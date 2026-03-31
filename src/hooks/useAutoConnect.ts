import { useEffect, useRef } from "react";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { useUpdateSetting } from "@/hooks/useAppSettings";
import { supabase } from "@/integrations/supabase/client";

/**
 * Auto-verifies LinkedIn and WhatsApp connections on mount
 * and persists the result in app_settings.
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
      let liOk = li.isAvailable;
      let waOk = wa.isAvailable;

      // LinkedIn: check DB credentials if extension not available
      if (!liOk) {
        try {
          const { data } = await supabase.functions.invoke("get-linkedin-credentials");
          if (data?.email) liOk = true;
        } catch {}
        // Also check li_at cookie
        try {
          const { data } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "linkedin_li_at")
            .maybeSingle();
          if (data?.value) liOk = true;
        } catch {}
      }

      // Verify sessions if extensions are available
      if (li.isAvailable) {
        try {
          const res = await li.verifySession();
          liOk = res.success;
        } catch {}
      }
      if (wa.isAvailable) {
        try {
          const res = await wa.verifySession();
          waOk = res.success;
        } catch {}
      }

      // Persist
      try {
        await updateSetting.mutateAsync({ key: "linkedin_connected", value: String(liOk) });
        await updateSetting.mutateAsync({ key: "whatsapp_connected", value: String(waOk) });
      } catch {}
    };

    // Delay slightly to let extension pings settle
    const timer = setTimeout(run, 2000);
    return () => clearTimeout(timer);
  }, []);
}
