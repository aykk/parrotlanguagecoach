export interface SessionData {
  id: string
  timestamp: Date
  language: string
  sentence: string
  overallScore: number
  accuracy: number
  fluency: number
  completeness: number
  weakPhonemes: string[]
  practicedPhonemes: string[]
  duration: number // in seconds
}

export interface ProgressStats {
  totalSessions: number
  averageScore: number
  improvementRate: number
  strongestPhonemes: string[]
  weakestPhonemes: string[]
  languageBreakdown: { [key: string]: number }
  recentTrend: "improving" | "stable" | "declining"
  streakDays: number
}

export class ProgressTracker {
  private sessions: SessionData[] = []
  private readonly STORAGE_KEY = "pronunciation_progress"

  constructor() {
    this.loadFromStorage()
  }

  addSession(sessionData: Omit<SessionData, "id" | "timestamp">): SessionData {
    const session: SessionData = {
      ...sessionData,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    }

    this.sessions.push(session)
    this.saveToStorage()

    console.log("[v0] Session saved:", session)
    console.log("[v0] Total sessions now:", this.sessions.length)

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("progressUpdated"))
    }

    return session
  }

  getRecentSessions(limit = 10): SessionData[] {
    return this.sessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit)
  }

  getProgressStats(): ProgressStats {
    if (this.sessions.length === 0) {
      return {
        totalSessions: 0,
        averageScore: 0,
        improvementRate: 0,
        strongestPhonemes: [],
        weakestPhonemes: [],
        languageBreakdown: {},
        recentTrend: "stable",
        streakDays: 0,
      }
    }

    const totalSessions = this.sessions.length
    const averageScore = this.sessions.reduce((sum, s) => sum + s.overallScore, 0) / totalSessions

    // Calculate improvement rate (last 5 vs first 5 sessions)
    const recentSessions = this.sessions.slice(-5)
    const oldSessions = this.sessions.slice(0, 5)
    const recentAvg = recentSessions.reduce((sum, s) => sum + s.overallScore, 0) / recentSessions.length
    const oldAvg = oldSessions.reduce((sum, s) => sum + s.overallScore, 0) / oldSessions.length
    const improvementRate = totalSessions >= 10 ? ((recentAvg - oldAvg) / oldAvg) * 100 : 0

    const phonemePerformance: { [key: string]: { scores: number[]; count: number } } = {}

    this.sessions.forEach((session) => {
      const allPhonemes = session.practicedPhonemes || session.weakPhonemes || []
      allPhonemes.forEach((phoneme) => {
        if (!phonemePerformance[phoneme]) {
          phonemePerformance[phoneme] = { scores: [], count: 0 }
        }
        phonemePerformance[phoneme].scores.push(session.overallScore)
        phonemePerformance[phoneme].count++
      })

      session.weakPhonemes.forEach((phoneme) => {
        if (!phonemePerformance[phoneme]) {
          phonemePerformance[phoneme] = { scores: [], count: 0 }
        }
        phonemePerformance[phoneme].scores.push(Math.max(0, session.overallScore - 20))
        phonemePerformance[phoneme].count++
      })
    })

    const phonemeStats = Object.entries(phonemePerformance)
      .map(([phoneme, data]) => ({
        phoneme,
        avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
        frequency: data.count,
      }))
      .filter((p) => p.frequency >= 2)
      .sort((a, b) => b.avgScore - a.avgScore)

    const strongestPhonemes = phonemeStats
      .filter((p) => p.avgScore >= averageScore)
      .slice(0, 5)
      .map((p) => p.phoneme)

    const weakestPhonemes = phonemeStats
      .filter((p) => p.avgScore < averageScore)
      .slice(-5)
      .reverse()
      .map((p) => p.phoneme)

    const languageBreakdown: { [key: string]: number } = {}
    this.sessions.forEach((session) => {
      languageBreakdown[session.language] = (languageBreakdown[session.language] || 0) + 1
    })

    const last10Sessions = this.sessions.slice(-10)
    const trendSlope = this.calculateTrendSlope(last10Sessions.map((s) => s.overallScore))
    const recentTrend: "improving" | "stable" | "declining" =
      trendSlope > 2 ? "improving" : trendSlope < -2 ? "declining" : "stable"

    const streakDays = this.calculateStreakDays()

    const stats = {
      totalSessions,
      averageScore: Math.round(averageScore),
      improvementRate: Math.round(improvementRate),
      strongestPhonemes,
      weakestPhonemes,
      languageBreakdown,
      recentTrend,
      streakDays,
    }

    console.log("[v0] Progress stats calculated:", stats)

    return stats
  }

  getScoreHistory(days = 30): Array<{ date: string; score: number; sessions: number }> {
    const now = new Date()
    const history: { [key: string]: { totalScore: number; count: number } } = {}

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split("T")[0]
      history[dateStr] = { totalScore: 0, count: 0 }
    }

    this.sessions.forEach((session) => {
      const dateStr = session.timestamp.toISOString().split("T")[0]
      if (history[dateStr]) {
        history[dateStr].totalScore += session.overallScore
        history[dateStr].count++
      }
    })

    return Object.entries(history).map(([date, data]) => ({
      date,
      score: data.count > 0 ? Math.round(data.totalScore / data.count) : 0,
      sessions: data.count,
    }))
  }

  getScoreHistoryBySessions(sessionCount = 30): Array<{ session: number; score: number; date: string }> {
    const recentSessions = this.sessions
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .slice(-sessionCount)

    return recentSessions.map((session, index) => ({
      session: index + 1,
      score: session.overallScore,
      date: session.timestamp.toISOString().split("T")[0],
    }))
  }

  private calculateTrendSlope(scores: number[]): number {
    if (scores.length < 2) return 0

    const n = scores.length
    const sumX = (n * (n - 1)) / 2
    const sumY = scores.reduce((a, b) => a + b, 0)
    const sumXY = scores.reduce((sum, score, index) => sum + index * score, 0)
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6

    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  }

  private calculateStreakDays(): number {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let streak = 0
    const currentDate = new Date(today)

    while (true) {
      const dateStr = currentDate.toISOString().split("T")[0]
      const hasSession = this.sessions.some((session) => session.timestamp.toISOString().split("T")[0] === dateStr)

      if (hasSession) {
        streak++
        currentDate.setDate(currentDate.getDate() - 1)
      } else {
        break
      }
    }

    return streak
  }

  private saveToStorage() {
    if (typeof window !== "undefined") {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.sessions))
    }
  }

  private loadFromStorage() {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          this.sessions = parsed.map((session: any) => ({
            ...session,
            timestamp: new Date(session.timestamp),
          }))
        } catch (error) {
          console.error("Failed to load progress data:", error)
        }
      }
    }
  }

  clearProgress() {
    this.sessions = []
    this.saveToStorage()
  }
}

// Singleton instance
export const progressTracker = new ProgressTracker()
