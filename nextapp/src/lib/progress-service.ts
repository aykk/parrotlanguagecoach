import { supabase } from './supabase-client';

export interface PronunciationSession {
  id?: string;
  user_id: string;
  phrase: string;
  language: string;
  accuracy_score: number;
  pronunciation_score: number;
  fluency_score: number;
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
  last_practice_date?: string;
  created_at?: string;
  updated_at?: string;
}

export class ProgressService {
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

    // Update user progress
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

    // Calculate streak (simplified - consecutive days with practice)
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

