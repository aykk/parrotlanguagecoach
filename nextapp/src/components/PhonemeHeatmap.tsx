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
    "l": "Say 'l' as in 'let'. Touch your tongue tip to the ridge behind your teeth and let air flow around the sides.",
    "r": "Say 'r' as in 'red'. Curl your tongue tip back or bunch it in the middle of your mouth.",
    "ɹ": "Say 'r' as in 'red'. Put your tongue tip near the ridge behind your teeth.",
    
    // Glides
    "w": "Say 'w' as in 'wet'. Round your lips and move your tongue to the back of your mouth.",
    "j": "Say 'y' as in 'yes'. Keep your tongue high and forward in your mouth.",
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
