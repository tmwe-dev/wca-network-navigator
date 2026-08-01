import { motion } from "framer-motion";

export function CommandPageBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      <motion.div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, hsl(210 100% 66% / 0.012), transparent 70%)",
        }}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
