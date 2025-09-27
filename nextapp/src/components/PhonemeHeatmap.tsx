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
        colorscale: [
        [0, "red"],
        [0.5, "yellow"],
        [1, "green"],
      	],
        zmin: 0,
        zmax: 100,

		text: [
            phonemes.map(
              (p, i) => `${p}: ${scores[i]}% accuracy`
            ),
          ],
          hoverinfo: "text", // only show custom text
        } as any,
      ]}
      layout={{
		title: { text: "Phonetic Profile Heatmap" },
		xaxis: { title: { text: "Phonemes" }, fixedrange: true },
        yaxis: { visible: false, fixedrange: true },
		
		}}
      style={{ width: "100%", height: "auto" }}
    />
  );
}
