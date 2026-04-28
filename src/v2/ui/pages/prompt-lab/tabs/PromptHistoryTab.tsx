/**
 * PromptHistoryTab — Storico versioni dei prompt operativi con diff e rollback.
 *
 * - Sinistra: lista prompt
 * - Centro: lista versioni (snapshot immutabili da `prompt_versions`)
 * - Destra: diff line-based tra due versioni selezionate (base vs target),
 *           con possibilità di ripristinare la versione target
 *
 * Logic-less: ogni call DB passa dal DAL (`@/data/promptTests`).
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { findOperativePrompts } from "@/data/operativePrompts";
import {
  listVersionsForPrompt,
  rollbackPromptToVersion,
  type PromptVersion,
} from "@/data/promptTests";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, History as HistoryIcon, RotateCcw, GitCompareArrows } from "lucide-react";

interface PromptOption { id: string; name: string }

const QK_PROMPTS = ["prompt-history", "prompts-list"] as const;
const qkVersions = (promptId: string) => ["prompt-history", "versions", promptId] as const;

const FIELDS: Array<keyof PromptVersion> = [
  "name",
  "context",
  "objective",
  "procedure",
  "criteria",
  "examples",
];

/** Diff line-based via Longest Common Subsequence (no deps).
 *  Ritorna sequenza di blocchi: equal | add | del. */
function diffLines(a: string, b: string): Array<{ kind: "eq" | "add" | "del"; line: string }> {
  const A = (a ?? "").split("\n");
  const B = (b ?? "").split("\n");
  const m = A.length;
  const n = B.length;
  // LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: Array<{ kind: "eq" | "add" | "del"; line: string }> = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (A[i] === B[j]) {
      out.push({ kind: "eq", line: A[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: "del", line: A[i] });
      i++;
    } else {
      out.push({ kind: "add", line: B[j] });
      j++;
    }
  }
  while (i < m) out.push({ kind: "del", line: A[i++] });
  while (j < n) out.push({ kind: "add", line: B[j++] });
  return out;
}

function FieldDiff({ field, base, target }: { field: string; base: string; target: string }) {
  const blocks = useMemo(() => diffLines(base, target), [base, target]);
  const hasChange = blocks.some((b) => b.kind !== "eq");
  if (!hasChange) {
    return (
      <div className="border rounded p-2">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{field}</div>
        <div className="text-[11px] text-muted-foreground italic">Nessuna differenza.</div>
      </div>
    );
  }
  return (
    <div className="border rounded">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1 border-b bg-muted/30 flex items-center justify-between">
        <span>{field}</span>
        <Badge variant="outline" className="text-[9px] py-0">
          {blocks.filter((b) => b.kind === "add").length}+ /{" "}
          {blocks.filter((b) => b.kind === "del").length}-
        </Badge>
      </div>
      <pre className="text-[11px] font-mono whitespace-pre-wrap p-1.5 max-h-72 overflow-auto leading-snug">
        {blocks.map((b, idx) => {
          const cls =
            b.kind === "add"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : b.kind === "del"
              ? "bg-destructive/15 text-destructive line-through"
              : "text-muted-foreground";
          const prefix = b.kind === "add" ? "+ " : b.kind === "del" ? "- " : "  ";
          return (
            <div key={idx} className={`px-1 ${cls}`}>
              {prefix}
              {b.line || " "}
            </div>
          );
        })}
      </pre>
    </div>
  );
}

export function PromptHistoryTab() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();

  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [baseVersionId, setBaseVersionId] = useState<string | null>(null);
  const [targetVersionId, setTargetVersionId] = useState<string | null>(null);

  const promptsQuery = useQuery({
    queryKey: [...QK_PROMPTS, userId],
    enabled: !!userId,
    queryFn: async () => {
      const rows = await findOperativePrompts(userId, "id, name");
      return rows as unknown as PromptOption[];
    },
  });

  const versionsQuery = useQuery({
    queryKey: selectedPromptId ? qkVersions(selectedPromptId) : ["prompt-history", "versions", "none"],
    enabled: !!selectedPromptId,
    queryFn: () => listVersionsForPrompt(selectedPromptId!, 50),
  });

  // Auto-select first prompt
  useEffect(() => {
    if (!selectedPromptId && promptsQuery.data && promptsQuery.data.length > 0) {
      setSelectedPromptId(promptsQuery.data[0].id);
    }
  }, [promptsQuery.data, selectedPromptId]);

  // Auto-select first two versions when list loads
  useEffect(() => {
    const v = versionsQuery.data ?? [];
    if (v.length === 0) {
      setBaseVersionId(null);
      setTargetVersionId(null);
      return;
    }
    // target = latest, base = previous (or same se 1 sola)
    const latest = v[0];
    const previous = v[1] ?? v[0];
    setTargetVersionId((cur) => cur && v.some((x) => x.id === cur) ? cur : latest.id);
    setBaseVersionId((cur) => cur && v.some((x) => x.id === cur) ? cur : previous.id);
  }, [versionsQuery.data]);

  const versions = versionsQuery.data ?? [];
  const baseVersion = useMemo(() => versions.find((v) => v.id === baseVersionId) ?? null, [versions, baseVersionId]);
  const targetVersion = useMemo(() => versions.find((v) => v.id === targetVersionId) ?? null, [versions, targetVersionId]);

  const rollbackMutation = useMutation({
    mutationFn: async (v: PromptVersion) => {
      await rollbackPromptToVersion({
        promptId: v.prompt_id,
        versionNumber: v.version_number,
        reason: `Rollback da Prompt Lab History a v${v.version_number}`,
      });
    },
    onSuccess: () => {
      toast.success("Prompt ripristinato. Creata nuova versione di rollback.");
      if (selectedPromptId) qc.invalidateQueries({ queryKey: qkVersions(selectedPromptId) });
    },
    onError: (e) => toast.error(`Errore rollback: ${(e as Error).message}`),
  });

  return (
    <div className="flex h-full min-h-0 gap-2">
      {/* COL 1: Prompt list */}
      <div className="w-56 flex-shrink-0 flex flex-col gap-2 border-r pr-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Prompt</Label>
          {promptsQuery.isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1">
            {(promptsQuery.data ?? []).map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedPromptId(p.id);
                  setBaseVersionId(null);
                  setTargetVersionId(null);
                }}
                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                  selectedPromptId === p.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                }`}
              >
                {p.name}
              </button>
            ))}
            {promptsQuery.data?.length === 0 && (
              <p className="text-[11px] text-muted-foreground px-2">Nessun operative prompt.</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* COL 2: Versions */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-2 border-r pr-2">
        <Label className="text-xs font-semibold flex items-center gap-1">
          <HistoryIcon className="h-3 w-3" /> Versioni ({versions.length})
        </Label>
        <ScrollArea className="flex-1">
          <div className="space-y-1">
            {versions.map((v) => {
              const isLatest = v.id === versions[0]?.id;
              return (
                <div
                  key={v.id}
                  className={`border rounded px-2 py-1.5 text-[11px] space-y-1 ${
                    targetVersionId === v.id ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">v{v.version_number}</span>
                    {isLatest && <Badge variant="default" className="text-[9px] py-0 h-4">current</Badge>}
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {new Date(v.created_at).toLocaleString()}
                    </span>
                  </div>
                  {v.change_reason && (
                    <div className="text-[10px] text-muted-foreground italic line-clamp-2">
                      {v.change_reason}
                    </div>
                  )}
                  <div className="flex items-center gap-1 pt-0.5">
                    <Button
                      size="sm"
                      variant={baseVersionId === v.id ? "default" : "outline"}
                      className="h-5 px-1.5 text-[9px]"
                      onClick={() => setBaseVersionId(v.id)}
                    >
                      base
                    </Button>
                    <Button
                      size="sm"
                      variant={targetVersionId === v.id ? "default" : "outline"}
                      className="h-5 px-1.5 text-[9px]"
                      onClick={() => setTargetVersionId(v.id)}
                    >
                      target
                    </Button>
                    {!isLatest && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1.5 text-[9px] ml-auto text-amber-600 hover:text-amber-700"
                        disabled={rollbackMutation.isPending}
                        onClick={() => {
                          if (confirm(`Ripristinare il prompt alla versione v${v.version_number}? Verrà creata una nuova versione di rollback.`)) {
                            rollbackMutation.mutate(v);
                          }
                        }}
                      >
                        <RotateCcw className="h-3 w-3 mr-0.5" /> ripristina
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {versions.length === 0 && selectedPromptId && (
              <p className="text-[11px] text-muted-foreground px-2">Nessuna versione ancora salvata.</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* COL 3: Diff viewer */}
      <div className="flex-1 min-w-0 flex flex-col gap-2 overflow-hidden">
        <div className="flex items-center gap-2 flex-shrink-0">
          <GitCompareArrows className="h-4 w-4 text-muted-foreground" />
          <Label className="text-xs font-semibold">Confronto versioni</Label>
          <div className="flex items-center gap-1 ml-auto">
            <Select
              value={baseVersionId ?? ""}
              onValueChange={(v) => setBaseVersionId(v)}
            >
              <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="base" /></SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">v{v.version_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[11px] text-muted-foreground">→</span>
            <Select
              value={targetVersionId ?? ""}
              onValueChange={(v) => setTargetVersionId(v)}
            >
              <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="target" /></SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">v{v.version_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!baseVersion || !targetVersion ? (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
            Seleziona un prompt e due versioni da confrontare.
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="space-y-2 pr-2 pb-3">
              <div className="text-[11px] text-muted-foreground">
                Confronto <span className="font-mono">v{baseVersion.version_number}</span> →{" "}
                <span className="font-mono">v{targetVersion.version_number}</span>
                {baseVersion.id === targetVersion.id && " (stessa versione)"}
              </div>
              {FIELDS.map((field) => (
                <FieldDiff
                  key={field as string}
                  field={field as string}
                  base={String(baseVersion[field] ?? "")}
                  target={String(targetVersion[field] ?? "")}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}