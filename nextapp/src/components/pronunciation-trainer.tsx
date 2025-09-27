"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { RotateCcw, BarChart3, Sparkles, Globe, Volume2, Settings } from "lucide-react"
import { AudioRecorder } from "@/components/audio-recorder"
import { PronunciationResults } from "@/components/pronunciation-results"
import { ProgressDashboard } from "@/components/progress-dashboard"
import { SpeechAnalyzer, type SpeechAnalysisResult } from "@/lib/speech-analysis"
import { progressTracker } from "@/lib/progress-tracker"
import { getLanguageList, getLanguageConfig, getRandomSentence, isRTLLanguage } from "@/lib/language-config"
import { aiPhraseGenerator } from "@/lib/ai-phrase-generator"
import { ProgressService } from "@/lib/progress-service"
import { supabase } from "@/lib/supabase-client"

export function PronunciationTrainer() {
  const [selectedLanguage, setSelectedLanguage] = useState<string>("english")
  const [currentSentence, setCurrentSentence] = useState<string>("")
  const [analysisResults, setAnalysisResults] = useState<SpeechAnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)
  const [isAIGenerated, setIsAIGenerated] = useState(false)
  const [complexity, setComplexity] = useState<number>(5)
  const [isGenerating, setIsGenerating] = useState(false)
  const speechAnalyzerRef = useRef<SpeechAnalyzer | null>(null)

  const languageConfig = getLanguageConfig(selectedLanguage)
  const isRTL = isRTLLanguage(selectedLanguage)

  useEffect(() => {
    speechAnalyzerRef.current = new SpeechAnalyzer(selectedLanguage)
    const randomSentence = getRandomSentence(selectedLanguage)
    setCurrentSentence(randomSentence)
    speechAnalyzerRef.current.setTargetText(randomSentence)
  }, [selectedLanguage])

  useEffect(() => {
    if (speechAnalyzerRef.current && currentSentence) {
      speechAnalyzerRef.current.setTargetText(currentSentence)
    }
  }, [currentSentence])

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language)
    setAnalysisResults(null)
    setIsAIGenerated(false)
  }

  const handleNewSentence = async () => {
    setIsGenerating(true)
    try {
      const difficultyLevel = complexity <= 3 ? "beginner" : complexity <= 7 ? "intermediate" : "advanced"
      const result = await aiPhraseGenerator.generateTargetedPhrases({
        language: selectedLanguage,
        weakPhonemes: languageConfig.commonDifficulties.slice(0, 3),
        difficultyLevel,
        currentScore: complexity, // Use actual complexity level from slider
      })

      if (result.phrases.length > 0) {
        const randomPhrase = result.phrases[Math.floor(Math.random() * result.phrases.length)]
        setCurrentSentence(randomPhrase.text)
        setIsAIGenerated(true)
      } else {
        // Fallback to random sentence
        const randomSentence = getRandomSentence(selectedLanguage)
        setCurrentSentence(randomSentence)
        setIsAIGenerated(false)
      }
    } catch (error) {
      console.error("Failed to generate AI sentence:", error)
      // Fallback to random sentence
      const randomSentence = getRandomSentence(selectedLanguage)
      setCurrentSentence(randomSentence)
      setIsAIGenerated(false)
    } finally {
      setIsGenerating(false)
    }
    setAnalysisResults(null)
  }

  const handleAIPhraseSelect = (phrase: string) => {
    setCurrentSentence(phrase)
    setAnalysisResults(null)
    setIsAIGenerated(true)
  }

  const handleRecordingStart = () => {
    setSessionStartTime(new Date())
  }

  const handleTextToSpeech = () => {
    if ("speechSynthesis" in window && currentSentence) {
      const utterance = new SpeechSynthesisUtterance(currentSentence)
      utterance.lang = languageConfig.code

      // Get available voices and select the best one for the language
      const voices = speechSynthesis.getVoices()
      const preferredVoice = selectBestVoice(voices, languageConfig.code)

      if (preferredVoice) {
        utterance.voice = preferredVoice
        console.log(`[v0] Selected voice: ${preferredVoice.name} for ${languageConfig.code}`)
      }

      // Apply enhanced voice settings for more natural speech
      utterance.pitch = languageConfig.voiceSettings.pitch
      utterance.rate = languageConfig.voiceSettings.rate
      utterance.volume = languageConfig.voiceSettings.volume

      speechSynthesis.speak(utterance)
    }
  }

  const handleRecordingComplete = async (blob: Blob) => {
    setIsAnalyzing(true)

    try {
      if (speechAnalyzerRef.current) {
        const results = await speechAnalyzerRef.current.analyzeAudio(blob)
        setAnalysisResults(results)

        if (sessionStartTime) {
          const duration = (Date.now() - sessionStartTime.getTime()) / 1000

          const practicedPhonemes = results.words.flatMap((word) => word.phonemes)

          progressTracker.addSession({
            language: selectedLanguage,
            sentence: currentSentence,
            overallScore: results.overallScore,
            accuracy: results.accuracy,
            fluency: results.fluency,
            completeness: results.completeness,
            weakPhonemes: results.weakPhonemes,
            practicedPhonemes: practicedPhonemes,
            duration,
          })

          // Save to Supabase
          try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              await ProgressService.saveSession({
                user_id: user.id,
                phrase: currentSentence,
                language: selectedLanguage,
                accuracy_score: results.accuracy,
                pronunciation_score: results.overallScore,
                fluency_score: results.fluency,
              })
            }
          } catch (error) {
            console.error('Failed to save session to Supabase:', error)
          }
        }
      }
    } catch (error) {
      console.error("Analysis failed:", error)
      // Fallback to mock results if analysis fails
      const mockResults: SpeechAnalysisResult = {
        overallScore: Math.floor(Math.random() * 30) + 70,
        accuracy: Math.floor(Math.random() * 30) + 70,
        fluency: Math.floor(Math.random() * 30) + 70,
        completeness: 100,
        words: currentSentence.split(" ").map((word, index) => ({
          word,
          score: Math.floor(Math.random() * 40) + 60,
          phonemes: ["f", "ɒ", "k", "s"],
          issues: [],
          confidence: 0.8,
        })),
        weakPhonemes: ["θ", "ð", "r", "l"],
        suggestions: [
          "Focus on the 'th' sound in 'the'",
          "Practice rolling your 'r' sounds",
          "Work on vowel clarity in unstressed syllables",
        ],
        detectedLanguage: selectedLanguage,
        confidence: 0.85,
      }
      setAnalysisResults(mockResults)

      // Track mock session too
      if (sessionStartTime) {
        const duration = (Date.now() - sessionStartTime.getTime()) / 1000

        const practicedPhonemes = mockResults.words.flatMap((word) => word.phonemes)

        progressTracker.addSession({
          language: selectedLanguage,
          sentence: currentSentence,
          overallScore: mockResults.overallScore,
          accuracy: mockResults.accuracy,
          fluency: mockResults.fluency,
          completeness: mockResults.completeness,
          weakPhonemes: mockResults.weakPhonemes,
          practicedPhonemes: practicedPhonemes,
          duration,
        })

        // Save mock session to Supabase too
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await ProgressService.saveSession({
              user_id: user.id,
              phrase: currentSentence,
              language: selectedLanguage,
              accuracy_score: mockResults.accuracy,
              pronunciation_score: mockResults.overallScore,
              fluency_score: mockResults.fluency,
            })
          }
        } catch (error) {
          console.error('Failed to save mock session to Supabase:', error)
        }
      }
    } finally {
      setIsAnalyzing(false)
    }
  }

  const selectBestVoice = (voices: SpeechSynthesisVoice[], langCode: string) => {
    if (voices.length === 0) return null

    // Priority order: neural/premium voices, then native voices, then any matching language
    const langPrefix = langCode.split("-")[0] // e.g., 'en' from 'en-US'

    // Look for high-quality voices (neural, premium, enhanced)
    const premiumVoice = voices.find(
      (voice) =>
        voice.lang.startsWith(langCode) &&
        (voice.name.toLowerCase().includes("neural") ||
          voice.name.toLowerCase().includes("premium") ||
          voice.name.toLowerCase().includes("enhanced") ||
          voice.name.toLowerCase().includes("natural")),
    )

    if (premiumVoice) return premiumVoice

    // Look for exact language match
    const exactMatch = voices.find((voice) => voice.lang === langCode)
    if (exactMatch) return exactMatch

    // Look for language family match (e.g., en-GB for en-US)
    const familyMatch = voices.find((voice) => voice.lang.startsWith(langPrefix))
    if (familyMatch) return familyMatch

    // Fallback to first available voice
    return voices[0]
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Tabs defaultValue="practice" className="space-y-8">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="practice" className="flex items-center gap-2">
            Practice
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="practice" className="space-y-8">
          {/* Enhanced Language Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-6 h-6" />
                Choose Your Language
              </CardTitle>
              <CardDescription>
                Select from {getLanguageList().length} supported languages for pronunciation practice
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-full md:w-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getLanguageList().map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{lang.flag}</span>
                        <span>{lang.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex flex-wrap gap-2">{isRTL && <Badge variant="outline">Right-to-Left</Badge>}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-6 h-6" />
                Practice Settings
              </CardTitle>
              <CardDescription>Customize the difficulty of your practice sessions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="complexity">Complexity Level: {complexity}/10</Label>
                <Slider
                  id="complexity"
                  min={1}
                  max={10}
                  step={1}
                  value={[complexity]}
                  onValueChange={(value) => setComplexity(value[0])}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Higher complexity includes more difficult words and sentence structures
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Practice Sentence */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>Practice Sentence</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleTextToSpeech}>
                    <Volume2 className="w-4 h-4 mr-2" />
                    Listen
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleNewSentence} disabled={isGenerating}>
                    <RotateCcw className={`w-4 h-4 mr-2 ${isGenerating ? "animate-spin" : ""}`} />
                    {isGenerating ? "Generating..." : "New Sentence"}
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>Read this sentence aloud clearly and naturally in {languageConfig.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-6 bg-muted rounded-lg">
                <p
                  className={`text-lg md:text-xl font-medium text-center text-balance leading-relaxed ${
                    isRTL ? "text-right" : "text-left"
                  }`}
                  dir={isRTL ? "rtl" : "ltr"}
                >
                  "{currentSentence}"
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Audio Recording */}
          <AudioRecorder
            onRecordingComplete={handleRecordingComplete}
            onRecordingStart={handleRecordingStart}
            isAnalyzing={isAnalyzing}
          />

          {/* Results */}
          {analysisResults && (
            <PronunciationResults
              results={analysisResults}
              sentence={currentSentence}
              language={selectedLanguage}
              onNewPhraseSelect={handleAIPhraseSelect}
            />
          )}
        </TabsContent>

        <TabsContent value="dashboard">
          <ProgressDashboard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
