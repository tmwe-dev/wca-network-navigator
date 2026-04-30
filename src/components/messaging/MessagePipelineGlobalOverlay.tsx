/**
 * MessagePipelineGlobalOverlay — Floating toast-like overlay (top-right)
 * mounted ONCE in App.tsx. Shows a stacked tracker for every active message
 * pipeline so the user sees the "paper moving from room to room" no matter
 * which page they're on.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useMessagePipeline } from "@/hooks/useMessagePipeline";
import MessagePipelineTracker from "./MessagePipelineTracker";

export default function MessagePipelineGlobalOverlay() {
  const all = useMessagePipeline();
  const visible = all.filter((s) => !s.endedAt || Date.now() - (s.endedAt ?? 0) < 5500);

  if (visible.length === 0) return null;

  return (
    <div
      className="fixed top-16 right-4 z-[60] flex flex-col gap-2 max-w-[min(calc(100vw-2rem),720px)] pointer-events-none"
      aria-live="polite"
    >
      <AnimatePresence>
        {visible.slice(0, 4).map((snap) => (
          <motion.div
            key={snap.pipelineId}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="pointer-events-auto shadow-lg shadow-primary/5"
          >
            <MessagePipelineTracker snapshot={snap} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}