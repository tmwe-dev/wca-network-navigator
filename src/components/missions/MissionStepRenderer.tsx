import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Check, ChevronRight, Globe, Hash, Radio, Users, Clock, FileCheck,
  Search, MessageSquareText, Paperclip, Image, Link2, Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { findActiveEmailPrompts } from "@/data/emailPrompts";
import { findEmailTemplatesShort } from "@/data/emailTemplates";

// ── Data types ──

export interface DeepSearchConfig {
  enabled: boolean;
  scrapeWebsite: boolean;
  scrapeLinkedIn: boolean;
  verifyWhatsApp: boolean;
  aiAnalysis: boolean;
}

export interface CommunicationConfig {
  templateMode: "ai_generate" | "preset" | "custom";
  presetId?: string;
  customSubject?: string;
  customBody?: string;
  samplePreview?: string;
  emailType?: string;
}

export interface AttachmentConfig {
  templateIds: string[];
  imageIds: string[];
  links: string[];
  includeSignatureImage: boolean;
}

export interface ToneConfig {
  quality: "fast" | "standard" | "premium";
  tone: string;
  language: string;
}

export interface MissionStepData {
  targets?: { countries: string[]; types: string[]; ratings: number[]; hasEmail: boolean };
  batching?: { batches: { country: string; count: number }[] };
  channel?: "email" | "whatsapp" | "linkedin" | "mix";
  deepSearch?: DeepSearchConfig;
  communication?: CommunicationConfig;
  attachments?: AttachmentConfig;
  toneConfig?: ToneConfig;
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

export const STEP_CONFIG = [
  { title: "Chi contattare?", icon: Globe, desc: "Seleziona paesi e filtri target" },
  { title: "Quanti e come frazionare?", icon: Hash, desc: "Distribuisci i contatti in batch" },
  { title: "Con quale canale?", icon: Radio, desc: "Email, WhatsApp, LinkedIn o mix" },
  { title: "Deep Search?", icon: Search, desc: "Arricchimento dati prima dell'invio" },
  { title: "Tipo di comunicazione", icon: MessageSquareText, desc: "Genera o scegli un modello di messaggio" },
  { title: "Allegati, immagini e link", icon: Paperclip, desc: "Documenti, immagini e riferimenti" },
  { title: "Tono e qualità", icon: Palette, desc: "Livello qualità, tono e lingua" },
  { title: "Assegnare agenti?", icon: Users, desc: "Distribuisci il lavoro tra gli agenti AI" },
  { title: "Quando inviare?", icon: Clock, desc: "Subito, programmato o distribuito" },
  { title: "Conferma e crea", icon: FileCheck, desc: "Rivedi e lancia la missione" },
];

export const TOTAL_STEPS = STEP_CONFIG.length;

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
        <Badge variant="outline" className="ml-auto">Step {stepIndex + 1}/{TOTAL_STEPS}</Badge>
      </div>

      <div className="min-h-[120px]">
        {stepIndex === 0 && <TargetStep data={data} onChange={onChange} stats={stats} />}
        {stepIndex === 1 && <BatchStep data={data} onChange={onChange} stats={stats} />}
        {stepIndex === 2 && <ChannelStep data={data} onChange={onChange} />}
        {stepIndex === 3 && <DeepSearchStep data={data} onChange={onChange} />}
        {stepIndex === 4 && <CommunicationStep data={data} onChange={onChange} />}
        {stepIndex === 5 && <AttachmentStep data={data} onChange={onChange} />}
        {stepIndex === 6 && <ToneStep data={data} onChange={onChange} />}
        {stepIndex === 7 && <AgentStep data={data} onChange={onChange} agentsList={agentsList} />}
        {stepIndex === 8 && <ScheduleStep data={data} onChange={onChange} />}
        {stepIndex === 9 && <ConfirmStep data={data} />}
      </div>

      <div className="flex justify-end">
        <Button onClick={onComplete} className="gap-2">
          {stepIndex === TOTAL_STEPS - 1 ? "🚀 Lancia Missione" : "Avanti"} <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}

// ── Step 0: Target ──

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
              selected.includes(c.code) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-foreground border-border hover:border-primary/50"
            }`}
          >
            {c.name} <span className="opacity-70">({c.count})</span>
          </button>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-primary font-medium">
          {selected.length} paesi — {countries.filter(c => selected.includes(c.code)).reduce((s, c) => s + c.count, 0)} contatti
        </p>
      )}
    </div>
  );
}

// ── Step 1: Batch ──

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
            <Slider value={[batch?.count || 0]} onValueChange={([v]) => updateBatch(c.code, v)} max={c.count} min={1} step={1} className="flex-1" />
            <span className="text-sm font-mono w-12 text-right">{batch?.count || 0}</span>
          </div>
        );
      })}
      <p className="text-xs text-primary font-medium">Totale: {batches.reduce((s, b) => s + b.count, 0)} contatti</p>
    </div>
  );
}

// ── Step 2: Channel ──

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
            data.channel === ch.key ? "bg-primary/10 border-primary ring-1 ring-primary/30" : "bg-muted/30 border-border hover:border-primary/50"
          }`}
        >
          <div className="text-sm font-medium">{ch.label}</div>
          <div className="text-xs text-muted-foreground mt-1">{ch.desc}</div>
        </button>
      ))}
    </div>
  );
}

// ── Step 3: Deep Search ──

function DeepSearchStep({ data, onChange }: { data: MissionStepData; onChange: (d: MissionStepData) => void }) {
  const ds = data.deepSearch || { enabled: false, scrapeWebsite: true, scrapeLinkedIn: true, verifyWhatsApp: false, aiAnalysis: true };
  const set = (patch: Partial<DeepSearchConfig>) => onChange({ ...data, deepSearch: { ...ds, ...patch } });

  const options = [
    { key: "scrapeWebsite" as const, label: "🌐 Scrape sito web aziendale", desc: "Analizza il sito per capire servizi e specializzazioni" },
    { key: "scrapeLinkedIn" as const, label: "🔗 Scrape profilo LinkedIn", desc: "Raccoglie headline, about e posizione del contatto" },
    { key: "verifyWhatsApp" as const, label: "💬 Verifica WhatsApp", desc: "Controlla se il numero è attivo su WhatsApp" },
    { key: "aiAnalysis" as const, label: "🤖 Analisi AI del profilo", desc: "Genera un riepilogo intelligente per personalizzare il messaggio" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Attivare Deep Search prima dell'invio?</p>
          <p className="text-xs text-muted-foreground">Arricchisce i dati dei contatti per messaggi più personalizzati</p>
        </div>
        <Switch checked={ds.enabled} onCheckedChange={v => set({ enabled: v })} />
      </div>

      {ds.enabled && (
        <div className="space-y-2 pl-1 border-l-2 border-primary/30 ml-2">
          {options.map(opt => (
            <label key={opt.key} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
              <Switch
                checked={ds[opt.key]}
                onCheckedChange={v => set({ [opt.key]: v })}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      )}

      {!ds.enabled && (
        <div className="bg-muted/20 rounded-lg p-3 text-xs text-muted-foreground">
          💡 Senza Deep Search, i messaggi saranno generati con i dati già presenti nel database. Puoi sempre attivarlo dopo.
        </div>
      )}
    </div>
  );
}

// ── Step 4: Communication Template ──

function CommunicationStep({ data, onChange }: { data: MissionStepData; onChange: (d: MissionStepData) => void }) {
  const comm = data.communication || { templateMode: "ai_generate" };
  const set = (patch: Partial<CommunicationConfig>) => onChange({ ...data, communication: { ...comm, ...patch } });

  const [emailTypes, setEmailTypes] = useState<{ id: string; title: string; scope: string }[]>([]);

  useEffect(() => {
    findActiveEmailPrompts()
      .then((data) => { if (data) setEmailTypes(data as any); });
  }, []);

  const modes = [
    { key: "ai_generate" as const, label: "🤖 AI genera in tempo reale", desc: "L'AI crea un messaggio personalizzato per ogni contatto basandosi sui dati" },
    { key: "preset" as const, label: "📋 Scegli un tipo email", desc: "Usa un modello di comunicazione già configurato (es. Hook → CTA)" },
    { key: "custom" as const, label: "✏️ Scrivi tu il modello", desc: "Definisci oggetto e corpo — l'AI li adatterà per ogni destinatario" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Come vuoi preparare i messaggi?</p>

      <div className="space-y-2">
        {modes.map(m => (
          <button
            key={m.key}
            onClick={() => set({ templateMode: m.key })}
            className={`w-full p-3 rounded-xl border text-left transition-all ${
              comm.templateMode === m.key ? "bg-primary/10 border-primary ring-1 ring-primary/30" : "bg-muted/30 border-border hover:border-primary/50"
            }`}
          >
            <div className="text-sm font-medium">{m.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{m.desc}</div>
          </button>
        ))}
      </div>

      {comm.templateMode === "preset" && emailTypes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Seleziona il tipo:</p>
          <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto">
            {emailTypes.map(et => (
              <button
                key={et.id}
                onClick={() => set({ presetId: et.id, emailType: et.title })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  comm.presetId === et.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-foreground border-border hover:border-primary/50"
                }`}
              >
                {et.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {comm.templateMode === "custom" && (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Oggetto (template)</Label>
            <Input
              value={comm.customSubject || ""}
              onChange={e => set({ customSubject: e.target.value })}
              placeholder="Es: Partnership opportunity — {{company}}"
              className="text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Corpo (template)</Label>
            <Textarea
              value={comm.customBody || ""}
              onChange={e => set({ customBody: e.target.value })}
              placeholder="Scrivi il modello del messaggio. Usa {{name}}, {{company}}, {{country}} come variabili..."
              className="text-sm min-h-[100px]"
            />
          </div>
          <p className="text-xs text-muted-foreground">💡 L'AI adatterà questo modello per ogni destinatario, personalizzando il tono e i dettagli.</p>
        </div>
      )}

      {comm.templateMode === "ai_generate" && (
        <div className="bg-muted/20 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
          <p>💡 <strong>L'AI genererà un messaggio unico per ogni contatto</strong>, usando:</p>
          <ul className="list-disc ml-4 space-y-0.5">
            <li>Dati del partner (servizi, certificazioni, rating)</li>
            <li>Profilo scaricato (se disponibile)</li>
            <li>Knowledge Base aziendale</li>
            <li>Risultati Deep Search (se attivato)</li>
          </ul>
          <p>Chiedi all'AI nella chat di generare un esempio di anteprima!</p>
        </div>
      )}
    </div>
  );
}

// ── Step 5: Attachments, Images, Links ──

function AttachmentStep({ data, onChange }: { data: MissionStepData; onChange: (d: MissionStepData) => void }) {
  const att = data.attachments || { templateIds: [], imageIds: [], links: [], includeSignatureImage: true };
  const set = (patch: Partial<AttachmentConfig>) => onChange({ ...data, attachments: { ...att, ...patch } });

  const [templates, setTemplates] = useState<{ id: string; name: string; file_url: string }[]>([]);
  const [images, setImages] = useState<{ name: string; url: string }[]>([]);
  const [newLink, setNewLink] = useState("");

  useEffect(() => {
    // Load templates
    findEmailTemplatesShort()
      .then((data) => { if (data) setTemplates(data as any); });
    // Load images
    supabase.storage.from("email-images").list("", { limit: 50, sortBy: { column: "created_at", order: "desc" } })
      .then(({ data }) => {
        if (data) setImages(data.filter(f => f.name && !f.name.startsWith(".")).map(f => {
          const { data: urlData } = supabase.storage.from("email-images").getPublicUrl(f.name);
          return { name: f.name, url: urlData.publicUrl };
        }));
      });
  }, []);

  const addLink = () => {
    if (!newLink.trim()) return;
    set({ links: [...att.links, newLink.trim()] });
    setNewLink("");
  };

  return (
    <div className="space-y-4">
      {/* Templates/Documents */}
      <div>
        <p className="text-sm font-medium mb-2">📎 Documenti da allegare</p>
        {templates.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nessun template caricato. Vai su Impostazioni → Template.</p>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto">
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => {
                  const ids = att.templateIds.includes(t.id) ? att.templateIds.filter(x => x !== t.id) : [...att.templateIds, t.id];
                  set({ templateIds: ids });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  att.templateIds.includes(t.id) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-foreground border-border hover:border-primary/50"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Images */}
      <div>
        <p className="text-sm font-medium mb-2">🖼️ Immagini nel corpo email</p>
        {images.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nessuna immagine. Caricale in Email Composer → tab Immagini.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {images.slice(0, 10).map(img => (
              <button
                key={img.name}
                onClick={() => {
                  const ids = att.imageIds.includes(img.name) ? att.imageIds.filter(x => x !== img.name) : [...att.imageIds, img.name];
                  set({ imageIds: ids });
                }}
                className={`flex-shrink-0 w-16 h-16 rounded-lg border-2 overflow-hidden transition-all ${
                  att.imageIds.includes(img.name) ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
                }`}
              >
                <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Links */}
      <div>
        <p className="text-sm font-medium mb-2">🔗 Link da includere</p>
        <div className="flex gap-2">
          <Input value={newLink} onChange={e => setNewLink(e.target.value)} onKeyDown={e => e.key === "Enter" && addLink()} placeholder="https://..." className="text-sm" />
          <Button size="sm" variant="outline" onClick={addLink}>+</Button>
        </div>
        {att.links.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {att.links.map((l, i) => (
              <Badge key={i} variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => set({ links: att.links.filter((_, j) => j !== i) })}>
                {l.substring(0, 30)}... ✕
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Signature image */}
      <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
        <Switch checked={att.includeSignatureImage} onCheckedChange={v => set({ includeSignatureImage: v })} />
        <div>
          <div className="text-sm">Includi immagine firma</div>
          <div className="text-xs text-muted-foreground">Aggiunge automaticamente la firma visiva configurata nelle impostazioni</div>
        </div>
      </label>
    </div>
  );
}

// ── Step 6: Tone & Quality ──

function ToneStep({ data, onChange }: { data: MissionStepData; onChange: (d: MissionStepData) => void }) {
  const tc = data.toneConfig || { quality: "standard", tone: "professionale", language: "auto" };
  const set = (patch: Partial<ToneConfig>) => onChange({ ...data, toneConfig: { ...tc, ...patch } });

  const qualities = [
    { key: "fast" as const, label: "⚡ Rapida", desc: "~3 crediti. Modello leggero, KB ridotta", color: "text-yellow-500" },
    { key: "standard" as const, label: "✨ Standard", desc: "~8 crediti. KB completa, profilo partner", color: "text-blue-500" },
    { key: "premium" as const, label: "💎 Premium", desc: "~15 crediti. KB completa + Deep Search + advisor", color: "text-purple-500" },
  ];

  const tones = ["professionale", "amichevole", "formale", "diretto", "persuasivo", "colloquiale"];
  const languages = [
    { key: "auto", label: "🌍 Auto (basato sul paese)" },
    { key: "english", label: "🇬🇧 Inglese" },
    { key: "italiano", label: "🇮🇹 Italiano" },
    { key: "français", label: "🇫🇷 Francese" },
    { key: "deutsch", label: "🇩🇪 Tedesco" },
    { key: "español", label: "🇪🇸 Spagnolo" },
  ];

  return (
    <div className="space-y-4">
      {/* Quality */}
      <div>
        <p className="text-sm font-medium mb-2">Livello di qualità</p>
        <div className="space-y-2">
          {qualities.map(q => (
            <button
              key={q.key}
              onClick={() => set({ quality: q.key })}
              className={`w-full p-3 rounded-xl border text-left transition-all ${
                tc.quality === q.key ? "bg-primary/10 border-primary ring-1 ring-primary/30" : "bg-muted/30 border-border hover:border-primary/50"
              }`}
            >
              <div className="text-sm font-medium">{q.label}</div>
              <div className="text-xs text-muted-foreground">{q.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Tone */}
      <div>
        <p className="text-sm font-medium mb-2">Tono</p>
        <div className="flex flex-wrap gap-2">
          {tones.map(t => (
            <button
              key={t}
              onClick={() => set({ tone: t })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${
                tc.tone === t ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-foreground border-border hover:border-primary/50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Language */}
      <div>
        <p className="text-sm font-medium mb-2">Lingua</p>
        <div className="flex flex-wrap gap-2">
          {languages.map(l => (
            <button
              key={l.key}
              onClick={() => set({ language: l.key })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                tc.language === l.key ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-foreground border-border hover:border-primary/50"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 7: Agents ──

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
            <button key={a.id} onClick={() => toggleAgent(a)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${isActive ? "bg-primary/10 border-primary" : "bg-muted/30 border-border hover:border-primary/50"}`}>
              <span className="text-xl">{a.emoji}</span>
              <div className="flex-1">
                <div className="text-sm font-medium">{a.name}</div>
                <div className="text-xs text-muted-foreground">{a.territories.length > 0 ? `Territori: ${a.territories.join(", ")}` : "Nessun territorio"}</div>
              </div>
              {isActive && <Check className="w-4 h-4 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 8: Schedule ──

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
          <button key={o.key} onClick={() => onChange({ ...data, schedule: o.key })}
            className={`p-4 rounded-xl border text-center transition-all ${data.schedule === o.key ? "bg-primary/10 border-primary ring-1 ring-primary/30" : "bg-muted/30 border-border hover:border-primary/50"}`}>
            <div className="text-sm font-medium">{o.label}</div>
            <div className="text-xs text-muted-foreground mt-1">{o.desc}</div>
          </button>
        ))}
      </div>
      {data.schedule === "scheduled" && (
        <Input type="datetime-local" value={data.scheduleDate || ""} onChange={e => onChange({ ...data, scheduleDate: e.target.value })} className="max-w-xs" />
      )}
    </div>
  );
}

// ── Step 9: Confirm ──

function ConfirmStep({ data }: { data: MissionStepData }) {
  const totalContacts = data.batching?.batches.reduce((s, b) => s + b.count, 0) || 0;
  const channelLabel = { email: "📧 Email", whatsapp: "💬 WhatsApp", linkedin: "🔗 LinkedIn", mix: "🔄 Mix" };
  const scheduleLabel = { immediate: "⚡ Subito", scheduled: "📅 Programmato", distributed: "📊 Distribuito" };

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">Rivedi la configurazione completa della missione:</p>
      <div className="grid grid-cols-2 gap-2">
        <SummaryCard label="Paesi" value={`${data.targets?.countries?.length || 0}`} />
        <SummaryCard label="Contatti" value={`${totalContacts}`} />
        <SummaryCard label="Canale" value={data.channel ? channelLabel[data.channel] : "—"} />
        <SummaryCard label="Scheduling" value={data.schedule ? scheduleLabel[data.schedule] : "—"} />
        <SummaryCard label="Deep Search" value={data.deepSearch?.enabled ? "✅ Attivo" : "❌ No"} />
        <SummaryCard label="Qualità" value={data.toneConfig?.quality === "premium" ? "💎 Premium" : data.toneConfig?.quality === "fast" ? "⚡ Rapida" : "✨ Standard"} />
        <SummaryCard label="Tono" value={data.toneConfig?.tone || "professionale"} />
        <SummaryCard label="Lingua" value={data.toneConfig?.language === "auto" ? "🌍 Auto" : data.toneConfig?.language || "auto"} />
      </div>

      {data.communication && (
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Comunicazione</div>
          <div className="text-sm">
            {data.communication.templateMode === "ai_generate" && "🤖 AI genera in tempo reale"}
            {data.communication.templateMode === "preset" && `📋 ${data.communication.emailType || "Tipo email selezionato"}`}
            {data.communication.templateMode === "custom" && `✏️ Modello personalizzato: "${data.communication.customSubject || "..."}"`}
          </div>
        </div>
      )}

      {data.attachments && (data.attachments.templateIds.length > 0 || data.attachments.imageIds.length > 0 || data.attachments.links.length > 0) && (
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Allegati</div>
          <div className="flex gap-3 text-xs">
            {data.attachments.templateIds.length > 0 && <span>📎 {data.attachments.templateIds.length} documenti</span>}
            {data.attachments.imageIds.length > 0 && <span>🖼️ {data.attachments.imageIds.length} immagini</span>}
            {data.attachments.links.length > 0 && <span>🔗 {data.attachments.links.length} link</span>}
          </div>
        </div>
      )}

      {data.agents && data.agents.length > 0 && (
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Agenti assegnati</div>
          <div className="flex gap-2 flex-wrap">
            {data.agents.map(a => <Badge key={a.agentId} variant="secondary">{a.agentName}</Badge>)}
          </div>
        </div>
      )}

      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-primary">
        Crediti stimati: ~{totalContacts * (data.toneConfig?.quality === "premium" ? 15 : data.toneConfig?.quality === "fast" ? 3 : 8)} crediti
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium capitalize">{value}</div>
    </div>
  );
}
