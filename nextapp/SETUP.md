# Parrot Language Coach - Supabase Setup

This guide will help you set up Supabase authentication and progress tracking for your pronunciation coach hackathon project.

## 🚀 Quick Setup

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be ready (usually takes 1-2 minutes)

### 2. Set up Environment Variables
1. Copy `.env.local.example` to `.env.local` (if it exists)
2. Add your Supabase credentials to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find these values in your Supabase project dashboard under Settings > API.

### 3. Set up Database Tables
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `supabase-setup.sql`
4. Run the SQL script

This will create:
- `pronunciation_sessions` table to store individual practice sessions
- `user_progress` table to track overall user progress
- Row Level Security (RLS) policies to ensure users can only access their own data

### 4. Enable Email Authentication
1. In your Supabase dashboard, go to Authentication > Settings
2. Make sure "Enable email confirmations" is enabled
3. Configure your site URL (e.g., `http://localhost:3000` for development)

### 5. Run the Application
```bash
cd nextapp
npm run dev
```

## 🎯 Features

### Authentication
- **Sign Up**: Users can create accounts with email/password
- **Sign In**: Existing users can sign in
- **Protected Routes**: Practice and progress pages require authentication
- **Auto-redirect**: Unauthenticated users are redirected to auth page

### Progress Tracking
- **Session Storage**: Each pronunciation practice session is saved
- **Progress Metrics**: Tracks accuracy, pronunciation, and fluency scores
- **Streak Tracking**: Calculates consecutive practice days
- **Progress Dashboard**: Visual display of user's improvement over time

### Pages
- `/auth` - Sign in/sign up page
- `/practice` - Pronunciation practice (requires auth)
- `/progress` - User progress dashboard (requires auth)

## 🔧 Database Schema

### pronunciation_sessions
- `id` - Unique session ID
- `user_id` - Reference to authenticated user
- `phrase` - The text that was practiced
- `language` - Language being practiced
- `accuracy_score` - Accuracy percentage (0-100)
- `pronunciation_score` - Overall pronunciation score (0-100)
- `fluency_score` - Fluency score (0-100)
- `created_at` - Timestamp

### user_progress
- `id` - Unique progress record ID
- `user_id` - Reference to authenticated user
- `total_sessions` - Total number of practice sessions
- `average_accuracy` - Average accuracy across all sessions
- `average_pronunciation` - Average pronunciation score
- `average_fluency` - Average fluency score
- `streak_days` - Current practice streak
- `last_practice_date` - Date of last practice
- `created_at` / `updated_at` - Timestamps

## 🧪 Testing the Setup

1. **Sign Up**: Go to `/auth` and create a new account
2. **Check Email**: Verify your email address (if email confirmation is enabled)
3. **Sign In**: Use your credentials to sign in
4. **Practice**: Go to `/practice` and record some audio
5. **View Progress**: Check `/progress` to see your saved sessions

## 🚨 Troubleshooting

### Common Issues

1. **"Supabase not configured" error**
   - Make sure your `.env.local` file has the correct Supabase URL and anon key
   - Restart your development server after adding environment variables

2. **Database permission errors**
   - Make sure you've run the `supabase-setup.sql` script
   - Check that RLS policies are enabled

3. **Authentication not working**
   - Verify your Supabase project URL and anon key
   - Check that email authentication is enabled in Supabase dashboard

4. **Progress not saving**
   - Check browser console for errors
   - Verify user is authenticated before practicing
   - Ensure database tables exist and have proper permissions

## 📱 Next Steps

Once basic auth is working, you can:
- Add more user profile fields
- Implement social authentication (Google, GitHub, etc.)
- Add more detailed progress analytics
- Create user preferences and settings
- Add leaderboards and social features

Happy hacking! 🎉

