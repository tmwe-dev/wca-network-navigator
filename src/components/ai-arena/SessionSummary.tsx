/**
 * SessionSummary — Animated overlay shown at the end of an AI Arena session.
 */
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Trophy, Mail, Globe, X } from "lucide-react";

interface SessionStats {
  proposed: number;
  confirmed: number;
  skipped: number;
  blocked: number;
  languages: string[];
  circuitBefore: number;
  circuitAfter: number;
}

interface SessionSummaryProps {
  open: boolean;
  stats: SessionStats;
  onClose: () => void;
}

function AnimatedNumber({ value }: { value: number }) {
  return (
    <motion.span
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.3 }}
      className="text-3xl font-bold"
    >
      {value}
    </motion.span>
  );
}

export function SessionSummary({ open, stats, onClose }: SessionSummaryProps): React.ReactElement | null {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="bg-card border border-border/50 rounded-2xl p-8 max-w-md w-full mx-4 space-y-6"
          >
            <div className="text-center">
              <motion.div
                initial={{ rotate: -20, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
              >
                <Trophy className="h-12 w-12 text-yellow-400 mx-auto" />
              </motion.div>
              <h2 className="text-2xl font-bold text-foreground mt-3">Sessione Completata!</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-500/10 rounded-xl p-4 text-center">
                <AnimatedNumber value={stats.proposed} />
                <p className="text-xs text-blue-400 mt-1">Proposti</p>
              </div>
              <div className="bg-green-500/10 rounded-xl p-4 text-center">
                <AnimatedNumber value={stats.confirmed} />
                <p className="text-xs text-green-400 mt-1">Confermati</p>
              </div>
              <div className="bg-muted rounded-xl p-4 text-center">
                <AnimatedNumber value={stats.skipped} />
                <p className="text-xs text-muted-foreground mt-1">Saltati</p>
              </div>
              <div className="bg-red-500/10 rounded-xl p-4 text-center">
                <AnimatedNumber value={stats.blocked} />
                <p className="text-xs text-red-400 mt-1">Bloccati</p>
              </div>
            </div>

            {stats.languages.length > 0 && (
              <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
                <Globe className="h-4 w-4" />
                <span>Email in {stats.languages.length} lingu{stats.languages.length === 1 ? "a" : "e"} divers{stats.languages.length === 1 ? "a" : "e"}</span>
              </div>
            )}

            <div className="bg-muted/50 rounded-xl p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Contatti nel circuito</span>
                <span className="font-mono">
                  {stats.circuitBefore} → <span className="text-green-400 font-bold">{stats.circuitAfter}</span>
                </span>
              </div>
              <div className="mt-2 h-2 bg-background rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: `${(stats.circuitBefore / Math.max(stats.circuitAfter, 1)) * 100}%` }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-green-500 to-blue-500 rounded-full"
                />
              </div>
            </div>

            <Button onClick={onClose} className="w-full" size="lg">
              <X className="h-4 w-4 mr-2" /> Chiudi
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
