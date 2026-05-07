import { useEffect, useRef } from "react";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { useUpdateSetting } from "@/hooks/useAppSettings";
import { createLogger } from "@/lib/log";
import { useAuth } from "@/providers/AuthProvider";

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
  const { status } = useAuth();
  const didRun = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;
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

      // ── WhatsApp: extension session must be authenticated ──
      let waOk = false;
      if (wa.isAvailable) {
        try {
          const r = await wa.verifySession();
          waOk = r.success === true && r.authenticated === true;
        } catch (e) { log.debug("best-effort operation failed", { error: e instanceof Error ? e.message : String(e) }); /* intentionally ignored: best-effort cleanup */ }
      }
      // No DB-sender fallback: it doesn't mean the bridge is actually live

      // Persist real state
      try {
        await updateSetting.mutateAsync({ key: "linkedin_connected", value: String(liOk) });
        await updateSetting.mutateAsync({ key: "whatsapp_connected", value: String(waOk) });
      } catch (e) { log.debug("best-effort operation failed", { error: e instanceof Error ? e.message : String(e) }); /* intentionally ignored: best-effort cleanup */ }
    };

    const timer = setTimeout(run, 2000);
    return () => clearTimeout(timer);
  }, [li, wa, updateSetting, status]);
}
