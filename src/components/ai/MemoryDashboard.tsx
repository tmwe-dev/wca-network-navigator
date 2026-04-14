import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Check, X, Trash2, Shield, Zap, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { deleteMemory } from "@/data/aiMemory";
import { queryKeys } from "@/lib/queryKeys";

interface MemoryRow {
  id: string;
  content: string;
  memory_type: string;
  tags: string[];
  importance: number;
  level: number;
  access_count: number;
  confidence: number;
  source: string;
  pending_promotion: boolean;
  created_at: string;
  last_accessed_at: string;
}

const LEVEL_LABELS: Record<number, { label: string; icon: typeof Clock; color: string }> = {
  1: { label: "Sessione", icon: Clock, color: "text-muted-foreground" },
  2: { label: "Operativa", icon: Zap, color: "text-yellow-500" },
  3: { label: "Permanente", icon: Shield, color: "text-green-500" },
};

export default function MemoryDashboard() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("pending");

  const { data: memories, isLoading } = useQuery({
    queryKey: queryKeys.ai.memories,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("ai_memory")
        .select("*")
        .eq("user_id", user.id)
        .order("level", { ascending: false })
        .order("confidence", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as MemoryRow[];
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      if (approve) {
        const { error } = await supabase
          .from("ai_memory")
          .update({
            level: 3,
            pending_promotion: false,
            decay_rate: 0,
            promoted_at: new Date().toISOString(),
          } as never)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ai_memory")
          .update({ pending_promotion: false } as never)
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: (_, { approve }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.memories });
      toast.success(approve ? "Memoria promossa a L3 (Permanente)" : "Promozione rifiutata");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteMemory(id); const error = null;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.memories });
      toast.success("Memoria eliminata");
    },
  });

  const runPromoterMutation = useMutation({
    mutationFn: async () => {
      const data = await invokeEdge<Record<string, unknown>>("memory-promoter", { context: "MemoryDashboard.memory_promoter" });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.memories });
      const s = data?.stats as Record<string, number> | undefined;
      toast.success(`Promoter: ${s?.promoted_l1_to_l2 || 0} → L2, ${s?.promoted_l2_candidate || 0} candidati L3, ${s?.pruned || 0} rimossi`);
    },
    onError: () => toast.error("Errore nel promoter"),
  });

  const pending = memories?.filter(m => m.pending_promotion) || [];
  const l3 = memories?.filter(m => m.level === 3) || [];
  const l2 = memories?.filter(m => m.level === 2 && !m.pending_promotion) || [];
  const l1 = memories?.filter(m => m.level === 1) || [];

  const MemoryCard = ({ m }: { m: MemoryRow }) => {
    const info = LEVEL_LABELS[m.level] || LEVEL_LABELS[1];
    const Icon = info.icon;
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card hover:bg-accent/30 transition-colors">
        <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", info.color)} />
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm leading-snug">{m.content}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] h-4">{info.label}</Badge>
            <Badge variant="secondary" className="text-[10px] h-4">
              Conf: {(m.confidence * 100).toFixed(0)}%
            </Badge>
            <Badge variant="secondary" className="text-[10px] h-4">
              Accessi: {m.access_count}
            </Badge>
            {m.tags?.map(t => (
              <Badge key={t} variant="outline" className="text-[10px] h-4 text-muted-foreground">{t}</Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {m.pending_promotion && (
            <>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500" onClick={() => promoteMutation.mutate({ id: m.id, approve: true })} aria-label="Conferma">
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => promoteMutation.mutate({ id: m.id, approve: false })} aria-label="Chiudi">
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => deleteMutation.mutate(m.id)} aria-label="Elimina">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Memoria AI Cognitiva</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => runPromoterMutation.mutate()}
          disabled={runPromoterMutation.isPending}
        >
          {runPromoterMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1.5" />}
          Esegui Promoter
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "In attesa", count: pending.length, color: "text-orange-500" },
          { label: "L3 Permanenti", count: l3.length, color: "text-green-500" },
          { label: "L2 Operative", count: l2.length, color: "text-yellow-500" },
          { label: "L1 Sessione", count: l1.length, color: "text-muted-foreground" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className={cn("text-xl font-bold", s.color)}>{s.count}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="pending" className="flex-1">
            Da approvare {pending.length > 0 && <Badge variant="destructive" className="ml-1.5 h-4 text-[10px]">{pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="l3" className="flex-1">Permanenti ({l3.length})</TabsTrigger>
          <TabsTrigger value="l2" className="flex-1">Operative ({l2.length})</TabsTrigger>
          <TabsTrigger value="l1" className="flex-1">Sessione ({l1.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-2 mt-3">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nessuna memoria in attesa di approvazione</p>
          ) : pending.map(m => <MemoryCard key={m.id} m={m} />)}
        </TabsContent>
        <TabsContent value="l3" className="space-y-2 mt-3">
          {l3.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Nessuna memoria permanente</p> : l3.map(m => <MemoryCard key={m.id} m={m} />)}
        </TabsContent>
        <TabsContent value="l2" className="space-y-2 mt-3">
          {l2.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Nessuna memoria operativa</p> : l2.map(m => <MemoryCard key={m.id} m={m} />)}
        </TabsContent>
        <TabsContent value="l1" className="space-y-2 mt-3">
          {l1.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Nessuna memoria di sessione</p> : l1.map(m => <MemoryCard key={m.id} m={m} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
