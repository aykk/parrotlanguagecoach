import { NextRequest, NextResponse } from 'next/server'

export interface PhraseGenerationRequest {
  language: string
  weakPhonemes: string[]
  difficultyLevel: "beginner" | "intermediate" | "advanced"
  currentScore: number
  focusAreas?: string[]
}

export interface GeneratedPhrase {
  text: string
  targetPhonemes: string[]
  difficulty: number
  explanation: string
  tips: string[]
}

export interface PhraseGenerationResult {
  phrases: GeneratedPhrase[]
  focusPhonemes: string[]
  practiceStrategy: string
  estimatedPracticeTime: number
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    
    if (!apiKey) {
      console.error("GEMINI_API_KEY environment variable is not set")
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      )
    }

    const body: PhraseGenerationRequest = await request.json()
    const { language, weakPhonemes, difficultyLevel, currentScore, focusAreas } = body

    const prompt = buildPrompt(body)
    const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

    console.log(
      "Generating AI phrases with complexity:",
      difficultyLevel,
      "for language:",
      language,
    )

    const response = await fetch(`${apiUrl}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.9,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 500,
          thinkingConfig: {
            thinkingBudget: 0
          }
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Gemini API error: ${response.status} - ${errorText}`)
      return NextResponse.json(
        { error: `Gemini API error: ${response.status} ${response.statusText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log("Gemini API response received successfully")
    console.log("Response structure:", JSON.stringify(data, null, 2))

    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
      const text = data.candidates[0].content.parts[0].text
      console.log("Extracted text:", text)
      const result = parseResponse(text, body)
      return NextResponse.json(result)
    } else if (data.candidates && data.candidates[0] && data.candidates[0].finishReason === "MAX_TOKENS") {
      console.log("Response was truncated due to token limit. Adjusting prompt...")
      // Return a simpler fallback response for token limit issues
      return NextResponse.json({
        phrases: [{
          text: "The red car runs fast.",
          targetPhonemes: body.weakPhonemes,
          difficulty: 3,
          explanation: "This is a simple practice sentence focusing on the target sounds.",
          tips: ["Focus on the 'r' sound in 'red' and 'runs'", "Practice the 'th' sound if present", "Speak clearly and slowly"]
        }],
        focusPhonemes: body.weakPhonemes,
        practiceStrategy: "Practice this sentence focusing on the target sounds.",
        estimatedPracticeTime: 10
      })
    } else {
      console.error("Invalid response structure:", JSON.stringify(data, null, 2))
      // Return a fallback response instead of error
      return NextResponse.json({
        phrases: [{
          text: "I'm sorry, I couldn't generate phrases at the moment. Please try again.",
          targetPhonemes: [],
          difficulty: 1,
          explanation: "This is a fallback message when the API response format is unexpected.",
          tips: ["Try again in a moment", "Check your internet connection", "Contact support if the issue persists"]
        }],
        focusPhonemes: body.weakPhonemes,
        practiceStrategy: "Please try generating phrases again.",
        estimatedPracticeTime: 15
      })
    }
  } catch (error) {
    console.error("Failed to generate phrases:", error)
    return NextResponse.json(
      { error: "Failed to generate phrases" },
      { status: 500 }
    )
  }
}

function getDifficultyDescription(level: number): string {
  if (level <= 2) return "EXTREMELY EASY: 2-3 simple words only (cat, dog, red car)"
  if (level <= 4) return "VERY EASY: 3-4 words, basic vocabulary (big red car, small dog runs)"
  if (level <= 6) return "EASY: 4-6 words, common words (The big red car runs fast)"
  if (level <= 8) return "MODERATE: 6-8 words, some longer words (The beautiful red car drives through the city)"
  return "HARD: 8+ words, complex vocabulary, longer sentences (The magnificent red automobile accelerates through the bustling metropolitan area)"
}

function buildPrompt(request: PhraseGenerationRequest): string {
  const { language, weakPhonemes, difficultyLevel, currentScore, focusAreas } = request

  const phonemeList = weakPhonemes.join(", ")
  // Map difficulty level to numeric complexity
  const complexityMap = { beginner: 2, intermediate: 5, advanced: 8 }
  const complexityLevel = complexityMap[difficultyLevel] || 5
  const difficultyDescription = getDifficultyDescription(complexityLevel)
  
  return `Generate 3 practice sentences in ${language}. Target phonemes: ${phonemeList}.

DIFFICULTY LEVEL ${complexityLevel}/10: ${difficultyDescription}

Requirements:
- Include target phonemes: ${phonemeList}
- Make sentences natural and appropriate for level ${complexityLevel}
- Focus on pronunciation practice

Format as JSON:
{
  "phrases": [
    {
      "text": "sentence here",
      "targetPhonemes": ["phoneme1", "phoneme2"],
      "difficulty": ${complexityLevel},
      "explanation": "why this helps",
      "tips": ["tip1", "tip2"]
    }
  ],
  "focusPhonemes": ["${phonemeList.split(", ").join('", "')}"],
  "practiceStrategy": "Practice these sentences focusing on the target sounds.",
  "estimatedPracticeTime": 15
}`
}

function parseResponse(response: string, request: PhraseGenerationRequest): PhraseGenerationResult {
  try {
    console.log("Parsing Gemini response for", request.difficultyLevel, "level")

    // Clean the response - remove markdown code blocks if present
    let cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    
    // Try to extract individual phrases from the response using regex
    const phraseMatches = cleanResponse.match(/"text":\s*"([^"]+)"/g)
    const targetPhonemesMatches = cleanResponse.match(/"targetPhonemes":\s*\[([^\]]+)\]/g)
    const difficultyMatches = cleanResponse.match(/"difficulty":\s*(\d+)/g)
    const explanationMatches = cleanResponse.match(/"explanation":\s*"([^"]+)"/g)
    const tipsMatches = cleanResponse.match(/"tips":\s*\[([^\]]+)\]/g)

    if (phraseMatches && phraseMatches.length > 0) {
      const phrases = phraseMatches.map((match, index) => {
        const text = match.match(/"text":\s*"([^"]+)"/)?.[1] || ""
        const targetPhonemes = targetPhonemesMatches?.[index]?.match(/"([^"]+)"/g)?.map(t => t.replace(/"/g, '')) || request.weakPhonemes
        const difficulty = difficultyMatches?.[index]?.match(/"difficulty":\s*(\d+)/)?.[1] || "5"
        const explanation = explanationMatches?.[index]?.match(/"explanation":\s*"([^"]+)"/)?.[1] || "Practice this sentence focusing on the target sounds."
        const tips = tipsMatches?.[index]?.match(/"([^"]+)"/g)?.map(t => t.replace(/"/g, '')) || ["Focus on the target sounds", "Speak clearly and slowly"]

        return {
          text,
          targetPhonemes,
          difficulty: parseInt(difficulty),
          explanation,
          tips
        }
      }).filter(phrase => phrase.text.length > 0)

      if (phrases.length > 0) {
        console.log("Successfully extracted", phrases.length, "phrases from response")
        return {
          phrases,
          focusPhonemes: request.weakPhonemes,
          practiceStrategy: "Practice these sentences focusing on the target sounds.",
          estimatedPracticeTime: 15,
        }
      }
    }

    // Fallback: try to parse as JSON
    const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      let jsonStr = jsonMatch[0]
      
      // If the JSON is truncated, try to fix it by adding missing closing brackets
      if (!jsonStr.endsWith('}')) {
        const openBraces = (jsonStr.match(/\{/g) || []).length
        const closeBraces = (jsonStr.match(/\}/g) || []).length
        const missingBraces = openBraces - closeBraces
        
        for (let i = 0; i < missingBraces; i++) {
          jsonStr += '}'
        }
      }

      const parsed = JSON.parse(jsonStr)
      if (parsed.phrases && Array.isArray(parsed.phrases)) {
        return {
          phrases: parsed.phrases.map((phrase: any) => ({
            text: phrase.text || "",
            targetPhonemes: phrase.targetPhonemes || [],
            difficulty: phrase.difficulty || 5,
            explanation: phrase.explanation || "",
            tips: phrase.tips || [],
          })),
          focusPhonemes: parsed.focusPhonemes || request.weakPhonemes,
          practiceStrategy: parsed.practiceStrategy || "Practice these sentences focusing on the target sounds.",
          estimatedPracticeTime: parsed.estimatedPracticeTime || 15,
        }
      }
    }

    throw new Error("No valid phrases found in response")
  } catch (error) {
    console.error("Failed to parse AI response:", error)
    return {
      phrases: [],
      focusPhonemes: request.weakPhonemes,
      practiceStrategy: "Unable to generate phrases. Please try again.",
      estimatedPracticeTime: 15,
    }
  }
}
