import * as React from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AgentRegistryEntry } from "@/data/agentPrompts";
import type { SimulatorResponse } from "@/data/agentSimulator";
import type { KbEntry } from "@/data/kbEntries";
import { Section } from "./Section";
import { CATEGORY_LABEL } from "./constants";
import { copy } from "./utils";
import { buildAgentMarkdown } from "./markdown";

interface Props {
  selected: AgentRegistryEntry | undefined;
  data: SimulatorResponse | undefined;
  loadingId: string | null;
  errorMsg: string | null;
  kbAll: KbEntry[] | null;
  kbCurrent: KbEntry[];
}

export function ReaderContent({ selected, data, loadingId, errorMsg, kbAll, kbCurrent }: Props) {
  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-4xl p-6 space-y-4">
        {selected && (
          <header className="border-b pb-3 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">{selected.displayName}</h2>
              <Badge variant="outline" className="text-[10px]">{CATEGORY_LABEL[selected.category]}</Badge>
              {selected.runtime.edgeFunction && (
                <Badge variant="secondary" className="text-[10px] font-mono">{selected.runtime.edgeFunction}</Badge>
              )}
              <Badge variant="secondary" className="text-[10px] font-mono">{selected.runtime.modelDefault}</Badge>
            </div>
            {selected.description && (
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{selected.description}</p>
            )}
          </header>
        )}

        {loadingId === selected?.id && !data && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground p-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Assemblaggio prompt in corso…
          </div>
        )}

        {errorMsg && (
          <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            Errore: {errorMsg}
          </div>
        )}

        {data && (
          <>
            <Section
              title="System prompt assemblato"
              meta={`${data.assembled.char_count.toLocaleString("it-IT")} caratteri`}
              onCopy={() => copy(data.assembled.system_prompt, "System prompt")}
            >
              <pre className="whitespace-pre-wrap break-words text-[12px] leading-relaxed font-mono bg-muted/40 rounded p-3 max-h-[600px] overflow-auto">
                {data.assembled.system_prompt || "(vuoto)"}
              </pre>
            </Section>

            <Section
              title="Persona"
              meta={data.persona.loaded ? `tono: ${data.persona.tone ?? "—"} · lingua: ${data.persona.language ?? "—"}` : "non caricata"}
              onCopy={data.persona.block_preview ? () => copy(data.persona.block_preview ?? "", "Persona") : undefined}
            >
              {data.persona.loaded ? (
                <pre className="whitespace-pre-wrap break-words text-[12px] leading-relaxed bg-muted/40 rounded p-3">
                  {data.persona.block_preview || "(blocco persona vuoto)"}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground italic">{data.persona.note || "Nessuna persona definita per questo agente."}</p>
              )}
            </Section>

            <Section
              title="Prompt operativi applicati (Prompt Lab)"
              meta={`${data.operative_prompts.applied.length} blocchi · contesti: ${data.operative_prompts.matched.contexts.join(", ") || "—"}`}
              onCopy={data.operative_prompts.block_preview ? () => copy(data.operative_prompts.block_preview, "Operative prompts") : undefined}
            >
              {data.operative_prompts.applied.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nessun prompt operativo applicato.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {data.operative_prompts.applied.map((n) => (
                      <Badge key={n} variant="outline" className="text-[10px]">{n}</Badge>
                    ))}
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-[12px] leading-relaxed bg-muted/40 rounded p-3 max-h-[400px] overflow-auto">
                    {data.operative_prompts.block_preview || "(anteprima vuota)"}
                  </pre>
                </>
              )}
            </Section>

            <Section title="Capabilities runtime" meta={data.capabilities.loaded ? "caricate da DB" : "default"}>
              <ul className="text-xs grid grid-cols-2 gap-x-4 gap-y-1">
                <li><span className="text-muted-foreground">Modalità:</span> <span className="font-mono">{data.capabilities.execution_mode}</span></li>
                <li><span className="text-muted-foreground">Modello:</span> <span className="font-mono">{data.capabilities.preferred_model ?? "—"}</span></li>
                <li><span className="text-muted-foreground">Temperature:</span> <span className="font-mono">{data.capabilities.temperature}</span></li>
                <li><span className="text-muted-foreground">Max token/call:</span> <span className="font-mono">{data.capabilities.max_tokens_per_call}</span></li>
                <li><span className="text-muted-foreground">Max iterazioni:</span> <span className="font-mono">{data.capabilities.max_iterations}</span></li>
                <li><span className="text-muted-foreground">Tool concorrenti:</span> <span className="font-mono">{data.capabilities.max_concurrent_tools}</span></li>
              </ul>
            </Section>

            <Section title="Tool effettivi" meta={`${data.tools.effective.length}/${data.tools.all_registered.length} consentiti`}>
              <div className="space-y-2 text-xs">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Consentiti</p>
                  <div className="flex flex-wrap gap-1">
                    {data.tools.effective.length === 0
                      ? <span className="text-muted-foreground italic text-[11px]">nessuno</span>
                      : data.tools.effective.map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px] font-mono">{t}</Badge>
                        ))}
                  </div>
                </div>
                {data.tools.filtered_out.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Filtrati dalle capabilities</p>
                    <div className="flex flex-wrap gap-1">
                      {data.tools.filtered_out.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px] font-mono opacity-60">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Section>

            <Section title="Hard guards (sempre attivi)">
              <div className="text-xs space-y-2">
                <div>
                  <span className="text-muted-foreground">Tabelle vietate: </span>
                  <span className="font-mono">{data.hard_guards.forbidden_tables.join(", ")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Operazioni distruttive bloccate: </span>
                  <span className="font-mono">{data.hard_guards.destructive_ops_blocked.join(", ")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Approvazione sempre richiesta: </span>
                  <span className="font-mono">{data.hard_guards.approval_required_always.join(", ")}</span>
                </div>
                <p className="text-[11px] italic text-muted-foreground">{data.hard_guards.notes}</p>
              </div>
            </Section>
          </>
        )}

        {selected && kbAll && (
          <Section
            title="Knowledge Base usata da questo agente"
            meta={`${kbCurrent.length} entry · categorie: ${selected.kbCategories.join(", ") || "—"}`}
            onCopy={kbCurrent.length > 0 ? () => copy(buildAgentMarkdown(selected, data, kbCurrent), "KB") : undefined}
          >
            {kbCurrent.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Nessuna entry attiva nelle categorie consultate ({selected.kbCategories.join(", ") || "nessuna categoria dichiarata"}).
              </p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-auto">
                {(() => {
                  const out: React.ReactNode[] = [];
                  let lastCat = "";
                  let lastChap = "";
                  kbCurrent.forEach((e) => {
                    if (e.category !== lastCat) {
                      out.push(
                        <h4 key={`cat-${e.id}`} className="text-[11px] font-semibold uppercase tracking-wider text-primary border-b pb-1 pt-2">
                          Categoria: <span className="font-mono">{e.category}</span>
                        </h4>,
                      );
                      lastCat = e.category;
                      lastChap = "";
                    }
                    const chap = e.chapter || "(senza capitolo)";
                    if (chap !== lastChap) {
                      out.push(
                        <h5 key={`chap-${e.id}`} className="text-[11px] font-semibold text-muted-foreground mt-2">
                          {chap}
                        </h5>,
                      );
                      lastChap = chap;
                    }
                    out.push(
                      <div
                        key={e.id}
                        className="rounded border bg-muted/20 p-2"
                        title={`priority ${e.priority} · tags: ${e.tags?.join(", ") || "—"} · aggiornato ${new Date(e.updated_at).toLocaleString("it-IT")}`}
                      >
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-medium">{e.title}</span>
                          <Badge variant="outline" className="text-[9px]">prio {e.priority}</Badge>
                          {(e.tags ?? []).slice(0, 4).map((t) => (
                            <Badge key={t} variant="secondary" className="text-[9px]">{t}</Badge>
                          ))}
                        </div>
                        <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed">
                          {e.content}
                        </pre>
                      </div>,
                    );
                  });
                  return out;
                })()}
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}