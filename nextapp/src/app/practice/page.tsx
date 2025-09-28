"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { progressTracker } from "@/lib/progress-tracker";
import { AuthHeader } from "@/components/auth-header";
import { ProgressDashboard } from "@/components/progress-dashboard";
import PhonemeHeatmap from "@/components/PhonemeHeatmap";
import { extractPhonemeScores } from "@/lib/parse-azure";
import { aiPhraseGenerator } from "@/lib/ai-phrase-generator";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "@radix-ui/react-icons";
import { Volume2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";

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
    ProsodyScore?: number;
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
    <div className="rounded-xl border p-4">
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
  const [prosodyScore, setProsodyScore] = useState<number | null>(null); // Prosody (Intonation)
  const [completenessScore, setCompletenessScore] = useState<number | null>(null); // Completeness

  // Results & UI
  const [words, setWords] = useState<Word[]>([]);
  const [lastJson, setLastJson] = useState<any>(null);
  const [phonemeScores, setPhonemeScores] = useState<{ [phoneme: string]: number }>({});

  // AI Generation
  const [complexity, setComplexity] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAIGenerated, setIsAIGenerated] = useState(false);

  // Recording / playback
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognizerRef = useRef<any>(null);

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
    "i": "Like 'ee' in 'see'. Keep tongue high and front.",
    "ɪ": "Like 'i' in 'sit'. Tongue slightly lower than 'ee'.",
    "e": "Like 'e' in 'bed'. Tongue mid-high, front.",
    "ɛ": "Like 'e' in 'bet'. Tongue mid-low, front.",
    "æ": "Like 'a' in 'cat'. Tongue low, front.",
    "ɑ": "Like 'a' in 'father'. Tongue low, back.",
    "ɔ": "Like 'o' in 'bought'. Tongue mid-low, back.",
    "o": "Like 'o' in 'go'. Tongue mid-high, back.",
    "u": "Like 'oo' in 'food'. Tongue high, back.",
    "ʊ": "Like 'u' in 'put'. Tongue slightly lower than 'oo'.",
    "ʌ": "Like 'u' in 'but'. Tongue mid, central.",
    "ə": "Like 'a' in 'about'. Tongue mid, central (schwa).",
    "ɝ": "Like 'er' in 'her'. Tongue mid, central, r-colored.",
    "ɚ": "Like 'er' in 'butter'. Tongue mid, central, r-colored.",
    
    // Diphthongs
    "eɪ": "Like 'ay' in 'say'. Start with 'e', glide to 'ɪ'.",
    "aɪ": "Like 'i' in 'time'. Start with 'a', glide to 'ɪ'.",
    "ɔɪ": "Like 'oy' in 'boy'. Start with 'ɔ', glide to 'ɪ'.",
    "aʊ": "Like 'ow' in 'cow'. Start with 'a', glide to 'ʊ'.",
    "oʊ": "Like 'o' in 'go'. Start with 'o', glide to 'ʊ'.",
    
    // Consonants - Stops
    "p": "Like 'p' in 'pat'. Close lips, release with burst.",
    "b": "Like 'b' in 'bat'. Close lips, release with voice.",
    "t": "Like 't' in 'top'. Tongue tip to alveolar ridge.",
    "d": "Like 'd' in 'dog'. Tongue tip to alveolar ridge, voiced.",
    "k": "Like 'k' in 'cat'. Back of tongue to soft palate.",
    "g": "Like 'g' in 'go'. Back of tongue to soft palate, voiced.",
    
    // Fricatives
    "f": "Like 'f' in 'fish'. Lower lip to upper teeth.",
    "v": "Like 'v' in 'van'. Lower lip to upper teeth, voiced.",
    "θ": "Like 'th' in 'think'. Tongue tip between teeth.",
    "ð": "Like 'th' in 'this'. Tongue tip between teeth, voiced.",
    "s": "Like 's' in 'sun'. Tongue tip near alveolar ridge.",
    "z": "Like 'z' in 'zoo'. Tongue tip near alveolar ridge, voiced.",
    "ʃ": "Like 'sh' in 'shoe'. Tongue tip near hard palate.",
    "ʒ": "Like 's' in 'measure'. Tongue tip near hard palate, voiced.",
    "h": "Like 'h' in 'hat'. Open glottis, no constriction.",
    
    // Affricates
    "t͡ʃ": "Like 'ch' in 'church'. Start like 't', end like 'ʃ'.",
    "d͡ʒ": "Like 'j' in 'judge'. Start like 'd', end like 'ʒ'.",
    
    // Nasals
    "m": "Like 'm' in 'man'. Close lips, air through nose.",
    "n": "Like 'n' in 'no'. Tongue tip to alveolar ridge, air through nose.",
    "ŋ": "Like 'ng' in 'sing'. Back of tongue to soft palate, air through nose.",
    
    // Liquids
    "l": "Like 'l' in 'let'. Tongue tip to alveolar ridge, sides down.",
    "r": "Like 'r' in 'red'. Tongue tip curled back or bunched.",
    "ɹ": "Like 'r' in 'red'. Tongue tip near alveolar ridge.",
    
    // Glides
    "w": "Like 'w' in 'wet'. Round lips, tongue back.",
    "j": "Like 'y' in 'yes'. Tongue high, front.",
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
      if (audioUrl) URL.revokeObjectURL(audioUrl);
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
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(blob));
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
    stopRecording();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    mediaChunksRef.current = [];
  }

  const stopListening = () => {
    if (recognizerRef.current && isListening) {
      recognizerRef.current.stopContinuousRecognitionAsync();
      setIsListening(false);
      setStatus("Stopped listening manually");
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
    setStatus("Getting token…");

    // Reset scores/results
    setOverall(null);
    setAccScore(null);
    setFluencyScore(null);
    setProsodyScore(null);
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
      paConfig.enableProsodyAssessment = true; // for Prosody
      
      // Enable phoneme assessment for all languages
      paConfig.enablePhonemeAssessment = true;
      
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

      const jsonStr = result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult);
      const parsed = JSON.parse(jsonStr);
      setLastJson(parsed);

      const nbest = parsed?.NBest?.[0];
      const pa = nbest?.PronunciationAssessment || {};

      // Top scores (all direct from Azure PA)
      setOverall(typeof pa.PronScore === "number" ? pa.PronScore : null);
      setAccScore(typeof pa.AccuracyScore === "number" ? pa.AccuracyScore : null);
      setFluencyScore(typeof pa.FluencyScore === "number" ? pa.FluencyScore : null);
      setProsodyScore(typeof pa.ProsodyScore === "number" ? pa.ProsodyScore : null);
      setCompletenessScore(typeof pa.CompletenessScore === "number" ? pa.CompletenessScore : null);
      

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
          ? wordsWithPhonemes.flatMap((word) => word.Phonemes?.map(p => p.Phoneme) || [])
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
          
          const savedSession = await progressTracker.addSession(sessionData);
          
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
    }
  };

  // Derived helpers
  const reviews = [
    {
      title: "Accuracy",
      score: accScore,
      text: accScore && accScore < 80 ? "Focus on pronouncing each sound clearly. Practice individual phonemes that scored low." : "Great pronunciation accuracy! Keep up the excellent work."
    },
    {
      title: "Fluency",
      score: fluencyScore,
      text: fluencyScore && fluencyScore < 80 ? "Work on speaking more smoothly. Practice connecting words naturally without long pauses." : "Excellent fluency! Your speech flows naturally."
    },
    {
      title: "Prosody",
      score: prosodyScore,
      text: prosodyScore && prosodyScore < 80 ? "Focus on intonation and rhythm. Practice the natural melody of the language." : "Great prosody! Your intonation sounds natural."
    },
    {
      title: "Completeness",
      score: completenessScore,
      text: completenessScore && completenessScore < 80 ? "Make sure to say all the words. Practice the complete sentence without skipping parts." : "Perfect completeness! You said everything clearly."
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
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center">
          <Button 
            onClick={() => router.push("/")}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowLeftIcon className="size-4" />
            Back to Home
          </Button>
          <AuthHeader />
        </div>

        <div className="max-w-4xl mx-auto space-y-6">

          <Tabs defaultValue="practice" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="practice">Practice</TabsTrigger>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            </TabsList>

            <TabsContent value="practice" className="space-y-6">
              {/* Language + Reference sentence */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-sm font-medium">Language</span>
                      <select
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                        value={lang}
                        onChange={(e) => setLang(e.target.value as Lang)}
                      >
                        {LANGUAGE_OPTIONS.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.flag} {option.name} ({option.code})
                          </option>
                        ))}
                      </select>
                    </label>

                <label className="block">
                  <span className="text-sm font-medium">Reference sentence</span>
                  <textarea
                    id="ref-input"
                    className="mt-1 w-full rounded-lg border px-3 py-2 min-h-[60px] resize-none"
                    defaultValue={refText.current}
                    onChange={(e) => {
                      refText.current = e.target.value;
                      setIsAIGenerated(false);
                      // Auto-resize textarea
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.max(60, e.target.scrollHeight) + 'px';
                    }}
                    placeholder={SAMPLE_BY_LANG[lang]}
                    rows={2}
                  />
                </label>
              </div>

              {/* AI Generation */}
              <div className="rounded-xl border p-4 space-y-4">
                <div className="font-semibold">Generate a sentence for me!</div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Complexity Level: {complexity}/10</label>
                    <Slider
                      value={[complexity]}
                      onValueChange={(value) => setComplexity(value[0])}
                      max={10}
                      min={1}
                      step={1}
                      className="mt-2"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Beginner</span>
                      <span>Advanced</span>
                    </div>
                  </div>
                  <button
                    onClick={generateAISentence}
                    disabled={isGenerating}
                    className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    {isGenerating ? "Generating..." : "Generate"}
                  </button>
                  {isAIGenerated && (
                    <div className="text-sm text-green-600">
                      ✓ AI-generated sentence loaded
                    </div>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={runAssessment}
                  disabled={!ready || loading}
                  className="rounded-2xl px-4 py-2 shadow font-medium border hover:shadow-md disabled:opacity-50"
                >
                  {loading ? "Listening…" : "Record & Assess"}
                </button>
                {isListening && (
                  <button
                    onClick={stopListening}
                    className="rounded-2xl px-4 py-2 shadow font-medium border border-red-500 text-red-600 hover:bg-red-50"
                  >
                    Stop Listening
                  </button>
                )}
              </div>

              <div className="text-sm text-gray-600">Status: {status}</div>

              {/* Playback */}
              <div className="rounded-xl border p-4 space-y-2">
                <div className="font-semibold">Playback</div>
                <div className="text-sm text-gray-600">
                  {isRecording ? "Recording…" : audioUrl ? "Recorded clip ready." : "No recording yet."}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      stopRecording();
                      if (audioUrl) new Audio(audioUrl).play();
                    }}
                    className="rounded-xl px-3 py-1 border text-sm"
                  >
                    Play latest
                  </button>
                  <button onClick={resetRecording} className="rounded-xl px-3 py-1 border text-sm">
                    Clear recording
                  </button>
                </div>
                {audioUrl && <audio className="w-full mt-2" controls src={audioUrl} />}
              </div>

              {/* Score cards WITH hover briefs */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <ScoreCard
                  label="Accuracy"
                  value={accScore}
                  brief="How correctly you pronounce each sound and word compared to a native speaker."
                />
                <ScoreCard
                  label="Fluency"
                  value={fluencyScore}
                  brief="How smoothly and naturally you speak, without long pauses or choppiness."
                />
                <ScoreCard
                  label="Prosody"
                  value={prosodyScore}
                  brief="The rise and fall of your voice—the 'melody' of speech (intonation, rhythm)."
                />
                <ScoreCard
                  label="Completeness"
                  value={completenessScore}
                  brief="Whether you said all expected words without skipping or adding extra ones."
                />
              </div>

              {/* Overall score */}
              {overall !== null && (
                <div className="rounded-xl border p-4">
                  <div className="text-sm text-gray-600">Overall Pronunciation Score</div>
                  <div className="text-3xl font-bold">{overall.toFixed(1)} / 100</div>
                </div>
              )}

              {/* Category Reviews */}
              <div className="rounded-xl border p-4">
                <h2 className="font-semibold mb-2">Category Reviews</h2>
                <div className="grid md:grid-cols-2 gap-3">
                  {reviews.map((r) => (
                    <div key={r.title} className="rounded-lg border p-3">
                      <div className="flex items-baseline justify-between">
                        <div className="font-medium">{r.title}</div>
                        <div className="text-sm text-gray-500">
                          {typeof r.score === "number" ? `${r.score.toFixed(1)}/100` : "N/A"}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{r.text}</p>
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
                  {words.length > 0 && (
                    <div className="rounded-xl border p-4">
                      <h2 className="font-semibold mb-2">Per-word analysis</h2>
                      {lang !== "en-US" && (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-2 text-blue-800">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-sm font-medium">Phoneme-level pronunciation assessment not supported for this language.</span>
                          </div>
                        </div>
                      )}
                      <div className="space-y-3">
                        {words.map((w, i) => {
                          const wAcc = w?.PronunciationAssessment?.AccuracyScore;
                          const err = w?.PronunciationAssessment?.ErrorType;
                          const low = typeof wAcc === "number" && wAcc < LOW_WORD;

                          // Color coding based on accuracy score
                          const getScoreColor = (score: number) => {
                            if (score >= 90) return "text-green-600 border-green-500";
                            if (score >= 80) return "text-yellow-600 border-yellow-500";
                            if (score >= 70) return "text-orange-600 border-orange-500";
                            return "text-red-600 border-red-500";
                          };

                          return (
                            <div key={i} className={`border rounded-lg p-3 ${low ? "border-amber-400" : ""}`}>
                              <div className="font-medium flex flex-wrap items-center gap-2">
                                <span>{w.Word}</span>
                                <button
                                  onClick={() => speakWord(w.Word)}
                                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                                  title="Listen to pronunciation"
                                >
                                  <Volume2 className="w-3 h-3 text-gray-500 hover:text-gray-700" />
                                </button>
                                {typeof wAcc === "number" && (
                                  <span className={`text-xs px-2 py-1 rounded border-2 ${getScoreColor(wAcc)}`}>
                                    {wAcc.toFixed(1)}%
                                  </span>
                                )}
                                {err && err !== "None" && (
                                  <span className="text-xs text-red-500">{err}</span>
                                )}
                              </div>

                              {/* Show phonemes only for English */}
                              {lang === "en-US" && w.Phonemes?.length ? (
                                <div className="mt-1 text-sm">
                                      {w.Phonemes.map((p, j) => {
                                        const pAcc = p?.PronunciationAssessment?.AccuracyScore ?? 100;
                                        const symbol = toIPA(p.Phoneme) ?? p.Phoneme;
                                        const bad = pAcc < LOW_PHONE;
                                        const tip = PHONEME_TIPS[symbol] || `Pronounce as ${p.Phoneme}`;
                                        return (
                                          <span
                                            key={j}
                                            className={`inline-block mr-2 ${bad ? "bg-red-50 text-red-700 rounded px-1" : ""}`}
                                            title={`Accuracy: ${pAcc.toFixed(1)}%\n\n${tip}`}
                                          >
                                            /{symbol}/
                                            <span className="text-xs text-gray-500"> {pAcc.toFixed(1)}</span>
                                          </span>
                                        );
                                      })}
                                </div>
                              ) : lang === "en-US" && w.Syllables?.length ? (
                                <div className="mt-1 text-sm text-gray-500">No phoneme stream; showing syllables below.</div>
                              ) : lang === "en-US" ? (
                                <div className="text-sm text-gray-500 mt-1">No phoneme data.</div>
                              ) : null}

                              {/* Target syllable chunks (comparison) - only for English */}
                              {lang === "en-US" && w.Syllables?.length ? (
                                <div className="mt-2 text-sm">
                                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                                    Target syllable chunks
                                  </div>
                                  <div>
                                    {w.Syllables.map((syl, k) => {
                                      const chunks: string[] =
                                        syl.Syllable.match(/dh|ch|jh|sh|zh|th|ng|rr|[a-z]+/gi) ?? [syl.Syllable];
                                      return (
                                        <span key={k} className="inline-block mr-3">
                                          <span className="underline">{syl.Grapheme ?? w.Word}</span>{" "}
                                      {chunks.map((ph, m) => {
                                        const symbol = toIPA(ph) ?? ph;
                                        return <span key={m} className="inline-block mr-1">/{symbol}/</span>;
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
                    </div>
                  )}

                  {/* Phoneme Heatmap - only for English */}
                  {lang === "en-US" && Object.keys(phonemeScores).length > 0 && (
                    <div className="rounded-xl border p-4">
                      <h2 className="font-semibold mb-4">Phoneme Accuracy Heatmap</h2>
                      <PhonemeHeatmap phonemeScores={phonemeScores} />
                    </div>
                  )}



              <p className="text-xs text-gray-500">
                Tip: Set the language to match your reference and speech (e.g., en-US or es-ES). Hover the ⓘ icons to see what each score means.
              </p>
            </TabsContent>

            <TabsContent value="dashboard" className="space-y-6">
              <ProgressDashboard />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  );
}