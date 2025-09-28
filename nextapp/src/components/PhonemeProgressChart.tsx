"use client";

import React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface ProgressProps {
  sessions: number[];
  mastered: number[];
  improving: number[];
  needsWork: number[];
}

const PhonemeProgressChart: React.FC<ProgressProps> = ({ sessions, mastered, improving, needsWork }) => {
  // Transform data for Recharts
  const chartData = sessions.map((session, index) => ({
    session: session,
    mastered: mastered[index] || 0,
    improving: improving[index] || 0,
    needsWork: needsWork[index] || 0,
  }));

  if (chartData.length === 0) {
    return <div className="h-80 flex items-center justify-center text-gray-500">No data available</div>;
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="session" 
            tickFormatter={(session) => `Session ${session}`}
            stroke="#6b7280"
          />
          <YAxis 
            domain={[0, 100]} 
            stroke="#6b7280"
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            labelFormatter={(session) => `Session ${session}`}
            formatter={(value, name) => [`${value}%`, name]}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="needsWork"
            stackId="1"
            stroke="#ef4444"
            fill="#ef4444"
            fillOpacity={0.3}
            name="Needs Work"
          />
          <Area
            type="monotone"
            dataKey="improving"
            stackId="1"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.3}
            name="Improving"
          />
          <Area
            type="monotone"
            dataKey="mastered"
            stackId="1"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.3}
            name="Mastered"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PhonemeProgressChart;
