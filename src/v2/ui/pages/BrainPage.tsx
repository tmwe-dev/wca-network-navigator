/**
 * BrainPage — /v2/brain
 *
 * F5 2026-05-23: pagina unificata "cervello + mani" del sistema AI.
 * Mostra 5 avatar canale (Email, WhatsApp, LinkedIn, Voce, Command) e
 * 5 icone tono (Formale, Cordiale, Diretto, Caloroso, Tecnico) come
 * riassunto leggibile della configurazione attiva. Read-only in questa
 * fase: le modifiche restano sui pannelli specialistici esistenti.
 */
import * as React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import {
  BRAIN_CHANNELS,
  BRAIN_TONES,
  agentsForChannel,
  classifyTone,
  useBrainAgents,
  useBrainPrompts,
  type BrainChannelDef,
  type BrainToneDef,
} from "@/v2/hooks/useBrain";

export function BrainPage() {
  const [selectedChannel, setSelectedChannel] = React.useState<BrainChannelDef | null>(null);
  const agentsQ = useBrainAgents();
  const promptsQ = useBrainPrompts(selectedChannel?.contexts ?? []);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl">
      <Helmet>
        <title>Cervello AI — Configuratore unificato</title>
        <meta name="description" content="Configuratore unico del cervello AI: canali, toni, prompt e agenti in un'unica vista." />
      </Helmet>

      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Cervello AI</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Una sola pagina per leggere — e in futuro modificare — come il sistema parla. Scegli un canale per vedere
          gli agenti, i prompt vivi e il tono attivo.
        </p>
      </header>

      {/* Canali */}
      <section aria-labelledby="brain-channels" className="mb-8">
        <h2 id="brain-channels" className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Canali di comunicazione
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {BRAIN_CHANNELS.map((c) => {
            const count = agentsQ.data ? agentsForChannel(agentsQ.data, c).length : 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedChannel(c)}
                className="group flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card/60 px-4 py-5 transition-all hover:border-primary/60 hover:bg-card hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label={`Apri canale ${c.label}`}
              >
                <span className="text-3xl select-none" aria-hidden>{c.emoji}</span>
                <span className="text-sm font-medium">{c.label}</span>
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {agentsQ.isLoading ? "…" : `${count} agenti`}
                </Badge>
              </button>
            );
          })}
        </div>
      </section>

      {/* Toni */}
      <section aria-labelledby="brain-tones" className="mb-8">
        <h2 id="brain-tones" className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Registri di tono
        </h2>
        <ToneRow agents={agentsQ.data ?? []} loading={agentsQ.isLoading} />
      </section>

      {/* Cosa serve sapere */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Come funziona</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong className="text-foreground">Canali</strong>: ogni avatar raggruppa gli agenti che parlano su quel
            mezzo e le regole (prompt) attive per quel contesto.
          </p>
          <p>
            <strong className="text-foreground">Toni</strong>: ogni icona conta quanti agenti adottano quel registro
            secondo la persona configurata.
          </p>
          <p>
            Per modificare prompt, persona o capabilities, vai al{" "}
            <Link to="/v2/lab?group=tests&tab=prompt-lab" className="underline underline-offset-2">Prompt Lab</Link>{" "}
            o all'<Link to="/v2/agents/persona" className="underline underline-offset-2">editor persona</Link>.
          </p>
        </CardContent>
      </Card>

      {/* Drawer canale */}
      <Sheet open={!!selectedChannel} onOpenChange={(open) => !open && setSelectedChannel(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-hidden p-0">
          {selectedChannel && (
            <div className="flex h-full flex-col">
              <SheetHeader className="p-6 pb-4 border-b">
                <SheetTitle className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden>{selectedChannel.emoji}</span>
                  <span>Canale {selectedChannel.label}</span>
                </SheetTitle>
                <SheetDescription>
                  Riepilogo leggibile di agenti, prompt e toni in vigore per questo canale.
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-6">
                  <ChannelAgents channel={selectedChannel} agents={agentsQ.data ?? []} loading={agentsQ.isLoading} />
                  <ChannelPrompts loading={promptsQ.isLoading} prompts={promptsQ.data ?? []} />
                </div>
              </ScrollArea>
              <div className="p-4 border-t flex justify-end gap-2">
                <Button variant="outline" asChild>
                  <Link to="/v2/lab?group=tests&tab=prompt-lab">Modifica prompt</Link>
                </Button>
                <Button onClick={() => setSelectedChannel(null)}>Chiudi</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ToneRow({ agents, loading }: { agents: ReturnType<typeof useBrainAgents>["data"] extends infer T ? T extends undefined ? never : T : never; loading: boolean }) {
  const counts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const t of BRAIN_TONES) map.set(t.id, 0);
    (agents ?? []).forEach((a) => {
      const matched = classifyTone(a.tone) ?? classifyTone(a.custom_tone_prompt);
      if (matched) map.set(matched.id, (map.get(matched.id) ?? 0) + 1);
    });
    return map;
  }, [agents]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {BRAIN_TONES.map((t: BrainToneDef) => (
        <div
          key={t.id}
          className="flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card/40 px-4 py-5"
        >
          <span className="text-3xl select-none" aria-hidden>{t.emoji}</span>
          <span className="text-sm font-medium">{t.label}</span>
          <Badge variant="outline" className="text-[10px] font-normal">
            {loading ? "…" : `${counts.get(t.id) ?? 0} agenti`}
          </Badge>
        </div>
      ))}
    </div>
  );
}

function ChannelAgents({
  channel,
  agents,
  loading,
}: {
  channel: BrainChannelDef;
  agents: ReturnType<typeof useBrainAgents>["data"] extends infer T ? T extends undefined ? never : T : never;
  loading: boolean;
}) {
  const list = React.useMemo(() => agentsForChannel(agents ?? [], channel), [agents, channel]);

  return (
    <section>
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Agenti su questo canale</h3>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Nessun agente configurato esplicitamente per questo canale.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((a) => {
            const tone = classifyTone(a.tone) ?? classifyTone(a.custom_tone_prompt);
            return (
              <li
                key={a.agent_id}
                className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
              >
                <span className="text-2xl select-none" aria-hidden>{a.avatar_emoji ?? "🤖"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{a.name ?? "Agente senza nome"}</span>
                    {a.role && <Badge variant="secondary" className="text-[10px] font-normal">{a.role}</Badge>}
                    {tone && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {tone.emoji} {tone.label}
                      </Badge>
                    )}
                  </div>
                  {a.preferred_model && (
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">{a.preferred_model}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ChannelPrompts({
  loading,
  prompts,
}: {
  loading: boolean;
  prompts: { id: string; name: string; context: string; objective: string | null; priority: number | null }[];
}) {
  return (
    <section>
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
        Prompt vivi ({prompts.length})
      </h3>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : prompts.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Nessun prompt attivo per questo canale.</p>
      ) : (
        <ul className="space-y-2">
          {prompts.map((p) => (
            <li key={p.id} className="rounded-lg border border-border/60 bg-card/40 p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{p.name}</span>
                <Badge variant="outline" className="text-[10px] font-normal">{p.context}</Badge>
                {typeof p.priority === "number" && (
                  <span className="text-[10px] text-muted-foreground font-mono">p{p.priority}</span>
                )}
              </div>
              {p.objective && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.objective}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default BrainPage;