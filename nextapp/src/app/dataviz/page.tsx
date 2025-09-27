"use client";

import React from "react";
import PhonemeHeatmap from "../../components/PhonemeHeatmap";
import ProgressDashboard from "../../components/ProgressDashboard";
import PhonemeTable from "../../components/PhonemeTable";

import { extractPhonemeScores } from "../../utils/parseAzure";
import sampleData from "../../data/sampleAzure.json";

export default function HomePage() {
  // 🔹 Hard-coded phoneme accuracy data (mocked as if Azure returned it)
//   const phonemeScores = {
//     "θ": 58,   // "th" in "think"
//     "ɪ": 92,   // "i" in "bit"
//     "ŋ": 75,   // "ng" in "sing"
//     "k": 80,   // "k" in "cat"
//     "r": 65,   // "r" in "red"
//     "æ": 50,   // "a" in "cat"
//     "ʃ": 10,   // "sh" in "ship"
//   };

  const phonemeScores = extractPhonemeScores(sampleData);

  const sessions = [1, 2, 3, 4, 5];
  const mastered = [20, 30, 40, 55, 70];
  const improving = [40, 35, 30, 25, 20];
  const needsWork = [40, 35, 30, 20, 10];

  return (
    <main style={{ padding: "2rem" }}>
      <h1 className="text-2xl font-bold mb-4">Dataviz Test Page</h1>

	  {/* Table Section */}
      <section style={{ marginBottom: "3rem" }}>
        <h2 className="text-xl font-semibold mb-2">Phoneme Scores Table</h2>
        <PhonemeTable phonemeScores={phonemeScores} />
      </section>

      {/* Heatmap Section */}
      {/* <section style={{ marginBottom: "4rem" }}>
        <h2 className="text-xl font-semibold mb-2">Phoneme Heatmap</h2>
        <PhonemeHeatmap phonemeScores={phonemeScores} />
      </section> */}
	  <main style={{ padding: "2rem" }}>
        <h1>Test: Azure → Phoneme Heatmap</h1>
        <PhonemeHeatmap phonemeScores={phonemeScores} />
      </main>

      {/* Progress Dashboard Section */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Progress Dashboard</h2>
        <ProgressDashboard
          sessions={sessions}
          mastered={mastered}
          improving={improving}
          needsWork={needsWork}
        />
      </section>
    </main>
  );
}
