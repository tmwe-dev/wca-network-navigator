import { motion } from "framer-motion";
import type { CommandPhase } from "@/v2/ui/pages/command/useCommandFlow";

interface AiEntityProps {
  size?: "sm" | "md" | "lg" | "hero";
  pulse?: boolean;
  phase?: CommandPhase;
  className?: string;
}

const sizes = {
  sm: { outer: 32, inner: 14, ring: 40 },
  md: { outer: 48, inner: 20, ring: 60 },
  lg: { outer: 72, inner: 30, ring: 90 },
  hero: { outer: 120, inner: 50, ring: 160 },
};

const phaseConfig: Record<string, {
  breathDuration: number;
  ringDuration: number;
  irisScale: [number, number, number];
  glowOpacity: [number, number, number];
  auroraScale: [number, number, number];
  hueShift?: string;
}> = {
  idle: {
    breathDuration: 4,
    ringDuration: 30,
    irisScale: [1, 1.1, 1],
    glowOpacity: [0.6, 1, 0.6],
    auroraScale: [1, 1.15, 1],
  },
  thinking: {
    breathDuration: 1.8,
    ringDuration: 12,
    irisScale: [1, 1.2, 1],
    glowOpacity: [0.7, 1, 0.7],
    auroraScale: [1, 1.25, 1],
  },
  proposal: {
    breathDuration: 3,
    ringDuration: 20,
    irisScale: [1, 1.05, 1],
    glowOpacity: [0.8, 1, 0.8],
    auroraScale: [1, 1.2, 1],
  },
  executing: {
    breathDuration: 1.2,
    ringDuration: 8,
    irisScale: [1, 1.15, 1],
    glowOpacity: [0.8, 1, 0.8],
    auroraScale: [1, 1.35, 1],
  },
  done: {
    breathDuration: 3,
    ringDuration: 25,
    irisScale: [1, 1.05, 1],
    glowOpacity: [0.7, 1, 0.7],
    auroraScale: [1, 1.1, 1],
    hueShift: "success",
  },
  error: {
    breathDuration: 2,
    ringDuration: 15,
    irisScale: [1, 1.1, 1],
    glowOpacity: [0.5, 0.9, 0.5],
    auroraScale: [1, 1.1, 1],
    hueShift: "destructive",
  },
};

const AiEntity = ({ size = "md", pulse = true, phase, className = "" }: AiEntityProps) => {
  const s = sizes[size];
  const cfg = phaseConfig[phase ?? "idle"] ?? phaseConfig.idle;
  const doPulse = pulse;

  const primaryVar = cfg.hueShift === "success"
    ? "var(--success)"
    : cfg.hueShift === "destructive"
    ? "var(--destructive)"
    : "var(--primary)";

  const accentVar = cfg.hueShift === "success"
    ? "var(--success)"
    : cfg.hueShift === "destructive"
    ? "var(--destructive)"
    : "var(--accent)";

  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: s.ring, height: s.ring }}>
      {/* Aurora glow */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, hsl(${primaryVar} / 0.18) 0%, hsl(${accentVar} / 0.12) 50%, transparent 70%)`,
          filter: "blur(20px)",
        }}
        animate={doPulse ? { scale: cfg.auroraScale, opacity: cfg.glowOpacity } : {}}
        transition={{ duration: cfg.breathDuration, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Ring */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: s.outer + 16,
          height: s.outer + 16,
          border: `1px solid hsl(${primaryVar} / 0.28)`,
        }}
        animate={doPulse ? { rotate: 360 } : {}}
        transition={{ duration: cfg.ringDuration, repeat: Infinity, ease: "linear" }}
      >
        <motion.div
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{ top: -1, left: "50%", marginLeft: -2, background: `hsl(${primaryVar} / 0.85)` }}
          animate={{ opacity: [0.3, 0.9, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>

      {/* Core sphere */}
      <motion.div
        className="relative rounded-full flex items-center justify-center"
        style={{
          width: s.outer,
          height: s.outer,
          background: `radial-gradient(circle at 35% 35%, hsl(${primaryVar} / 0.34), hsl(${accentVar} / 0.22) 60%, hsl(var(--card) / 0.92))`,
          boxShadow: `0 0 ${s.outer}px hsl(${primaryVar} / 0.18), inset 0 0 ${s.inner}px hsl(${primaryVar} / 0.14)`,
        }}
        animate={doPulse ? { scale: [1, 1.03, 1] } : {}}
        transition={{ duration: cfg.breathDuration * 0.75, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      >
        {/* Iris */}
        <motion.div
          className="rounded-full"
          style={{
            width: s.inner,
            height: s.inner,
            background: `radial-gradient(circle at 40% 40%, hsl(${primaryVar} / 0.7), hsl(${accentVar} / 0.7) 70%, transparent)`,
          }}
          animate={doPulse ? { scale: cfg.irisScale, opacity: [0.7, 1, 0.7] } : {}}
          transition={{ duration: cfg.breathDuration * 0.6, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Specular highlight */}
        <div
          className="absolute rounded-full bg-foreground/[0.2]"
          style={{ width: s.inner * 0.4, height: s.inner * 0.25, top: "22%", left: "28%", filter: "blur(3px)" }}
        />
      </motion.div>
    </div>
  );
};

export default AiEntity;
