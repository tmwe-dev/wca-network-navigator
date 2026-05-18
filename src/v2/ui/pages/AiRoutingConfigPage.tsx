/**
 * AiRoutingConfigPage — Admin-only page to manage `ai_routing_config`.
 * Scope x (provider, model) mapping with tier badges. Live editing,
 * no redeploy needed (60s cache in edge functions).
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Info } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/v2/ui/templates/PageShell";

type RoutingRow = {
  scope: string;
  provider: string;
  model: string;
  tier: string | null;
  notes: string | null;
  updated_at: string | null;
};

const PROVIDERS = ["anthropic", "openai", "google"] as const;

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  anthropic: ["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-5"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "text-embedding-3-small"],
  google: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"],
};

const TIER_COLOR: Record<string, string> = {
  heavy: "bg-red-500/15 text-red-600 border-red-500/30",
  standard: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  light: "bg-green-500/15 text-green-600 border-green-500/30",
  vision: "bg-purple-500/15 text-purple-600 border-purple-500/30",
  embeddings: "bg-amber-500/15 text-amber-700 border-amber-500/30",
};

const TIER_HINT: Record<string, string> = {
  heavy: "Reasoning complesso, agent loop, journalist review.",
  standard: "Generazione email/outreach, query planner.",
  light: "Classificazione, suggerimenti, summary.",
  vision: "OCR, multimodale, parse business card.",
  embeddings: "Vettori per RAG/memoria/KB.",
};

export function AiRoutingConfigPage() {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, Partial<RoutingRow>>>({});
  const [filter, setFilter] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["operators", "self-admin-check"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) return null;
      const { data } = await supabase.from("operators").select("is_admin").eq("user_id", user.id).maybeSingle();
      return data;
    },
  });
  const isAdmin = profile?.is_admin ?? false;

  const { data: rows = [], isLoading } = useQuery({
    enabled: isAdmin,
    queryKey: ["ai_routing_config", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_routing_config" as never)
        .select("scope, provider, model, tier, notes, updated_at")
        .order("tier", { ascending: true })
        .order("scope", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as RoutingRow[];
    },
  });

  const filteredRows = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.toLowerCase();
    return rows.filter((r) =>
      r.scope.toLowerCase().includes(q) ||
      r.provider.toLowerCase().includes(q) ||
      r.model.toLowerCase().includes(q) ||
      (r.tier ?? "").toLowerCase().includes(q),
    );
  }, [rows, filter]);

  const saveOne = useMutation({
    mutationFn: async (scope: string) => {
      const patch = edits[scope];
      if (!patch) return;
      const { error } = await supabase
        .from("ai_routing_config" as never)
        .update({
          ...(patch.provider ? { provider: patch.provider } : {}),
          ...(patch.model ? { model: patch.model } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          updated_at: new Date().toISOString(),
        } as never)
        .eq("scope", scope);
      if (error) throw error;
    },
    onSuccess: (_d, scope) => {
      toast.success(`Scope "${scope}" aggiornato`);
      setEdits((prev) => {
        const next = { ...prev };
        delete next[scope];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["ai_routing_config"] });
    },
    onError: (err) => toast.error(`Errore salvataggio: ${err instanceof Error ? err.message : String(err)}`),
  });

  if (!isAdmin) {
    return (
      <PageShell title="AI Routing">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Solo gli amministratori possono modificare il routing AI.
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell title="AI Routing Config" description="Mappa scope → provider/modello. Modifiche live (cache 60s).">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            Come funziona
          </CardTitle>
          <CardDescription>
            Ogni edge function AI è etichettata con uno <strong>scope</strong>. Il gateway risolve provider/modello da questa tabella prima di chiamare l'API. Cambia provider o modello per scope senza redeploy.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-xs">
          {Object.entries(TIER_HINT).map(([tier, hint]) => (
            <div key={tier} className="flex items-center gap-2">
              <Badge variant="outline" className={TIER_COLOR[tier]}>{tier}</Badge>
              <span className="text-muted-foreground">{hint}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Scope ({rows.length})</CardTitle>
            <CardDescription>Provider attuali: Anthropic / OpenAI / Google</CardDescription>
          </div>
          <Input
            placeholder="Filtra scope/provider/modello…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-xs"
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scope</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Modello</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Azione</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((r) => {
                  const edit = edits[r.scope] || {};
                  const provider = edit.provider ?? r.provider;
                  const model = edit.model ?? r.model;
                  const notes = edit.notes ?? r.notes ?? "";
                  const dirty = !!edits[r.scope];
                  const tier = r.tier ?? "—";
                  return (
                    <TableRow key={r.scope} className={dirty ? "bg-amber-500/5" : ""}>
                      <TableCell className="font-mono text-xs">{r.scope}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={TIER_COLOR[tier] ?? ""}>{tier}</Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={provider}
                          onValueChange={(v) =>
                            setEdits((p) => ({ ...p, [r.scope]: { ...(p[r.scope] || {}), provider: v, model: MODEL_SUGGESTIONS[v]?.[0] ?? model } }))
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PROVIDERS.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={model}
                          list={`models-${provider}`}
                          onChange={(e) => setEdits((p) => ({ ...p, [r.scope]: { ...(p[r.scope] || {}), model: e.target.value } }))}
                          className="font-mono text-xs w-56"
                        />
                        <datalist id={`models-${provider}`}>
                          {(MODEL_SUGGESTIONS[provider] ?? []).map((m) => (
                            <option key={m} value={m} />
                          ))}
                        </datalist>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={notes}
                          placeholder="—"
                          onChange={(e) => setEdits((p) => ({ ...p, [r.scope]: { ...(p[r.scope] || {}), notes: e.target.value } }))}
                          className="text-xs"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={dirty ? "default" : "ghost"}
                          disabled={!dirty || saveOne.isPending}
                          onClick={() => saveOne.mutate(r.scope)}
                        >
                          {saveOne.isPending && saveOne.variables === r.scope ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <><Save className="h-4 w-4 mr-1" /> Salva</>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nessuno scope corrisponde al filtro.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}