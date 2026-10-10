"use client";

import { CityMetrics } from "@synapse/simulation";
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

export function MetricChart({ data, metric = "satisfaction" }: { data: CityMetrics[]; metric?: "satisfaction" | "hunger" | "averageReward" }) {
  return <div className="metric-chart" aria-label={`Evolution of ${metric}`}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 2, bottom: 0, left: 2 }}>
        <YAxis hide domain={["auto", "auto"]} />
        <Tooltip contentStyle={{ background: "#0c1b20", border: "1px solid #31545b", borderRadius: 0, fontSize: 11 }} labelFormatter={(value) => `sample ${value}`} />
        <Line type="monotone" dataKey={metric} stroke={metric === "hunger" ? "#e7a44e" : "#66d9df"} strokeWidth={1.8} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}
