"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase-client";
import { progressTracker } from "@/lib/progress-tracker";
import { AuthHeader } from "@/components/auth-header";
import { ProgressDashboard } from "@/components/progress-dashboard";
import PhonemeHeatmap from "@/components/PhonemeHeatmap";
import LipReader, { LipReaderRef } from "@/components/lip-reader";
import { extractPhonemeScores } from "@/lib/parse-azure";
import { aiPhraseGenerator } from "@/lib/ai-phrase-generator";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "@radix-ui/react-icons";
import { Volume2, Play, Trash2, Square } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

// Type definitions
type Phoneme = {
  Phoneme: string;
  Offset?: number;
  Duration?: number;
  PronunciationAssessment?: { AccuracyScore?: number };
};
type Syllable = {
  Syllable: string;
  Grapheme?: string;
  Offset?: number;
  Duration?: number;
  PronunciationAssessment?: { AccuracyScore?: number };
  Phonemes?: Phoneme[];
};
type Word = {
  Word: string;
  Offset?: number;
  Duration?: number;
  PronunciationAssessment?: {
    AccuracyScore?: number;
    FluencyScore?: number;
    IntonationScore?: number;
    CompletenessScore?: number;
    ErrorType?: string; // None | Omission | Insertion | Substitution | ...
    Feedback?: any;
  };
  Syllables?: Syllable[];
  Phonemes?: Phoneme[];
};

const TOKEN_ROUTE = "/api/azure-speech";
const LOW_WORD = 90;
const LOW_PHONE = 90;

type Lang = "en-US" | "es-ES" | "fr-FR" | "de-DE" | "it-IT" | "pt-BR";
const SAMPLE_BY_LANG: Record<Lang, string> = {
  "en-US": "The quick brown fox jumps over the lazy dog.",
  "es-ES": "El zorro marrón salta sobre el perro perezoso.",
  "fr-FR": "Le renard brun rapide saute par-dessus le chien paresseux.",
  "de-DE": "Der schnelle braune Fuchs springt über den faulen Hund.",
  "it-IT": "La volpe marrone veloce salta sopra il cane pigro.",
  "pt-BR": "A raposa marrom rápida pula sobre o cão preguiçoso.",
};

const LANGUAGE_OPTIONS = [
  { code: "en-US", name: "English", flag: "🇺🇸" },
  { code: "es-ES", name: "Español", flag: "🇪🇸" },
  { code: "fr-FR", name: "Français", flag: "🇫🇷" },
  { code: "de-DE", name: "Deutsch", flag: "🇩🇪" },
  { code: "it-IT", name: "Italiano", flag: "🇮🇹" },
  { code: "pt-BR", name: "Português", flag: "🇧🇷" },
];

// --- Tiny tooltip (no libs)
function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="relative inline-block group">
      {children}
      <span className="pointer-events-none absolute z-20 hidden group-hover:block -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-pre rounded-lg border bg-white px-3 py-2 text-xs text-gray-700 shadow">
        {label}
      </span>
    </span>
  );
}

// --- Score card with hover brief
function ScoreCard({ label, value, brief }: { label: string; value: number | null; brief: string }) {
  return (
    <div className="rounded-xl border-2 border-white/40 bg-white/75 backdrop-blur-md shadow-xl p-4">
      <div className="text-xs text-gray-600 flex items-center gap-2">
        <span>{label}</span>
        <Tooltip label={brief}>
          <span aria-label={brief} className="cursor-help select-none text-gray-400">ⓘ</span>
        </Tooltip>
      </div>
      <div className="text-2xl font-semibold">
        {typeof value === "number" ? `${value.toFixed(1)} / 100` : "N/A"}
      </div>
    </div>
  );
}

export default function AzureSpeechTest() {
  const router = useRouter();
  const [sdk, setSdk] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("Idle");

  // Language
  const [lang, setLang] = useState<Lang>("en-US");

  // Top-level scores (from PA)
  const [overall, setOverall] = useState<number | null>(null); // PronScore
  const [accScore, setAccScore] = useState<number | null>(null); // Accuracy
  const [fluencyScore, setFluencyScore] = useState<number | null>(null); // Fluency
  const [intonationScore, setIntonationScore] = useState<number | null>(null); // Intonation
  const [completenessScore, setCompletenessScore] = useState<number | null>(null); // Completeness

  // Results & UI
  const [words, setWords] = useState<Word[]>([]);
  const [lastJson, setLastJson] = useState<any>(null);
  const [phonemeScores, setPhonemeScores] = useState<{ [phoneme: string]: number }>({});

  // AI Generation
  const [complexity, setComplexity] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAIGenerated, setIsAIGenerated] = useState(false);

  // Phoneme Practice
  const [lowestAccuracyPhonemes, setLowestAccuracyPhonemes] = useState<Array<{phoneme: string, accuracy: number}>>([]);
  const lipReaderRef = useRef<LipReaderRef>(null);
  const [practiceSentences, setPracticeSentences] = useState<Array<{phoneme: string, sentence: string}>>([]);
  const [generatingPractice, setGeneratingPractice] = useState<string | null>(null);
  const [processingRecording, setProcessingRecording] = useState(false);
  const [loadingDots, setLoadingDots] = useState(".");
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [hasRecordedData, setHasRecordedData] = useState(false);

  // Initial loading screen (2 seconds on first load/refresh)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Authentication effect
  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log('=== INITIALIZING AUTH IN PRACTICE PAGE ===')
        const { data } = await supabase.auth.getUser()
        console.log('Initial user data:', data.user)
        setCurrentUser(data.user)
        console.log('Setting user ID to:', data.user?.id || null)
        await progressTracker.setUserId(data.user?.id || null)
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('Auth state changed:', event, session?.user?.email)
          setCurrentUser(session?.user ?? null)
          console.log('Setting user ID to:', session?.user?.id || null)
          await progressTracker.setUserId(session?.user?.id || null)
          
          // If user logged out, clear the dashboard
          if (!session?.user) {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("progressUpdated"))
            }
          }
        })
        
        return () => subscription.unsubscribe()
      } catch (error) {
        console.error('Auth init failed:', error)
      }
    }
    initAuth()
  }, []);

  // Check if there's recorded data available
  useEffect(() => {
    const checkRecordedData = () => {
      if (lipReaderRef.current) {
        const hasData = lipReaderRef.current.hasRecordedData();
        setHasRecordedData(hasData);
      }
    };
    
    // Check initially
    checkRecordedData();
    
    // Check less frequently to reduce performance impact
    const interval = setInterval(checkRecordedData, 3000);
    
    return () => clearInterval(interval);
  }, []);

  // Phoneme pronunciation mapping (how to pronounce each phoneme)
  const PHONEME_PRONUNCIATION: { [key: string]: string } = {
    // Vowels - using more accurate pronunciation
    'i': 'beat', 'ɪ': 'bit', 'e': 'bait', 'ɛ': 'bet', 'æ': 'bat', 'ɑ': 'pot', 'ɔ': 'bought', 'o': 'boat', 'ʊ': 'book', 'u': 'boot', 'ʌ': 'but', 'ə': 'about',
    'aɪ': 'bite', 'aʊ': 'bout', 'ɔɪ': 'boy', 'eɪ': 'bay', 'oʊ': 'bow', 'ɝ': 'bird', 'ɚ': 'butter',
    // Consonants - using words that contain the sound
    'p': 'pop', 'b': 'bob', 't': 'tot', 'd': 'dad', 'k': 'kick', 'g': 'gig', 'f': 'fife', 'v': 'vive', 's': 'sis', 'z': 'zoo',
    'θ': 'think', 'ð': 'this', 'ʃ': 'wish', 'ʒ': 'vision', 'tʃ': 'church', 'dʒ': 'judge', 'm': 'mom', 'n': 'noon', 'ŋ': 'sing', 'l': 'lull', 'r': 'roar', 'ɹ': 'roar',
    'w': 'wow', 'j': 'yes', 'h': 'huh'
  };

  // Function to speak phoneme pronunciation
  const speakPhoneme = (phoneme: string) => {
    const pronunciation = PHONEME_PRONUNCIATION[phoneme] || phoneme;
    const utterance = new SpeechSynthesisUtterance(pronunciation);
    utterance.rate = 0.5; // Slower for clarity
    utterance.pitch = 1.0; // Normal pitch
    utterance.volume = 0.8;
    
    // Stop any current speech
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };

  // Recording / playback
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognizerRef = useRef<any>(null);

  // Loading dots animation
  useEffect(() => {
    if ((loading && !isListening) || isInitialLoad) {
      const interval = setInterval(() => {
        setLoadingDots(prev => {
          if (prev === ".") return "..";
          if (prev === "..") return "...";
          return ".";
        });
      }, 500);
      return () => clearInterval(interval);
    }
  }, [loading, isListening, isInitialLoad]);

  // ARPAbet/SAPI -> IPA (best effort)
  const PHONEME_MAP: Record<string, string> = {
    dh: "ð", th: "θ", ax: "ə", ih: "ɪ", iy: "i", eh: "ɛ", ae: "æ",
    aa: "ɑ", ao: "ɔ", ah: "ʌ", uh: "ʊ", uw: "u", er: "ɝ", r: "ɹ",
    ow: "oʊ", ey: "eɪ", ay: "aɪ", aw: "aʊ", oy: "ɔɪ",
    sh: "ʃ", zh: "ʒ", ch: "t͡ʃ", jh: "d͡ʒ",
    ng: "ŋ", y: "j", w: "w", l: "l", m: "m", n: "n",
    b: "b", d: "d", g: "ɡ", p: "p", t: "t", k: "k",
    f: "f", v: "v", s: "s", z: "z", h: "h",
    axr: "ɚ", rr: "r", x: "x",
  };
  const toIPA = (p: string) => PHONEME_MAP[p.toLowerCase()] ?? p;

  // Pronunciation tips for each phoneme
  const PHONEME_TIPS: Record<string, string> = {
    // Vowels
    "i": "Say 'ee' as in 'see'. Keep your tongue high and forward in your mouth. Smile slightly.",
    "ɪ": "Say 'i' as in 'sit'. Your tongue is slightly lower than 'ee'. Keep it relaxed.",
    "e": "Say 'e' as in 'bed'. Your tongue is mid-high and forward. Keep your mouth slightly open.",
    "ɛ": "Say 'e' as in 'bet'. Your tongue is mid-low and forward. Open your mouth a bit more.",
    "æ": "Say 'a' as in 'cat'. Your tongue is low and forward. Open your mouth wide.",
    "ɑ": "Say 'a' as in 'father'. Your tongue is low and back. Open your mouth wide and relax.",
    "ɔ": "Say 'o' as in 'bought'. Your tongue is mid-low and back. Round your lips slightly.",
    "o": "Say 'o' as in 'go'. Your tongue is mid-high and back. Round your lips more.",
    "u": "Say 'oo' as in 'food'. Your tongue is high and back. Round your lips tightly.",
    "ʊ": "Say 'u' as in 'put'. Your tongue is slightly lower than 'oo'. Round your lips less.",
    "ʌ": "Say 'u' as in 'but'. Your tongue is mid and central. Keep your mouth relaxed.",
    "ə": "Say 'a' as in 'about'. Your tongue is mid and central. This is the most relaxed sound.",
    "ɝ": "Say 'er' as in 'her'. Your tongue is mid and central, with an 'r' quality.",
    "ɚ": "Say 'er' as in 'butter'. Your tongue is mid and central, with a softer 'r' quality.",
    
    // Diphthongs
    "eɪ": "Say 'ay' as in 'say'. Start with 'e' and glide to 'ɪ'. Move your tongue smoothly.",
    "aɪ": "Say 'i' as in 'time'. Start with 'a' and glide to 'ɪ'. Move your tongue from low to high.",
    "ɔɪ": "Say 'oy' as in 'boy'. Start with 'ɔ' and glide to 'ɪ'. Move your tongue from back to front.",
    "aʊ": "Say 'ow' as in 'cow'. Start with 'a' and glide to 'ʊ'. Move your tongue from low to high.",
    "oʊ": "Say 'o' as in 'go'. Start with 'o' and glide to 'ʊ'. Move your tongue from mid to high.",
    
    // Consonants - Stops
    "p": "Say 'p' as in 'pat'. Close your lips tightly, then release with a burst of air.",
    "b": "Say 'b' as in 'bat'. Close your lips tightly, then release with your voice.",
    "t": "Say 't' as in 'top'. Touch your tongue tip to the ridge behind your teeth.",
    "d": "Say 'd' as in 'dog'. Touch your tongue tip to the ridge behind your teeth, with your voice.",
    "k": "Say 'k' as in 'cat'. Touch the back of your tongue to the roof of your mouth.",
    "g": "Say 'g' as in 'go'. Touch the back of your tongue to the roof of your mouth, with your voice.",
    
    // Fricatives
    "f": "Say 'f' as in 'fish'. Touch your lower lip to your upper teeth and blow air.",
    "v": "Say 'v' as in 'van'. Touch your lower lip to your upper teeth and use your voice.",
    "θ": "Say 'th' as in 'think'. Put your tongue between your teeth and blow air.",
    "ð": "Say 'th' as in 'this'. Put your tongue between your teeth and use your voice.",
    "s": "Say 's' as in 'sun'. Put your tongue near the ridge behind your teeth and blow air.",
    "z": "Say 'z' as in 'zoo'. Put your tongue near the ridge behind your teeth and use your voice.",
    "ʃ": "Say 'sh' as in 'shoe'. Put your tongue near the roof of your mouth and blow air.",
    "ʒ": "Say 's' as in 'measure'. Put your tongue near the roof of your mouth and use your voice.",
    "h": "Say 'h' as in 'hat'. Open your mouth and blow air from your throat.",
    
    // Affricates
    "t͡ʃ": "Say 'ch' as in 'church'. Start like 't' and end like 'sh'. Make it one smooth sound.",
    "d͡ʒ": "Say 'j' as in 'judge'. Start like 'd' and end like 'zh'. Make it one smooth sound.",
    
    // Nasals
    "m": "Say 'm' as in 'man'. Close your lips and let air come through your nose.",
    "n": "Say 'n' as in 'no'. Touch your tongue tip to the ridge behind your teeth and let air through your nose.",
    "ŋ": "Say 'ng' as in 'sing'. Touch the back of your tongue to the roof of your mouth and let air through your nose.",
    
    // Liquids
    "l": "Say 'l' as in 'love'. Touch your tongue tip to the ridge behind your teeth and let air flow around the sides.",
    "r": "Say 'r' as in 'red'. Curl your tongue tip back without touching anything.",
    "ɹ": "Say 'r' as in 'red'. Put your tongue tip near the ridge behind your teeth.",
    
    // Glides
    "w": "Say 'w' as in 'we'. Round your lips and raise the back of your tongue.",
    "j": "Say 'y' as in 'yes'. Raise your tongue high and forward without touching anything.",
  };

  const refText = useRef(SAMPLE_BY_LANG["en-US"]);

  // Auto-change reference sentence when language changes
  useEffect(() => {
    refText.current = SAMPLE_BY_LANG[lang];
    const el = document.getElementById("ref-input") as HTMLTextAreaElement | null;
    if (el) {
      el.value = SAMPLE_BY_LANG[lang];
      // Auto-resize textarea
      el.style.height = 'auto';
      el.style.height = Math.max(60, el.scrollHeight) + 'px';
    }
    setIsAIGenerated(false);
  }, [lang]);

  useEffect(() => {
    (async () => {
      const _sdk = await import("microsoft-cognitiveservices-speech-sdk");
      setSdk(_sdk);
      setReady(true);
    })();
    return () => {
      // Cleanup handled by lip reader component
    };
  }, []);

  const generateAISentence = async () => {
    setIsGenerating(true);
    try {
      const difficultyLevel = complexity <= 3 ? "beginner" : complexity <= 7 ? "intermediate" : "advanced";
      
      // Provide some common phonemes for general practice if none are specified
      const getDefaultPhonemes = (language: Lang) => {
        switch (language) {
          case "en-US": return ["th", "r", "l", "v", "w", "s", "z", "sh", "ch", "ng"];
          case "es-ES": return ["r", "rr", "ñ", "ll", "j", "g", "b", "v", "d", "t"];
          case "fr-FR": return ["r", "u", "eu", "œ", "j", "g", "b", "v", "d", "t"];
          case "de-DE": return ["r", "ch", "sch", "ü", "ö", "ä", "j", "g", "b", "v"];
          case "it-IT": return ["r", "gl", "gn", "sc", "j", "g", "b", "v", "d", "t"];
          case "pt-BR": return ["r", "rr", "nh", "lh", "j", "g", "b", "v", "d", "t"];
          default: return ["r", "l", "n", "m", "k", "g", "s", "j", "t", "d"];
        }
      };
      
      const defaultPhonemes = getDefaultPhonemes(lang);

      const result = await aiPhraseGenerator.generateTargetedPhrases({
        language: lang,
        weakPhonemes: defaultPhonemes,
        difficultyLevel: difficultyLevel as "beginner" | "intermediate" | "advanced",
        currentScore: 75, // Could be populated from user's average score
        focusAreas: []
      });

      if (result.phrases.length > 0) {
        const phrase = result.phrases[0];
        refText.current = phrase.text;
        const el = document.getElementById("ref-input") as HTMLTextAreaElement | null;
        if (el) {
          el.value = phrase.text;
          // Auto-resize textarea
          el.style.height = 'auto';
          el.style.height = Math.max(60, el.scrollHeight) + 'px';
        }
        setIsAIGenerated(true);
      } else {
        // Fallback to sample sentence if AI generation fails
        refText.current = SAMPLE_BY_LANG[lang];
        const el = document.getElementById("ref-input") as HTMLTextAreaElement | null;
        if (el) {
          el.value = SAMPLE_BY_LANG[lang];
          el.style.height = 'auto';
          el.style.height = Math.max(60, el.scrollHeight) + 'px';
        }
        setIsAIGenerated(false);
      }
    } catch (error) {
      console.error("Failed to generate AI sentence:", error);
      // Fallback to sample sentence on error
      refText.current = SAMPLE_BY_LANG[lang];
      const el = document.getElementById("ref-input") as HTMLTextAreaElement | null;
      if (el) {
        el.value = SAMPLE_BY_LANG[lang];
        el.style.height = 'auto';
        el.style.height = Math.max(60, el.scrollHeight) + 'px';
      }
      setIsAIGenerated(false);
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate practice sentences for lowest accuracy phonemes
  const generatePracticeSentences = async (phoneme: string) => {
    setGeneratingPractice(phoneme);
    try {
      const difficultyLevel = complexity <= 3 ? "beginner" : complexity <= 7 ? "intermediate" : "advanced";
      
      const result = await aiPhraseGenerator.generateTargetedPhrases({
        language: lang,
        weakPhonemes: [phoneme],
        difficultyLevel: difficultyLevel as "beginner" | "intermediate" | "advanced",
        currentScore: 75,
        focusAreas: []
      });

      if (result.phrases.length > 0) {
        const sentence = result.phrases[0].text;
        // Update the reference sentence
        refText.current = sentence;
        const el = document.getElementById("ref-input") as HTMLTextAreaElement | null;
        if (el) {
          el.value = sentence;
          el.style.height = 'auto';
          el.style.height = Math.max(60, el.scrollHeight) + 'px';
        }
        setIsAIGenerated(true);
        
        // Scroll to top of page
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error) {
      console.error("Failed to generate practice sentence:", error);
    } finally {
      setGeneratingPractice(null);
    }
  };

  // Update lowest accuracy phonemes when phoneme scores change
  useEffect(() => {
    if (Object.keys(phonemeScores).length > 0) {
      const phonemeArray = Object.entries(phonemeScores)
        .map(([phoneme, accuracy]) => ({ phoneme, accuracy }))
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 3); // Get top 3 lowest accuracy phonemes
      
      setLowestAccuracyPhonemes(phonemeArray);
    } else {
      // Reset when phoneme scores are cleared (new session or non-English)
      setLowestAccuracyPhonemes([]);
    }
  }, [phonemeScores]);


  // ----- Recording helpers -----
  async function ensureStream(): Promise<MediaStream> {
    if (mediaStreamRef.current) return mediaStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;
    return stream;
  }
  async function startRecording() {
    const stream = await ensureStream();
    mediaChunksRef.current = [];
    const mr = new MediaRecorder(stream);
    mediaRecorderRef.current = mr;
    mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) mediaChunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(mediaChunksRef.current, { type: "audio/webm" });
      // Audio is now handled by the lip reader component
    };
    mr.start();
    setIsRecording(true);
  }
  function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    setIsRecording(false);
  }
  function resetRecording() {
    console.log('resetRecording called');
    stopRecording();
    mediaChunksRef.current = [];
    
    // Clear lip reader data
    lipReaderRef.current?.clearData();
    setHasRecordedData(false);
    console.log('resetRecording completed');
  }

  const stopListening = () => {
    if (recognizerRef.current && isListening) {
      recognizerRef.current.stopContinuousRecognitionAsync();
      setIsListening(false);
      setStatus("Stopped listening manually");
      
      // Stop lip reader recording
      lipReaderRef.current?.stopRecording();
    }
  };

  const speakWord = (word: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = lang;
      utterance.rate = 0.8;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
    }
  };

  // ----- Token -----
  const getToken = async () => {
    const r = await fetch(TOKEN_ROUTE, { cache: "no-store" });
    const ctype = r.headers.get("content-type") || "";
    if (ctype.includes("application/json")) return r.json();
    const body = await r.text();
    throw new Error(`Token route returned non-JSON.\nStatus: ${r.status}\nBody:\n${body.slice(0, 400)}`);
  };

  // --- Pronunciation Assessment ---
  const runAssessment = async () => {
    if (!sdk) return;
    setLoading(true);
    setProcessingRecording(true);
    setStatus("Getting token…");
    
    // Start lip reader recording
    lipReaderRef.current?.startRecording();

    // Reset scores/results
    setOverall(null);
    setAccScore(null);
    setFluencyScore(null);
    setIntonationScore(null);
    setCompletenessScore(null);
    setWords([]);
    setLastJson(null);
    setPhonemeScores({});
    resetRecording();

    try {
      const { token, region, error } = await getToken();
      if (error) throw new Error(error);

      const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechRecognitionLanguage = lang;
      speechConfig.setProperty(sdk.PropertyId.SpeechServiceResponse_OutputFormatOption, "detailed");
      // Balanced timeouts for better recognition across languages
      speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, "5000");
      speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "1500");

      const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
      recognizerRef.current = recognizer;

      const paConfig = new sdk.PronunciationAssessmentConfig(
        refText.current,
        sdk.PronunciationAssessmentGradingSystem.HundredMark,
        sdk.PronunciationAssessmentGranularity.Phoneme,
        true // miscue detection
      );
      paConfig.enableProsodyAssessment = true; // for Intonation
      
      // Enable phoneme assessment for all languages
      paConfig.enablePhonemeAssessment = true;
      
      // Add debugging for completeness
      console.log('Reference text for completeness:', refText.current);
      console.log('Reference text length:', refText.current.length);
      
      paConfig.applyTo(recognizer);

      await startRecording();
      setStatus(`Listening (PA ${lang})… Speak clearly.`);
      setIsListening(true);
      await new Promise<void>((resolve, reject) => {
        recognizer.startContinuousRecognitionAsync(resolve, reject);
      });

      const result: any = await new Promise((resolve, reject) => {
        // Add a reasonable timeout to prevent hanging
        const timeout = setTimeout(() => {
          recognizer.stopContinuousRecognitionAsync();
          reject(new Error("Recognition timeout - no speech detected"));
        }, 15000); // 15 second timeout

        recognizer.recognized = (_: any, e: any) => {
          if (e?.result?.reason === sdk.ResultReason.RecognizedSpeech || e?.result?.reason === sdk.ResultReason.RecognizedIntent) {
            clearTimeout(timeout);
            recognizer.stopContinuousRecognitionAsync(() => resolve(e.result));
          }
        };

        // Also handle session stopped event for better control
        recognizer.sessionStopped = (_: any, e: any) => {
          clearTimeout(timeout);
          if (e?.result?.reason === sdk.ResultReason.RecognizedSpeech || e?.result?.reason === sdk.ResultReason.RecognizedIntent) {
            resolve(e.result);
          }
        };
      });

      stopRecording();
      setIsListening(false);
      setStatus("Processing result…");
      
      // Stop lip reader recording
      lipReaderRef.current?.stopRecording();
      
      // Update recorded data state
      setTimeout(() => {
        if (lipReaderRef.current) {
          const hasData = lipReaderRef.current.hasRecordedData();
          setHasRecordedData(hasData);
        }
      }, 1000);

      const jsonStr = result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult);
      const parsed = JSON.parse(jsonStr);
      setLastJson(parsed);

      const nbest = parsed?.NBest?.[0];
      const pa = nbest?.PronunciationAssessment || {};

      // Top scores (all direct from Azure PA)
      setOverall(typeof pa.PronScore === "number" ? pa.PronScore : null);
      setAccScore(typeof pa.AccuracyScore === "number" ? pa.AccuracyScore : null);
      setFluencyScore(typeof pa.FluencyScore === "number" ? pa.FluencyScore : null);
      setIntonationScore(typeof pa.ProsodyScore === "number" ? pa.ProsodyScore : null);
      
      // Debug completeness score
      console.log('Azure CompletenessScore:', pa.CompletenessScore);
      console.log('Azure NBest:', nbest);
      console.log('Recognized text:', nbest?.Display);
      console.log('Reference text:', refText.current);
      
      // Calculate custom completeness based on word count
      let customCompleteness = pa.CompletenessScore;
      if (nbest?.Display && refText.current) {
        const referenceWords = refText.current.toLowerCase().trim().split(/\s+/);
        const recognizedWords = nbest.Display.toLowerCase().trim().split(/\s+/);
        
        // Count how many reference words were actually spoken
        // Create a copy of recognized words to avoid double-counting
        const availableWords = [...recognizedWords];
        let spokenWords = 0;
        
        for (const refWord of referenceWords) {
          const index = availableWords.indexOf(refWord);
          if (index !== -1) {
            spokenWords++;
            // Remove the matched word to prevent double-counting
            availableWords.splice(index, 1);
          }
        }
        
        // Calculate completeness as percentage of words spoken
        const wordCompleteness = (spokenWords / referenceWords.length) * 100;
        customCompleteness = Math.round(wordCompleteness);
        
        console.log('Reference words:', referenceWords);
        console.log('Recognized words:', recognizedWords);
        console.log('Spoken words:', spokenWords, 'out of', referenceWords.length);
        console.log('Custom completeness:', customCompleteness + '%');
      }
      
      setCompletenessScore(typeof customCompleteness === "number" ? customCompleteness : null);
      

      const wordsWithPhonemes: Word[] = nbest?.Words ?? [];
      setWords(wordsWithPhonemes);

      // Extract phoneme scores for heatmap (only for English)
      let extractedScores: { [phoneme: string]: number } = {};
      if (lang === "en-US") {
        try {
          extractedScores = extractPhonemeScores(parsed);
          setPhonemeScores(extractedScores);
        } catch (error) {
          console.error("Error extracting phoneme scores:", error);
          setPhonemeScores({});
        }
      } else {
        // Clear phoneme scores for non-English languages
        setPhonemeScores({});
      }

      // Save session to progress tracker (always save if we have any results)
      const actualOverall = typeof pa.PronScore === "number" ? pa.PronScore : null;
      const actualAccuracy = typeof pa.AccuracyScore === "number" ? pa.AccuracyScore : null;
      const actualFluency = typeof pa.FluencyScore === "number" ? pa.FluencyScore : null;
      const actualCompleteness = typeof pa.CompletenessScore === "number" ? pa.CompletenessScore : null;
      
      if (wordsWithPhonemes.length > 0 || actualOverall !== null) {
        const sessionStartTime = new Date();
        const duration = 5; // Approximate duration for now
        
        // Only extract phonemes for English
        const practicedPhonemes = lang === "en-US" 
          ? [
              ...wordsWithPhonemes.flatMap((word) => word.Phonemes?.map(p => p.Phoneme) || []),
              ...Object.keys(extractedScores)
            ].filter((phoneme, index, array) => array.indexOf(phoneme) === index) // Remove duplicates
          : [];

        const weakPhonemes = lang === "en-US" 
          ? Object.entries(extractedScores)
              .filter(([_, score]) => score < 80)
              .map(([phoneme, _]) => phoneme)
          : [];

        try {
          const sessionData = {
            language: lang,
            sentence: refText.current,
            overallScore: actualOverall || 0,
            accuracy: actualAccuracy || 0,
            fluency: actualFluency || 0,
            completeness: actualCompleteness || 0,
            weakPhonemes: weakPhonemes,
            practicedPhonemes: practicedPhonemes,
            duration,
          };
          
          console.log('=== SAVING SESSION FROM PRACTICE PAGE ===')
          console.log('Session data to save:', sessionData)
          const savedSession = await progressTracker.addSession(sessionData);
          console.log('Session saved:', savedSession)
          
          // Trigger dashboard update
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("progressUpdated"));
            window.dispatchEvent(new CustomEvent("sessionAdded"));
          }
        } catch (error) {
          console.error("Failed to save session:", error);
        }
      }

      if (parsed?.RecognitionStatus === "NoMatch") {
        setStatus("NoMatch (heard silence/noise). Check mic permission, device, and gain, then try again.");
      } else {
        setStatus("Done.");
      }
    } catch (e: any) {
      stopRecording();
      setIsListening(false);
      setStatus(`Error: ${e.message || String(e)}`);
    } finally {
      setLoading(false);
      setProcessingRecording(false);
      // Auto-scroll to Performance Overview after recording finishes
      setTimeout(() => {
        const performanceSection = document.querySelector('[data-results]');
        if (performanceSection) {
          performanceSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          // Fallback: scroll to any element with "Performance" in the text
          const performanceElements = Array.from(document.querySelectorAll('h2, h3, div')).filter(el => 
            el.textContent?.includes('Performance')
          );
          if (performanceElements.length > 0) {
            performanceElements[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }, 1000);
    }
  };

  // Derived helpers
  const reviews = [
    {
      title: "Accuracy",
      score: accScore,
      text: accScore === null || accScore === undefined 
        ? "How clearly you pronounce each sound. Higher scores mean your pronunciation matches the target language better."
        : accScore < 80 
          ? "Focus on pronouncing each sound clearly. Practice individual phonemes that scored low." 
          : "Great pronunciation accuracy! Keep up the excellent work."
    },
    {
      title: "Fluency",
      score: fluencyScore,
      text: fluencyScore === null || fluencyScore === undefined 
        ? "How smoothly and naturally you speak. Higher scores mean fewer pauses and more natural speech flow."
        : fluencyScore < 80 
          ? "Work on speaking more smoothly. Practice connecting words naturally without long pauses." 
          : "Excellent fluency! Your speech flows naturally."
    },
    // Only include intonation for English
    ...(lang === "en-US" ? [{
      title: "Intonation",
      score: intonationScore,
      text: intonationScore === null || intonationScore === undefined 
        ? "The rhythm and melody of your speech. Higher scores mean your intonation matches native speakers better."
        : intonationScore < 80 
          ? "Focus on intonation and rhythm. Practice the natural melody of the language." 
          : "Great intonation! Your speech rhythm sounds natural."
    }] : []),
    {
      title: "Completeness",
      score: completenessScore,
      text: completenessScore === null || completenessScore === undefined 
        ? "How much of the sentence you said. Higher scores mean you spoke more of the target text."
        : completenessScore < 80 
          ? "Make sure to say all the words. Practice the complete sentence without skipping parts." 
          : "Perfect completeness! You said everything clearly."
    }
  ];

  const issueWords = words.filter(w => {
    const acc = w?.PronunciationAssessment?.AccuracyScore;
    return typeof acc === "number" && acc < LOW_WORD;
  });

  const miscueCounts = words.reduce((acc, w) => {
    const err = w?.PronunciationAssessment?.ErrorType;
    if (err === "Omission") acc.omission++;
    else if (err === "Insertion") acc.insertion++;
    else if (err === "Substitution") acc.substitution++;
    return acc;
  }, { omission: 0, insertion: 0, substitution: 0 });

  const band = (score: number | null) => {
    if (score === null) return "N/A";
    if (score >= 95) return "A+";
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  };

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Background with feathers2.png */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/feathers2.png"
          alt="Background"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/30" />
      </div>

      
      {/* Initial loading screen (2 seconds) */}
      {isInitialLoad && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white">
          <Image
            src="/parrot.gif"
            alt="Loading..."
            width={300}
            height={300}
            className="w-72 h-72 object-contain"
            unoptimized
          />
          <div className="text-xl font-medium text-gray-600">
            Loading{loadingDots}
          </div>
        </div>
      )}

      {/* Main content - only show after initial load */}
      {!isInitialLoad && (
        <div className="relative z-10 container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-8 flex justify-between items-center"
        >
          <Button 
            onClick={() => router.push("/")}
            variant="outline"
            className="flex items-center gap-2 bg-white/70 hover:bg-white/75 border-white/20 text-gray-800"
          >
            <ArrowLeftIcon className="size-4" />
            Back to Home
          </Button>
          <AuthHeader />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="max-w-4xl mx-auto space-y-6"
        >
          <Tabs defaultValue="practice" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-white/70 backdrop-blur-md border-white/20">
              <TabsTrigger value="practice" className="data-[state=active]:bg-green-700 data-[state=active]:text-white">Practice</TabsTrigger>
              <TabsTrigger value="dashboard" className="data-[state=active]:bg-green-700 data-[state=active]:text-white">Dashboard</TabsTrigger>
            </TabsList>

            <TabsContent value="practice" className="space-y-6">
              {/* Language Selector */}
              <div className="rounded-xl p-4 border-2 border-white/40 bg-white/70 backdrop-blur-md shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">Language:</h3>
                  <select
                    className="w-48 rounded-lg border border-white/20 bg-white/70 backdrop-blur-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={lang}
                    onChange={(e) => setLang(e.target.value as Lang)}
                  >
                    {LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.flag} {option.name} ({option.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Main Practice Area - Side by Side Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Side: Reference Sentence */}
                <div className="rounded-xl p-6 border-2 border-white/40 bg-white/70 backdrop-blur-md shadow-xl">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Read this sentence out loud!</h3>
                  <div className="bg-white/50 rounded-xl p-4 border-2 border-gray-200 mb-4">
                    <textarea
                      id="ref-input"
                      className="w-full bg-transparent text-lg font-medium text-center focus:outline-none resize-none"
                      defaultValue={refText.current}
                      onChange={(e) => {
                        refText.current = e.target.value;
                        setIsAIGenerated(false);
                        // Auto-resize textarea
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.max(80, e.target.scrollHeight) + 'px';
                      }}
                      placeholder={SAMPLE_BY_LANG[lang]}
                      rows={3}
                    />
                  </div>
                  
                  {/* AI Generation Controls */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Complexity Level: {complexity}/10</label>
                      <Slider
                        value={[complexity]}
                        onValueChange={(value) => setComplexity(value[0])}
                        max={10}
                        min={1}
                        step={1}
                        className="mt-2"
                      />
                      <div className="flex justify-between text-xs mt-1 text-gray-600">
                        <span>Beginner</span>
                        <span>Advanced</span>
                      </div>
                    </div>
                    <button
                      onClick={generateAISentence}
                      disabled={isGenerating}
                      className="w-full rounded-lg border border-white/20 bg-green-600 text-white backdrop-blur-md px-4 py-2 font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isGenerating ? "Generating..." : "Generate!"}
                    </button>
                  </div>
                </div>

                {/* Right Side: Video Feed */}
                <div className="rounded-xl p-6 border-2 border-white/40 bg-white/70 backdrop-blur-md shadow-xl">
                  <LipReader ref={lipReaderRef} />
                </div>
              </div>

              {/* Recording Controls - Compact Layout */}
              <div className="rounded-xl p-6 border-2 border-white/40 bg-white/70 backdrop-blur-md shadow-xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Volume Bar */}
                  <div className="flex flex-col justify-center">
                    <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                      </svg>
                      Volume
                    </div>
                    <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        id="volume-bar"
                        className="h-full bg-green-500 transition-all duration-100 ease-out"
                        style={{ width: '0%' }}
                      />
                    </div>
                  </div>

                  {/* Status indicator */}
                  <div className="flex flex-col justify-center">
                    {loading ? (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                        <span>Processing...</span>
                      </div>
                    ) : isListening ? (
                      <div className="flex items-center gap-2 text-sm text-red-600">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                        <span>Recording live...</span>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500"></div>
                    )}
                  </div>

                  {/* Recording and Playback Controls */}
                  <div className="flex items-center justify-center gap-4">
                    {/* Live Recording Button */}
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={isListening ? stopListening : runAssessment}
                        disabled={!ready || loading}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl ${
                          isListening 
                            ? 'bg-red-600 hover:bg-red-700' 
                            : 'bg-red-500 hover:bg-red-600'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {processingRecording ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : isListening ? (
                          <Square className="w-4 h-4 text-white" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-white"></div>
                        )}
                      </button>
                      <span className="text-xs font-medium text-gray-600">Record</span>
                    </div>

                    {/* Audio Playback Controls */}
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={() => {
                          lipReaderRef.current?.startPlayback();
                        }}
                        disabled={!ready || !hasRecordedData}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl ${
                          ready && hasRecordedData
                            ? 'bg-green-600 hover:bg-green-700 text-white' 
                            : 'bg-gray-400/50 text-gray-200/50 cursor-not-allowed'
                        }`}
                      >
                        <Play className="w-4 h-4 ml-0.5" />
                      </button>
                      <span className="text-xs font-medium text-gray-600">Play</span>
                    </div>
                    
                    <div className="flex flex-col items-center gap-2">
                      <button 
                        onClick={resetRecording} 
                        disabled={!ready || !hasRecordedData}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl ${
                          ready && hasRecordedData
                            ? 'bg-gray-600 hover:bg-gray-700 text-white' 
                            : 'bg-gray-400/50 text-gray-200/50 cursor-not-allowed'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-medium text-gray-600">Clear</span>
                    </div>
                  </div>
                </div>
              </div>



              {/* Combined Overall Score and Performance Overview */}
              <div className="rounded-xl border-2 border-white/40 bg-white/75 backdrop-blur-md shadow-xl p-6" data-results>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">Performance overview:</h2>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-600">Overall pronunciation score:</div>
                    <div className={`text-4xl font-bold ${
                      overall !== null 
                        ? overall >= 90 ? 'text-green-600' : overall >= 80 ? 'text-yellow-600' : overall >= 70 ? 'text-orange-600' : 'text-red-600'
                        : 'text-black'
                    }`}>
                      {overall !== null ? `${overall.toFixed(1)} / 100` : "N/A"}
                    </div>
                  </div>
                </div>
                <div className="h-96 mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart 
                      data={reviews.map(r => ({
                        category: r.title,
                        score: typeof r.score === "number" ? r.score : 0,
                        fullMark: 100,
                        description: r.text
                      }))}
                      margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                    >
                      <PolarGrid 
                        stroke="#000000" 
                        strokeWidth={1}
                        fill="transparent"
                      />
                      <PolarAngleAxis 
                        dataKey="category" 
                        tick={{ fontSize: 16, fill: '#000000', fontWeight: 'bold' }}
                        className="text-lg font-bold"
                      />
                      <PolarRadiusAxis 
                        angle={90} 
                        domain={[0, 100]} 
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickCount={6}
                      />
                      <Radar
                        name="Score"
                        dataKey="score"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={0.3}
                        strokeWidth={3}
                        dot={{ fill: '#10b981', strokeWidth: 2, r: 5 }}
                        animationBegin={0}
                        animationDuration={1500}
                        animationEasing="ease-out"
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Category Details with Hover Info */}
                <div className="grid md:grid-cols-2 gap-4">
                  {reviews.map((r) => (
                    <div key={r.title} className="group relative rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{r.title}</span>
                          <div className="relative group/info">
                            <span className="text-xs bg-gray-100 hover:bg-gray-200 rounded-full w-4 h-4 flex items-center justify-center cursor-help transition-colors">
                              i
                            </span>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover/info:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                              {r.text}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        </div>
                        <div className="text-lg font-bold">
                          {typeof r.score === "number" ? `${r.score.toFixed(1)}%` : "N/A"}
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${typeof r.score === "number" ? r.score : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Miscue summary */}
              {(miscueCounts.omission || miscueCounts.insertion || miscueCounts.substitution) ? (
                <div className="rounded-xl border p-4">
                  <div className="font-semibold mb-2">Miscues</div>
                  <div className="text-sm text-gray-700">
                    Omission: {miscueCounts.omission} · Insertion: {miscueCounts.insertion} · Substitution: {miscueCounts.substitution}
                  </div>
                </div>
              ) : null}

                  {/* Per-word analysis */}
                  <div className="rounded-xl border-2 border-white/40 bg-white/75 backdrop-blur-md shadow-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="font-semibold">Per-word analysis:</h2>
                        <div className="group relative">
                          <span className="inline-flex items-center justify-center w-4 h-4 text-xs font-semibold text-gray-500 bg-gray-200 rounded-full cursor-help">i</span>
                          <div className="absolute right-0 top-6 w-64 p-3 bg-black text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                            Shows pronunciation accuracy for each word you spoke. Green borders indicate high accuracy, red borders show words that need practice.
                          </div>
                        </div>
                      </div>
                    {words.length > 0 ? (
                      <>
                        {lang !== "en-US" && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center gap-2 text-green-800">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm font-medium">Phoneme-level pronunciation assessment not supported for this language.</span>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {words.map((w, i) => {
                          const wAcc = w?.PronunciationAssessment?.AccuracyScore;
                          const err = w?.PronunciationAssessment?.ErrorType;
                          const low = typeof wAcc === "number" && wAcc < LOW_WORD;

                          // Color coding based on accuracy score
                          const getScoreColor = (score: number) => {
                            if (score >= 90) return "border-green-500";
                            if (score >= 80) return "border-yellow-500";
                            if (score >= 70) return "border-orange-500";
                            return "border-red-500";
                          };

                          return (
                            <div key={i} className={`border-2 rounded-lg p-4 border-white/40 bg-white/75 backdrop-blur-md shadow-xl ${low ? "border-amber-400" : ""}`}>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-lg">{w.Word}</span>
                                  <button
                                    onClick={() => speakWord(w.Word)}
                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                    title="Listen to pronunciation"
                                  >
                                    <Volume2 className="w-4 h-4" />
                                  </button>
                                </div>
                                {typeof wAcc === "number" && (
                                  <span className={`text-sm px-3 py-1 rounded-lg border-2 font-semibold ${getScoreColor(wAcc)}`}>
                                    {wAcc.toFixed(1)}%
                                  </span>
                                )}
                              </div>
                              {err && err !== "None" && (
                                <div className="text-xs px-2 py-1 rounded mb-2 border-2 border-white/40 bg-white/75 backdrop-blur-md">
                                  {err}
                                </div>
                              )}

                              {/* Show phonemes only for English */}
                              {lang === "en-US" && w.Phonemes?.length ? (
                                <div className="mt-3">
                                  <div className="text-xs font-medium text-gray-600 mb-2">Phonemes:</div>
                                  <div className="flex flex-wrap gap-1">
                                    {w.Phonemes.map((p, j) => {
                                      const pAcc = p?.PronunciationAssessment?.AccuracyScore ?? 100;
                                      const symbol = toIPA(p.Phoneme) ?? p.Phoneme;
                                      const bad = pAcc < LOW_PHONE;
                                      const tip = PHONEME_TIPS[symbol] || `Pronounce as ${p.Phoneme}`;
                                      return (
                                        <span
                                          key={j}
                                          className={`inline-block px-2 py-1 text-xs rounded-lg border cursor-pointer hover:bg-gray-100 transition-colors ${bad ? "border-red-300" : "border-gray-300"}`}
                                          title={`Accuracy: ${pAcc.toFixed(1)}%\n\n${tip}\n\nClick to hear pronunciation`}
                                          onClick={() => speakPhoneme(p.Phoneme)}
                                        >
                                          /{symbol}/
                                          <span className="ml-1">({pAcc.toFixed(0)})</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : lang === "en-US" && w.Syllables?.length ? (
                                <div className="mt-3 text-sm text-gray-500">No phoneme stream available</div>
                              ) : lang === "en-US" ? (
                                <div className="mt-3 text-sm text-gray-500">No phoneme data available</div>
                              ) : null}

                              {/* Target syllable chunks (comparison) - only for English */}
                              {lang === "en-US" && w.Syllables?.length ? (
                                <div className="mt-3">
                                  <div className="text-xs font-medium text-gray-600 mb-2">Target syllables:</div>
                                  <div className="text-sm">
                                    {w.Syllables.map((syl, k) => {
                                      const chunks: string[] =
                                        syl.Syllable.match(/dh|ch|jh|sh|zh|th|ng|rr|[a-z]+/gi) ?? [syl.Syllable];
                                      return (
                                        <span key={k} className="inline-block mr-2">
                                          <span className="font-medium">{syl.Grapheme ?? w.Word}</span>{" "}
                                          {chunks.map((ph, m) => {
                                            const symbol = toIPA(ph) ?? ph;
                                            return <span key={m} className="text-gray-500">/{symbol}/</span>;
                                          })}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-lg font-medium">N/A</div>
                        <div className="text-sm">Complete a recording to see word analysis</div>
                      </div>
                    )}
                  </div>

                  {/* Phoneme Heatmap - only for English */}
                  <div className="rounded-xl border-2 border-white/40 bg-white/75 backdrop-blur-md shadow-xl p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold">Phoneme accuracy heatmap:</h2>
                        <div className="group relative">
                          <span className="inline-flex items-center justify-center w-4 h-4 text-xs font-semibold text-gray-500 bg-gray-200 rounded-full cursor-help">i</span>
                          <div className="absolute right-0 top-6 w-64 p-3 bg-black text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                            Visual heatmap showing accuracy for each phoneme (speech sound). Red indicates phonemes you should practice more, green shows well-pronounced sounds.
                          </div>
                        </div>
                      </div>
                    {lang === "en-US" && Object.keys(phonemeScores).length > 0 ? (
                      <PhonemeHeatmap phonemeScores={phonemeScores} />
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-lg font-medium">N/A</div>
                        <div className="text-sm">
                          {lang !== "en-US" 
                            ? "Phoneme assessment not supported for this language" 
                            : "Complete a recording to see phoneme analysis"
                          }
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lowest Accuracy Phonemes Practice */}
                  <div className="rounded-xl border-2 border-white/40 bg-white/75 backdrop-blur-md shadow-xl p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold">Lowest accuracy phonemes:</h2>
                        <div className="group relative">
                          <span className="inline-flex items-center justify-center w-4 h-4 text-xs font-semibold text-gray-500 bg-gray-200 rounded-full cursor-help">i</span>
                          <div className="absolute right-0 top-6 w-64 p-3 bg-black text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                            Lists phonemes where your accuracy is below 90%. Click "Practice this sound" to get targeted sentences for improvement.
                          </div>
                        </div>
                      </div>
                    {lang === "en-US" && lowestAccuracyPhonemes.length > 0 ? (
                      <>
                        {lowestAccuracyPhonemes.filter(item => item.accuracy < 90).length > 0 ? (
                          <div className="space-y-4">
                            {lowestAccuracyPhonemes.filter(item => item.accuracy < 90).map((item, index) => (
                              <div key={index} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <span 
                                      className="text-lg font-bold text-gray-800 cursor-pointer hover:text-blue-600 transition-colors"
                                      onClick={() => speakPhoneme(item.phoneme)}
                                      title={`Click to hear pronunciation\n\n${PHONEME_TIPS[item.phoneme] || `Pronounce as ${item.phoneme}`}`}
                                    >
                                      /{item.phoneme}/
                                    </span>
                                    <span className={`px-2 py-1 rounded text-sm font-medium ${
                                      item.accuracy >= 80 ? 'bg-green-100 text-green-800' :
                                      item.accuracy >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-red-100 text-red-800'
                                    }`}>
                                      {item.accuracy.toFixed(1)}%
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => generatePracticeSentences(item.phoneme)}
                                    disabled={generatingPractice === item.phoneme}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                  >
                                    {generatingPractice === item.phoneme ? (
                                      <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Generating...
                                      </>
                                    ) : (
                                      "Practice this sound"
                                    )}
                                  </button>
                                </div>
                                <div className="text-sm text-gray-600">
                                  Click "Practice this sound" to generate a sentence containing this phoneme for focused practice.
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className="text-lg font-medium text-green-600 mb-2">🎉 Congratulations!</div>
                            <div className="text-gray-600">You didn't struggle on any phonemes this session!</div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-lg font-medium">N/A</div>
                        <div className="text-sm">
                          {lang !== "en-US" 
                            ? "Phoneme assessment not supported for this language" 
                            : "Complete a recording to see phoneme analysis"
                          }
                        </div>
                      </div>
                    )}
        </div>

            </TabsContent>

            <TabsContent value="dashboard" className="space-y-6">
              <ProgressDashboard />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
      )}
    </main>
  );
}