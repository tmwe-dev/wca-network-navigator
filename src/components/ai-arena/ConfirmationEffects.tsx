/**
 * ConfirmationEffects — Particle burst and visual feedback for AI Arena actions.
 */
import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  color: string;
}

interface ConfirmationEffectsProps {
  trigger: "confirm" | "skip" | "blacklist" | null;
  onComplete?: () => void;
}

const COLORS = {
  confirm: ["#22c55e", "#4ade80", "#86efac", "#10b981", "#34d399"],
  skip: ["#6b7280", "#9ca3af", "#d1d5db"],
  blacklist: ["#ef4444", "#f87171", "#fca5a5"],
};

export function ConfirmationEffects({ trigger, onComplete }: ConfirmationEffectsProps): React.ReactElement | null {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [flash, setFlash] = useState(false);

  const generateParticles = useCallback((type: "confirm" | "skip" | "blacklist") => {
    const colors = COLORS[type];
    const count = type === "confirm" ? 20 : type === "blacklist" ? 12 : 0;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 0,
      y: 0,
      angle: (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5,
      speed: 80 + Math.random() * 120,
      size: 4 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
  }, []);

  useEffect(() => {
    if (!trigger) return;
    if (trigger === "confirm") {
      setParticles(generateParticles("confirm"));
      setFlash(true);
      setTimeout(() => setFlash(false), 150);
    } else if (trigger === "blacklist") {
      setParticles(generateParticles("blacklist"));
    }
    const timer = setTimeout(() => {
      setParticles([]);
      onComplete?.();
    }, 800);
    return () => clearTimeout(timer);
  }, [trigger, generateParticles, onComplete]);

  return (
    <>
      {/* Flash overlay */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-white/10 pointer-events-none z-50"
          />
        )}
      </AnimatePresence>

      {/* Particles */}
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{
              opacity: 0,
              x: Math.cos(p.angle) * p.speed,
              y: Math.sin(p.angle) * p.speed,
              scale: 0.2,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="fixed pointer-events-none z-50"
            style={{
              left: "50%",
              top: "50%",
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              backgroundColor: p.color,
            }}
          />
        ))}
      </AnimatePresence>
    </>
  );
}
