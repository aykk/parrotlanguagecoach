"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
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
import { TrendingUp, TrendingDown, Minus, Calendar, Target, Flame, Clock, Globe, MessageSquare, Timer, Trash2, AlertTriangle } from "lucide-react"
import { progressTracker, type ProgressStats, type SessionData } from "@/lib/progress-tracker"
import PhonemeProgressChart from "./PhonemeProgressChart"

// Phoneme pronunciation tips
const PHONEME_TIPS: { [key: string]: string } = {
  'i': 'Like "beat" - spread your lips and raise your tongue high',
  'ɪ': 'Like "bit" - slightly lower tongue than /i/',
  'e': 'Like "bait" - tongue mid-high, lips slightly spread',
  'ɛ': 'Like "bet" - tongue mid-low, lips slightly spread',
  'æ': 'Like "bat" - tongue low, lips spread wide',
  'ɑ': 'Like "pot" - tongue low and back, lips open',
  'ɔ': 'Like "bought" - tongue mid-low and back, lips rounded',
  'o': 'Like "boat" - tongue mid-high and back, lips rounded',
  'ʊ': 'Like "book" - tongue high and back, lips slightly rounded',
  'u': 'Like "boot" - tongue high and back, lips very rounded',
  'ʌ': 'Like "but" - tongue mid-low and central',
  'ə': 'Like "about" - tongue mid and central, neutral lips',
  'p': 'Like "pop" - close lips, then release with a puff',
  'b': 'Like "bob" - close lips, then release with voice',
  't': 'Like "tot" - tongue tip touches roof, then releases',
  'd': 'Like "dot" - tongue tip touches roof, then releases with voice',
  'k': 'Like "cot" - back of tongue touches roof, then releases',
  'g': 'Like "got" - back of tongue touches roof, then releases with voice',
  'f': 'Like "fife" - top teeth touch bottom lip, air flows through',
  'v': 'Like "vive" - top teeth touch bottom lip, air flows with voice',
  'θ': 'Like "think" - tongue tip between teeth, air flows through',
  'ð': 'Like "this" - tongue tip between teeth, air flows with voice',
  's': 'Like "sip" - tongue near roof, air flows through narrow gap',
  'z': 'Like "zip" - tongue near roof, air flows with voice',
  'ʃ': 'Like "ship" - tongue near roof, lips slightly rounded',
  'ʒ': 'Like "measure" - tongue near roof, lips slightly rounded, with voice',
  'h': 'Like "hop" - air flows freely through open mouth',
  'm': 'Like "mom" - lips closed, air flows through nose',
  'n': 'Like "non" - tongue tip touches roof, air flows through nose',
  'ŋ': 'Like "sing" - back of tongue touches roof, air flows through nose',
  'l': 'Like "loll" - tongue tip touches roof, air flows around sides',
  'r': 'Like "roar" - tongue tip curled back, or bunched in middle',
  'w': 'Like "wow" - lips rounded, tongue high and back',
  'j': 'Like "yes" - tongue high and front, lips spread'
}

// Convert phoneme to IPA symbol
const toIPA = (phoneme: string): string => {
  const ipaMap: { [key: string]: string } = {
    'i': 'i', 'ɪ': 'ɪ', 'e': 'e', 'ɛ': 'ɛ', 'æ': 'æ', 'ɑ': 'ɑ', 'ɔ': 'ɔ', 'o': 'o', 'ʊ': 'ʊ', 'u': 'u', 'ʌ': 'ʌ', 'ə': 'ə',
    'p': 'p', 'b': 'b', 't': 't', 'd': 'd', 'k': 'k', 'g': 'g', 'f': 'f', 'v': 'v', 'θ': 'θ', 'ð': 'ð', 's': 's', 'z': 'z',
    'ʃ': 'ʃ', 'ʒ': 'ʒ', 'h': 'h', 'm': 'm', 'n': 'n', 'ŋ': 'ŋ', 'l': 'l', 'r': 'r', 'w': 'w', 'j': 'j'
  }
  return ipaMap[phoneme] || phoneme
}

// Tooltip component for session details
const SessionTooltip = ({ session }: { session: SessionData }) => {
  return (
    <div className="absolute z-50 w-80 p-4 bg-popover border rounded-lg shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 -top-2 -translate-y-full">
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
  const [phonemeMasteryData, setPhonemeMasteryData] = useState<{
    sessions: number[];
    mastered: number[];
    improving: number[];
    needsWork: number[];
  }>({ sessions: [], mastered: [], improving: [], needsWork: [] });
  const [scoreRange, setScoreRange] = useState<'lifetime' | '30days' | '30sessions' | '10sessions'>('30sessions');
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false)
  const [loadingDots, setLoadingDots] = useState("")
  const dotsRef = useRef<NodeJS.Timeout | null>(null)

  const deleteSession = (sessionId: string) => {
    if (confirm("Are you sure you want to delete this session?")) {
      progressTracker.deleteSession(sessionId)
      // Data will be reloaded by the event listener
    }
  }

  const clearAllSessions = () => {
    if (confirm("Are you sure you want to delete ALL sessions? This cannot be undone.")) {
      progressTracker.clearProgress()
      setShowClearAllConfirm(false)
      // Data will be reloaded by the event listener
    }
  }

  useEffect(() => {
    // Animate loading dots
    let dotCount = 0
    dotsRef.current = setInterval(() => {
      dotCount = (dotCount + 1) % 4 // 0, 1, 2, 3
      setLoadingDots(".".repeat(dotCount))
    }, 500)

    const loadData = () => {
      const newStats = progressTracker.getProgressStats()
      const newSessions = progressTracker.getRecentSessions(10)
      const newHistory = progressTracker.getScoreHistoryByTimeRange(scoreRange)
      const newPhonemeMastery = progressTracker.getPhonemeMasteryProgress(30)

      setStats(newStats)
      setRecentSessions(newSessions)
      setScoreHistory(newHistory)
      setPhonemeMasteryData(newPhonemeMastery)
      
      // Clear loading dots when data is loaded
      if (dotsRef.current) {
        clearInterval(dotsRef.current)
      }
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

  // Separate useEffect for scoreRange changes
  useEffect(() => {
    const loadData = () => {
      const newHistory = progressTracker.getScoreHistoryByTimeRange(scoreRange)
      setScoreHistory(newHistory)
    }
    loadData()
  }, [scoreRange])

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Image
          src="/parrot.gif"
          alt="Loading..."
          width={192}
          height={192}
          className="w-48 h-48 object-contain"
          unoptimized
        />
        <div className="text-lg font-medium text-gray-600">
          Loading{loadingDots}
        </div>
      </div>
    )
  }

  if (stats.totalSessions === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-64 text-center p-6">
          <Target className="w-16 h-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Practice Sessions Yet</h3>
          <p className="text-muted-foreground mb-4">Start practicing to see your progress here!</p>
        </div>
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

  const languageMap: { [key: string]: { name: string; flag: string } } = {
    'en-US': { name: 'English', flag: '🇺🇸' },
    'en': { name: 'English', flag: '🇺🇸' },
    'en-GB': { name: 'English', flag: '🇬🇧' },
    'es-ES': { name: 'Spanish', flag: '🇪🇸' },
    'es': { name: 'Spanish', flag: '🇪🇸' },
    'fr-FR': { name: 'French', flag: '🇫🇷' },
    'fr': { name: 'French', flag: '🇫🇷' },
    'de-DE': { name: 'German', flag: '🇩🇪' },
    'de': { name: 'German', flag: '🇩🇪' },
    'it-IT': { name: 'Italian', flag: '🇮🇹' },
    'it': { name: 'Italian', flag: '🇮🇹' },
    'pt-BR': { name: 'Portuguese', flag: '🇧🇷' },
    'pt': { name: 'Portuguese', flag: '🇧🇷' },
  }

  // Consolidate language data to avoid duplicates
  const consolidatedLanguages: { [key: string]: number } = {}
  Object.entries(stats.languageBreakdown).forEach(([language, count]) => {
    const langInfo = languageMap[language] || { name: language.charAt(0).toUpperCase() + language.slice(1), flag: '🌍' }
    const baseName = langInfo.name
    if (consolidatedLanguages[baseName]) {
      consolidatedLanguages[baseName] += count
    } else {
      consolidatedLanguages[baseName] = count
    }
  })

  const languageData = Object.entries(consolidatedLanguages).map(([language, count]) => {
    const langInfo = languageMap[language] || { name: language, flag: '🌍' }
    return {
      name: `${langInfo.flag} ${language}`,
      value: count,
    }
  })

  const COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6"]

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl p-6 border-2 border-blue-200/30 bg-gradient-to-br from-blue-50/20 to-cyan-50/20 backdrop-blur-md shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Sessions</p>
                <p className="text-2xl font-bold">{stats.totalSessions}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </div>

        <div className="rounded-xl p-6 border-2 border-green-200/30 bg-gradient-to-br from-green-50/20 to-emerald-50/20 backdrop-blur-md shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Score</p>
                <p className="text-2xl font-bold">{stats.averageScore}%</p>
              </div>
              <Target className="w-8 h-8 text-green-500" />
            </div>
          </div>

        <div className="rounded-xl p-6 border-2 border-red-200/30 bg-gradient-to-br from-red-50/20 to-orange-50/20 backdrop-blur-md shadow-xl">
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
          </div>

        <div className="rounded-xl p-6 border-2 border-orange-200/30 bg-gradient-to-br from-orange-50/20 to-yellow-50/20 backdrop-blur-md shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Streak</p>
                <p className="text-2xl font-bold">{stats.streakDays} days</p>
              </div>
              <Flame className="w-8 h-8 text-orange-500" />
            </div>
          </div>
      </div>

      <Tabs defaultValue="progress" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="phonemes">Phonemes</TabsTrigger>
          <TabsTrigger value="languages">Languages</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="space-y-4">
          <div className="rounded-xl p-6 border-2 border-yellow-200/30 bg-gradient-to-br from-yellow-50/20 to-orange-50/20 backdrop-blur-md shadow-xl">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Phoneme Mastery Progress</h3>
              <p className="text-sm text-muted-foreground">Track how your phonemes improve from "Needs Work" to "Improving" to "Mastered" over time!</p>
            </div>
            <div>
              {phonemeMasteryData.sessions.length > 0 ? (
                <div className="h-80">
                  <PhonemeProgressChart
                    sessions={phonemeMasteryData.sessions}
                    mastered={phonemeMasteryData.mastered}
                    improving={phonemeMasteryData.improving}
                    needsWork={phonemeMasteryData.needsWork}
                  />
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  Complete some practice sessions to see your phoneme mastery progress
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl p-6 border-2 border-yellow-200/30 bg-gradient-to-br from-yellow-50/20 to-orange-50/20 backdrop-blur-md shadow-xl">
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Score Progression</h3>
                  <p className="text-sm text-muted-foreground">Track your pronunciation improvement over time</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Time Range:</label>
                  <select
                    value={scoreRange}
                    onChange={(e) => setScoreRange(e.target.value as 'lifetime' | '30days' | '30sessions' | '10sessions')}
                    className="rounded-md border px-3 py-1 text-sm"
                  >
                    <option value="lifetime">Lifetime</option>
                    <option value="30days">Last 30 Days</option>
                    <option value="30sessions">Last 30 Sessions</option>
                    <option value="10sessions">Last 10 Sessions</option>
                  </select>
                </div>
              </div>
            </div>
            <div>
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
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="phonemes" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl p-6 border-2 border-yellow-200/30 bg-gradient-to-br from-yellow-50/20 to-orange-50/20 backdrop-blur-md shadow-xl">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Strongest Phonemes</h3>
                <p className="text-sm text-muted-foreground">Sounds with highest accuracy</p>
              </div>
              <div>
                <div className="space-y-2">
                  {stats.strongestPhonemes.length > 0 ? (
                    stats.strongestPhonemes.map((phoneme, index) => {
                      const accuracy = stats.phonemeAccuracy[phoneme] || 0;
                      const symbol = toIPA(phoneme) ?? phoneme;
                      const tip = PHONEME_TIPS[symbol] || `Pronounce as ${phoneme}`;
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 rounded border"
                        >
                          <span 
                            className="font-mono text-lg tooltip-trigger cursor-help"
                            data-tooltip={`${phoneme} → ${symbol}\n\n${tip}`}
                          >
                            /{phoneme}/
                          </span>
                          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                            {accuracy}%
                          </Badge>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-muted-foreground text-sm">Keep practicing to see your strengths!</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl p-6 border-2 border-yellow-200/30 bg-gradient-to-br from-yellow-50/20 to-orange-50/20 backdrop-blur-md shadow-xl">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Phonemes to Practice</h3>
                <p className="text-sm text-muted-foreground">Sounds under 60% accuracy</p>
              </div>
              <div>
                <div className="space-y-2">
                  {Object.entries(stats.phonemeAccuracy)
                    .filter(([_, accuracy]) => accuracy < 60)
                    .length > 0 ? (
                    Object.entries(stats.phonemeAccuracy)
                      .filter(([_, accuracy]) => accuracy < 60)
                      .sort(([, a], [, b]) => a - b)
                      .map(([phoneme, accuracy], index) => {
                        const symbol = toIPA(phoneme) ?? phoneme;
                        const tip = PHONEME_TIPS[symbol] || `Pronounce as ${phoneme}`;
                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 rounded border"
                          >
                            <span 
                              className="font-mono text-lg tooltip-trigger cursor-help"
                              data-tooltip={`${phoneme} → ${symbol}\n\n${tip}`}
                            >
                              /{phoneme}/
                            </span>
                            <Badge variant="destructive">
                              {accuracy}%
                            </Badge>
                          </div>
                        );
                      })
                  ) : (
                    <p className="text-muted-foreground text-sm">Great job! All your phonemes are performing well.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="languages" className="space-y-4">
          <div className="rounded-xl p-6 border-2 border-yellow-200/30 bg-gradient-to-br from-yellow-50/20 to-orange-50/20 backdrop-blur-md shadow-xl">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Language Practice Distribution</h3>
              <p className="text-sm text-muted-foreground">How much time you've spent on each language</p>
            </div>
            <div>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={languageData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={0}
                    >
                      {languageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#fff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any, name: any) => [`${value} sessions`, name]}
                      labelStyle={{ color: '#374151', fontWeight: '500' }}
                      contentStyle={{ 
                        backgroundColor: '#f9fafb', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <div className="rounded-xl p-6 border-2 border-yellow-200/30 bg-gradient-to-br from-yellow-50/20 to-orange-50/20 backdrop-blur-md shadow-xl">
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Recent Practice Sessions</h3>
                  <p className="text-sm text-muted-foreground">Your latest pronunciation practice history</p>
                </div>
                {recentSessions.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      clearAllSessions()
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete all sessions"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Clear All
                  </button>
                )}
              </div>
            </div>
            <div>
              <div className="space-y-3">
                {recentSessions.map((session, index) => (
                  <div key={session.id} className="group relative flex items-start justify-between p-4 rounded-lg border-2 border-gray-200 bg-card hover:bg-muted/50 transition-colors cursor-pointer shadow-md">
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
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          deleteSession(session.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded-lg transition-all duration-200 text-red-500 hover:text-red-700"
                        title="Delete session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <SessionTooltip session={session} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
