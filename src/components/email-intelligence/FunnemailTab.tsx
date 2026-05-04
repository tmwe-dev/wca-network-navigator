/**
 * FunnemailTab — quinto tab della pagina /v2/email-intelligence.
 *
 * Mostra:
 *  - tabella gruppi mittenti con switch "abilitato per Funnemail" + chip azioni
 *  - dialog di editing policy per gruppo
 *  - tail "Ultime azioni Funnemail" da funnemail_actions_log
 */
import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings2, Mail, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import {
  listFunnemailGroups,
  updateFunnemailGroupPolicy,
  listFunnemailActions,
  type FunnemailGroupRow,
  type FunnemailPolicy,
} from "@/data/funnemail";

const ALL_ACTIONS: Array<{ key: NonNullable<FunnemailPolicy["actions"]>[number]; label: string; desc: string }> = [
  { key: "tag_only", label: "Classifica & tagga", desc: "Salva sempre la classificazione AI nel log" },
  { key: "deep_search", label: "Deep Search se serve", desc: "Scout automatico se mittente sconosciuto o dati vecchi" },
  { key: "draft_reply", label: "Bozza in coda", desc: "Genera bozza (mai invio diretto). Approvazione manuale" },
  { key: "crm_update", label: "Aggiorna CRM", desc: "Lead status / task delegati al pipeline esistente" },
  { key: "imap_action", label: "Azione IMAP", desc: "Archive/move via apply-email-rules (regola del gruppo)" },
];

const QKEY_GROUPS = ["funnemail", "groups"] as const;
const QKEY_ACTIONS = ["funnemail", "actions"] as const;

export default function FunnemailTab(): React.ReactElement {
  const qc = useQueryClient();
  const [editing, setEditing] = React.useState<FunnemailGroupRow | null>(null);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: QKEY_GROUPS,
    queryFn: listFunnemailGroups,
    staleTime: 30_000,
  });

  const { data: actions = [] } = useQuery({
    queryKey: QKEY_ACTIONS,
    queryFn: () => listFunnemailActions(50),
    refetchInterval: 15_000,
  });

  const toggleEnabled = useMutation({
    mutationFn: async (g: FunnemailGroupRow) => {
      await updateFunnemailGroupPolicy(g.id, !g.funnemail_enabled, g.funnemail_policy);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QKEY_GROUPS });
      toast.success("Funnemail aggiornato");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Errore"),
  });

  return (
    <div className="flex flex-col gap-4 h-full min-h-0 overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Funnemail — policy per gruppo</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Decide cosa fa l'AI all'arrivo di una mail in base al gruppo del mittente
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* Tabella gruppi (2/3) */}
        <div className="lg:col-span-2 border border-border/40 rounded-md flex flex-col min-h-0 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/40 text-xs font-medium text-muted-foreground bg-muted/20 flex-shrink-0">
            {groups.length} gruppi · {groups.filter((g) => g.funnemail_enabled).length} attivi
          </div>
          <ScrollArea className="flex-1">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background border-b border-border/40">
                <tr className="text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium w-10">On</th>
                  <th className="text-left px-3 py-2 font-medium">Gruppo</th>
                  <th className="text-left px-3 py-2 font-medium">Azioni AI</th>
                  <th className="text-right px-3 py-2 font-medium w-14"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Caricamento…</td></tr>
                )}
                {!isLoading && groups.map((g) => {
                  const acts = g.funnemail_policy?.actions ?? [];
                  return (
                    <tr key={g.id} className="border-b border-border/20 hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <Switch
                          checked={g.funnemail_enabled}
                          onCheckedChange={() => toggleEnabled.mutate(g)}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium">{g.nome_gruppo}</td>
                      <td className="px-3 py-2">
                        {acts.length === 0 ? (
                          <span className="text-muted-foreground/60">— nessuna —</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {acts.map((a) => (
                              <Badge key={a} variant="outline" className="text-[10px] px-1.5 py-0">
                                {ALL_ACTIONS.find((x) => x.key === a)?.label ?? a}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(g)} className="h-7 px-2">
                          <Settings2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>
        </div>

        {/* Tail azioni (1/3) */}
        <div className="border border-border/40 rounded-md flex flex-col min-h-0 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/40 text-xs font-medium text-muted-foreground bg-muted/20 flex-shrink-0">
            Ultime azioni Funnemail
          </div>
          <ScrollArea className="flex-1">
            <ul className="divide-y divide-border/20">
              {actions.length === 0 && (
                <li className="px-3 py-8 text-center text-xs text-muted-foreground">
                  Nessuna azione registrata
                </li>
              )}
              {actions.map((a) => (
                <li key={a.id} className="px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={a.status} />
                    <span className="font-medium">{a.action}</span>
                    <span className="ml-auto text-muted-foreground/70">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: it })}
                    </span>
                  </div>
                  <div className="text-muted-foreground truncate mt-0.5">{a.from_address ?? "—"}</div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      </div>

      {editing && (
        <PolicyEditorDialog
          group={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: QKEY_GROUPS });
          }}
        />
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: string }): React.ReactElement {
  if (status === "ok") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (status === "queued") return <Clock className="h-3.5 w-3.5 text-amber-500" />;
  return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
}

function PolicyEditorDialog({
  group,
  onClose,
  onSaved,
}: {
  group: FunnemailGroupRow;
  onClose: () => void;
  onSaved: () => void;
}): React.ReactElement {
  const [enabled, setEnabled] = React.useState(group.funnemail_enabled);
  const [acts, setActs] = React.useState<Set<string>>(
    new Set(group.funnemail_policy?.actions ?? []),
  );
  const [minConf, setMinConf] = React.useState<number>(group.funnemail_policy?.min_confidence ?? 0.6);
  const [dsTrigger, setDsTrigger] = React.useState<string>(group.funnemail_policy?.deep_search?.trigger ?? "if_unknown_or_stale");
  const [dsStaleDays, setDsStaleDays] = React.useState<number>(group.funnemail_policy?.deep_search?.stale_days ?? 30);
  const [dsLevel, setDsLevel] = React.useState<string>(group.funnemail_policy?.deep_search?.level ?? "scout");
  const [drTone, setDrTone] = React.useState<string>(group.funnemail_policy?.draft_reply?.tone ?? "neutral_b2b");

  const save = useMutation({
    mutationFn: async () => {
      const policy: FunnemailPolicy = {
        enabled: true,
        actions: Array.from(acts) as FunnemailPolicy["actions"],
        min_confidence: minConf,
        deep_search: { trigger: dsTrigger as "always" | "if_unknown_or_stale" | "never", stale_days: dsStaleDays, level: dsLevel as "scout" | "detective" | "sherlock" },
        draft_reply: { tone: drTone, agent_id: group.funnemail_policy?.draft_reply?.agent_id ?? null },
        crm_update: group.funnemail_policy?.crm_update ?? {},
        imap_action: group.funnemail_policy?.imap_action ?? {},
      };
      await updateFunnemailGroupPolicy(group.id, enabled, policy);
    },
    onSuccess: () => {
      toast.success("Policy salvata");
      onSaved();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Errore"),
  });

  function toggleAction(k: string) {
    setActs((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Funnemail · {group.nome_gruppo}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <Label htmlFor="fn-enabled">Funnemail attivo per questo gruppo</Label>
            <Switch id="fn-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Azioni abilitate</Label>
            <div className="mt-2 space-y-2">
              {ALL_ACTIONS.map((a) => (
                <label key={a.key} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acts.has(a.key)}
                    onChange={() => toggleAction(a.key)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-xs font-medium">{a.label}</div>
                    <div className="text-[11px] text-muted-foreground">{a.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Confidenza minima</Label>
              <Input
                type="number"
                step="0.05"
                min={0}
                max={1}
                value={minConf}
                onChange={(e) => setMinConf(Number(e.target.value))}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Tono bozza</Label>
              <Input value={drTone} onChange={(e) => setDrTone(e.target.value)} className="h-8" />
            </div>
          </div>

          {acts.has("deep_search") && (
            <div className="border border-border/40 rounded-md p-2 space-y-2">
              <div className="text-xs font-medium">Deep Search</div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px]">Trigger</Label>
                  <Select value={dsTrigger} onValueChange={setDsTrigger}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="if_unknown_or_stale">Se sconosciuto o vecchio</SelectItem>
                      <SelectItem value="always">Sempre</SelectItem>
                      <SelectItem value="never">Mai</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px]">Stale (giorni)</Label>
                  <Input type="number" value={dsStaleDays} onChange={(e) => setDsStaleDays(Number(e.target.value))} className="h-8" />
                </div>
                <div>
                  <Label className="text-[10px]">Livello</Label>
                  <Select value={dsLevel} onValueChange={setDsLevel}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scout">Scout</SelectItem>
                      <SelectItem value="detective">Detective</SelectItem>
                      <SelectItem value="sherlock">Sherlock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvo…" : "Salva policy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}