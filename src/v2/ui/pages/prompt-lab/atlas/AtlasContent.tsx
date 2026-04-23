/**
 * AtlasContent — Brain map dell'agente selezionato.
 *
 * Sezioni full-width con grid a 2 colonne:
 *  1. Cosa fa (descrizione + trigger + dipendenze)
 *  2. Prompt di sistema (sorgenti prompt con icone)
 *  3. KB consultata (categorie + procedure critiche)
 *  4. Strumenti (tools con evidenza approval-required)
 *  5. Contratto I/O (input → output)
 *  6. Diagnostica (warnings, variabili richieste)
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as Icons from "lucide-react";
import {
  FileText, BookOpen, Wrench, Network, AlertTriangle, Zap,
  ExternalLink, ShieldAlert, Variable, ArrowRight, Blocks,
} from "lucide-react";
import type { AgentRegistryEntry } from "@/data/agentPrompts";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/providers/AuthProvider";
import { collectAllBlocks } from "../hooks/useBlockCollector";
import { groupBlocksByAgent } from "../hooks/agentMapping";
import type { Block } from "../types";
import { ArchitectReviewPanel } from "./ArchitectReviewPanel";

/* ─── Section wrapper ─── */
function Section({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card rounded-lg border">
      <header className="flex items-center gap-2 border-b px-4 py-2.5">
        <Icon className="text-primary h-4 w-4" />
        <h3 className="text-xs font-semibold">{title}</h3>
        {count !== undefined && (
          <Badge variant="secondary" className="ml-auto text-[9px]">{count}</Badge>
        )}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

/* ─── Main content ─── */
export function AtlasContent({ agent }: { agent: AgentRegistryEntry }) {
  const { user } = useAuth();
  const [agentBlocks, setAgentBlocks] = useState<Array<{ tabLabel: string; block: Block }>>([]);
  const [blocksLoaded, setBlocksLoaded] = useState(false);

  // Carica i blocchi assegnati a questo agente
  useEffect(() => {
    if (!user?.id) return;
    setBlocksLoaded(false);
    collectAllBlocks(user.id).then((all) => {
      const groups = groupBlocksByAgent(all);
      const myGroup = groups.get(agent.id);
      setAgentBlocks(myGroup?.items ?? []);
      setBlocksLoaded(true);
    }).catch(() => setBlocksLoaded(true));
  }, [user?.id, agent.id]);

  const hasApprovalTools = agent.approvalRequiredTools.length > 0;
  const hasWarnings =
    agent.requiredVars.length > 0 ||
    agent.criticalProcedures.length > 5 ||
    hasApprovalTools;

  return (
    <div className="space-y-4 p-4">
      {/* Header: descrizione */}
      <div className="rounded-lg border bg-gradient-to-r from-primary/5 to-transparent p-4">
        <p className="text-sm leading-relaxed">{agent.description}</p>
      </div>

      {/* Grid 2 colonne */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Cosa fa ── */}
        <Section icon={Zap} title="Come interviene">
          <div className="space-y-3">
            <div>
              <p className="text-muted-foreground mb-1.5 text-[10px] font-medium uppercase tracking-wider">
                Trigger di attivazione
              </p>
              <ul className="space-y-1">
                {agent.runtime.triggers.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <ArrowRight className="text-primary mt-0.5 h-3 w-3 shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            {agent.dependsOn.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1.5 text-[10px] font-medium uppercase tracking-wider">
                  Dipende da
                </p>
                <div className="flex flex-wrap gap-1">
                  {agent.dependsOn.map((dep) => (
                    <Badge key={dep} variant="outline" className="text-[10px]">{dep}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* ── Prompt di sistema ── */}
        <Section icon={FileText} title="Prompt sources" count={agent.promptSources.length}>
          {agent.promptSources.length === 0 ? (
            <p className="text-muted-foreground text-xs italic">Nessuna sorgente prompt registrata.</p>
          ) : (
            <ul className="space-y-2">
              {agent.promptSources.map((src, i) => (
                <li key={i} className="group flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{src.label}</p>
                    <p className="text-muted-foreground mt-0.5 truncate text-[10px]" title={src.source}>
                      {src.source}
                    </p>
                    {src.hint && (
                      <p className="text-muted-foreground mt-0.5 text-[10px] italic">{src.hint}</p>
                    )}
                  </div>
                  <Link
                    to={`/v2/prompt-lab?tab=${src.promptLabTab}`}
                    className="text-muted-foreground hover:text-primary shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    title="Apri nel Prompt Lab"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* ── KB consultata ── */}
        <Section icon={BookOpen} title="Knowledge Base" count={agent.kbCategories.length}>
          <div className="space-y-3">
            <div>
              <p className="text-muted-foreground mb-1.5 text-[10px] font-medium uppercase tracking-wider">
                Categorie assemblate a runtime
              </p>
              <div className="flex flex-wrap gap-1">
                {agent.kbCategories.length === 0 ? (
                  <span className="text-muted-foreground text-[11px] italic">nessuna</span>
                ) : (
                  agent.kbCategories.map((c) => (
                    <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                  ))
                )}
              </div>
            </div>
            {agent.criticalProcedures.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1.5 text-[10px] font-medium uppercase tracking-wider">
                  Procedure critiche iniettate
                </p>
                <ul className="space-y-0.5">
                  {agent.criticalProcedures.map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px]">
                      <ShieldAlert className="text-amber-500 mt-0.5 h-3 w-3 shrink-0" />
                      <span className="leading-snug">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>

        {/* ── Strumenti ── */}
        <Section icon={Wrench} title="Tool disponibili" count={agent.tools.length}>
          {agent.tools.length === 0 ? (
            <p className="text-muted-foreground text-xs italic">
              Agente puro — nessun tool, produce solo output testuale.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {agent.tools.map((t) => {
                  const needsApproval = agent.approvalRequiredTools.includes(t);
                  return (
                    <Badge
                      key={t}
                      variant={needsApproval ? "destructive" : "outline"}
                      className="font-mono text-[10px]"
                      title={needsApproval ? "Richiede approvazione" : "Esecuzione diretta"}
                    >
                      {needsApproval && <ShieldAlert className="mr-1 h-2.5 w-2.5" />}
                      {t}
                    </Badge>
                  );
                })}
              </div>
              {hasApprovalTools && (
                <p className="text-muted-foreground text-[10px]">
                  <ShieldAlert className="mr-1 inline h-3 w-3 text-destructive" />
                  I tool in rosso richiedono approvazione esplicita prima dell'esecuzione.
                </p>
              )}
            </div>
          )}
        </Section>

        {/* ── Contratto I/O (full width) ── */}
        <div className="lg:col-span-2">
          <Section icon={Network} title="Contratto runtime I/O">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-muted-foreground mb-1.5 text-[10px] font-medium uppercase tracking-wider">
                  Input
                </p>
                <pre className="bg-muted overflow-auto rounded-lg p-3 text-[11px] leading-relaxed">
                  {agent.contract.input}
                </pre>
              </div>
              <div>
                <p className="text-muted-foreground mb-1.5 text-[10px] font-medium uppercase tracking-wider">
                  Output
                </p>
                <pre className="bg-muted overflow-auto rounded-lg p-3 text-[11px] leading-relaxed">
                  {agent.contract.output}
                </pre>
              </div>
            </div>
          </Section>
        </div>

        {/* ── Diagnostica (solo se ci sono warnings) ── */}
        {hasWarnings && (
          <div className="lg:col-span-2">
            <Section icon={AlertTriangle} title="Diagnostica">
              <div className="space-y-2">
                {agent.requiredVars.length > 0 && (
                  <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/5 p-3">
                    <Variable className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div>
                      <p className="text-xs font-medium">Variabili obbligatorie</p>
                      <p className="text-muted-foreground mt-0.5 text-[11px]">
                        Questo agente richiede: {agent.requiredVars.map((v) => (
                          <code key={v} className="bg-muted mx-0.5 rounded px-1 py-0.5 text-[10px]">{v}</code>
                        ))}
                      </p>
                    </div>
                  </div>
                )}
                {agent.criticalProcedures.length > 5 && (
                  <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/5 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div>
                      <p className="text-xs font-medium">Prompt molto lungo</p>
                      <p className="text-muted-foreground mt-0.5 text-[11px]">
                        {agent.criticalProcedures.length} procedure critiche iniettate — il prompt
                        potrebbe essere troppo lungo e causare token overhead.
                      </p>
                    </div>
                  </div>
                )}
                {hasApprovalTools && (
                  <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/5 p-3">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div>
                      <p className="text-xs font-medium">Richiede approvazione</p>
                      <p className="text-muted-foreground mt-0.5 text-[11px]">
                        {agent.approvalRequiredTools.length} tool richiedono approvazione:
                        {" "}{agent.approvalRequiredTools.join(", ")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Section>
          </div>
        )}

        {/* ── Blocchi assegnati a questo agente (full width) ── */}
        <div className="lg:col-span-2">
          <Section icon={Blocks} title="Blocchi assegnati" count={blocksLoaded ? agentBlocks.length : undefined}>
            {!blocksLoaded ? (
              <p className="text-muted-foreground text-xs italic">Caricamento blocchi...</p>
            ) : agentBlocks.length === 0 ? (
              <p className="text-muted-foreground text-xs italic">
                Nessun blocco direttamente mappato a questo agente. I blocchi condivisi (KB doctrine globale) sono visibili tramite il tab Prompt Lab.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[400px] overflow-auto">
                {agentBlocks.map(({ tabLabel, block }) => (
                  <div key={block.id} className="group flex items-start gap-2 rounded border bg-muted/10 p-2 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{tabLabel}</Badge>
                        <span className="text-xs font-medium truncate">{block.label}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                        {block.content.slice(0, 200).replace(/\s+/g, " ").trim()}
                        {block.content.length > 200 ? "..." : ""}
                      </p>
                    </div>
                    <Link
                      to={`/v2/prompt-lab`}
                      className="text-muted-foreground hover:text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-1"
                      title="Apri nel Prompt Lab"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* ── Architect Review (full width) ── */}
        <div className="lg:col-span-2">
          <ArchitectReviewPanel agent={agent} />
        </div>
      </div>
    </div>
  );
}
