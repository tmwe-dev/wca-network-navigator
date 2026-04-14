/**
 * ABTestResults — Dashboard showing A/B test results with comparison
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FlaskConical, Star, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ABTest {
  id: string;
  test_name: string;
  test_type: string;
  status: string;
  variant_a: Record<string, string>;
  variant_b: Record<string, string>;
  total_sent_a: number;
  total_sent_b: number;
  responses_a: number;
  responses_b: number;
  open_rate_a: number;
  open_rate_b: number;
  winner: string | null;
  confidence_level: number;
  started_at: string;
  completed_at: string | null;
}

function VariantColumn({ label, sent, responses, rate, isWinner }: {
  label: string; sent: number; responses: number; rate: number; isWinner: boolean;
}) {
  return (
    <div className={cn(
      "flex-1 rounded-lg border p-3 space-y-2 transition-colors",
      isWinner ? "border-yellow-500/50 bg-yellow-500/5" : "border-border/60 bg-card/30"
    )}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase">{label}</span>
        {isWinner && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Inviate</span>
          <span className="font-mono text-foreground">{sent}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Risposte</span>
          <span className="font-mono text-foreground">{responses}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Tasso</span>
          <span className="font-mono font-bold text-foreground">{rate.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", isWinner ? "bg-yellow-500" : "bg-primary/60")}
            style={{ width: `${Math.min(rate, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function TestCard({ test, onComplete }: { test: ABTest; onComplete: (id: string) => void }) {
  const variantAText = Object.values(test.variant_a)[0] || "—";
  const variantBText = Object.values(test.variant_b)[0] || "—";
  const isSignificant = test.confidence_level >= 95;
  const StatusIcon = test.status === "completed" ? CheckCircle2 : test.status === "cancelled" ? XCircle : Clock;
  const statusColor = test.status === "completed" ? "text-green-500" : test.status === "cancelled" ? "text-red-500" : "text-amber-500";

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{test.test_name}</span>
          <Badge variant="outline" className="text-[10px] h-5">{test.test_type}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <StatusIcon className={cn("w-3.5 h-3.5", statusColor)} />
          <span className={cn("text-[10px] capitalize", statusColor)}>{test.status}</span>
        </div>
      </div>

      {/* Variant previews */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="truncate text-muted-foreground">A: {variantAText}</div>
        <div className="truncate text-muted-foreground">B: {variantBText}</div>
      </div>

      {/* Results */}
      <div className="flex gap-3">
        <VariantColumn label="Variante A" sent={test.total_sent_a} responses={test.responses_a} rate={test.open_rate_a} isWinner={test.winner === "a"} />
        <VariantColumn label="Variante B" sent={test.total_sent_b} responses={test.responses_b} rate={test.open_rate_b} isWinner={test.winner === "b"} />
      </div>

      {/* Confidence */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Confidenza: <span className={cn("font-semibold", isSignificant ? "text-green-500" : "text-foreground")}>{test.confidence_level}%</span>
          {isSignificant && <span className="ml-1.5 text-green-500">✓ Significativo</span>}
        </div>
        {test.status === "running" && (
          <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => onComplete(test.id)}>
            Termina e usa vincitore
          </Button>
        )}
      </div>

      <div className="text-[10px] text-muted-foreground">
        Iniziato: {new Date(test.started_at).toLocaleDateString("it-IT")}
        {test.completed_at && ` — Completato: ${new Date(test.completed_at).toLocaleDateString("it-IT")}`}
      </div>
    </div>
  );
}

export function ABTestResults() {
  const qc = useQueryClient();

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ["ab-tests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ab_tests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as ABTest[];
    },
    staleTime: 30_000,
  });

  const completeMutation = useMutation({
    mutationFn: async (testId: string) => {
      const test = tests.find(t => t.id === testId);
      if (!test) return;
      const winner = test.open_rate_a >= test.open_rate_b ? "a" : "b";
      const { error } = await supabase.from("ab_tests").update({
        status: "completed",
        winner,
        completed_at: new Date().toISOString(),
      }).eq("id", testId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Test completato");
      qc.invalidateQueries({ queryKey: ["ab-tests"] });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  if (tests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FlaskConical className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">Nessun A/B test creato</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Crea il tuo primo test dalla sezione "Da Inviare"</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4 max-w-3xl mx-auto">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-primary" /> A/B Test ({tests.length})
        </h2>
        {tests.map(t => (
          <TestCard key={t.id} test={t} onComplete={(id) => completeMutation.mutate(id)} />
        ))}
      </div>
    </ScrollArea>
  );
}
