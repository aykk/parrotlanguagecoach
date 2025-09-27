import { supabase } from './supabase-client';

export interface PronunciationSession {
  id?: string;
  user_id: string;
  phrase: string;
  language: string;
  accuracy_score: number;
  pronunciation_score: number;
  fluency_score: number;
  weak_phonemes: string[];
  practiced_words: string[];
  session_duration: number;
  created_at?: string;
}

export interface UserProgress {
  id?: string;
  user_id: string;
  total_sessions: number;
  average_accuracy: number;
  average_pronunciation: number;
  average_fluency: number;
  streak_days: number;
  current_level: number;
  total_xp: number;
  weak_phonemes: string[];
  mastered_phonemes: string[];
  weak_words: string[];
  mastered_words: string[];
  last_practice_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserLevel {
  level: number;
  xp_required: number;
  title: string;
  description: string;
  unlocked_features: string[];
}

export interface PhonemeProgress {
  phoneme: string;
  attempts: number;
  successes: number;
  average_score: number;
  last_practiced?: string;
}

export interface WordProgress {
  word: string;
  attempts: number;
  successes: number;
  average_score: number;
  last_practiced?: string;
}

export class ProgressService {
  // Level system configuration
  static readonly LEVELS: UserLevel[] = [
    { level: 1, xp_required: 0, title: "Beginner", description: "Just starting your pronunciation journey", unlocked_features: ["Basic phrases", "Simple words"] },
    { level: 2, xp_required: 100, title: "Novice", description: "Getting the hang of pronunciation", unlocked_features: ["Common phrases", "Basic phonemes"] },
    { level: 3, xp_required: 250, title: "Apprentice", description: "Building confidence in speaking", unlocked_features: ["Intermediate phrases", "Complex words"] },
    { level: 4, xp_required: 500, title: "Practitioner", description: "Developing fluency", unlocked_features: ["Advanced phrases", "Idioms"] },
    { level: 5, xp_required: 1000, title: "Expert", description: "Mastering pronunciation", unlocked_features: ["Expert phrases", "All phonemes"] },
    { level: 6, xp_required: 2000, title: "Master", description: "Pronunciation perfectionist", unlocked_features: ["Master phrases", "Accent training"] },
  ];

  // Calculate XP based on session performance
  static calculateXP(session: PronunciationSession): number {
    const baseXP = 10;
    const accuracyBonus = Math.floor(session.accuracy_score / 10);
    const fluencyBonus = Math.floor(session.fluency_score / 20);
    const durationBonus = Math.floor(session.session_duration / 30); // Bonus for longer sessions
    const phonemeBonus = session.weak_phonemes.length * 2; // Bonus for practicing difficult phonemes
    
    return baseXP + accuracyBonus + fluencyBonus + durationBonus + phonemeBonus;
  }

  // Get user's current level
  static getUserLevel(totalXP: number): UserLevel {
    for (let i = this.LEVELS.length - 1; i >= 0; i--) {
      if (totalXP >= this.LEVELS[i].xp_required) {
        return this.LEVELS[i];
      }
    }
    return this.LEVELS[0];
  }

  // Get next level info
  static getNextLevel(currentLevel: number): UserLevel | null {
    return this.LEVELS.find(level => level.level === currentLevel + 1) || null;
  }

  // Calculate adaptive difficulty based on user performance
  static calculateAdaptiveDifficulty(userProgress: UserProgress, language: string): number {
    const baseDifficulty = 5; // Default difficulty (1-10 scale)
    
    // Adjust based on overall performance
    const avgScore = (userProgress.average_accuracy + userProgress.average_pronunciation + userProgress.average_fluency) / 3;
    
    if (avgScore >= 90) {
      return Math.min(10, baseDifficulty + 3); // Increase difficulty for high performers
    } else if (avgScore >= 80) {
      return Math.min(9, baseDifficulty + 2);
    } else if (avgScore >= 70) {
      return Math.min(8, baseDifficulty + 1);
    } else if (avgScore >= 60) {
      return baseDifficulty;
    } else {
      return Math.max(1, baseDifficulty - 2); // Decrease difficulty for struggling users
    }
  }

  // Get recommended phonemes to practice based on weakness
  static getRecommendedPhonemes(userProgress: UserProgress, limit: number = 5): string[] {
    return userProgress.weak_phonemes.slice(0, limit);
  }

  // Get recommended words to practice
  static getRecommendedWords(userProgress: UserProgress, limit: number = 5): string[] {
    return userProgress.weak_words.slice(0, limit);
  }

  // Save a pronunciation session
  static async saveSession(session: Omit<PronunciationSession, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('pronunciation_sessions')
      .insert([session])
      .select()
      .single();

    if (error) {
      console.error('Error saving session:', error);
      throw error;
    }

    // Update user progress with XP calculation
    await this.updateUserProgress(session.user_id);
    
    return data;
  }

  // Get user's pronunciation sessions
  static async getUserSessions(userId: string, limit = 50) {
    const { data, error } = await supabase
      .from('pronunciation_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching sessions:', error);
      throw error;
    }

    return data || [];
  }

  // Get user's overall progress
  static async getUserProgress(userId: string) {
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching progress:', error);
      throw error;
    }

    return data;
  }

  // Update user's overall progress
  static async updateUserProgress(userId: string) {
    // Get all sessions for this user
    const sessions = await this.getUserSessions(userId, 1000);
    
    if (sessions.length === 0) return;

    // Calculate averages
    const totalSessions = sessions.length;
    const avgAccuracy = sessions.reduce((sum, s) => sum + s.accuracy_score, 0) / totalSessions;
    const avgPronunciation = sessions.reduce((sum, s) => sum + s.pronunciation_score, 0) / totalSessions;
    const avgFluency = sessions.reduce((sum, s) => sum + s.fluency_score, 0) / totalSessions;

    // Calculate total XP
    const totalXP = sessions.reduce((sum, session) => {
      return sum + this.calculateXP(session);
    }, 0);

    // Get current level
    const currentLevel = this.getUserLevel(totalXP);

    // Calculate streak (consecutive days with practice)
    const today = new Date().toISOString().split('T')[0];
    const uniqueDays = [...new Set(sessions.map(s => s.created_at?.split('T')[0]))].sort().reverse();
    let streakDays = 0;
    let currentDate = new Date(today);
    
    for (const day of uniqueDays) {
      const dayDate = new Date(day);
      const diffDays = Math.floor((currentDate.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === streakDays) {
        streakDays++;
        currentDate = dayDate;
      } else {
        break;
      }
    }

    // Analyze weak phonemes and words
    const phonemeStats = new Map<string, { attempts: number, successes: number, totalScore: number }>();
    const wordStats = new Map<string, { attempts: number, successes: number, totalScore: number }>();

    sessions.forEach(session => {
      // Track phonemes
      session.weak_phonemes.forEach(phoneme => {
        const stats = phonemeStats.get(phoneme) || { attempts: 0, successes: 0, totalScore: 0 };
        stats.attempts++;
        if (session.accuracy_score >= 70) stats.successes++;
        stats.totalScore += session.accuracy_score;
        phonemeStats.set(phoneme, stats);
      });

      // Track words
      session.practiced_words.forEach(word => {
        const stats = wordStats.get(word) || { attempts: 0, successes: 0, totalScore: 0 };
        stats.attempts++;
        if (session.accuracy_score >= 70) stats.successes++;
        stats.totalScore += session.accuracy_score;
        wordStats.set(word, stats);
      });
    });

    // Get weak phonemes (success rate < 60%)
    const weakPhonemes = Array.from(phonemeStats.entries())
      .filter(([_, stats]) => stats.successes / stats.attempts < 0.6)
      .map(([phoneme, _]) => phoneme)
      .slice(0, 10);

    // Get mastered phonemes (success rate >= 80%)
    const masteredPhonemes = Array.from(phonemeStats.entries())
      .filter(([_, stats]) => stats.successes / stats.attempts >= 0.8)
      .map(([phoneme, _]) => phoneme)
      .slice(0, 10);

    // Get weak words (success rate < 60%)
    const weakWords = Array.from(wordStats.entries())
      .filter(([_, stats]) => stats.successes / stats.attempts < 0.6)
      .map(([word, _]) => word)
      .slice(0, 10);

    // Get mastered words (success rate >= 80%)
    const masteredWords = Array.from(wordStats.entries())
      .filter(([_, stats]) => stats.successes / stats.attempts >= 0.8)
      .map(([word, _]) => word)
      .slice(0, 10);

    const lastPracticeDate = uniqueDays[0] || null;

    // Upsert user progress
    const { data, error } = await supabase
      .from('user_progress')
      .upsert({
        user_id: userId,
        total_sessions: totalSessions,
        average_accuracy: Math.round(avgAccuracy * 100) / 100,
        average_pronunciation: Math.round(avgPronunciation * 100) / 100,
        average_fluency: Math.round(avgFluency * 100) / 100,
        streak_days: streakDays,
        current_level: currentLevel.level,
        total_xp: totalXP,
        weak_phonemes: weakPhonemes,
        mastered_phonemes: masteredPhonemes,
        weak_words: weakWords,
        mastered_words: masteredWords,
        last_practice_date: lastPracticeDate,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating progress:', error);
      throw error;
    }

    return data;
  }

  // Get leaderboard (top users by average accuracy)
  static async getLeaderboard(limit = 10) {
    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .order('average_accuracy', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      throw error;
    }

    return data || [];
  }
}

