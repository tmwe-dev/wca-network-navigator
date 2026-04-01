import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CheckCircle2, XCircle, Clock, Linkedin, ChevronDown, ChevronUp, Radar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchLogEntry } from "@/hooks/useSmartLinkedInSearch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

interface AISearchMonitorProps {
  searchLog: SearchLogEntry[];
  isSearching: boolean;
}

export function AISearchMonitorButton({ searchLog, isSearching }: AISearchMonitorProps) {
  const [open, setOpen] = useState(false);
  const hasLog = searchLog.length > 0;
  const lastMatch = searchLog.find(e => e.match);

  if (!hasLog && !isSearching) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all",
            isSearching
              ? "border-primary/30 bg-primary/5 text-primary animate-pulse"
              : lastMatch
                ? "border-success/30 bg-success/5 text-success"
                : "border-destructive/30 bg-destructive/5 text-destructive"
          )}
        >
          <Radar className="w-3.5 h-3.5" />
          {isSearching ? "Ricerca in corso..." : lastMatch ? "Profilo trovato" : "Non trovato"}
          {hasLog && <span className="text-[10px] opacity-60">({searchLog.length})</span>}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Radar className="w-4 h-4 text-primary" />
            Monitor Ricerca LinkedIn
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          {searchLog.length === 0 && isSearching && (
            <div className="text-xs text-muted-foreground text-center py-4">
              Avvio ricerca...
            </div>
          )}
          {searchLog.map((entry, i) => (
            <SearchStepCard key={i} entry={entry} />
          ))}
          {isSearching && (
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="flex items-center gap-2 text-xs text-primary px-3 py-2"
            >
              <Search className="w-3.5 h-3.5 animate-spin" />
              Prossimo tentativo...
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SearchStepCard({ entry }: { entry: SearchLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasMatch = entry.match && entry.confidence >= 0.5;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "border rounded-lg p-2.5 text-xs space-y-1.5",
        hasMatch ? "border-success/30 bg-success/5" : "border-border/50 bg-card/50"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-muted-foreground">#{entry.step}</span>
          {hasMatch ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
          ) : (
            <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span className="font-medium">
            {entry.method === "linkedin_people_search" ? "LinkedIn Search" : entry.method}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-0.5 text-muted-foreground">
            <Clock className="w-3 h-3" />
            {entry.ms}ms
          </span>
          <button onClick={() => setExpanded(!expanded)} className="p-0.5 hover:bg-muted/50 rounded">
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground font-mono truncate">
        🔍 "{entry.query}"
      </div>

      {hasMatch && entry.match && (
        <div className="flex items-center gap-1.5 text-[11px] text-success">
          <Linkedin className="w-3 h-3" />
          <a href={entry.match} target="_blank" rel="noopener" className="underline truncate">
            {entry.match}
          </a>
          <span className="text-[10px] font-mono">({Math.round(entry.confidence * 100)}%)</span>
        </div>
      )}

      <AnimatePresence>
        {expanded && entry.reasoning && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="text-[10px] text-muted-foreground/80 pt-1 border-t border-border/30"
          >
            💬 {entry.reasoning}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
