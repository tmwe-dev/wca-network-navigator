import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createLogger } from "@/lib/log";
import { createMemory } from "@/data/aiMemory";

const log = createLogger("FeedbackButtons");

interface FeedbackButtonsProps {
  messageIndex: number;
  className?: string;
}

export function FeedbackButtons({ messageIndex, className }: FeedbackButtonsProps) {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const handleFeedback = async (type: "up" | "down") => {
    if (feedback === type) return;
    setFeedback(type);

    try {
      // Save feedback as memory for the AI to learn from
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await createMemory({
        user_id: user.id,
        content: type === "up"
          ? `L'utente ha gradito la risposta #${messageIndex} dell'assistente.`
          : `L'utente NON ha gradito la risposta #${messageIndex} dell'assistente. Migliorare la qualità delle risposte future.`,
        memory_type: "preference",
        tags: ["feedback", type === "up" ? "positive" : "negative"],
        importance: type === "up" ? 2 : 4,
        source: "feedback",
        level: 1,
        confidence: 0.5,
      } as any);

      // Also boost/reduce confidence of recent L1/L2 memories
      const { data: recentMemories } = await supabase
        .from("ai_memory")
        .select("id, confidence, level")
        .eq("user_id", user.id)
        .in("level", [1, 2] as any)
        .order("last_accessed_at", { ascending: false })
        .limit(5);

      if (recentMemories?.length) {
        const delta = type === "up" ? 0.05 : -0.08;
        for (const m of recentMemories) {
          const newConf = Math.max(0, Math.min(1, Number((m as any).confidence || 0.5) + delta));
          await supabase
            .from("ai_memory")
            .update({ confidence: newConf } as any)
            .eq("id", m.id);
        }
      }
    } catch (e) {
      log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
      // Silent fail for feedback
    }
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-6 w-6 rounded-full",
          feedback === "up" && "text-green-500 bg-green-500/10"
        )}
        onClick={() = aria-label="Positivo"> handleFeedback("up")}
        aria-label="Positivo"
      >
        <ThumbsUp className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-6 w-6 rounded-full",
          feedback === "down" && "text-red-500 bg-red-500/10"
        )}
        onClick={() = aria-label="Negativo"> handleFeedback("down")}
        aria-label="Negativo"
      >
        <ThumbsDown className="h-3 w-3" />
      </Button>
    </div>
  );
}
