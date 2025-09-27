"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { ProgressService, UserProgress, PronunciationSession, UserLevel } from "@/lib/progress-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function ProgressPage() {
  const [user, setUser] = useState<any>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [sessions, setSessions] = useState<PronunciationSession[]>([]);
  const [currentLevel, setCurrentLevel] = useState<UserLevel | null>(null);
  const [nextLevel, setNextLevel] = useState<UserLevel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          window.location.href = '/auth';
          return;
        }
        
        setUser(user);
        
        // Fetch user progress
        const userProgress = await ProgressService.getUserProgress(user.id);
        setProgress(userProgress);
        
        // Get level information
        if (userProgress) {
          const currentLevelInfo = ProgressService.getUserLevel(userProgress.total_xp || 0);
          const nextLevelInfo = ProgressService.getNextLevel(currentLevelInfo.level);
          setCurrentLevel(currentLevelInfo);
          setNextLevel(nextLevelInfo);
        }
        
        // Fetch recent sessions
        const userSessions = await ProgressService.getUserSessions(user.id, 10);
        setSessions(userSessions);
        
      } catch (error) {
        console.error('Error loading progress:', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading your progress...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your Progress</h1>
            <p className="text-gray-600">Track your pronunciation journey</p>
          </div>
          <div className="flex gap-3">
            <Button asChild>
              <Link href="/practice">Practice Now</Link>
            </Button>
            <Button variant="outline" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>

        {/* Level System */}
        {currentLevel && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                  {currentLevel.level}
                </div>
                <div>
                  <div className="text-2xl font-bold">{currentLevel.title}</div>
                  <div className="text-sm text-gray-600">{currentLevel.description}</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Total XP: {progress?.total_xp || 0}</span>
                  {nextLevel && (
                    <span>Next Level: {nextLevel.xp_required - (progress?.total_xp || 0)} XP needed</span>
                  )}
                </div>
                {nextLevel && (
                  <Progress 
                    value={((progress?.total_xp || 0) - currentLevel.xp_required) / (nextLevel.xp_required - currentLevel.xp_required) * 100} 
                    className="h-2" 
                  />
                )}
                <div className="text-sm text-gray-600">
                  <strong>Unlocked Features:</strong> {currentLevel.unlocked_features.join(", ")}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{progress?.total_sessions || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Average Accuracy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{progress?.average_accuracy?.toFixed(1) || 0}%</div>
              <Progress value={progress?.average_accuracy || 0} className="mt-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pronunciation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{progress?.average_pronunciation?.toFixed(1) || 0}%</div>
              <Progress value={progress?.average_pronunciation || 0} className="mt-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Streak</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{progress?.streak_days || 0} days</div>
              <Badge variant="secondary" className="mt-2">
                🔥 Keep it up!
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Weak Areas & Recommendations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Areas to Improve</CardTitle>
              <CardDescription>Focus on these phonemes and words</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-2">Weak Phonemes</h4>
                  <div className="flex flex-wrap gap-2">
                    {(progress?.weak_phonemes || []).slice(0, 5).map((phoneme, index) => (
                      <Badge key={index} variant="destructive" className="text-xs">
                        {phoneme}
                      </Badge>
                    ))}
                    {(!progress?.weak_phonemes || progress.weak_phonemes.length === 0) && (
                      <span className="text-sm text-gray-500">No weak phonemes detected!</span>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-2">Difficult Words</h4>
                  <div className="flex flex-wrap gap-2">
                    {(progress?.weak_words || []).slice(0, 5).map((word, index) => (
                      <Badge key={index} variant="destructive" className="text-xs">
                        {word}
                      </Badge>
                    ))}
                    {(!progress?.weak_words || progress.weak_words.length === 0) && (
                      <span className="text-sm text-gray-500">No difficult words detected!</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mastered Skills</CardTitle>
              <CardDescription>You're doing great with these!</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-2">Mastered Phonemes</h4>
                  <div className="flex flex-wrap gap-2">
                    {(progress?.mastered_phonemes || []).slice(0, 5).map((phoneme, index) => (
                      <Badge key={index} variant="default" className="text-xs bg-green-600">
                        {phoneme}
                      </Badge>
                    ))}
                    {(!progress?.mastered_phonemes || progress.mastered_phonemes.length === 0) && (
                      <span className="text-sm text-gray-500">Keep practicing to master phonemes!</span>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-2">Mastered Words</h4>
                  <div className="flex flex-wrap gap-2">
                    {(progress?.mastered_words || []).slice(0, 5).map((word, index) => (
                      <Badge key={index} variant="default" className="text-xs bg-green-600">
                        {word}
                      </Badge>
                    ))}
                    {(!progress?.mastered_words || progress.mastered_words.length === 0) && (
                      <span className="text-sm text-gray-500">Keep practicing to master words!</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Sessions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Practice Sessions</CardTitle>
            <CardDescription>Your latest pronunciation attempts</CardDescription>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No practice sessions yet!</p>
                <Button asChild className="mt-4">
                  <Link href="/practice">Start Your First Session</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{session.phrase}</p>
                      <p className="text-sm text-gray-600">{session.language}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(session.created_at!).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-semibold text-green-600">{session.accuracy_score}%</div>
                        <div className="text-xs text-gray-500">Accuracy</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-blue-600">{session.pronunciation_score}%</div>
                        <div className="text-xs text-gray-500">Pronunciation</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-purple-600">{session.fluency_score}%</div>
                        <div className="text-xs text-gray-500">Fluency</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
