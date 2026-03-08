import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Search, Mic, MicOff, LayoutGrid, List, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewMode, CockpitFilter } from "@/pages/Cockpit";

interface TopCommandBarProps {
  onCommand: (command: string, filters: CockpitFilter[]) => void;
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

type MicState = "idle" | "listening" | "processing" | "applied";

export function TopCommandBar({ onCommand, viewMode, onViewChange, searchQuery, onSearchChange }: TopCommandBarProps) {
  const [input, setInput] = useState("");
  const [micState, setMicState] = useState<MicState>("idle");
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setIsProcessing(true);
    // Simulate AI parsing
    setTimeout(() => {
      const filters: CockpitFilter[] = [];
      const lower = input.toLowerCase();
      if (lower.includes("italian") || lower.includes("italia")) {
        filters.push({ id: "lang-it", label: "🇮🇹 Italiano", type: "language" });
      }
      if (lower.includes("priorit")) {
        filters.push({ id: "prio-high", label: "⚡ Alta priorità", type: "priority" });
      }
      if (lower.includes("linkedin")) {
        filters.push({ id: "ch-linkedin", label: "LinkedIn", type: "channel" });
      }
      if (lower.includes("email")) {
        filters.push({ id: "ch-email", label: "Email", type: "channel" });
      }
      if (lower.includes("whatsapp")) {
        filters.push({ id: "ch-whatsapp", label: "WhatsApp", type: "channel" });
      }
      if (lower.includes("list")) {
        onViewChange("list");
      }
      if (lower.includes("card")) {
        onViewChange("card");
      }
      if (filters.length === 0) {
        filters.push({ id: `custom-${Date.now()}`, label: input.trim(), type: "custom" });
      }
      onCommand(input, filters);
      setInput("");
      setIsProcessing(false);
    }, 800);
  };

  const micRingColor: Record<MicState, string> = {
    idle: "border-muted-foreground/60",
    listening: "border-destructive animate-pulse",
    processing: "border-warning animate-spin",
    applied: "border-success",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 pt-3 pb-2"
    >
      <form onSubmit={handleSubmit} className="relative flex items-center gap-3">
        {/* Command Input */}
        <div className="relative flex-1 group">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 via-accent/20 to-chart-3/20 blur-xl opacity-0 group-focus-within:opacity-60 transition-opacity duration-500" />
          <div className="relative flex items-center gap-2 rounded-xl border border-border/60 bg-card/80 backdrop-blur-xl px-4 py-2.5 focus-within:border-primary/50 transition-all duration-200">
            {isProcessing ? (
              <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Comanda la pagina — filtra, ordina, cerca con AI..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
            />
            <Search className="w-4 h-4 text-muted-foreground/70" />
          </div>
        </div>

        {/* Mic Button */}
        <button
          type="button"
          className={cn(
            "relative w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 hover:scale-105",
            micRingColor[micState],
            micState === "listening" && "bg-destructive/10",
            micState === "idle" && "bg-card/60 hover:bg-card/80"
          )}
          onClick={() => {
            // Placeholder for voice — will be implemented later
            setMicState(prev => prev === "idle" ? "listening" : "idle");
          }}
        >
          {micState === "listening" ? (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <Mic className="w-4 h-4 text-destructive" />
            </motion.div>
          ) : (
            <MicOff className="w-4 h-4 text-muted-foreground" />
          )}
          {micState === "listening" && (
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-destructive/40"
              animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
          )}
        </button>

        {/* View Toggle */}
        <div className="flex items-center rounded-lg border border-border/60 bg-card/60 backdrop-blur-sm p-0.5">
          <button
            type="button"
            onClick={() => onViewChange("card")}
            className={cn(
              "p-1.5 rounded-md transition-all duration-200",
              viewMode === "card" ? "bg-primary/20 text-primary" : "text-muted-foreground/80 hover:text-foreground"
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewChange("list")}
            className={cn(
              "p-1.5 rounded-md transition-all duration-200",
              viewMode === "list" ? "bg-primary/20 text-primary" : "text-muted-foreground/80 hover:text-foreground"
            )}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </form>
    </motion.div>
  );
}
