import { useState, useEffect, useContext } from "react";
import { OctagonX } from "lucide-react";
import { ThemeCtx, t } from "@/components/download/theme";

interface SpeedGaugeProps {
  lastUpdatedAt: string | null;
  onStop: () => void;
}

export function SpeedGauge({ lastUpdatedAt, onStop }: SpeedGaugeProps) {
  const isDark = useContext(ThemeCtx);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!lastUpdatedAt) { setElapsed(0); return; }

    const calc = () => Math.max(0, Math.floor((Date.now() - new Date(lastUpdatedAt).getTime()) / 1000));
    setElapsed(calc());

    const id = setInterval(() => setElapsed(calc()), 1000);
    return () => clearInterval(id);
  }, [lastUpdatedAt]);

  const capped = Math.min(elapsed, 60);
  // 0s = left (danger), 60s = right (safe). Angle: -90 to +90
  const angle = -90 + (capped / 60) * 180;

  // Zone colors
  const getColor = (s: number) => {
    if (s < 15) return isDark ? "#ef4444" : "#dc2626"; // red
    if (s < 30) return isDark ? "#f59e0b" : "#d97706"; // amber
    return isDark ? "#22c55e" : "#16a34a"; // green
  };

  const color = getColor(capped);
  const cx = 40, cy = 42, r = 30;

  // Arc helper: angle in degrees (-90 to 90) to SVG point
  const arcPoint = (deg: number) => {
    const rad = (deg - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  // Create colored arc segments
  const makeArc = (startDeg: number, endDeg: number) => {
    const s = arcPoint(startDeg);
    const e = arcPoint(endDeg);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  };

  // Needle endpoint
  const needleRad = (angle - 90) * (Math.PI / 180);
  const needleLen = r - 4;
  const nx = cx + needleLen * Math.cos(needleRad);
  const ny = cy + needleLen * Math.sin(needleRad);

  return (
    <div className="flex items-center gap-2">
      <div className="relative" style={{ width: 80, height: 52 }}>
        <svg viewBox="0 0 80 52" width={80} height={52}>
          {/* Red zone: 0-15s → -90° to -45° */}
          <path d={makeArc(-90, -45)} fill="none" stroke="#ef4444" strokeWidth={5} strokeLinecap="round" opacity={0.3} />
          {/* Yellow zone: 15-30s → -45° to 0° */}
          <path d={makeArc(-45, 0)} fill="none" stroke="#f59e0b" strokeWidth={5} strokeLinecap="round" opacity={0.3} />
          {/* Green zone: 30-60s → 0° to 90° */}
          <path d={makeArc(0, 90)} fill="none" stroke="#22c55e" strokeWidth={5} strokeLinecap="round" opacity={0.3} />

          {/* Needle */}
          <line
            x1={cx} y1={cy} x2={nx} y2={ny}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            style={{ transition: "all 0.5s ease-out" }}
          />
          {/* Center dot */}
          <circle cx={cx} cy={cy} r={2.5} fill={color} />

          {/* Value */}
          <text x={cx} y={cy - 8} textAnchor="middle" fontSize={14} fontWeight="bold" fontFamily="monospace" fill={color}>
            {elapsed}s
          </text>
        </svg>
        {/* Label below gauge */}
        <div
          className={`absolute -bottom-0.5 left-0 right-0 text-center leading-none ${isDark ? "text-slate-500" : "text-slate-400"}`}
          style={{ fontSize: 7 }}
        >
          dall'ultima richiesta
        </div>
      </div>

      {/* STOP button */}
      <button
        onClick={onStop}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-all shadow-lg shadow-red-900/30 animate-pulse"
        style={{ animationDuration: "2s" }}
      >
        <OctagonX className="w-4 h-4" />
        STOP
      </button>
    </div>
  );
}
