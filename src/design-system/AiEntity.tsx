import { motion } from "framer-motion";

interface AiEntityProps {
  size?: "sm" | "md" | "lg" | "hero";
  pulse?: boolean;
  className?: string;
}

const sizes = {
  sm: { outer: 32, inner: 14, ring: 40 },
  md: { outer: 48, inner: 20, ring: 60 },
  lg: { outer: 72, inner: 30, ring: 90 },
  hero: { outer: 120, inner: 50, ring: 160 },
};

const AiEntity = ({ size = "md", pulse = true, className = "" }: AiEntityProps) => {
  const s = sizes[size];

  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: s.ring, height: s.ring }}>
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, hsl(var(--primary) / 0.18) 0%, hsl(var(--accent) / 0.12) 50%, transparent 70%)`,
          filter: "blur(20px)",
        }}
        animate={pulse ? { scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] } : {}}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="absolute rounded-full border border-primary/[0.28]"
        style={{ width: s.outer + 16, height: s.outer + 16 }}
        animate={pulse ? { rotate: 360 } : {}}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        <motion.div
          className="absolute w-1.5 h-1.5 rounded-full bg-primary/85"
          style={{ top: -1, left: "50%", marginLeft: -2 }}
          animate={{ opacity: [0.3, 0.9, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>

      <motion.div
        className="relative rounded-full flex items-center justify-center"
        style={{
          width: s.outer,
          height: s.outer,
          background: `radial-gradient(circle at 35% 35%, hsl(var(--primary) / 0.34), hsl(var(--accent) / 0.22) 60%, hsl(var(--card) / 0.92))`,
          boxShadow: `0 0 ${s.outer}px hsl(var(--primary) / 0.18), inset 0 0 ${s.inner}px hsl(var(--primary) / 0.14)`,
        }}
        animate={pulse ? { scale: [1, 1.03, 1] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      >
        <motion.div
          className="rounded-full"
          style={{
            width: s.inner,
            height: s.inner,
            background: `radial-gradient(circle at 40% 40%, hsl(var(--primary) / 0.7), hsl(var(--accent) / 0.7) 70%, transparent)`,
          }}
          animate={pulse ? { scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] } : {}}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          className="absolute rounded-full bg-foreground/[0.2]"
          style={{ width: s.inner * 0.4, height: s.inner * 0.25, top: "22%", left: "28%", filter: "blur(3px)" }}
        />
      </motion.div>
    </div>
  );
};

export default AiEntity;
