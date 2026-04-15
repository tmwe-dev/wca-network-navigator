import { useEffect, useRef } from "react";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { useUpdateSetting } from "@/hooks/useAppSettings";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";

const log = createLogger("useAutoConnect");

/**
 * Auto-verifies LinkedIn and WhatsApp connections on mount
 * and persists the result in app_settings.
 * 
 * LinkedIn: requires BOTH extension available AND authenticated session.
 * WhatsApp: extension session OR API sender configured.
 */
export function useAutoConnect() {
  const li = useLinkedInExtensionBridge();
  const wa = useWhatsAppExtensionBridge();
  const updateSetting = useUpdateSetting();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const run = async () => {
      // ── LinkedIn: real auth only ──
      let liOk = false;
      if (li.isAvailable) {
        try {
          const r = await li.verifySession();
          liOk = r.success === true && r.authenticated === true;
        } catch (e) { log.debug("best-effort operation failed", { error: e instanceof Error ? e.message : String(e) }); /* intentionally ignored: best-effort cleanup */ }
      }
      // No fallback to DB credentials — they don't mean you're logged in locally

      // ── WhatsApp: extension OR API sender ──
      let waOk = false;
      if (wa.isAvailable) {
        try {
          const r = await wa.verifySession();
          waOk = r.success === true;
        } catch (e) { log.debug("best-effort operation failed", { error: e instanceof Error ? e.message : String(e) }); /* intentionally ignored: best-effort cleanup */ }
      }
      if (!waOk) {
        try {
          const { data } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "whatsapp_sender")
            .maybeSingle();
          if (data?.value) waOk = true;
        } catch (e) { log.debug("best-effort operation failed", { error: e instanceof Error ? e.message : String(e) }); /* intentionally ignored: best-effort cleanup */ }
      }

      // Persist real state
      try {
        await updateSetting.mutateAsync({ key: "linkedin_connected", value: String(liOk) });
        await updateSetting.mutateAsync({ key: "whatsapp_connected", value: String(waOk) });
      } catch (e) { log.debug("best-effort operation failed", { error: e instanceof Error ? e.message : String(e) }); /* intentionally ignored: best-effort cleanup */ }
    };

    const timer = setTimeout(run, 2000);
    return () => clearTimeout(timer);
  }, []);
}
