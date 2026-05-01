/**
 * PartnerDetailInline — Pannello di dettaglio Partner adattato per essere
 * embedded nello slot destro del GoldenLayout (NON fixed). Riusa
 * `usePartnerDetail` + `PartnerContent` del drawer originale.
 */
import * as React from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "../atoms/Button";
import { usePartnerDetail } from "@/v2/hooks/usePartnersV2";
import { PartnerContent } from "./PartnerDetailDrawer";

interface Props {
  readonly partnerId: string | null;
  readonly onClose: () => void;
}

export function PartnerDetailInline({ partnerId, onClose }: Props): React.ReactElement | null {
  const { data: partner, isLoading } = usePartnerDetail(partnerId);
  if (!partnerId) return null;
  return (
    <div className="h-full flex flex-col bg-card">
      <div className="flex items-center justify-between p-3 border-b border-border/40">
        <h2 className="text-sm font-semibold text-foreground truncate">
          {isLoading ? "Caricamento…" : partner?.companyName ?? "Partner"}
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Chiudi">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : partner ? (
          <PartnerContent partner={partner} />
        ) : (
          <p className="text-sm text-muted-foreground">Partner non trovato.</p>
        )}
      </div>
    </div>
  );
}

export default PartnerDetailInline;