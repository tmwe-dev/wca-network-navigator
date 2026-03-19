import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Database, Users, Mail, Search, Mic, Brain, Shield, Zap, FileText, Layers, GitMerge, CreditCard, Upload, BarChart3, Bell, BookOpen } from "lucide-react";

const ease = [0.2, 0.8, 0.2, 1] as const;

interface ToolActivation { icon: typeof Database; label: string; color: string; }
interface SourceTag { name: string; color: string; }

const toolMap: Record<string, { tools: ToolActivation[]; sources: SourceTag[] }> = {
  churn: {
    tools: [
      { icon: GitMerge, label: "Unify Sources", color: "var(--warning)" },
      { icon: Search, label: "Search Partners", color: "var(--primary)" },
      { icon: Search, label: "Search Contacts", color: "var(--accent)" },
      { icon: Brain, label: "Run ML Scoring", color: "var(--success)" },
      { icon: Search, label: "Run Deep Search", color: "var(--warning)" },
      { icon: BarChart3, label: "Generate Report", color: "var(--primary)" },
    ],
    sources: [
      { name: "WCA Partner Network", color: "var(--primary)" },
      { name: "Imported Contacts", color: "var(--accent)" },
      { name: "Company Reports", color: "var(--success)" },
    ],
  },
  campaign: {
    tools: [
      { icon: GitMerge, label: "Unify Sources", color: "var(--warning)" },
      { icon: Search, label: "Search Contacts", color: "var(--primary)" },
      { icon: Search, label: "Run Deep Search", color: "var(--accent)" },
      { icon: FileText, label: "Create Email Draft", color: "var(--success)" },
      { icon: Mail, label: "Send Email Batch", color: "var(--warning)" },
      { icon: Shield, label: "Audit Action", color: "var(--primary)" },
    ],
    sources: [
      { name: "Imported Contacts", color: "var(--primary)" },
      { name: "WCA Partner Network", color: "var(--accent)" },
      { name: "Business Card Archive", color: "var(--warning)" },
      { name: "Deep Search API", color: "var(--success)" },
    ],
  },
  report: {
    tools: [
      { icon: GitMerge, label: "Unify Sources", color: "var(--warning)" },
      { icon: Search, label: "Search Partners", color: "var(--primary)" },
      { icon: Brain, label: "Analyze Data", color: "var(--accent)" },
      { icon: BarChart3, label: "Generate Executive Report", color: "var(--success)" },
      { icon: Layers, label: "Save Template", color: "var(--warning)" },
    ],
    sources: [
      { name: "WCA Partner Network", color: "var(--primary)" },
      { name: "Company Reports", color: "var(--success)" },
      { name: "Internal Database", color: "var(--accent)" },
    ],
  },
  email: {
    tools: [
      { icon: Search, label: "Search Contacts", color: "var(--primary)" },
      { icon: BookOpen, label: "Read Company Report", color: "var(--accent)" },
      { icon: FileText, label: "Create Email Draft", color: "var(--success)" },
      { icon: Layers, label: "Load Template", color: "var(--warning)" },
    ],
    sources: [
      { name: "Imported Contacts", color: "var(--primary)" },
      { name: "Business Card Archive", color: "var(--warning)" },
      { name: "CRM Core", color: "var(--accent)" },
    ],
  },
  import: {
    tools: [
      { icon: Upload, label: "Parse Contact File", color: "var(--primary)" },
      { icon: GitMerge, label: "Deduplicate & Merge", color: "var(--warning)" },
      { icon: Search, label: "Run Deep Search", color: "var(--accent)" },
      { icon: Database, label: "Update CRM Records", color: "var(--success)" },
      { icon: Shield, label: "Audit Action", color: "var(--primary)" },
    ],
    sources: [
      { name: "Contact File (300)", color: "var(--primary)" },
      { name: "WCA Partner Network", color: "var(--accent)" },
      { name: "CRM Core", color: "var(--success)" },
    ],
  },
  businesscard: {
    tools: [
      { icon: CreditCard, label: "Parse Business Cards", color: "var(--warning)" },
      { icon: GitMerge, label: "Unify Sources", color: "var(--primary)" },
      { icon: Search, label: "Run Deep Search", color: "var(--accent)" },
      { icon: Database, label: "Create Contact Profile", color: "var(--success)" },
      { icon: Bell, label: "Schedule Reminder", color: "var(--warning)" },
    ],
    sources: [
      { name: "Business Card Archive", color: "var(--warning)" },
      { name: "Deep Search API", color: "var(--accent)" },
      { name: "Company Reports", color: "var(--success)" },
    ],
  },
  voice: {
    tools: [
      { icon: Mic, label: "Read Aloud", color: "var(--success)" },
      { icon: Brain, label: "TTS Engine", color: "var(--accent)" },
      { icon: Database, label: "Load Context", color: "var(--primary)" },
    ],
    sources: [{ name: "CRM Core", color: "var(--primary)" }],
  },
  batch: {
    tools: [
      { icon: Search, label: "Search Contacts", color: "var(--primary)" },
      { icon: GitMerge, label: "Validate & Deduplicate", color: "var(--warning)" },
      { icon: FileText, label: "Create Email Draft", color: "var(--success)" },
      { icon: Shield, label: "Governance Check", color: "var(--accent)" },
      { icon: Mail, label: "Send Email Batch", color: "var(--warning)" },
      { icon: Shield, label: "Audit Action", color: "var(--primary)" },
    ],
    sources: [
      { name: "Imported Contacts", color: "var(--primary)" },
      { name: "WCA Partner Network", color: "var(--accent)" },
      { name: "CRM Core", color: "var(--success)" },
    ],
  },
  template: {
    tools: [
      { icon: Layers, label: "Save Template", color: "var(--success)" },
      { icon: Shield, label: "Audit Action", color: "var(--primary)" },
    ],
    sources: [{ name: "Template Library", color: "var(--success)" }],
  },
};

const chainSteps = ["FONTE", "UNIFICA", "ANALISI", "TOOL", "APPROVAZIONE", "ESECUZIONE", "AUDIT"];

interface ToolActivationBarProps {
  scenarioKey: string | null;
  visible: boolean;
  phase?: "activating" | "active" | "done";
  chainHighlight?: number;
}

const ToolActivationBar = ({ scenarioKey, visible, phase = "active", chainHighlight }: ToolActivationBarProps) => {
  const entry = scenarioKey ? toolMap[scenarioKey] || toolMap.churn : null;
  const tools = entry?.tools || [];
  const sources = entry?.sources || [];
  const [revealedCount, setRevealedCount] = useState(0);

  useEffect(() => {
    if (!visible || phase !== "activating") { setRevealedCount(tools.length); return; }
    setRevealedCount(0);
    let i = 0;
    const interval = setInterval(() => { i++; setRevealedCount(i); if (i >= tools.length) clearInterval(interval); }, 280);
    return () => clearInterval(interval);
  }, [visible, phase, tools.length, scenarioKey]);

  return (
    <AnimatePresence>
      {visible && tools.length > 0 && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4, ease }} className="overflow-hidden">
          <div className="flex items-center gap-1 py-1.5 px-1 mb-1">
            {chainSteps.map((step, i) => {
              const isActive = chainHighlight !== undefined && i <= chainHighlight;
              const isCurrent = chainHighlight !== undefined && i === chainHighlight;
              return (
                <div key={step} className="flex items-center gap-1">
                  <motion.span className={`text-[7px] tracking-[0.15em] font-mono transition-all duration-500 ${isCurrent ? "text-primary/50" : isActive ? "text-muted-foreground/25" : "text-muted-foreground/10"}`} animate={isCurrent ? { opacity: [0.4, 0.8, 0.4] } : {}} transition={{ duration: 1.5, repeat: Infinity }}>
                    {step}
                  </motion.span>
                  {i < chainSteps.length - 1 && <span className={`text-[7px] ${isActive ? "text-muted-foreground/15" : "text-muted-foreground/6"}`}>→</span>}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-1 py-2 px-1 flex-wrap">
            <span className="text-[8px] text-muted-foreground/15 tracking-[0.2em] uppercase mr-2 font-mono">TOOLS</span>
            {tools.map((tool, i) => {
              const revealed = i < revealedCount;
              return (
                <motion.div key={`${tool.label}-${i}`} initial={{ opacity: 0, scale: 0.8, x: -8 }} animate={{ opacity: revealed ? 1 : 0.15, scale: revealed ? 1 : 0.9, x: 0 }} transition={{ delay: phase === "activating" ? 0 : i * 0.06, duration: 0.3, ease }} className="flex items-center gap-1.5 px-2 py-1 rounded-lg relative" style={{ background: `hsl(${tool.color} / ${revealed ? 0.04 : 0.01})`, border: `1px solid hsl(${tool.color} / ${revealed ? 0.06 : 0.02})` }}>
                  {revealed && phase === "activating" && i === revealedCount - 1 && (
                    <motion.div className="absolute inset-0 rounded-lg" initial={{ boxShadow: `0 0 12px hsl(${tool.color} / 0.15)` }} animate={{ boxShadow: `0 0 0px hsl(${tool.color} / 0)` }} transition={{ duration: 0.8 }} />
                  )}
                  <tool.icon className="w-2.5 h-2.5" style={{ color: `hsl(${tool.color} / ${revealed ? 0.35 : 0.1})` }} strokeWidth={1.5} />
                  <span className="text-[8px] font-light" style={{ color: `hsl(${tool.color} / ${revealed ? 0.4 : 0.12})` }}>{tool.label}</span>
                </motion.div>
              );
            })}
          </div>

          {sources.length > 0 && (
            <div className="flex items-center gap-1 py-1 px-1 flex-wrap">
              <span className="text-[8px] text-muted-foreground/15 tracking-[0.2em] uppercase mr-2 font-mono">FONTI</span>
              {sources.map((src, i) => (
                <motion.span key={src.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.08 }} className="text-[8px] px-2 py-1 rounded-lg font-mono" style={{ color: `hsl(${src.color} / 0.35)`, background: `hsl(${src.color} / 0.03)`, border: `1px solid hsl(${src.color} / 0.04)` }}>
                  {src.name}
                </motion.span>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ToolActivationBar;
