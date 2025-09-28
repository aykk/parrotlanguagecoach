// table of raw data
"use client";

import React from "react";
import Plot from "react-plotly.js";

interface TableProps {
  phonemeScores: { [key: string]: number };
}

export default function PhonemeTable({ phonemeScores }: TableProps) {
  const phonemes = Object.keys(phonemeScores);
  const scores = Object.values(phonemeScores);

  return (
    <Plot
      data={[
        {
          type: "table",
          header: {
            values: [["<b>Phoneme</b>"], ["<b>Accuracy (%)</b>"]],
            align: "center",
            line: { width: 1, color: "black" },
            fill: { color: "lightgrey" },
            font: { family: "Arial", size: 14, color: "black" },
          },
          cells: {
            values: [phonemes, scores],
            align: "center",
            line: { color: "black", width: 1 },
            fill: { color: "white" },
            font: { family: "Arial", size: 12, color: ["black"] },
          },
        } as any,
      ]}
      layout={{
        title: { text: "Phoneme Scores Table" },
        margin: { t: 50, l: 0, r: 0, b: 0 },
      }}
      style={{ width: "100%", height: "auto"}}
      config={{ responsive: true }}
    />
  );
}
