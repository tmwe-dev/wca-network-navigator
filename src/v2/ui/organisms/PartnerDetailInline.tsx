/**
 * PartnerDetailInline — Pannello di dettaglio Partner ricco (header, info,
 * contatti suddivisi, networks, services, attività) embedded nello slot
 * destro del GoldenLayout. Riusa il pannello legacy `PartnerDetailFull`
 * che ha già la sezione contatti che l'utente vuole preservare.
 *
 * Carica i dati via `usePartner` (DAL `getPartner`) che restituisce il
 * partner + relazioni: partner_contacts, partner_networks,
 * partner_services, partner_certifications, interactions, reminders.
 */
import * as React from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "../atoms/Button";
import { usePartner, useToggleFavorite } from "@/hooks/usePartners";
import { PartnerDetailFull } from "@/components/partners/PartnerDetailFull";
import type { PartnerViewModel } from "@/types/partner-views";

interface Props {
  readonly partnerId: string | null;
  readonly onClose: () => void;
}

export function PartnerDetailInline({ partnerId, onClose }: Props): React.ReactElement | null {
  const { data: partner, isLoading } = usePartner(partnerId ?? "");
  const toggleFavorite = useToggleFavorite();

  if (!partnerId) return null;

  const vm = partner as unknown as PartnerViewModel | undefined;
  const title = isLoading
    ? "Caricamento…"
    : (vm?.company_name as string | undefined) ?? "Partner";

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="flex items-center justify-between p-3 border-b border-border/40">
        <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Chiudi">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : vm ? (
          <PartnerDetailFull
            partner={vm}
            onToggleFavorite={() =>
              toggleFavorite.mutate({ id: partnerId, isFavorite: !vm.is_favorite })
            }
          />
        ) : (
          <p className="p-4 text-sm text-muted-foreground">Partner non trovato.</p>
        )}
      </div>
    </div>
  );
}

export default PartnerDetailInline;