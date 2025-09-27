-- Supabase setup script for Parrot Language Coach
-- Run this in your Supabase SQL editor

-- Enable Row Level Security
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Create pronunciation_sessions table
CREATE TABLE IF NOT EXISTS pronunciation_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phrase TEXT NOT NULL,
  language TEXT NOT NULL,
  accuracy_score DECIMAL(5,2) NOT NULL CHECK (accuracy_score >= 0 AND accuracy_score <= 100),
  pronunciation_score DECIMAL(5,2) NOT NULL CHECK (pronunciation_score >= 0 AND pronunciation_score <= 100),
  fluency_score DECIMAL(5,2) NOT NULL CHECK (fluency_score >= 0 AND fluency_score <= 100),
  weak_phonemes TEXT[] DEFAULT '{}',
  practiced_words TEXT[] DEFAULT '{}',
  session_duration DECIMAL(8,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_progress table
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_sessions INTEGER DEFAULT 0,
  average_accuracy DECIMAL(5,2) DEFAULT 0,
  average_pronunciation DECIMAL(5,2) DEFAULT 0,
  average_fluency DECIMAL(5,2) DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  total_xp INTEGER DEFAULT 0,
  weak_phonemes TEXT[] DEFAULT '{}',
  mastered_phonemes TEXT[] DEFAULT '{}',
  weak_words TEXT[] DEFAULT '{}',
  mastered_words TEXT[] DEFAULT '{}',
  last_practice_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on tables
ALTER TABLE pronunciation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

-- Create policies for pronunciation_sessions
CREATE POLICY "Users can view their own sessions" ON pronunciation_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" ON pronunciation_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON pronunciation_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" ON pronunciation_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Create policies for user_progress
CREATE POLICY "Users can view their own progress" ON user_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress" ON user_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress" ON user_progress
  FOR UPDATE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pronunciation_sessions_user_id ON pronunciation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_pronunciation_sessions_created_at ON pronunciation_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_progress_updated_at 
  BEFORE UPDATE ON user_progress 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

