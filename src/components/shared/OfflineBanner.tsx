import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useTranslation } from "react-i18next";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { t } = useTranslation();

  if (isOnline) return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-2 bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 text-sm text-yellow-400"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      {t("common.offlineMessage", "Sei offline. Alcune funzionalità potrebbero non essere disponibili.")}
    </div>
  );
}
