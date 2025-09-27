"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Sparkles, Target, Clock, Lightbulb } from "lucide-react"
import { aiPhraseGenerator, type PhraseGenerationResult, type GeneratedPhrase } from "@/lib/ai-phrase-generator"

interface AIPhraseGeneratorCardProps {
  language: string
  weakPhonemes: string[]
  currentScore: number
  onPhraseSelect: (phrase: string) => void
}

export function AIPhraseGeneratorCard({
  language,
  weakPhonemes,
  currentScore,
  onPhraseSelect,
}: AIPhraseGeneratorCardProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedResult, setGeneratedResult] = useState<PhraseGenerationResult | null>(null)
  const [selectedPhrase, setSelectedPhrase] = useState<GeneratedPhrase | null>(null)

  const handleGeneratePhrases = async () => {
    if (weakPhonemes.length === 0) return

    setIsGenerating(true)
    try {
      const difficultyLevel = currentScore > 85 ? "advanced" : currentScore > 70 ? "intermediate" : "beginner"

      const result = await aiPhraseGenerator.generateTargetedPhrases({
        language,
        weakPhonemes,
        difficultyLevel,
        currentScore,
        focusAreas: ["pronunciation", "fluency"],
      })

      setGeneratedResult(result)
    } catch (error) {
      console.error("Failed to generate phrases:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handlePhraseClick = (phrase: GeneratedPhrase) => {
    setSelectedPhrase(phrase)
    onPhraseSelect(phrase.text)
  }

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 3) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
    if (difficulty <= 6) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
  }

  const getDifficultyLabel = (difficulty: number) => {
    if (difficulty <= 3) return "Easy"
    if (difficulty <= 6) return "Medium"
    return "Hard"
  }

  if (weakPhonemes.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-32 text-center">
          <Target className="w-12 h-12 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Complete a practice session to get AI-generated phrases</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI-Powered Practice Phrases
          </CardTitle>
          <CardDescription>
            Get personalized sentences targeting your weak phonemes: {weakPhonemes.map((p) => `/${p}/`).join(", ")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleGeneratePhrases} disabled={isGenerating} className="w-full">
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Phrases...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Practice Phrases
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {generatedResult && (
        <div className="space-y-4">
          {/* Practice Strategy */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="w-5 h-5" />
                Practice Strategy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed mb-4">{generatedResult.practiceStrategy}</p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>~{generatedResult.estimatedPracticeTime} minutes</span>
                </div>
                <div className="flex items-center gap-1">
                  <Target className="w-4 h-4" />
                  <span>Focus: {generatedResult.focusPhonemes.map((p) => `/${p}/`).join(", ")}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Generated Phrases */}
          <div className="space-y-3">
            {generatedResult.phrases.map((phrase, index) => (
              <Card
                key={index}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedPhrase?.text === phrase.text ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => handlePhraseClick(phrase)}
              >
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {/* Phrase Text */}
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-lg font-medium leading-relaxed flex-1">"{phrase.text}"</p>
                      <Badge className={getDifficultyColor(phrase.difficulty)}>
                        {getDifficultyLabel(phrase.difficulty)}
                      </Badge>
                    </div>

                    {/* Target Phonemes */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">Targets:</span>
                      <div className="flex gap-1">
                        {phrase.targetPhonemes.map((phoneme, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            /{phoneme}/
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Explanation */}
                    <p className="text-sm text-muted-foreground">{phrase.explanation}</p>

                    {/* Tips */}
                    {phrase.tips.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          <Lightbulb className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm font-medium">Tips:</span>
                        </div>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-5">
                          {phrase.tips.map((tip, i) => (
                            <li key={i} className="list-disc">
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedPhrase && (
            <Card className="border-primary">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">Selected for Practice</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  This phrase is now loaded in the practice area above. Click record when you're ready!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
