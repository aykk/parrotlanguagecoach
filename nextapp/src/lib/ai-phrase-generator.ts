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

export class AIPhraseGenerator {
  private usedSentences: Set<string> = new Set()

  async generateTargetedPhrases(request: PhraseGenerationRequest): Promise<PhraseGenerationResult> {
    try {
      console.log(
        "Generating AI phrases with complexity:",
        request.difficultyLevel,
        "for language:",
        request.language,
      )

      const response = await fetch('/api/generate-phrases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error(`API error: ${response.status} - ${errorData.error}`)
        throw new Error(`API error: ${response.status} ${errorData.error}`)
      }

      const result = await response.json()
      console.log("API response received successfully")

      // Track used sentences to avoid duplicates
      result.phrases.forEach((phrase: GeneratedPhrase) => {
        if (phrase.text) {
          this.usedSentences.add(phrase.text)
        }
      })

      return result
    } catch (error) {
      console.error("Failed to generate AI phrases:", error)
      return this.getApiKeyInvalidResult()
    }
  }

  private getApiKeyInvalidResult(): PhraseGenerationResult {
    return {
      phrases: [
        {
          text: "API key is invalid or not configured. Please check your environment variables.",
          targetPhonemes: [],
          difficulty: 1,
          explanation: "This is a fallback message when the API key is not working.",
          tips: ["Check your API key configuration", "Verify the environment variables", "Contact support if the issue persists"],
        },
      ],
      focusPhonemes: [],
      practiceStrategy: "Please fix the API configuration to get personalized practice phrases.",
      estimatedPracticeTime: 0,
    }
  }

  private calculateConsistency(scores: number[]): number {
    if (scores.length === 0) return 0

    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length
    const standardDeviation = Math.sqrt(variance)

    return Math.max(0, 1 - standardDeviation / 50)
  }
}

export const aiPhraseGenerator = new AIPhraseGenerator()