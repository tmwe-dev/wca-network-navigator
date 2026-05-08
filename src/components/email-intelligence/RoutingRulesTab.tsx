import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  listFunnemailRoutingRules,
  upsertFunnemailRoutingRule,
  deleteFunnemailRoutingRule,
  toggleFunnemailRoutingRule,
  type FunnemailRoutingRuleRow,
  type FunnemailRoutingCondition,
} from "@/data/funnemailRoutingRules";

const QK = ["funnemail", "routing-rules"] as const;

export default function RoutingRulesTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: rules = [], isLoading } = useQuery({ queryKey: QK, queryFn: listFunnemailRoutingRules });

  const [name, setName] = useState("");
  const [field, setField] = useState<FunnemailRoutingCondition["field"]>("subject");
  const [op, setOp] = useState<FunnemailRoutingCondition["op"]>("contains");
  const [value, setValue] = useState("");
  const [groupId, setGroupId] = useState("");
  const [priority, setPriority] = useState(100);

  async function handleCreate() {
    if (!user?.id) return;
    if (!name.trim() || !value.trim() || !groupId.trim()) {
      toast.error("Nome, valore e group_id sono richiesti");
      return;
    }
    try {
      await upsertFunnemailRoutingRule({
        user_id: user.id,
        name: name.trim(),
        conditions: [{ field, op, value: value.trim() }] as never,
        target_group_id: groupId.trim(),
        priority,
        enabled: true,
      } as never);
      toast.success("Regola creata");
      setName(""); setValue(""); setGroupId("");
      qc.invalidateQueries({ queryKey: QK });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    }
  }

  return (
    <div className="flex flex-col gap-4 overflow-auto pb-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Nuova regola composite</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <Input placeholder="Nome regola" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={field} onChange={(e) => setField(e.target.value as FunnemailRoutingCondition["field"])}>
            <option value="from_address">from_address</option>
            <option value="domain">domain</option>
            <option value="subject">subject</option>
            <option value="body">body</option>
          </select>
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={op} onChange={(e) => setOp(e.target.value as FunnemailRoutingCondition["op"])}>
            <option value="equals">equals</option>
            <option value="contains">contains</option>
            <option value="starts_with">starts_with</option>
            <option value="ends_with">ends_with</option>
            <option value="regex">regex</option>
          </select>
          <Input placeholder="valore" value={value} onChange={(e) => setValue(e.target.value)} />
          <Input placeholder="target group_id (uuid)" value={groupId} onChange={(e) => setGroupId(e.target.value)} />
          <div className="flex gap-2">
            <Input type="number" placeholder="prio" value={priority} onChange={(e) => setPriority(Number(e.target.value) || 100)} className="w-20" />
            <Button onClick={handleCreate}>Crea</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carico...</p>}
        {!isLoading && rules.length === 0 && <p className="text-sm text-muted-foreground">Nessuna regola configurata.</p>}
        {rules.map((r: FunnemailRoutingRuleRow) => (
          <Card key={r.id}>
            <CardContent className="flex items-center justify-between gap-3 py-3">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{r.name}</span>
                  <Badge variant="outline">prio {r.priority}</Badge>
                  <Badge variant="secondary">match {r.match_count}</Badge>
                </div>
                <code className="text-xs text-muted-foreground truncate">{JSON.stringify(r.conditions)} → {r.target_group_name ?? r.target_group_id}</code>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={r.enabled}
                  onCheckedChange={async (v) => {
                    await toggleFunnemailRoutingRule(r.id, v);
                    qc.invalidateQueries({ queryKey: QK });
                  }}
                />
                <Button
                  variant="ghost" size="icon"
                  onClick={async () => {
                    if (!confirm("Eliminare questa regola?")) return;
                    await deleteFunnemailRoutingRule(r.id);
                    qc.invalidateQueries({ queryKey: QK });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
