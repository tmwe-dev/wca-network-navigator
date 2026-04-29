/**
 * Command Help — auto-generated capability catalog
 *
 * Pure UI: enumerates every tool registered in `TOOL_METADATA`, groups by area,
 * supports search + read/write filters, and links to the Prompt Lab + KB pages
 * where the underlying behavior can be tuned.
 *
 * This page is intentionally logic-less (no data fetching): the registry is the
 * single source of truth.
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { TOOL_METADATA, type ToolMetadata } from "./tools/registry";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Search, Shield, Eye, BookOpen, Settings2, ArrowLeft } from "lucide-react";
import { useCommandPromptsAndKb } from "./hooks/useCommandPromptsAndKb";

type Filter = "all" | "read" | "write";

interface Group {
  readonly key: string;
  readonly label: string;
  readonly match: (id: string) => boolean;
}

/** Categorization is purely string-pattern based — easy to extend. */
const GROUPS: readonly Group[] = [
  { key: "partner",    label: "Partner & CRM",       match: (id) => /partner|contact|deduplicate|lead-score|quality/i.test(id) },
  { key: "outreach",   label: "Outreach & Campagne", match: (id) => /campaign|outreach|enqueue|mission|follow/i.test(id) },
  { key: "email",      label: "Email & Inbox",       match: (id) => /email|inbox|folder|compose/i.test(id) },
  { key: "messaging",  label: "WhatsApp & LinkedIn", match: (id) => /whatsapp|linkedin/i.test(id) },
  { key: "search",     label: "Ricerca & Scraping",  match: (id) => /scrape|deep-search|enrich|browser|website/i.test(id) },
  { key: "kb",         label: "Knowledge Base",      match: (id) => /kb|knowledge|country-kb/i.test(id) },
  { key: "ops",        label: "Sistema & Audit",     match: (id) => /health|audit|export|replay|sync|harmonize|optimus|report|snapshot|dashboard|status|analyze|business-card|parse|pending/i.test(id) },
];

function categorize(tool: ToolMetadata): string {
  const found = GROUPS.find((g) => g.match(tool.id));
  return found ? found.label : "Altro";
}

export function CommandHelpPage() {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const { data: promptsAndKb, isLoading: loadingPrompts } = useCommandPromptsAndKb();

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return TOOL_METADATA.filter((t) => {
      if (filter === "read" && t.requiresApproval) return false;
      if (filter === "write" && !t.requiresApproval) return false;
      if (!q) return true;
      return (
        t.id.toLowerCase().includes(q) ||
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    });
  }, [query, filter]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, ToolMetadata[]>();
    for (const t of filtered) {
      const cat = categorize(t);
      const arr = map.get(cat) ?? [];
      arr.push(t);
      map.set(cat, arr);
    }
    // Stable order based on GROUPS list, then "Altro"
    const ordered: Array<[string, ToolMetadata[]]> = [];
    for (const g of GROUPS) {
      const arr = map.get(g.label);
      if (arr && arr.length > 0) ordered.push([g.label, arr]);
    }
    const other = map.get("Altro");
    if (other && other.length > 0) ordered.push(["Altro", other]);
    return ordered;
  }, [filtered]);

  const totalCount = TOOL_METADATA.length;
  const writeCount = TOOL_METADATA.filter((t) => t.requiresApproval).length;
  const readCount = totalCount - writeCount;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Button asChild variant="ghost" size="sm">
              <Link to="/v2/command">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Torna a Command
              </Link>
            </Button>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/v2/prompt-lab">
                  <Settings2 className="mr-2 h-4 w-4" />
                  Prompt Lab
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/v2/knowledge-base">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Knowledge Base
                </Link>
              </Button>
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cosa può fare Command</h1>
            <p className="mt-2 text-muted-foreground">
              {totalCount} strumenti disponibili — {readCount} in sola lettura, {writeCount} con approvazione richiesta.
              Scrivi in linguaggio naturale: Command sceglie automaticamente lo strumento giusto.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca per nome, id o descrizione…"
                className="pl-9"
              />
            </div>
            <ToggleGroup
              type="single"
              value={filter}
              onValueChange={(v) => v && setFilter(v as Filter)}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="all">Tutti</ToggleGroupItem>
              <ToggleGroupItem value="read">
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                Sola lettura
              </ToggleGroupItem>
              <ToggleGroupItem value="write">
                <Shield className="mr-1.5 h-3.5 w-3.5" />
                Con approvazione
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* Governance note */}
        <Card className="mb-6 border-dashed">
          <CardContent className="flex flex-col gap-2 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div>
              <strong className="text-foreground">Dove vivono le regole di Command:</strong> i prompt operativi sono
              nel <Link to="/v2/prompt-lab" className="underline underline-offset-2">Prompt Lab</Link>{" "}
              (filtra per <code className="rounded bg-muted px-1 py-0.5 text-xs">context = command</code>).
              Le schede informative sono nella <Link to="/v2/knowledge-base" className="underline underline-offset-2">Knowledge Base</Link>{" "}
              (categoria <code className="rounded bg-muted px-1 py-0.5 text-xs">command_tools</code>).
            </div>
          </CardContent>
        </Card>

        {/* Active prompts + Memory & Guru */}
        <section className="mb-8 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="h-4 w-4" /> Prompt attivi
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {loadingPrompts ? "…" : `${promptsAndKb?.prompts.length ?? 0} prompt`} con
                <code className="ml-1 rounded bg-muted px-1 py-0.5">context = command</code>
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              {loadingPrompts ? (
                <p className="text-xs text-muted-foreground">Caricamento…</p>
              ) : (promptsAndKb?.prompts.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground">Nessun prompt configurato.</p>
              ) : (
                <ul className="space-y-2 max-h-72 overflow-auto pr-1">
                  {promptsAndKb!.prompts.map((p) => (
                    <li key={p.id} className="text-sm flex items-start justify-between gap-2 border-b border-border/40 pb-1.5 last:border-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{p.name}</span>
                          {p.tags?.includes("OBBLIGATORIA") && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">OBBL</Badge>
                          )}
                          {p.is_active === false && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0">off</Badge>
                          )}
                        </div>
                        {p.objective && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{p.objective}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">P{p.priority ?? 0}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                <Link to="/v2/prompt-lab?context=command">Apri nel Prompt Lab</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4" /> Memoria & Guru
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Schede KB lette automaticamente da Command (categoria <code className="rounded bg-muted px-1 py-0.5">command_tools</code> e <code className="rounded bg-muted px-1 py-0.5">ai_memory</code>).
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              {loadingPrompts ? (
                <p className="text-xs text-muted-foreground">Caricamento…</p>
              ) : (promptsAndKb?.kb.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground">Nessuna scheda dedicata trovata.</p>
              ) : (
                <ul className="space-y-1.5 max-h-72 overflow-auto pr-1">
                  {promptsAndKb!.kb.map((k) => (
                    <li key={k.id} className="text-sm flex items-center justify-between gap-2">
                      <span className="truncate">{k.title}</span>
                      <Badge variant="secondary" className="text-[9px] shrink-0">{k.category}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                <Link to="/v2/knowledge-base">Apri Knowledge Base</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Groups */}
        {grouped.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">Nessuno strumento corrisponde alla ricerca.</p>
        ) : (
          <div className="space-y-8">
            {grouped.map(([label, tools]) => (
              <section key={label}>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-xl font-semibold">{label}</h2>
                  <span className="text-sm text-muted-foreground">{tools.length}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {tools.map((tool) => (
                    <Card key={tool.id} className="transition-colors hover:bg-accent/30">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base">{tool.label}</CardTitle>
                          {tool.requiresApproval ? (
                            <Badge variant="outline" className="shrink-0 gap-1">
                              <Shield className="h-3 w-3" /> Approval
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="shrink-0 gap-1">
                              <Eye className="h-3 w-3" /> Read
                            </Badge>
                          )}
                        </div>
                        <code className="text-xs text-muted-foreground">{tool.id}</code>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground">{tool.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CommandHelpPage;