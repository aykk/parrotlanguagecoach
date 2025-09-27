"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { PronunciationTrainer } from "@/components/pronunciation-trainer";
import { AdaptiveDifficulty } from "@/components/adaptive-difficulty";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PracticePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adaptiveDifficulty, setAdaptiveDifficulty] = useState<number>(5);
  const [recommendedPhonemes, setRecommendedPhonemes] = useState<string[]>([]);
  const [recommendedWords, setRecommendedWords] = useState<string[]>([]);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          window.location.href = '/auth';
          return;
        }
        setUser(user);
      } catch (error) {
        console.error('Error loading user:', error);
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
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl md:text-6xl font-bold text-balance mb-2">parrot</h1>
            <p className="text-gray-600">Practice your pronunciation</p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link href="/progress">View Progress</Link>
            </Button>
            <Button variant="ghost" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <PronunciationTrainer />
          </div>
          <div className="space-y-4">
            <AdaptiveDifficulty
              language="english"
              onDifficultyChange={setAdaptiveDifficulty}
              onRecommendedPhonemes={setRecommendedPhonemes}
              onRecommendedWords={setRecommendedWords}
            />
          </div>
        </div>
      </div>
    </main>
  );
}