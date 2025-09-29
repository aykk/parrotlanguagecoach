# Parrot: AI Phonetics Coach

**Speak with confidence, clarity, fluency, and accuracy.**

Parrot is an advanced AI-powered pronunciation training application that helps language learners improve their speaking skills through real-time speech analysis and personalized feedback. Built with Next.js and powered by Azure Speech Services, it provides comprehensive pronunciation training across multiple languages.

## Features

### Core Functionality
- **Real-time Speech Analysis**: Advanced phoneme-level pronunciation analysis using Azure Speech Services
- **Multi-language Support**: Practice pronunciation in 10+ languages including English, Spanish, French, German, Italian, Portuguese, Japanese, Mandarin Chinese, Arabic, and Russian
- **AI-Powered Phrase Generation**: Dynamic practice sentences generated based on your weak phonemes and difficulty level
- **Progress Tracking**: Comprehensive dashboard with phoneme heatmaps, progress charts, and performance analytics
- **Audio Recording & Playback**: Record your pronunciation and compare with native speakers

### User Experience
- **Modern UI**: Responsive design with smooth animations using Framer Motion
- **Guest Mode**: Start practicing immediately without account creation
- **User Authentication**: Secure sign-in with Supabase integration
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Accessibility**: RTL language support and comprehensive accessibility features

## Getting Started

### Prerequisites
- Node.js 18+
- Azure Speech Services account
- Supabase account (for authentication)
- Google Gemini API key (for AI phrase generation)

### Installation

1. Clone the repository and navigate to the project directory
   ```bash
   git clone https://github.com/yourusername/parrotlanguagecoach.git
   cd parrotlanguagecoach/nextapp
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env.local` file with the following environment variables:
   ```env
   AZURE_SPEECH_KEY=your_azure_speech_key
   AZURE_SPEECH_REGION=your_azure_region
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. Run the development server
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Technology Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Azure Speech Services** - Speech recognition and synthesis
- **Supabase** - Authentication and database
- **Google Gemini API** - AI-powered phrase generation