/**
 * useFunnemailUrgencyAlerts — singleton realtime per alert Funnemail.
 *
 * Sottoscrive INSERT su `funnemail_decisions` con urgency in (critical, high)
 * e mostra un toast cliccabile. De-dup per id, no spam.
 * Attivato solo se `localStorage.funnemail_urgency_alerts !== "off"`.
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";

interface DecisionInsert {
  id: string;
  message_id: string;
  urgency: "critical" | "high" | "normal" | "low";
  folder_slug: string | null;
  from_address: string | null;
  reasoning: string | null;
}

export function useFunnemailUrgencyAlerts(): void {
  const qc = useQueryClient();
  const seenRef = useRef<Set<string>>(new Set());
  const subRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    let optedOut = false;
    try { optedOut = localStorage.getItem("funnemail_urgency_alerts") === "off"; } catch { /* ignore */ }
    if (optedOut) return;

    const channel = supabase
      .channel("funnemail_urgency_alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "funnemail_decisions" },
        (payload) => {
          const row = payload.new as DecisionInsert;
          if (!row?.id || seenRef.current.has(row.id)) return;
          if (row.urgency !== "critical" && row.urgency !== "high") return;
          seenRef.current.add(row.id);
          const sender = row.from_address?.replace(/<[^>]+>/g, "").trim() || row.from_address || "Mittente sconosciuto";
          const isCritical = row.urgency === "critical";
          toast(isCritical ? `🔴 Email critica` : `🟠 Email ad alta priorità`, {
            description: `${sender}${row.reasoning ? ` — ${row.reasoning.slice(0, 120)}` : ""}`,
            duration: isCritical ? 15000 : 8000,
            action: {
              label: "Apri",
              onClick: () => { window.location.href = "/v2/funnemail-inbox"; },
            },
          });
          qc.invalidateQueries({ queryKey: queryKeys.funnemailInbox.root });
        },
      )
      .subscribe();
    subRef.current = channel;

    return () => {
      if (subRef.current) {
        void supabase.removeChannel(subRef.current);
        subRef.current = null;
      }
    };
  }, [qc]);
}