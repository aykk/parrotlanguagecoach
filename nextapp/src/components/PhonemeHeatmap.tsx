"use client";

import React, { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";

// Dynamically import Plot to avoid SSR issues
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface HeatmapProps {
  phonemeScores: { [key: string]: number };
}

export default function PhonemeHeatmap({ phonemeScores }: HeatmapProps) {
  const phonemes = Object.keys(phonemeScores);
  const scores = Object.values(phonemeScores);

  const [playingPhoneme, setPlayingPhoneme] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  // Convert phonemes to IPA symbols for display
  const ipaPhonemes = phonemes.map(phoneme => toIPA(phoneme));

  //cache to store sounds instead of new declare every time, reduce latency when playing sounds
  const audioCache = useRef<{ [phoneme: string]: HTMLAudioElement }>({});

  useEffect(() => {
    phonemes.forEach((phoneme) => {
      if (!audioCache.current[phoneme]) {
        const audio = new Audio(`/sounds/${phoneme}.mp3`);
        audio.preload = "auto";

        // If the file doesn't exist, drop it from the cache
        audio.onerror = () => {
          console.warn(`No audio file found for phoneme: ${phoneme}`);
          delete audioCache.current[phoneme];
        };

        audioCache.current[phoneme] = audio;
      }
    });
  }, [phonemes]);

  const playSound = (phoneme: string) => {
    const audio = audioCache.current[phoneme];
    if (!audio) return;

    // If same phoneme is playing → stop it
    if (playingPhoneme === phoneme && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingPhoneme(null);
      audioRef.current = null;
      return;
    }

    // Stop any other active audio
    if (audioRef.current && audioRef.current !== audio) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Use cached audio
    audioRef.current = audio;
    setPlayingPhoneme(phoneme);

    audio.currentTime = 0;
    audio.play().catch((err) => {
      console.error("Audio play error:", err);
      setPlayingPhoneme(null);
      audioRef.current = null;
    });

    audio.onended = () => {
      setPlayingPhoneme(null);
      audioRef.current = null;
    };
  };

  return (
    <div style={{ textAlign: "center" }}>
      {/* Heatmap */}
      <Plot
        data={[
          {
            z: [scores],
            x: ipaPhonemes,
            y: ["Accuracy"],
            type: "heatmap",
            colorscale: [
              [0, "red"],
              [0.5, "yellow"],
              [1, "green"],
            ],
            zmin: 0,
            zmax: 100,
            showscale: false,
            hovertemplate: "%{x}: %{z}% accuracy<extra></extra>",
          } as any,
        ]}
        layout={{
          title: { text: "Phonetic Profile Heatmap" },
          margin: { l: 0, r: 0, t: 40, b: 7 }, // shrink side margins
          xaxis: {
            side: "bottom",
            showgrid: false,
            zeroline: false,
            tickmode: "array",
            //ticks: "",  // hides tick marks
            showticklabels: false, // hides text labels
            visible: true,
          },
          yaxis: {
            showgrid: false,
            zeroline: false,
            showticklabels: false,
            ticks: "",
            visible: false,
          },
        }}
        style={{ width: "100%", height: "400px" }}
      />

      {/* Custom phoneme buttons aligned with columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${phonemes.length}, 1fr)`,
          gap: "6px",
          marginTop: "8px",
        }}
      >
        {phonemes.map((phoneme, index) => (
          <button
            key={phoneme}
            onClick={() => playSound(phoneme)}
            disabled={!!playingPhoneme && playingPhoneme !== phoneme}
            style={{
              padding: "6px 0",
              borderRadius: "6px",
              border: "1px solid #ccc",
              backgroundColor:
                playingPhoneme === phoneme ? "green" : "#f5f5f5",
              color: playingPhoneme === phoneme ? "white" : "black",
              cursor:
                playingPhoneme && playingPhoneme !== phoneme
                  ? "not-allowed"
                  : "pointer",
              transition: "background-color 0.2s ease",
              fontSize: "14px",
              textAlign: "center",
              width: "100%",
            }}
            title={`${phoneme} → ${ipaPhonemes[index]}`}
          >
            {ipaPhonemes[index]}
          </button>
        ))}
      </div>
    </div>
  );
}
