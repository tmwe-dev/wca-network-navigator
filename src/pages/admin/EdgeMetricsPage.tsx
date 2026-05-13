/**
 * Sprint H.5 — Edge function metrics dashboard.
 *
 * Displays latency percentiles, error rates and token usage
 * for each Supabase edge function over the last 24 h.
 */

import React, { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import type { EdgeFunctionMetric } from "../../types/edgeMetrics";

/* ---------- skeleton placeholder ---------- */

function MetricsSkeleton(): React.ReactElement {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-10 bg-gray-200 rounded w-full" />
      ))}
      <div className="h-64 bg-gray-200 rounded w-full" />
    </div>
  );
}

/* ---------- summary cards ---------- */

interface SummaryCardProps {
  label: string;
  value: string;
}

function SummaryCard({ label, value }: SummaryCardProps): React.ReactElement {
  return (
    <div className="rounded-lg border p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

/* ---------- main component ---------- */

export default function EdgeMetricsPage(): React.ReactElement {
  // In production this would come from a Supabase RPC / edge function.
  const [metrics] = useState<EdgeFunctionMetric[]>([]);
  const [loading] = useState<boolean>(false);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Edge Function Metrics</h1>
        <MetricsSkeleton />
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Edge Function Metrics</h1>
        <p className="text-gray-500">
          No edge function metrics available yet. Data will appear here once functions start reporting telemetry.
        </p>
      </div>
    );
  }

  const totalCalls = metrics.reduce((s, m) => s + m.call_count_24h, 0);
  const avgErrorRate = metrics.reduce((s, m) => s + m.error_rate, 0) / metrics.length;
  const totalTokens = metrics.reduce((s, m) => s + m.token_usage, 0);

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Edge Function Metrics (24 h)</h1>

      {/* summary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard label="Total Calls" value={totalCalls.toLocaleString()} />
        <SummaryCard label="Avg Error Rate" value={`${(avgErrorRate * 100).toFixed(2)}%`} />
        <SummaryCard label="Total Tokens" value={totalTokens.toLocaleString()} />
      </div>

      {/* latency chart */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Latency Percentiles</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={metrics}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="function_name" />
            <YAxis unit=" ms" />
            <Tooltip />
            <Legend />
            <Bar dataKey="p50_ms" name="p50" fill="#3498db" />
            <Bar dataKey="p95_ms" name="p95" fill="#f39c12" />
            <Bar dataKey="p99_ms" name="p99" fill="#e74c3c" />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
