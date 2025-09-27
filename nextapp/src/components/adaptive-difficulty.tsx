"use client";
import { useEffect, useState } from "react";
import { ProgressService, UserProgress } from "@/lib/progress-service";
import { supabase } from "@/lib/supabase-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, Target, TrendingUp } from "lucide-react";

interface AdaptiveDifficultyProps {
  language: string;
  onDifficultyChange: (difficulty: number) => void;
  onRecommendedPhonemes: (phonemes: string[]) => void;
  onRecommendedWords: (words: string[]) => void;
}

export function AdaptiveDifficulty({ 
  language, 
  onDifficultyChange, 
  onRecommendedPhonemes, 
  onRecommendedWords 
}: AdaptiveDifficultyProps) {
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [recommendedDifficulty, setRecommendedDifficulty] = useState<number>(5);
  const [recommendedPhonemes, setRecommendedPhonemes] = useState<string[]>([]);
  const [recommendedWords, setRecommendedWords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserProgress = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const progress = await ProgressService.getUserProgress(user.id);
          setUserProgress(progress);
          
          if (progress) {
            // Calculate adaptive difficulty
            const difficulty = ProgressService.calculateAdaptiveDifficulty(progress, language);
            setRecommendedDifficulty(difficulty);
            onDifficultyChange(difficulty);
            
            // Get recommendations
            const phonemes = ProgressService.getRecommendedPhonemes(progress, 3);
            const words = ProgressService.getRecommendedWords(progress, 3);
            
            setRecommendedPhonemes(phonemes);
            setRecommendedWords(words);
            onRecommendedPhonemes(phonemes);
            onRecommendedWords(words);
          }
        }
      } catch (error) {
        console.error('Error loading user progress:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserProgress();
  }, [language, onDifficultyChange, onRecommendedPhonemes, onRecommendedWords]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Adaptive Difficulty
          </CardTitle>
          <CardDescription>Loading your personalized recommendations...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!userProgress) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Adaptive Difficulty
          </CardTitle>
          <CardDescription>Start practicing to get personalized recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Complete your first practice session to unlock adaptive difficulty and personalized recommendations!
          </p>
        </CardContent>
      </Card>
    );
  }

  const getDifficultyLabel = (difficulty: number) => {
    if (difficulty <= 3) return "Beginner";
    if (difficulty <= 5) return "Easy";
    if (difficulty <= 7) return "Intermediate";
    if (difficulty <= 9) return "Advanced";
    return "Expert";
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 3) return "bg-green-100 text-green-800";
    if (difficulty <= 5) return "bg-blue-100 text-blue-800";
    if (difficulty <= 7) return "bg-yellow-100 text-yellow-800";
    if (difficulty <= 9) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5" />
          Adaptive Difficulty
        </CardTitle>
        <CardDescription>Personalized based on your performance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Recommended Level</span>
            <Badge className={getDifficultyColor(recommendedDifficulty)}>
              {getDifficultyLabel(recommendedDifficulty)} ({recommendedDifficulty}/10)
            </Badge>
          </div>
          <p className="text-xs text-gray-600">
            Based on your average score of {((userProgress.average_accuracy + userProgress.average_pronunciation + userProgress.average_fluency) / 3).toFixed(1)}%
          </p>
        </div>

        {recommendedPhonemes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium">Focus Areas</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {recommendedPhonemes.map((phoneme, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {phoneme}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {recommendedWords.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">Practice Words</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {recommendedWords.map((word, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {word}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t">
          <p className="text-xs text-gray-500">
            💡 The system automatically adjusts difficulty based on your performance. 
            Keep practicing to unlock more challenging content!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
