import { useLinkedInFlow } from "@/hooks/useLinkedInFlow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Linkedin, Play, Square, RotateCcw, Moon, Zap, AlertCircle, Globe, BrainCircuit } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface LinkedInFlowPanelProps {
  selectedContacts: Array<{
    id: string;
    name: string;
    company: string;
    linkedinUrl?: string | null;
    website?: string | null;
  }>;
  onClose?: () => void;
}

export function LinkedInFlowPanel({ selectedContacts, onClose }: LinkedInFlowPanelProps) {
  const flow = useLinkedInFlow();
  const [delaySec, setDelaySec] = useState(15);
  const [autoConnect, setAutoConnect] = useState(false);
  const [generateOutreach, setGenerateOutreach] = useState(true);
  const [deepSearchWeb, setDeepSearchWeb] = useState(true);

  const withLinkedIn = selectedContacts.filter(c => c.linkedinUrl);
  const _withoutLinkedIn = selectedContacts.filter(c => !c.linkedinUrl);
  const progressPct = flow.progress.total > 0
    ? Math.round((flow.progress.processed / flow.progress.total) * 100)
    : 0;

  const estimatedMinutes = Math.ceil((withLinkedIn.length * delaySec) / 60);

  const handleStart = () => {
    flow.startFlow(selectedContacts, { delaySec, autoConnect, generateOutreach, deepSearchWeb });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="rounded-xl border border-border bg-card p-5 space-y-4 max-w-md w-full"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#0077B5]/10 flex items-center justify-center">
          <Linkedin className="w-5 h-5 text-[#0077B5]" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">LinkedIn Flow</h3>
          <p className="text-xs text-muted-foreground">Analisi batch notturna</p>
        </div>
        <Badge variant="outline" className="text-xs">
          <Moon className="w-3 h-3 mr-1" />
          Batch
        </Badge>
      </div>

      {/* Status quando in corso */}
      <AnimatePresence mode="wait">
        {flow.isRunning ? (
          <motion.div
            key="running"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-mono text-foreground">
                {flow.progress.processed}/{flow.progress.total}
              </span>
            </div>
            <Progress value={progressPct} className="h-2" />

            {flow.currentContact && (
              <div className="flex items-center gap-2 text-xs">
                <Zap className="w-3 h-3 text-primary animate-pulse" />
                <span className="text-muted-foreground truncate">
                  {flow.currentStep || flow.currentContact}
                </span>
              </div>
            )}

            {/* Extension indicators */}
            <div className="flex gap-1.5">
              {flow.linkedInAvailable && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  <Linkedin className="w-2.5 h-2.5 mr-0.5" /> LI
                </Badge>
              )}
              {flow.partnerConnectAvailable && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  <Globe className="w-2.5 h-2.5 mr-0.5" /> PC
                </Badge>
              )}
            </div>

            <div className="flex gap-2 text-xs">
              <Badge variant="secondary" className="text-xs">
                ✅ {flow.progress.success}
              </Badge>
              {flow.progress.errors > 0 && (
                <Badge variant="destructive" className="text-xs">
                  ❌ {flow.progress.errors}
                </Badge>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="destructive" onClick={flow.stopFlow} className="flex-1">
                <Square className="w-3 h-3 mr-1" /> Stop
              </Button>
            </div>
          </motion.div>
        ) : flow.phase === "completed" ? (
          <motion.div
            key="completed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            <div className="text-center py-3">
              <p className="text-sm font-medium text-foreground">✅ Flow completato</p>
              <p className="text-xs text-muted-foreground mt-1">
                {flow.progress.success} profili analizzati, {flow.progress.errors} errori
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={onClose} className="w-full">
              Chiudi
            </Button>
          </motion.div>
        ) : flow.phase === "paused" ? (
          <motion.div
            key="paused"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            <Progress value={progressPct} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              In pausa — {flow.progress.processed}/{flow.progress.total} completati
            </p>
            <Button size="sm" onClick={flow.resumeFlow} className="w-full">
              <RotateCcw className="w-3 h-3 mr-1" /> Riprendi
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="config"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                <p className="font-semibold text-foreground">{selectedContacts.length}</p>
                <p className="text-muted-foreground">Contatti</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                <p className="font-semibold text-foreground">{withLinkedIn.length}</p>
                <p className="text-muted-foreground">Con LinkedIn</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                <p className="font-semibold text-foreground">~{estimatedMinutes} min</p>
                <p className="text-muted-foreground">Stima</p>
              </div>
            </div>

            {/* Extension status */}
            <div className="flex gap-2 text-xs">
              <Badge variant={flow.linkedInAvailable ? "secondary" : "outline"} className="text-[10px]">
                <Linkedin className="w-3 h-3 mr-1" />
                LinkedIn {flow.linkedInAvailable ? "✓" : "✗"}
              </Badge>
              <Badge variant={flow.partnerConnectAvailable ? "secondary" : "outline"} className="text-[10px]">
                <Globe className="w-3 h-3 mr-1" />
                Partner Connect {flow.partnerConnectAvailable ? "✓" : "✗"}
              </Badge>
            </div>

            {!flow.extensionAvailable && (
              <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-2.5">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>Nessuna estensione rilevata. Installa almeno una tra Partner Connect e LinkedIn.</span>
              </div>
            )}

            {/* Config */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Delay tra profili</Label>
                  <span className="text-xs font-mono text-muted-foreground">{delaySec}s</span>
                </div>
                <Slider
                  value={[delaySec]}
                  onValueChange={([v]) => setDelaySec(v)}
                  min={8}
                  max={60}
                  step={1}
                  className="w-full"
                />
                <p className="text-[10px] text-muted-foreground">
                  Più lento = più sicuro. Consigliato 15-30s per uso notturno.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <BrainCircuit className="w-3.5 h-3.5 text-muted-foreground" />
                  <Label className="text-xs">Deep Search Web (Partner Connect)</Label>
                </div>
                <Switch checked={deepSearchWeb} onCheckedChange={setDeepSearchWeb} disabled={!flow.partnerConnectAvailable} />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Genera bozza outreach (AI)</Label>
                <Switch checked={generateOutreach} onCheckedChange={setGenerateOutreach} />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Auto-collegamento LinkedIn</Label>
                <Switch checked={autoConnect} onCheckedChange={setAutoConnect} disabled={!flow.linkedInAvailable} />
              </div>
            </div>

            {/* Start */}
            <Button
              onClick={handleStart}
              disabled={selectedContacts.length === 0 || !flow.extensionAvailable}
              className="w-full"
            >
              <Play className="w-3.5 h-3.5 mr-1.5" />
              Avvia Flow ({selectedContacts.length} contatti)
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
