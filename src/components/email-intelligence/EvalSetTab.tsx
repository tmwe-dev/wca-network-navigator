import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Play } from "lucide-react";
import {
  listFunnemailEvalCases,
  listFunnemailEvalRuns,
  createFunnemailEvalCase,
  runFunnemailEval,
  type FunnemailEvalCase,
  type FunnemailEvalRun,
} from "@/data/funnemailEval";

const QK_CASES = ["funnemail", "eval-cases"] as const;
const QK_RUNS = ["funnemail", "eval-runs"] as const;

export default function EvalSetTab() {
  const qc = useQueryClient();
  const { data: cases = [] } = useQuery({ queryKey: QK_CASES, queryFn: listFunnemailEvalCases });
  const { data: runs = [] } = useQuery({ queryKey: QK_RUNS, queryFn: () => listFunnemailEvalRuns(50), refetchInterval: 10000 });

  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [expectedAction, setExpectedAction] = useState("reply");
  const [running, setRunning] = useState(false);

  async function handleCreate() {
    if (!name.trim() || !from.trim()) {
      toast.error("Nome e mittente sono richiesti");
      return;
    }
    try {
      await createFunnemailEvalCase({
        name: name.trim(),
        inbound_payload: { from_address: from.trim(), subject: subject.trim(), body_text: body.trim() },
        expected_decision: { suggested_action: expectedAction, confidence_min: 0.6 },
      });
      toast.success("Caso creato");
      setName(""); setFrom(""); setSubject(""); setBody("");
      qc.invalidateQueries({ queryKey: QK_CASES });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    }
  }

  async function handleRunAll() {
    setRunning(true);
    try {
      const r = await runFunnemailEval({ all: true });
      const rate = r.pass_rate ? Math.round(r.pass_rate * 100) : 0;
      toast.success(`Eseguiti ${r.total ?? 0} casi · pass-rate ${rate}%`);
      qc.invalidateQueries({ queryKey: QK_RUNS });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setRunning(false);
    }
  }

  async function handleRunOne(caseId: string) {
    try {
      const r = await runFunnemailEval({ case_id: caseId });
      const passed = (r.runs?.[0] as { passed?: boolean })?.passed;
      toast[passed ? "success" : "error"](`Caso ${passed ? "PASSED" : "FAILED"}`);
      qc.invalidateQueries({ queryKey: QK_RUNS });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    }
  }

  const passRate = runs.length ? Math.round((runs.filter((r) => r.passed).length / runs.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 overflow-auto pb-6">
      <div className="flex items-center gap-3">
        <Button onClick={handleRunAll} disabled={running || cases.length === 0}>
          <Play className="h-4 w-4 mr-1" /> Run all enabled
        </Button>
        <Badge variant="outline">Pass-rate ultime {runs.length}: {passRate}%</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Nuovo caso</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Input placeholder="Nome caso" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="from_address" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input placeholder="oggetto" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={expectedAction} onChange={(e) => setExpectedAction(e.target.value)}>
            {["reply","archive","escalate","ignore","deep_search","crm_update","autoresponder"].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <Textarea placeholder="corpo email" value={body} onChange={(e) => setBody(e.target.value)} className="md:col-span-2" rows={3} />
          <Button onClick={handleCreate} className="md:col-span-2 w-fit">Crea caso</Button>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-sm font-medium mb-2">Casi ({cases.length})</h3>
        <div className="grid gap-2">
          {cases.map((c: FunnemailEvalCase) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="font-medium">{c.name}</span>
                  <code className="text-xs text-muted-foreground truncate">expected: {JSON.stringify(c.expected_decision)}</code>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleRunOne(c.id)}>
                  <Play className="h-3 w-3 mr-1" /> Run
                </Button>
              </CardContent>
            </Card>
          ))}
          {cases.length === 0 && <p className="text-sm text-muted-foreground">Nessun caso configurato.</p>}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Esiti recenti ({runs.length})</h3>
        <div className="grid gap-2">
          {runs.map((r: FunnemailEvalRun) => (
            <Card key={r.id}>
              <CardContent className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant={r.passed ? "secondary" : "destructive"}>{r.passed ? "PASS" : "FAIL"}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(r.run_at).toLocaleString()}</span>
                  {r.latency_ms != null && <span className="text-xs text-muted-foreground">{r.latency_ms}ms</span>}
                </div>
                <code className="text-xs text-muted-foreground truncate max-w-[60%]">
                  {r.error ?? JSON.stringify(r.diff ?? r.actual_decision ?? {})}
                </code>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
