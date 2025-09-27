"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Globe, Star, TrendingUp } from "lucide-react"
import { getLanguageList, getLanguageConfig } from "@/lib/language-config"

interface LanguageSelectorProps {
  selectedLanguage: string
  onLanguageChange: (language: string) => void
  className?: string
}

export function LanguageSelector({ selectedLanguage, onLanguageChange, className }: LanguageSelectorProps) {
  const [showAll, setShowAll] = useState(false)
  const languages = getLanguageList()
  const popularLanguages = ["english", "spanish", "french", "german", "italian"]

  const displayLanguages = showAll ? languages : languages.filter((lang) => popularLanguages.includes(lang.code))

  const getDifficultyColor = (complexity: number) => {
    if (complexity >= 8) return "text-red-500 bg-red-50"
    if (complexity >= 6) return "text-orange-500 bg-orange-50"
    if (complexity >= 4) return "text-yellow-600 bg-yellow-50"
    return "text-green-600 bg-green-50"
  }

  const getDifficultyLabel = (complexity: number) => {
    if (complexity >= 8) return "Expert"
    if (complexity >= 6) return "Advanced"
    if (complexity >= 4) return "Intermediate"
    return "Beginner"
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-6 h-6 text-primary" />
          Choose Your Language
        </CardTitle>
        <CardDescription>Select from {languages.length} supported languages for pronunciation practice</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayLanguages.map((lang) => {
            const config = getLanguageConfig(lang.code)
            const isSelected = selectedLanguage === lang.code
            const isPopular = popularLanguages.includes(lang.code)

            return (
              <Button
                key={lang.code}
                variant={isSelected ? "default" : "outline"}
                className={`h-auto p-4 justify-start ${isSelected ? "ring-2 ring-primary" : ""}`}
                onClick={() => onLanguageChange(lang.code)}
              >
                <div className="flex items-start gap-3 w-full">
                  <span className="text-2xl">{lang.flag}</span>
                  <div className="flex-1 text-left space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{lang.name}</span>
                      {isPopular && <Star className="w-3 h-3 text-yellow-500 fill-current" />}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="secondary" className={`${getDifficultyColor(config.phonemeComplexity)} border-0`}>
                        {getDifficultyLabel(config.phonemeComplexity)}
                      </Badge>
                      <span className="text-muted-foreground">{config.commonDifficulties.length} sounds</span>
                    </div>
                  </div>
                </div>
              </Button>
            )
          })}
        </div>

        {!showAll && (
          <Button variant="ghost" onClick={() => setShowAll(true)} className="w-full">
            <TrendingUp className="w-4 h-4 mr-2" />
            Show All {languages.length} Languages
          </Button>
        )}

        {showAll && (
          <Button variant="ghost" onClick={() => setShowAll(false)} className="w-full">
            Show Popular Languages Only
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
