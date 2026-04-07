import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronRight, Globe, Hash, Radio, Users, Clock, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

export interface MissionStepData {
  targets?: { countries: string[]; types: string[]; ratings: number[]; hasEmail: boolean };
  batching?: { batches: { country: string; count: number }[] };
  channel?: "email" | "whatsapp" | "linkedin" | "mix";
  agents?: { agentId: string; agentName: string; countries: string[] }[];
  schedule?: "immediate" | "scheduled" | "distributed";
  scheduleDate?: string;
}

interface StepProps {
  stepIndex: number;
  data: MissionStepData;
  onChange: (d: MissionStepData) => void;
  onComplete: () => void;
  stats?: { countries: { code: string; name: string; count: number; withEmail: number }[] };
  agentsList?: { id: string; name: string; emoji: string; territories: string[] }[];
}

const STEP_CONFIG = [
  { title: "Chi contattare?", icon: Globe, desc: "Seleziona paesi, tipologia e filtri" },
  { title: "Quanti e come frazionare?", icon: Hash, desc: "Distribuisci i contatti in batch" },
  { title: "Con quale canale?", icon: Radio, desc: "Email, WhatsApp, LinkedIn o mix" },
  { title: "Assegnare agenti?", icon: Users, desc: "Distribuisci il lavoro tra gli agenti AI" },
  { title: "Quando inviare?", icon: Clock, desc: "Subito, programmato o distribuito" },
  { title: "Conferma e crea", icon: FileCheck, desc: "Rivedi e lancia la missione" },
];

export function MissionStepRenderer({ stepIndex, data, onChange, onComplete, stats, agentsList }: StepProps) {
  const cfg = STEP_CONFIG[stepIndex];
  if (!cfg) return null;
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-card border border-border rounded-xl p-6 space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{cfg.title}</h3>
          <p className="text-xs text-muted-foreground">{cfg.desc}</p>
        </div>
        <Badge variant="outline" className="ml-auto">Step {stepIndex + 1}/6</Badge>
      </div>

      <div className="min-h-[120px]">
        {stepIndex === 0 && <TargetStep data={data} onChange={onChange} stats={stats} />}
        {stepIndex === 1 && <BatchStep data={data} onChange={onChange} stats={stats} />}
        {stepIndex === 2 && <ChannelStep data={data} onChange={onChange} />}
        {stepIndex === 3 && <AgentStep data={data} onChange={onChange} agentsList={agentsList} />}
        {stepIndex === 4 && <ScheduleStep data={data} onChange={onChange} />}
        {stepIndex === 5 && <ConfirmStep data={data} />}
      </div>

      <div className="flex justify-end">
        <Button onClick={onComplete} className="gap-2">
          {stepIndex === 5 ? "🚀 Lancia Missione" : "Avanti"} <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}

function TargetStep({ data, onChange, stats }: { data: MissionStepData; onChange: (d: MissionStepData) => void; stats?: StepProps["stats"] }) {
  const countries = stats?.countries || [];
  const selected = data.targets?.countries || [];

  const toggle = (code: string) => {
    const cur = [...selected];
    const idx = cur.indexOf(code);
    if (idx >= 0) cur.splice(idx, 1); else cur.push(code);
    onChange({ ...data, targets: { ...data.targets, countries: cur, types: data.targets?.types || [], ratings: data.targets?.ratings || [], hasEmail: data.targets?.hasEmail ?? true } });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Seleziona i paesi target (dati dal tuo database):</p>
      <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto">
        {countries.length === 0 && <p className="text-xs text-muted-foreground italic">Chiedi all'AI di caricare le statistiche...</p>}
        {countries.map(c => (
          <button
            key={c.code}
            onClick={() => toggle(c.code)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              selected.includes(c.code)
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-foreground border-border hover:border-primary/50"
            }`}
          >
            {c.name} <span className="opacity-70">({c.count})</span>
          </button>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-primary font-medium">
          {selected.length} paesi selezionati — {countries.filter(c => selected.includes(c.code)).reduce((s, c) => s + c.count, 0)} contatti totali
        </p>
      )}
    </div>
  );
}

function BatchStep({ data, onChange, stats }: { data: MissionStepData; onChange: (d: MissionStepData) => void; stats?: StepProps["stats"] }) {
  const selected = data.targets?.countries || [];
  const countries = (stats?.countries || []).filter(c => selected.includes(c.code));
  const batches = data.batching?.batches || countries.map(c => ({ country: c.code, count: Math.min(c.count, 50) }));

  const updateBatch = (country: string, count: number) => {
    const updated = batches.map(b => b.country === country ? { ...b, count } : b);
    onChange({ ...data, batching: { batches: updated } });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Regola il numero di contatti per batch:</p>
      {countries.map(c => {
        const batch = batches.find(b => b.country === c.code);
        return (
          <div key={c.code} className="flex items-center gap-3">
            <span className="text-sm w-24 truncate">{c.name}</span>
            <Slider
              value={[batch?.count || 0]}
              onValueChange={([v]) => updateBatch(c.code, v)}
              max={c.count}
              min={1}
              step={1}
              className="flex-1"
            />
            <span className="text-sm font-mono w-12 text-right">{batch?.count || 0}</span>
          </div>
        );
      })}
      <p className="text-xs text-primary font-medium">
        Totale: {batches.reduce((s, b) => s + b.count, 0)} contatti
      </p>
    </div>
  );
}

function ChannelStep({ data, onChange }: { data: MissionStepData; onChange: (d: MissionStepData) => void }) {
  const channels = [
    { key: "email" as const, label: "📧 Email", desc: "Comunicazione formale e tracciabile" },
    { key: "whatsapp" as const, label: "💬 WhatsApp", desc: "Messaggistica diretta e veloce" },
    { key: "linkedin" as const, label: "🔗 LinkedIn", desc: "Networking professionale" },
    { key: "mix" as const, label: "🔄 Mix", desc: "Combina più canali in sequenza" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {channels.map(ch => (
        <button
          key={ch.key}
          onClick={() => onChange({ ...data, channel: ch.key })}
          className={`p-4 rounded-xl border text-left transition-all ${
            data.channel === ch.key
              ? "bg-primary/10 border-primary ring-1 ring-primary/30"
              : "bg-muted/30 border-border hover:border-primary/50"
          }`}
        >
          <div className="text-sm font-medium">{ch.label}</div>
          <div className="text-xs text-muted-foreground mt-1">{ch.desc}</div>
        </button>
      ))}
    </div>
  );
}

function AgentStep({ data, onChange, agentsList }: { data: MissionStepData; onChange: (d: MissionStepData) => void; agentsList?: StepProps["agentsList"] }) {
  const agents = agentsList || [];
  const assigned = data.agents || [];

  const toggleAgent = (agent: typeof agents[0]) => {
    const exists = assigned.find(a => a.agentId === agent.id);
    if (exists) {
      onChange({ ...data, agents: assigned.filter(a => a.agentId !== agent.id) });
    } else {
      onChange({ ...data, agents: [...assigned, { agentId: agent.id, agentName: agent.name, countries: agent.territories }] });
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Seleziona gli agenti AI da coinvolgere:</p>
      {agents.length === 0 && <p className="text-xs text-muted-foreground italic">Nessun agente configurato. Vai su Agenti per crearne.</p>}
      <div className="space-y-2">
        {agents.map(a => {
          const isActive = assigned.some(x => x.agentId === a.id);
          return (
            <button
              key={a.id}
              onClick={() => toggleAgent(a)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                isActive ? "bg-primary/10 border-primary" : "bg-muted/30 border-border hover:border-primary/50"
              }`}
            >
              <span className="text-xl">{a.emoji}</span>
              <div className="flex-1">
                <div className="text-sm font-medium">{a.name}</div>
                <div className="text-xs text-muted-foreground">
                  {a.territories.length > 0 ? `Territori: ${a.territories.join(", ")}` : "Nessun territorio"}
                </div>
              </div>
              {isActive && <Check className="w-4 h-4 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleStep({ data, onChange }: { data: MissionStepData; onChange: (d: MissionStepData) => void }) {
  const options = [
    { key: "immediate" as const, label: "⚡ Subito", desc: "Inserisci immediatamente nel cockpit" },
    { key: "scheduled" as const, label: "📅 Programmato", desc: "Inizia in una data specifica" },
    { key: "distributed" as const, label: "📊 Distribuito", desc: "Spalma l'invio su più giorni" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {options.map(o => (
          <button
            key={o.key}
            onClick={() => onChange({ ...data, schedule: o.key })}
            className={`p-4 rounded-xl border text-center transition-all ${
              data.schedule === o.key
                ? "bg-primary/10 border-primary ring-1 ring-primary/30"
                : "bg-muted/30 border-border hover:border-primary/50"
            }`}
          >
            <div className="text-sm font-medium">{o.label}</div>
            <div className="text-xs text-muted-foreground mt-1">{o.desc}</div>
          </button>
        ))}
      </div>
      {data.schedule === "scheduled" && (
        <Input
          type="datetime-local"
          value={data.scheduleDate || ""}
          onChange={e => onChange({ ...data, scheduleDate: e.target.value })}
          className="max-w-xs"
        />
      )}
    </div>
  );
}

function ConfirmStep({ data }: { data: MissionStepData }) {
  const totalContacts = data.batching?.batches.reduce((s, b) => s + b.count, 0) || 0;
  const channelLabel = { email: "📧 Email", whatsapp: "💬 WhatsApp", linkedin: "🔗 LinkedIn", mix: "🔄 Mix" };
  const scheduleLabel = { immediate: "⚡ Subito", scheduled: "📅 Programmato", distributed: "📊 Distribuito" };

  return (
    <div className="space-y-2 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs text-muted-foreground">Paesi</div>
          <div className="font-medium">{data.targets?.countries?.length || 0}</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs text-muted-foreground">Contatti</div>
          <div className="font-medium">{totalContacts}</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs text-muted-foreground">Canale</div>
          <div className="font-medium">{data.channel ? channelLabel[data.channel] : "—"}</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs text-muted-foreground">Scheduling</div>
          <div className="font-medium">{data.schedule ? scheduleLabel[data.schedule] : "—"}</div>
        </div>
      </div>
      {data.agents && data.agents.length > 0 && (
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Agenti assegnati</div>
          <div className="flex gap-2 flex-wrap">
            {data.agents.map(a => (
              <Badge key={a.agentId} variant="secondary">{a.agentName}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
