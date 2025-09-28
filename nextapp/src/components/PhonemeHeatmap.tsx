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

  // Convert phonemes to IPA symbols for display
  const ipaPhonemes = phonemes.map(phoneme => toIPA(phoneme));

  const playSound = (phoneme: string) => {
    // Use browser's speech synthesis instead of audio files
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(phoneme);
      utterance.rate = 0.5; // Slower for phoneme clarity
      utterance.pitch = 1.2; // Slightly higher pitch
      utterance.volume = 0.8;
      
      // Stop any current speech
      speechSynthesis.cancel();
      
      setPlayingPhoneme(phoneme);
      speechSynthesis.speak(utterance);
      
      utterance.onend = () => {
        setPlayingPhoneme(null);
      };
    }
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
            hovertemplate: "<b>%{x}</b><br>Accuracy: %{z}%<br><br>%{customdata}<extra></extra>",
            customdata: ipaPhonemes.map(phoneme => {
              const tip = PHONEME_TIPS[phoneme] || `Pronounce as ${phoneme}`;
              return tip;
            }),
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
            {phonemes.map((phoneme, index) => {
              const ipaSymbol = ipaPhonemes[index];
              const tip = PHONEME_TIPS[ipaSymbol] || `Pronounce as ${phoneme}`;
              return (
                <div key={phoneme} className="relative group">
                  <button
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
                  >
                    {ipaSymbol}
                  </button>
                  {/* Custom tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                    <div className="font-semibold">{phoneme} → {ipaSymbol}</div>
                    <div className="mt-1 max-w-xs">{tip}</div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}
