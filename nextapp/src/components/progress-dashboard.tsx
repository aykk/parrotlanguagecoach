"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { TrendingUp, TrendingDown, Minus, Calendar, Target, Flame, Clock, Globe, MessageSquare, Timer } from "lucide-react"
import { progressTracker, type ProgressStats, type SessionData } from "@/lib/progress-tracker"

// Tooltip component for session details
const SessionTooltip = ({ session }: { session: SessionData }) => {
  return (
    <div className="absolute z-50 w-80 p-4 bg-popover border rounded-lg shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-500" />
          <span className="font-medium">Language: {session.language}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-green-500" />
          <span className="font-medium">Phrase:</span>
        </div>
        <p className="text-sm text-muted-foreground ml-6 italic">"{session.sentence}"</p>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium">Overall: {session.overallScore}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">Accuracy: {session.accuracy}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">Fluency: {session.fluency}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium">Completeness: {session.completeness}%</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium">Duration: {Math.round(session.duration)}s</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium">
                {session.timestamp.toLocaleDateString()} at {session.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
        
        {session.weakPhonemes && session.weakPhonemes.length > 0 && (
          <div>
            <span className="text-sm font-medium text-red-600">Weak Phonemes:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {session.weakPhonemes.map((phoneme, index) => (
                <span key={index} className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                  {phoneme}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {session.practicedPhonemes && session.practicedPhonemes.length > 0 && (
          <div>
            <span className="text-sm font-medium text-green-600">Practiced Phonemes:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {session.practicedPhonemes.slice(0, 10).map((phoneme, index) => (
                <span key={index} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                  {phoneme}
                </span>
              ))}
              {session.practicedPhonemes.length > 10 && (
                <span className="text-xs text-muted-foreground">+{session.practicedPhonemes.length - 10} more</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function ProgressDashboard() {
  const [stats, setStats] = useState<ProgressStats | null>(null)
  const [recentSessions, setRecentSessions] = useState<SessionData[]>([])
  const [scoreHistory, setScoreHistory] = useState<Array<{ session: number; score: number; date: string }>>([])

  useEffect(() => {
    const loadData = () => {
      const newStats = progressTracker.getProgressStats()
      const newSessions = progressTracker.getRecentSessions(10)
      const newHistory = progressTracker.getScoreHistoryBySessions(30)

      setStats(newStats)
      setRecentSessions(newSessions)
      setScoreHistory(newHistory)
    }

    loadData()

    // Listen for storage changes to update dashboard
    const handleStorageChange = () => {
      loadData()
    }
    window.addEventListener("storage", handleStorageChange)

    const handleProgressUpdate = () => {
      loadData()
    }
    window.addEventListener("progressUpdated", handleProgressUpdate)

    const handleSessionAdded = () => {
      setTimeout(() => {
        loadData()
      }, 100)
    }
    window.addEventListener("sessionAdded", handleSessionAdded)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("progressUpdated", handleProgressUpdate)
      window.removeEventListener("sessionAdded", handleSessionAdded)
    }
  }, [])

  if (!stats) {
    return <div className="flex items-center justify-center h-64">Loading dashboard...</div>
  }

  if (stats.totalSessions === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64 text-center">
          <Target className="w-16 h-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Practice Sessions Yet</h3>
          <p className="text-muted-foreground mb-4">Start practicing to see your progress here!</p>
        </CardContent>
      </Card>
    )
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving":
        return <TrendingUp className="w-4 h-4 text-green-500" />
      case "declining":
        return <TrendingDown className="w-4 h-4 text-red-500" />
      default:
        return <Minus className="w-4 h-4 text-yellow-500" />
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "improving":
        return "text-green-500"
      case "declining":
        return "text-red-500"
      default:
        return "text-yellow-500"
    }
  }

  const languageData = Object.entries(stats.languageBreakdown).map(([language, count]) => ({
    name: language.charAt(0).toUpperCase() + language.slice(1),
    value: count,
  }))

  const COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6"]

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Sessions</p>
                <p className="text-2xl font-bold">{stats.totalSessions}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Score</p>
                <p className="text-2xl font-bold">{stats.averageScore}%</p>
              </div>
              <Target className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Improvement</p>
                <p className={`text-2xl font-bold ${getTrendColor(stats.recentTrend)}`}>
                  {stats.improvementRate > 0 ? "+" : ""}
                  {stats.improvementRate}%
                </p>
              </div>
              {getTrendIcon(stats.recentTrend)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Streak</p>
                <p className="text-2xl font-bold">{stats.streakDays} days</p>
              </div>
              <Flame className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="progress" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="phonemes">Phonemes</TabsTrigger>
          <TabsTrigger value="languages">Languages</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Score Progression (Last 30 Sessions)</CardTitle>
              <CardDescription>Track your pronunciation improvement over your recent practice sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scoreHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="session" tickFormatter={(session) => `Session ${session}`} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip
                      labelFormatter={(session) => `Session ${session}`}
                      formatter={(value, name) => [`${value}%`, "Score"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      dot={{ fill: "var(--color-primary)", strokeWidth: 2, r: 4 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="phonemes" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Strongest Phonemes</CardTitle>
                <CardDescription>Sounds you've mastered</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.strongestPhonemes.length > 0 ? (
                    stats.strongestPhonemes.map((phoneme, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 rounded bg-green-50 dark:bg-green-950"
                      >
                        <span className="font-mono text-lg">/{phoneme}/</span>
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        >
                          Mastered
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">Keep practicing to see your strengths!</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Phonemes to Practice</CardTitle>
                <CardDescription>Sounds that need more work</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.weakestPhonemes.length > 0 ? (
                    stats.weakestPhonemes.map((phoneme, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 rounded bg-red-50 dark:bg-red-950"
                      >
                        <span className="font-mono text-lg">/{phoneme}/</span>
                        <Badge variant="destructive">Practice Needed</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">Great job! No weak phonemes identified.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="languages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Language Practice Distribution</CardTitle>
              <CardDescription>How much time you've spent on each language</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={languageData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {languageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Practice Sessions</CardTitle>
              <CardDescription>Your latest pronunciation practice history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentSessions.map((session, index) => (
                  <div key={session.id} className="group relative flex items-start justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{session.language}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {session.timestamp.toLocaleDateString()} at{" "}
                          {session.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-sm font-medium break-words whitespace-normal">{session.sentence}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-bold">{session.overallScore}%</p>
                        <p className="text-xs text-muted-foreground">Overall</p>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">{Math.round(session.duration)}s</span>
                      </div>
                    </div>
                    <SessionTooltip session={session} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
