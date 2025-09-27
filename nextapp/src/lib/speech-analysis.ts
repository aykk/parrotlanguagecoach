export interface PhonemeData {
  symbol: string
  name: string
  difficulty: number
  examples: string[]
}

export interface WordAnalysis {
  word: string
  score: number
  phonemes: string[]
  issues: string[]
  confidence: number
}

export interface SpeechAnalysisResult {
  overallScore: number
  accuracy: number
  fluency: number
  completeness: number
  words: WordAnalysis[]
  weakPhonemes: string[]
  suggestions: string[]
  detectedLanguage: string
  confidence: number
}

// Phoneme mapping for different languages
const PHONEME_MAPS = {
  english: {
    θ: { name: "voiceless th", difficulty: 8, examples: ["think", "three", "math"] },
    ð: { name: "voiced th", difficulty: 8, examples: ["the", "this", "mother"] },
    r: { name: "r sound", difficulty: 6, examples: ["red", "car", "very"] },
    l: { name: "l sound", difficulty: 5, examples: ["love", "call", "little"] },
    w: { name: "w sound", difficulty: 4, examples: ["water", "we", "away"] },
    v: { name: "v sound", difficulty: 5, examples: ["very", "have", "love"] },
    ʃ: { name: "sh sound", difficulty: 4, examples: ["she", "fish", "nation"] },
    ʒ: { name: "zh sound", difficulty: 6, examples: ["measure", "vision", "garage"] },
    tʃ: { name: "ch sound", difficulty: 3, examples: ["chair", "much", "nature"] },
    dʒ: { name: "j sound", difficulty: 3, examples: ["jump", "age", "bridge"] },
  },
  spanish: {
    r: { name: "single r", difficulty: 7, examples: ["pero", "caro", "amor"] },
    rr: { name: "rolled r", difficulty: 9, examples: ["perro", "carro", "arroz"] },
    ñ: { name: "ñ sound", difficulty: 5, examples: ["niño", "año", "señor"] },
    x: { name: "j sound", difficulty: 6, examples: ["joven", "rojo", "mejor"] },
    β: { name: "soft b", difficulty: 4, examples: ["haber", "saber", "Cuba"] },
    θ: { name: "c/z sound", difficulty: 6, examples: ["cinco", "luz", "hacer"] },
    ʎ: { name: "ll sound", difficulty: 5, examples: ["llamar", "calle", "pollo"] },
  },
  french: {
    r: { name: "uvular r", difficulty: 8, examples: ["rouge", "Paris", "très"] },
    y: { name: "u sound", difficulty: 7, examples: ["tu", "rue", "plus"] },
    œ: { name: "eu sound", difficulty: 6, examples: ["peur", "sœur", "bœuf"] },
    ɛ̃: { name: "in sound", difficulty: 5, examples: ["vin", "pain", "main"] },
    ɔ̃: { name: "on sound", difficulty: 5, examples: ["bon", "son", "mon"] },
    ɑ̃: { name: "an sound", difficulty: 5, examples: ["dans", "grand", "blanc"] },
    ʒ: { name: "j sound", difficulty: 4, examples: ["je", "rouge", "âge"] },
    ɲ: { name: "gn sound", difficulty: 5, examples: ["agneau", "ligne", "montagne"] },
  },
  german: {
    x: { name: "ach sound", difficulty: 8, examples: ["ach", "Bach", "Nacht"] },
    ç: { name: "ich sound", difficulty: 8, examples: ["ich", "nicht", "möchte"] },
    ʁ: { name: "r sound", difficulty: 7, examples: ["rot", "Herr", "sehr"] },
    ʏ: { name: "ü sound", difficulty: 6, examples: ["über", "für", "Tür"] },
    œ: { name: "ö sound", difficulty: 6, examples: ["hören", "können", "schön"] },
    ɛː: { name: "ä sound", difficulty: 5, examples: ["spät", "Käse", "Mädchen"] },
    pf: { name: "pf sound", difficulty: 7, examples: ["Pferd", "Kopf", "Apfel"] },
    ts: { name: "z sound", difficulty: 5, examples: ["Zeit", "Katze", "Platz"] },
  },
  italian: {
    r: { name: "rolled r", difficulty: 8, examples: ["rosso", "carro", "terra"] },
    ʎ: { name: "gli sound", difficulty: 6, examples: ["figlio", "moglie", "foglia"] },
    ɲ: { name: "gn sound", difficulty: 5, examples: ["gnocchi", "bagno", "sogno"] },
    ts: { name: "z sound", difficulty: 4, examples: ["pizza", "grazie", "marzo"] },
    dz: { name: "z sound", difficulty: 4, examples: ["zero", "pranzo", "mezzo"] },
    ʃ: { name: "sc sound", difficulty: 4, examples: ["pesce", "uscire", "scienza"] },
  },
  portuguese: {
    r: { name: "r sound", difficulty: 7, examples: ["rato", "carro", "mar"] },
    ʁ: { name: "rr sound", difficulty: 8, examples: ["carro", "terra", "ferro"] },
    ʎ: { name: "lh sound", difficulty: 6, examples: ["filho", "mulher", "olho"] },
    ɲ: { name: "nh sound", difficulty: 5, examples: ["ninho", "sonho", "anha"] },
    ũ: { name: "ão sound", difficulty: 6, examples: ["não", "mão", "pão"] },
    ĩ: { name: "ão sound", difficulty: 5, examples: ["sim", "fim", "jardim"] },
    ʒ: { name: "j sound", difficulty: 4, examples: ["já", "hoje", "viagem"] },
  },
  japanese: {
    r: { name: "r sound", difficulty: 8, examples: ["ramen", "arigato", "kore"] },
    f: { name: "f sound", difficulty: 6, examples: ["fuji", "fuku", "fune"] },
    ts: { name: "tsu sound", difficulty: 5, examples: ["tsunami", "natsu", "katsu"] },
    ʃ: { name: "shi sound", difficulty: 4, examples: ["sushi", "shiro", "ashi"] },
    tʃ: { name: "chi sound", difficulty: 4, examples: ["chichi", "mochi", "uchi"] },
    dʒ: { name: "ji sound", difficulty: 4, examples: ["jikan", "moji", "fuji"] },
  },
  mandarin: {
    x: { name: "x sound", difficulty: 8, examples: ["xiexie", "xiao", "xin"] },
    q: { name: "q sound", difficulty: 9, examples: ["qing", "qi", "qian"] },
    zh: { name: "zh sound", difficulty: 7, examples: ["zhong", "zhi", "zhao"] },
    ch: { name: "ch sound", difficulty: 7, examples: ["chang", "chi", "cheng"] },
    sh: { name: "sh sound", difficulty: 6, examples: ["shang", "shi", "shui"] },
    r: { name: "r sound", difficulty: 8, examples: ["ren", "ri", "rang"] },
  },
  arabic: {
    ʕ: { name: "ain sound", difficulty: 9, examples: ["عين", "عرب", "معا"] },
    ħ: { name: "ha sound", difficulty: 8, examples: ["حب", "صحيح", "مرحبا"] },
    χ: { name: "kha sound", difficulty: 8, examples: ["خير", "أخ", "تاريخ"] },
    ɣ: { name: "ghain sound", difficulty: 8, examples: ["غد", "بلاغ", "مغرب"] },
    q: { name: "qaf sound", difficulty: 7, examples: ["قلب", "حق", "وقت"] },
    ʔ: { name: "hamza sound", difficulty: 6, examples: ["أب", "سؤال", "مؤمن"] },
  },
  russian: {
    r: { name: "rolled r", difficulty: 8, examples: ["рука", "дорога", "мир"] },
    ʲ: { name: "soft consonant", difficulty: 7, examples: ["тень", "день", "семь"] },
    x: { name: "kh sound", difficulty: 6, examples: ["хорошо", "хлеб", "тихо"] },
    ʃ: { name: "sh sound", difficulty: 4, examples: ["школа", "машина", "наш"] },
    ʒ: { name: "zh sound", difficulty: 5, examples: ["жить", "можно", "уже"] },
    ts: { name: "ts sound", difficulty: 5, examples: ["цвет", "отец", "конец"] },
  },
}

// Mock speech recognition - in production, integrate with Web Speech API or cloud services
export class SpeechAnalyzer {
  private language: string
  private targetText: string

  constructor(language = "english") {
    this.language = language
    this.targetText = ""
  }

  setTargetText(text: string) {
    this.targetText = text.toLowerCase()
  }

  async analyzeAudio(audioBlob: Blob): Promise<SpeechAnalysisResult> {
    console.log("[v0] Starting speech analysis...")
    console.log("[v0] Audio blob size:", audioBlob.size)
    console.log("[v0] Target text:", this.targetText)

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const transcription = this.simulateRealisticTranscription(audioBlob)
    console.log("[v0] Simulated transcription:", transcription)

    // Analyze pronunciation
    const result = this.analyzePronunciation(transcription)
    console.log("[v0] Analysis result:", result)

    return result
  }

  private simulateRealisticTranscription(audioBlob: Blob): string {
    // Simulate speech recognition based on audio characteristics
    const audioSize = audioBlob.size
    const targetWords = this.targetText.split(" ")

    // If audio is too small, assume poor recording or silence
    if (audioSize < 10000) {
      console.log("[v0] Audio too small, simulating poor transcription")
      return this.generatePoorTranscription(targetWords)
    }

    // Simulate varying quality based on audio size and duration
    const qualityFactor = Math.min(1, audioSize / 50000) // Normalize based on expected size
    console.log("[v0] Quality factor:", qualityFactor)

    return targetWords
      .map((word) => {
        const errorChance = (1 - qualityFactor) * 0.6 + Math.random() * 0.3
        console.log("[v0] Error chance for", word, ":", errorChance)

        if (errorChance > 0.4) {
          return this.introduceRealisticError(word)
        }
        return word
      })
      .join(" ")
  }

  private generatePoorTranscription(targetWords: string[]): string {
    return targetWords
      .map((word) => {
        // High chance of errors for poor audio
        if (Math.random() < 0.7) {
          return this.introduceRealisticError(word)
        }
        return word
      })
      .join(" ")
  }

  private introduceRealisticError(word: string): string {
    const commonErrors = {
      // TH sounds
      the: ["ze", "da", "de"],
      think: ["sink", "tink", "fink"],
      three: ["tree", "free", "sree"],
      this: ["dis", "zis", "tis"],

      // R sounds
      red: ["wed", "led", "ded"],
      very: ["wery", "vely", "bery"],
      water: ["vater", "wata", "vata"],

      // V/W confusion
      very: ["wery", "bery"],
      water: ["vater", "wata"],

      // L sounds
      love: ["rove", "lobe", "lub"],
      little: ["rittle", "litter", "littel"],

      // Common mispronunciations
      pronunciation: ["pronunciashun", "pronunsiation", "pronuncation"],
      comfortable: ["comftable", "comfterble", "comfortible"],

      // Consonant clusters
      street: ["stweet", "steet", "streat"],
      strong: ["stwong", "stong", "strung"],
    }

    const errors = commonErrors[word as keyof typeof commonErrors]
    if (errors) {
      return errors[Math.floor(Math.random() * errors.length)]
    }

    // Generic error patterns
    if (word.includes("th")) {
      return word.replace("th", Math.random() < 0.5 ? "z" : "d")
    }
    if (word.startsWith("r")) {
      return "w" + word.slice(1)
    }
    if (word.includes("v")) {
      return word.replace("v", "w")
    }

    return word
  }

  private analyzePronunciation(transcription: string): SpeechAnalysisResult {
    const targetWords = this.targetText.split(" ")
    const spokenWords = transcription.split(" ")
    console.log("[v0] Analyzing:", targetWords, "vs", spokenWords)

    const wordAnalyses: WordAnalysis[] = targetWords.map((targetWord, index) => {
      const spokenWord = spokenWords[index] || ""
      const similarity = this.calculateSimilarity(targetWord, spokenWord)
      const phonemes = this.extractPhonemes(targetWord)

      const baseScore = similarity * 100
      const finalScore = Math.max(0, Math.min(100, baseScore))

      console.log("[v0] Word analysis:", targetWord, "->", spokenWord, "similarity:", similarity, "score:", finalScore)

      return {
        word: targetWord,
        score: Math.round(finalScore),
        phonemes,
        issues: this.identifyIssues(targetWord, spokenWord),
        confidence: similarity > 0.8 ? 0.9 : similarity > 0.5 ? 0.7 : 0.4,
      }
    })

    const overallScore = wordAnalyses.reduce((sum, w) => sum + w.score, 0) / wordAnalyses.length
    const weakPhonemes = this.identifyWeakPhonemes(wordAnalyses)
    const suggestions = this.generateSuggestions(weakPhonemes, wordAnalyses)

    const completenessScore =
      spokenWords.length >= targetWords.length ? 100 : Math.round((spokenWords.length / targetWords.length) * 100)
    const accuracyScore = Math.round(overallScore)
    const fluencyScore = Math.round(overallScore * 0.95) // Slightly lower than accuracy

    const result = {
      overallScore: Math.round(overallScore),
      accuracy: accuracyScore,
      fluency: fluencyScore,
      completeness: completenessScore,
      words: wordAnalyses,
      weakPhonemes,
      suggestions,
      detectedLanguage: this.language,
      confidence: overallScore > 80 ? 0.9 : overallScore > 60 ? 0.7 : 0.5,
    }

    console.log("[v0] Final analysis result:", result)
    return result
  }

  private calculateSimilarity(target: string, spoken: string): number {
    if (target === spoken) return 1

    const maxLength = Math.max(target.length, spoken.length)
    const distance = this.levenshteinDistance(target, spoken)
    return Math.max(0, (maxLength - distance) / maxLength)
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null))

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator)
      }
    }

    return matrix[str2.length][str1.length]
  }

  private extractPhonemes(word: string): string[] {
    // Simplified phoneme extraction - in production, use proper phonetic dictionaries
    const phonemeMap = PHONEME_MAPS[this.language as keyof typeof PHONEME_MAPS] || PHONEME_MAPS.english
    const phonemes: string[] = []

    // Basic pattern matching for common phonemes
    if (word.includes("th")) phonemes.push("θ", "ð")
    if (word.includes("sh")) phonemes.push("ʃ")
    if (word.includes("ch")) phonemes.push("tʃ")
    if (word.includes("r")) phonemes.push("r")
    if (word.includes("l")) phonemes.push("l")
    if (word.includes("w")) phonemes.push("w")
    if (word.includes("v")) phonemes.push("v")

    return phonemes
  }

  private identifyIssues(target: string, spoken: string): string[] {
    const issues: string[] = []

    if (target !== spoken) {
      if (target.includes("th") && !spoken.includes("th")) {
        issues.push("TH sound substitution")
      }
      if (target.includes("r") && spoken.includes("w")) {
        issues.push("R-W confusion")
      }
      if (target.includes("v") && spoken.includes("w")) {
        issues.push("V-W confusion")
      }
    }

    return issues
  }

  private identifyWeakPhonemes(wordAnalyses: WordAnalysis[]): string[] {
    const phonemeScores: { [key: string]: number[] } = {}

    wordAnalyses.forEach((analysis) => {
      analysis.phonemes.forEach((phoneme) => {
        if (!phonemeScores[phoneme]) phonemeScores[phoneme] = []
        phonemeScores[phoneme].push(analysis.score)
      })
    })

    const weakPhonemes = Object.entries(phonemeScores)
      .map(([phoneme, scores]) => ({
        phoneme,
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      }))
      .filter((p) => p.avgScore < 75)
      .sort((a, b) => a.avgScore - b.avgScore)
      .slice(0, 5)
      .map((p) => p.phoneme)

    return weakPhonemes
  }

  private generateSuggestions(weakPhonemes: string[], wordAnalyses: WordAnalysis[]): string[] {
    const suggestions: string[] = []
    const phonemeMap = PHONEME_MAPS[this.language as keyof typeof PHONEME_MAPS] || PHONEME_MAPS.english

    weakPhonemes.forEach((phoneme) => {
      const phonemeInfo = phonemeMap[phoneme as keyof typeof phonemeMap]
      if (phonemeInfo) {
        suggestions.push(`Practice the ${phonemeInfo.name} sound with words like: ${phonemeInfo.examples.join(", ")}`)
      }
    })

    // Add general suggestions based on overall performance
    const avgScore = wordAnalyses.reduce((sum, w) => sum + w.score, 0) / wordAnalyses.length

    if (avgScore < 70) {
      suggestions.push("Focus on speaking more slowly and clearly")
      suggestions.push("Practice individual sounds before attempting full sentences")
    } else if (avgScore < 85) {
      suggestions.push("Work on connecting sounds smoothly between words")
      suggestions.push("Pay attention to word stress and rhythm")
    }

    return suggestions.slice(0, 4) // Limit to 4 suggestions
  }
}

// Utility functions for phonetic analysis
export function getPhonemeInfo(phoneme: string, language = "english") {
  const phonemeMap = PHONEME_MAPS[language as keyof typeof PHONEME_MAPS] || PHONEME_MAPS.english
  return phonemeMap[phoneme as keyof typeof phonemeMap]
}

export function getDifficultyColor(difficulty: number): string {
  if (difficulty >= 8) return "text-red-500"
  if (difficulty >= 6) return "text-orange-500"
  if (difficulty >= 4) return "text-yellow-500"
  return "text-green-500"
}
