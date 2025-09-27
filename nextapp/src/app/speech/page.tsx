"use client";

import { useEffect, useRef, useState } from "react";

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

type Lang = "en-US" | "es-ES";
const SAMPLE_BY_LANG: Record<Lang, string> = {
  "en-US": "The quick brown fox jumps over the lazy dog.",
  "es-ES": "El zorro marrón salta sobre el perro perezoso.",
};

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
  const [showIPA, setShowIPA] = useState(false);

  // Recording / playback
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

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

  const refText = useRef(SAMPLE_BY_LANG["en-US"]);

  useEffect(() => {
    (async () => {
      const _sdk = await import("microsoft-cognitiveservices-speech-sdk");
      setSdk(_sdk);
      setReady(true);
    })();
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySampleForLang = () => {
    refText.current = SAMPLE_BY_LANG[lang];
    const el = document.getElementById("ref-input") as HTMLInputElement | null;
    if (el) el.value = refText.current;
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

  // ----- Token -----
  const getToken = async () => {
    const r = await fetch(TOKEN_ROUTE, { cache: "no-store" });
    const ctype = r.headers.get("content-type") || "";
    if (ctype.includes("application/json")) return r.json();
    const body = await r.text();
    throw new Error(`Token route returned non-JSON.\nStatus: ${r.status}\nBody:\n${body.slice(0, 400)}`);
  };

  // --- STT sanity check ---
  const testSTT = async () => {
    if (!sdk) return;
    setStatus("Getting token…");
    resetRecording();
    try {
      const { token, region, error } = await getToken();
      if (error) throw new Error(error);

      const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechRecognitionLanguage = lang;
      speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, "7000");
      speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "1500");

      const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

      await startRecording();
      setStatus(`Listening (STT ${lang})… Speak now.`);
      recognizer.recognizeOnceAsync(
        (res: any) => {
          stopRecording();
          setStatus(`STT Result: ${sdk.ResultReason[res.reason]} :: ${res.text || "(empty)"}`);
          recognizer.close();
        },
        (err: any) => {
          stopRecording();
          setStatus(`STT error: ${String(err)}`);
          recognizer.close();
        }
      );
    } catch (e: any) {
      stopRecording();
      setStatus(`STT exception: ${e.message || String(e)}`);
    }
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
    resetRecording();

    try {
      const { token, region, error } = await getToken();
      if (error) throw new Error(error);

      const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechRecognitionLanguage = lang;
      speechConfig.setProperty(sdk.PropertyId.SpeechServiceResponse_OutputFormatOption, "detailed");
      speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, "7000");
      speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "1500");

      const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

      const paConfig = new sdk.PronunciationAssessmentConfig(
        refText.current,
        sdk.PronunciationAssessmentGradingSystem.HundredMark,
        sdk.PronunciationAssessmentGranularity.Phoneme,
        true // miscue detection
      );
      paConfig.enableProsodyAssessment = true; // for Prosody
      paConfig.applyTo(recognizer);

      await startRecording();
      setStatus(`Listening (PA ${lang})… Speak clearly.`);
      await new Promise<void>((resolve, reject) => {
        recognizer.startContinuousRecognitionAsync(resolve, reject);
      });

      const result: any = await new Promise((resolve) => {
        recognizer.recognized = (_: any, e: any) => {
          if (e?.result?.reason === sdk.ResultReason.RecognizedSpeech || e?.result?.reason === sdk.ResultReason.RecognizedIntent) {
            recognizer.stopContinuousRecognitionAsync(() => resolve(e.result));
          }
        };
      });

      stopRecording();
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

      if (parsed?.RecognitionStatus === "NoMatch") {
        setStatus("NoMatch (heard silence/noise). Check mic permission, device, and gain, then try again.");
      } else {
        setStatus("Done.");
      }
    } catch (e: any) {
      stopRecording();
      setStatus(`Error: ${e.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  // Derived helpers for reviews
  const issueWords = words.filter((w) => {
    const err = w?.PronunciationAssessment?.ErrorType;
    const wAcc = w?.PronunciationAssessment?.AccuracyScore ?? 100;
    return (err && err !== "None") || wAcc < LOW_WORD;
  });
  const miscueCounts = words.reduce(
    (acc, w) => {
      const et = w?.PronunciationAssessment?.ErrorType;
      if (et === "Omission") acc.omission++;
      else if (et === "Insertion") acc.insertion++;
      else if (et === "Substitution") acc.substitution++;
      return acc;
    },
    { omission: 0, insertion: 0, substitution: 0 }
  );
  const lowPhonemeCount = words.reduce((sum, w) =>
    sum + (w.Phonemes ?? []).reduce((s, p) => s + ((p?.PronunciationAssessment?.AccuracyScore ?? 100) < LOW_PHONE ? 1 : 0), 0)
  , 0);

  function band(n?: number | null) {
    if (typeof n !== "number") return "N/A";
    if (n >= 95) return "excellent";
    if (n >= 90) return "strong";
    if (n >= 80) return "good";
    if (n >= 70) return "fair";
    return "needs work";
  }

  const reviews = [
    {
      title: "Accuracy",
      score: accScore,
      text:
        `Your accuracy is ${band(accScore)}${
          lowPhonemeCount ? ` (found ${lowPhonemeCount} low-scoring phoneme${lowPhonemeCount === 1 ? "" : "s"}).` : "."
        } Focus on the highlighted phonemes to tighten articulation.`,
    },
    {
      title: "Fluency",
      score: fluencyScore,
      text:
        `Fluency is ${band(fluencyScore)}. Keep a steady pace and keep pauses short; practice reading the reference in one smooth breath group.`,
    },
    {
      title: "Prosody",
      score: prosodyScore,
      text:
        `Prosody/intonation is ${band(prosodyScore)}. Add pitch movement on important words; contrast statements vs. questions to add contour.`,
    },
    {
      title: "Completeness",
      score: completenessScore,
      text:
        `Completeness is ${band(completenessScore)}${
          miscueCounts.omission || miscueCounts.insertion || miscueCounts.substitution
            ? ` (O:${miscueCounts.omission} I:${miscueCounts.insertion} S:${miscueCounts.substitution}).`
            : "."
        } Match the reference closely to avoid omissions and insertions.`,
    },
  ];

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Azure Speech — Pronunciation Assessment</h1>

      {/* Language + Reference sentence */}
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium">Language</span>
          <select
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
          >
            <option value="en-US">English (en-US)</option>
            <option value="es-ES">Español (es-ES)</option>
          </select>
          <button
            type="button"
            className="mt-2 rounded-lg border px-3 py-1 text-sm"
            onClick={applySampleForLang}
            title="Replace the reference sentence with a sample for the selected language"
          >
            Use sample sentence
          </button>
        </label>

        <label className="block">
          <span className="text-sm font-medium">Reference sentence</span>
          <input
            id="ref-input"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            defaultValue={refText.current}
            onChange={(e) => (refText.current = e.target.value)}
            placeholder={SAMPLE_BY_LANG[lang]}
          />
        </label>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={runAssessment}
          disabled={!ready || loading}
          className="rounded-2xl px-4 py-2 shadow font-medium border hover:shadow-md disabled:opacity-50"
        >
          {loading ? "Listening…" : "Record & Assess (PA)"}
        </button>

        <button
          onClick={testSTT}
          disabled={!ready || loading}
          className="rounded-2xl px-3 py-2 border text-sm hover:shadow"
        >
          Test STT (no PA)
        </button>

        <button
          onClick={async () => {
            try {
              const r = await fetch(TOKEN_ROUTE, { cache: "no-store" });
              const ct = r.headers.get("content-type");
              const body = await r.text();
              alert(`Status: ${r.status}\nCT: ${ct}\n\nBody (first 300 chars):\n${body.slice(0,300)}`);
            } catch (e: any) {
              alert(`Debug error: ${e.message || String(e)}`);
            }
          }}
          className="rounded-2xl px-3 py-2 border text-sm hover:shadow"
        >
          Debug token route
        </button>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showIPA} onChange={(e) => setShowIPA(e.target.checked)} />
          Show IPA
        </label>
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

      {/* Per-word & phonemes */}
      {words.length > 0 && (
        <div className="rounded-xl border p-4">
          <h2 className="font-semibold mb-2">Per-word & phonemes</h2>
          <div className="space-y-3">
            {words.map((w, i) => {
              const wAcc = w?.PronunciationAssessment?.AccuracyScore;
              const err = w?.PronunciationAssessment?.ErrorType;
              const low = typeof wAcc === "number" && wAcc < LOW_WORD;

              return (
                <div key={i} className={`border rounded-lg p-3 ${low ? "border-amber-400" : ""}`}>
                  <div className="font-medium flex flex-wrap items-center gap-2">
                    <span>{w.Word}</span>
                    {typeof wAcc === "number" && (
                      <span className={`text-xs ${low ? "text-amber-600" : "text-gray-500"}`}>
                        ({wAcc.toFixed(1)})
                      </span>
                    )}
                    {err && err !== "None" && (
                      <span className="text-xs text-red-500">{err}</span>
                    )}
                  </div>

                  {/* Spoken phonemes */}
                  {w.Phonemes?.length ? (
                    <div className="mt-1 text-sm">
                      {w.Phonemes.map((p, j) => {
                        const pAcc = p?.PronunciationAssessment?.AccuracyScore ?? 100;
                        const symbol = showIPA ? (toIPA(p.Phoneme) ?? p.Phoneme) : p.Phoneme;
                        const bad = pAcc < LOW_PHONE;
                        return (
                          <span
                            key={j}
                            className={`inline-block mr-2 ${bad ? "bg-red-50 text-red-700 rounded px-1" : ""}`}
                            title={`Accuracy: ${pAcc.toFixed(1)}`}
                          >
                            /{symbol}/
                            <span className="text-xs text-gray-500"> {pAcc.toFixed(1)}</span>
                          </span>
                        );
                      })}
                    </div>
                  ) : w.Syllables?.length ? (
                    <div className="mt-1 text-sm text-gray-500">No phoneme stream; showing syllables below.</div>
                  ) : (
                    <div className="text-sm text-gray-500 mt-1">No phoneme data.</div>
                  )}

                  {/* Target syllable chunks (comparison) */}
                  {w.Syllables?.length ? (
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
                                const symbol = showIPA ? (toIPA(ph) ?? ph) : ph;
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

      {lastJson && (
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer font-medium">Raw JSON (NBest)</summary>
          <pre className="mt-3 text-xs whitespace-pre-wrap break-words">
            {JSON.stringify(lastJson, null, 2)}
          </pre>
        </details>
      )}

      <p className="text-xs text-gray-500">
        Tip: Set the language to match your reference and speech (e.g., en-US or es-ES). Hover the ⓘ icons to see what each score means.
      </p>
    </div>
  );
}
