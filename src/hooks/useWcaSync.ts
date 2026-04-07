/**
 * useWcaSync — Global hook for WCA sync via SSE
 * Listens for "sync-wca-trigger" custom event and runs the sync edge function.
 */
import { useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useWcaSync() {
  const queryClient = useQueryClient();

  const handleSyncWca = useCallback(async () => {
    const toastId = toast.loading("🚀 Avvio sincronizzazione globale...");

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessione scaduta, effettua il login");

      const response = await fetch(`${supabaseUrl}/functions/v1/sync-wca-partners`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) throw new Error(`Sync fallito: HTTP ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Stream non disponibile");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "start") {
              toast.loading(`🔍 Trovati ${evt.total} partner da sincronizzare...`, { id: toastId });
            } else if (evt.type === "progress") {
              const pct = evt.total > 0 ? Math.round((evt.synced / evt.total) * 100) : 0;
              const bar = "█".repeat(Math.floor(pct / 5)) + "░".repeat(20 - Math.floor(pct / 5));
              toast.loading(
                `${bar} ${pct}%\n` +
                `👥 ${evt.synced}/${evt.total} partner · 📇 ${evt.contacts} contatti · 🌐 ${evt.networks} network` +
                (evt.totalPages > 1 ? `\n📦 Pagina ${evt.page}/${evt.totalPages}` : ""),
                { id: toastId }
              );
            } else if (evt.type === "complete") {
              toast.success(
                `✅ Sincronizzazione completata!\n` +
                `👥 ${evt.synced} partner · 📇 ${evt.contacts} contatti · 🌐 ${evt.networks} network`,
                { id: toastId, duration: 8000 }
              );
            } else if (evt.type === "error") {
              console.error("Sync SSE error:", evt.message);
              toast.loading(`⚠️ ${evt.message}`, { id: toastId });
            }
          } catch {}
        }
      }
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partners-paginated"] });
      queryClient.invalidateQueries({ queryKey: ["country-stats"] });
      queryClient.invalidateQueries({ queryKey: ["partner-stats"] });
    } catch (e: any) {
      toast.error(e?.message || "Errore sincronizzazione", { id: toastId });
    }
  }, [queryClient]);

  useEffect(() => {
    window.addEventListener("sync-wca-trigger", handleSyncWca);
    return () => window.removeEventListener("sync-wca-trigger", handleSyncWca);
  }, [handleSyncWca]);
}
