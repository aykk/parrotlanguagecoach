/*
Stacked area chart showing % of sounds
“Mastered,” “Improving,” or “Needs Work”
over practice sessions

Lets learners see improvement over time
*/

import React from "react";
import Plot from "react-plotly.js";

interface ProgressProps {
  sessions: number[];
  mastered: number[];
  improving: number[];
  needsWork: number[];
}

const ProgressDashboard: React.FC<ProgressProps> = ({ sessions, mastered, improving, needsWork }) => {
  return (
    <Plot
      data={[
        { x: sessions, y: mastered, stackgroup: "one", name: "Mastered", line: { color: "green" }, type: "scatter" },
        { x: sessions, y: improving, stackgroup: "one", name: "Improving", line: { color: "yellow" }, type: "scatter" },
        { x: sessions, y: needsWork, stackgroup: "one", name: "Needs Work", line: { color: "red" }, type: "scatter" },
      ]}
      layout={{
        title: { text: "Progress Tracking Dashboard" },
        xaxis: { title: { text: "Session" } },
        yaxis: { title: { text: "Proportion (%)" } },
      } as any}
      style={{ width: "100%", height: "400px" }}
    />
  );
};

export default ProgressDashboard;