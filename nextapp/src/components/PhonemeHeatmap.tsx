// heatmap to show accuracy of each phenome type
"use client";

import React from "react";
import Plot from "react-plotly.js";

interface HeatmapProps {
  phonemeScores: { [key: string]: number };
}

export default function PhonemeHeatmap({ phonemeScores }: HeatmapProps) {
  const phonemes = Object.keys(phonemeScores);
  const scores = Object.values(phonemeScores);

  return (
    <Plot
      data={[{
        z: [scores],
        x: phonemes,
        y: [""],
        type: "heatmap",
        colorscale: "RdYlGn",
        zmin: 0,
        zmax: 100,
      }]}
      layout={{ title: { text: "Phonetic Profile Heatmap" }}}
      style={{ width: "100%", height: "400px" }}
    />
  );
}
