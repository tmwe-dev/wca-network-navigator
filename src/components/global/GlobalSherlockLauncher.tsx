/**
 * GlobalSherlockLauncher — listener singleton globale per l'evento `sherlock-launch`.
 *
 * Ascolta `window.dispatchEvent(new CustomEvent("sherlock-launch", { detail: {
 *   partnerId, contactId?, level } }))` da qualunque punto della UI (menu ⋯ delle
 * card CRM/BCA/RA, BulkActions, ContactDetail) e apre `SherlockLauncherDialog`
 * con il livello richiesto, recuperando i dati del partner se necessario.
 *
 * Sostituisce i listener locali su NetworkPage / PartnerDetailInline che lasciavano
 * il click silente nelle altre pagine.
 */
import * as React from "react";
import { SherlockLauncherDialog, type SherlockLauncherTarget } from "@/v2/ui/organisms/sherlock/SherlockLauncherDialog";
import type { SherlockLevel } from "@/v2/services/sherlock/sherlockTypes";
import { getPartner } from "@/data/partners";
import { createLogger } from "@/lib/log";

const log = createLogger("GlobalSherlockLauncher");

interface LaunchDetail {
  partnerId?: string | null;
  contactId?: string | null;
  level?: SherlockLevel;
  /** Quando true il dispatch è un replay già intercettato — ignorato. */
  _replay?: boolean;
  /** Target già pronto: salta la fetch del partner. */
  target?: Partial<SherlockLauncherTarget>;
}

export function GlobalSherlockLauncher(): React.ReactElement | null {
  const [open, setOpen] = React.useState(false);
  const [target, setTarget] = React.useState<SherlockLauncherTarget | null>(null);
  const [autoLevel, setAutoLevel] = React.useState<SherlockLevel | undefined>(undefined);

  React.useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail as LaunchDetail | undefined;
      if (!detail || detail._replay) return;
      if (!detail.partnerId && !detail.contactId && !detail.target) return;

      // Se ci dà già un target completo lo usiamo
      if (detail.target?.companyName) {
        setTarget({
          partnerId: detail.target.partnerId ?? detail.partnerId ?? null,
          contactId: detail.target.contactId ?? detail.contactId ?? null,
          companyName: detail.target.companyName ?? null,
          contactName: detail.target.contactName ?? null,
          city: detail.target.city ?? null,
          countryName: detail.target.countryName ?? null,
          countryCode: detail.target.countryCode ?? null,
          website: detail.target.website ?? null,
          linkedinUrl: detail.target.linkedinUrl ?? null,
        });
        setAutoLevel(detail.level);
        setOpen(true);
        return;
      }

      // Altrimenti carichiamo il partner
      if (detail.partnerId) {
        try {
          const row = await getPartner(detail.partnerId);
          const r = row as Record<string, unknown>;
          setTarget({
            partnerId: detail.partnerId,
            contactId: detail.contactId ?? null,
            companyName: (r.company_name as string | null) ?? null,
            contactName: null,
            city: (r.city as string | null) ?? null,
            countryName: (r.country_name as string | null) ?? null,
            countryCode: (r.country_code as string | null) ?? null,
            website: (r.website as string | null) ?? null,
            linkedinUrl: (r.linkedin_url as string | null) ?? null,
          });
          setAutoLevel(detail.level);
          setOpen(true);
        } catch (err) {
          log.warn("getPartner failed for sherlock-launch", { partnerId: detail.partnerId, err: err instanceof Error ? err.message : String(err) });
        }
        return;
      }
    };
    window.addEventListener("sherlock-launch", handler);
    return () => window.removeEventListener("sherlock-launch", handler);
  }, []);

  return (
    <SherlockLauncherDialog
      open={open}
      onOpenChange={setOpen}
      target={target}
      autoStartLevel={autoLevel}
    />
  );
}

export default GlobalSherlockLauncher;