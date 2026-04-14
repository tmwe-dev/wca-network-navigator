import { useState } from "react";
import MissionPlanReviewComponent from "./MissionPlanReview";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronDown, Rocket } from "lucide-react";
import type { MissionStepData } from "@/components/missions/MissionStepRenderer";

// ── Widget type definitions ──

export interface WidgetConfig {
  type: "country_select" | "channel_select" | "slider_batch" | "toggle_group" | "confirm_summary" | "plan_review";
  data?: Record<string, unknown>;
}

// ── Detect widget markers in AI text ──

const WIDGET_MARKERS: Record<string, WidgetConfig["type"]> = {
  "[WIDGET:country_select]": "country_select",
  "[WIDGET:channel_select]": "channel_select",
  "[WIDGET:slider_batch]": "slider_batch",
  "[WIDGET:toggle_group]": "toggle_group",
  "[WIDGET:confirm_summary]": "confirm_summary",
  "[WIDGET:plan_review]": "plan_review",
};

export function extractWidgets(text: string): { cleanText: string; widgets: WidgetConfig[] } {
  let cleanText = text;
  const widgets: WidgetConfig[] = [];

  for (const [marker, type] of Object.entries(WIDGET_MARKERS)) {
    if (cleanText.includes(marker)) {
      cleanText = cleanText.replace(marker, "").trim();
      widgets.push({ type });
    }
  }

  return { cleanText, widgets };
}

// ── Country Multi-Select Widget ──

interface CountrySelectProps {
  countries: { code: string; name: string; count: number; withEmail: number }[];
  selected: string[];
  onSelect: (codes: string[]) => void;
}

function CountrySelectWidget({ countries, selected, onSelect }: CountrySelectProps) {
  const [open, setOpen] = useState(true);

  const _toggle = (code: string) => {
    const updated = selected.includes(code) ? selected.filter(c => c !== code) : [...selected, code];
    onSelect(updated);
  };

  const totalSelected = countries.filter(c => selected.includes(c.code)).reduce((s, c) => s + c.count, 0);

  return (
    <div className="mt-2 bg-muted/30 rounded-lg border border-border p-3 space-y-2">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-left">
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "" : "-rotate-90"}`} />
        <span className="text-sm font-medium">Seleziona paesi</span>
        {selected.length > 0 && (
          <Badge variant="secondary" className="ml-auto text-xs">{selected.length} paesi — {totalSelected} partner</Badge>
        )}
      </button>
      {open && (
        <div className="max-h-[200px] overflow-y-auto space-y-1">
          {countries.map(c => (
            <label key={c.code} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer text-sm">
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                selected.includes(c.code) ? "bg-primary border-primary" : "border-muted-foreground/30"
              }`}>
                {selected.includes(c.code) && <Check className="w-3 h-3 text-primary-foreground" />}
              </div>
              <span className="flex-1">{c.name}</span>
              <span className="text-xs text-muted-foreground">{c.count} partner</span>
              <span className="text-xs text-muted-foreground/60">({c.withEmail} email)</span>
            </label>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <Button size="sm" className="w-full mt-1" onClick={() => setOpen(false)}>
          ✓ Conferma {selected.length} paesi
        </Button>
      )}
    </div>
  );
}

// ── Channel Select Widget ──

interface ChannelSelectProps {
  value: string;
  onChange: (v: string) => void;
}

function ChannelSelectWidget({ value, onChange }: ChannelSelectProps) {
  const channels = [
    { key: "email", label: "📧 Email", desc: "Formale e tracciabile" },
    { key: "whatsapp", label: "💬 WhatsApp", desc: "Diretto e veloce" },
    { key: "linkedin", label: "🔗 LinkedIn", desc: "Networking professionale" },
    { key: "mix", label: "🔄 Mix", desc: "Multi-canale" },
  ];

  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      {channels.map(ch => (
        <button
          key={ch.key}
          onClick={() => onChange(ch.key)}
          className={`p-3 rounded-lg border text-left transition-all text-xs ${
            value === ch.key ? "bg-primary/10 border-primary ring-1 ring-primary/30" : "bg-muted/30 border-border hover:border-primary/50"
          }`}
        >
          <div className="font-medium">{ch.label}</div>
          <div className="text-muted-foreground mt-0.5">{ch.desc}</div>
        </button>
      ))}
    </div>
  );
}

// ── Slider Batch Widget ──

interface SliderBatchProps {
  batches: { country: string; name: string; count: number; max: number }[];
  onChange: (batches: { country: string; name: string; count: number; max: number }[]) => void;
}

function SliderBatchWidget({ batches, onChange }: SliderBatchProps) {
  const update = (country: string, count: number) => {
    onChange(batches.map(b => b.country === country ? { ...b, count } : b));
  };

  return (
    <div className="mt-2 bg-muted/30 rounded-lg border border-border p-3 space-y-3">
      <p className="text-xs text-muted-foreground font-medium">Contatti per batch:</p>
      {batches.map(b => (
        <div key={b.country} className="flex items-center gap-3">
          <span className="text-xs w-20 truncate">{b.name}</span>
          <Slider value={[b.count]} onValueChange={([v]) => update(b.country, v)} max={b.max} min={1} step={1} className="flex-1" />
          <span className="text-xs font-mono w-10 text-right">{b.count}</span>
        </div>
      ))}
      <p className="text-xs text-primary font-medium">Totale: {batches.reduce((s, b) => s + b.count, 0)} contatti</p>
    </div>
  );
}

// ── Toggle Group Widget ──

interface ToggleGroupProps {
  options: { key: string; label: string; desc: string; checked: boolean }[];
  onChange: (key: string, checked: boolean) => void;
}

function ToggleGroupWidget({ options, onChange }: ToggleGroupProps) {
  return (
    <div className="mt-2 bg-muted/30 rounded-lg border border-border p-3 space-y-2">
      {options.map(opt => (
        <label key={opt.key} className="flex items-center gap-3 py-1 cursor-pointer">
          <Switch checked={opt.checked} onCheckedChange={v => onChange(opt.key, v)} />
          <div className="flex-1">
            <div className="text-xs font-medium">{opt.label}</div>
            <div className="text-xs text-muted-foreground">{opt.desc}</div>
          </div>
        </label>
      ))}
    </div>
  );
}

// ── Confirm Summary Widget ──

interface ConfirmSummaryProps {
  data: MissionStepData;
  countryStats: { code: string; name: string; count: number }[];
  onLaunch: () => void;
}

function ConfirmSummaryWidget({ data, countryStats, onLaunch }: ConfirmSummaryProps) {
  const countries = data.targets?.countries || [];
  const total = data.batching?.batches.reduce((s, b) => s + b.count, 0) || 0;

  return (
    <div className="mt-2 bg-card border border-primary/30 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-semibold flex items-center gap-2"><Rocket className="w-4 h-4 text-primary" /> Riepilogo Missione</h4>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-muted-foreground">Paesi:</span> {countries.length}</div>
        <div><span className="text-muted-foreground">Contatti:</span> {total}</div>
        <div><span className="text-muted-foreground">Canale:</span> {data.channel || "email"}</div>
        <div><span className="text-muted-foreground">Deep Search:</span> {data.deepSearch?.enabled ? "Sì" : "No"}</div>
      </div>
      {countries.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {countries.map(c => {
            const stat = countryStats.find(s => s.code === c);
            return <Badge key={c} variant="secondary" className="text-xs">{stat?.name || c}</Badge>;
          })}
        </div>
      )}
      <Button className="w-full gap-2" onClick={onLaunch}>
        <Rocket className="w-4 h-4" /> 🚀 Lancia Missione
      </Button>
    </div>
  );
}

// ── Main renderer ──

interface MissionWidgetRendererProps {
  widgets: WidgetConfig[];
  stepData: MissionStepData;
  onChange: (d: MissionStepData) => void;
  countryStats: { code: string; name: string; count: number; withEmail: number }[];
  onLaunch: () => void;
  onPlanApprove?: () => void;
  onPlanCancel?: () => void;
  planReviewProps?: { plan: Record<string, unknown>; isApproving: boolean };
}

export function MissionWidgetRenderer({ widgets, stepData, onChange, countryStats, onLaunch, onPlanApprove, onPlanCancel, planReviewProps }: MissionWidgetRendererProps) {
  if (widgets.length === 0) return null;

  return (
    <div className="space-y-2">
      {widgets.map((w, i) => {
        switch (w.type) {
          case "country_select":
            return (
              <CountrySelectWidget
                key={i}
                countries={countryStats}
                selected={stepData.targets?.countries || []}
                onSelect={codes => onChange({
                  ...stepData,
                  targets: { ...stepData.targets, countries: codes, types: stepData.targets?.types || [], ratings: stepData.targets?.ratings || [], hasEmail: stepData.targets?.hasEmail ?? true },
                })}
              />
            );

          case "channel_select":
            return (
              <ChannelSelectWidget
                key={i}
                value={stepData.channel || "email"}
                onChange={v => onChange({ ...stepData, channel: v as string })}
              />
            );

          case "slider_batch": {
            const selected = stepData.targets?.countries || [];
            const batches = selected.map(code => {
              const stat = countryStats.find(c => c.code === code);
              const existing = stepData.batching?.batches.find(b => b.country === code);
              return {
                country: code,
                name: stat?.name || code,
                count: existing?.count || Math.min(stat?.count || 50, 50),
                max: stat?.count || 100,
              };
            });
            return (
              <SliderBatchWidget
                key={i}
                batches={batches}
                onChange={updated => onChange({
                  ...stepData,
                  batching: { batches: updated.map(b => ({ country: b.country, count: b.count })) },
                })}
              />
            );
          }

          case "toggle_group":
            return (
              <ToggleGroupWidget
                key={i}
                options={[
                  { key: "scrapeWebsite", label: "🌐 Scrape sito web", desc: "Analizza il sito per servizi e specializzazioni", checked: stepData.deepSearch?.scrapeWebsite ?? true },
                  { key: "scrapeLinkedIn", label: "🔗 Scrape LinkedIn", desc: "Raccoglie dati professionali", checked: stepData.deepSearch?.scrapeLinkedIn ?? true },
                  { key: "verifyWhatsApp", label: "💬 Verifica WhatsApp", desc: "Controlla disponibilità WhatsApp", checked: stepData.deepSearch?.verifyWhatsApp ?? false },
                  { key: "aiAnalysis", label: "🤖 Analisi AI", desc: "Riepilogo intelligente del profilo", checked: stepData.deepSearch?.aiAnalysis ?? true },
                ]}
                onChange={(key, checked) => onChange({
                  ...stepData,
                  deepSearch: { ...stepData.deepSearch, enabled: true, [key]: checked },
                })}
              />
            );

          case "confirm_summary":
            return (
              <ConfirmSummaryWidget
                key={i}
                data={stepData}
                countryStats={countryStats}
                onLaunch={onLaunch}
              />
            );

          case "plan_review":
            if (planReviewProps && onPlanApprove && onPlanCancel) {
              return (
                <MissionPlanReviewComponent
                  key={i}
                  plan={planReviewProps.plan}
                  visible={true}
                  isApproving={planReviewProps.isApproving}
                  onApprove={onPlanApprove}
                  onCancel={onPlanCancel}
                />
              );
            }
            return null;

          default:
            return null;
        }
      })}
    </div>
  );
}
