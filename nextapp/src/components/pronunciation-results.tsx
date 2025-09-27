"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts"
import { Target, Lightbulb, Volume2, Brain, CheckCircle } from "lucide-react"
import type { SpeechAnalysisResult } from "@/lib/speech-analysis"
import { getPhonemeInfo, getDifficultyColor } from "@/lib/speech-analysis"
import { AIPhraseGeneratorCard } from "@/components/ai-phrase-generator-card"

interface PronunciationResultsProps {
  results: SpeechAnalysisResult
  sentence: string
  language: string
  onNewPhraseSelect?: (phrase: string) => void
}

export function PronunciationResults({ results, sentence, language, onNewPhraseSelect }: PronunciationResultsProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-500"
    if (score >= 75) return "text-yellow-500"
    return "text-red-500"
  }

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 90) return "default"
    if (score >= 75) return "secondary"
    return "destructive"
  }

  const radarData = [
    { subject: "Accuracy", score: results.accuracy, fullMark: 100 },
    { subject: "Fluency", score: results.fluency, fullMark: 100 },
    { subject: "Completeness", score: results.completeness, fullMark: 100 },
    { subject: "Confidence", score: Math.round(results.confidence * 100), fullMark: 100 },
  ]

  const phonemeData = results.weakPhonemes
    .map((phoneme) => {
      const info = getPhonemeInfo(phoneme, language)
      return {
        phoneme,
        difficulty: (info as any)?.difficulty || 5,
        name: (info as any)?.name || phoneme,
        examples: (info as any)?.examples || [],
      }
    })
    .sort((a, b) => b.difficulty - a.difficulty)

  return (
    <div className="space-y-6">
      {/* Overall Score with Enhanced Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Overall Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="text-4xl font-bold text-primary">{results.overallScore}%</div>
              <Badge variant={getScoreBadgeVariant(results.overallScore)} className="text-lg px-3 py-1">
                {results.overallScore >= 90 ? "Excellent" : results.overallScore >= 75 ? "Good" : "Needs Practice"}
              </Badge>
            </div>
            <Progress value={results.overallScore} className="h-3 mb-4" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Brain className="w-4 h-4" />
              <span>Confidence: {Math.round(results.confidence * 100)}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Performance Radar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="var(--color-primary)"
                    fill="var(--color-primary)"
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Accuracy</p>
                <p className="text-2xl font-bold">{results.accuracy}%</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Fluency</p>
                <p className="text-2xl font-bold">{results.fluency}%</p>
              </div>
              <Volume2 className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completeness</p>
                <p className="text-2xl font-bold">{results.completeness}%</p>
              </div>
              <Target className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Word-by-Word Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Word-by-Word Analysis</CardTitle>
          <CardDescription>Individual pronunciation accuracy for each word</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {results.words.map((wordData, index) => (
              <div
                key={index}
                className="flex flex-col items-center p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <span className="text-sm font-medium mb-1">{wordData.word}</span>
                <span className={`text-lg font-bold ${getScoreColor(wordData.score)}`}>
                  {Math.round(wordData.score)}%
                </span>
                <div className="w-16 mt-1">
                  <Progress value={wordData.score} className="h-1" />
                </div>
                {wordData.issues.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground text-center">{wordData.issues[0]}</div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Phoneme Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Phoneme Difficulty Analysis</CardTitle>
          <CardDescription>Sounds that need more practice, ranked by difficulty</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {phonemeData.map((phoneme, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-mono font-bold">/{phoneme.phoneme}/</div>
                  <div>
                    <p className="font-medium">{phoneme.name}</p>
                    <p className="text-sm text-muted-foreground">Examples: {phoneme.examples.slice(0, 3).join(", ")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${getDifficultyColor(phoneme.difficulty)}`}>{phoneme.difficulty}/10</span>
                  <div className="w-20">
                    <Progress value={phoneme.difficulty * 10} className="h-2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI-Powered Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            Personalized Suggestions
          </CardTitle>
          <CardDescription>AI-powered recommendations based on your pronunciation analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {results.suggestions.map((suggestion, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium mt-0.5">
                  {index + 1}
                </div>
                <p className="text-sm leading-relaxed">{suggestion}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AIPhraseGeneratorCard
        language={language}
        weakPhonemes={results.weakPhonemes}
        currentScore={results.overallScore}
        onPhraseSelect={onNewPhraseSelect || (() => {})}
      />
    </div>
  )
}
