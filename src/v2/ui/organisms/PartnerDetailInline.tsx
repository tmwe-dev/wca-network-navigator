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
import { Loader2, X, Search, ScanSearch, Telescope, ChevronDown } from "lucide-react";
import { Button } from "../atoms/Button";
import { usePartner, useToggleFavorite } from "@/hooks/usePartners";
import { PartnerDetailFull } from "@/components/partners/PartnerDetailFull";
import type { PartnerViewModel } from "@/types/partner-views";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  SherlockLauncherDialog,
  type SherlockLauncherTarget,
} from "./sherlock/SherlockLauncherDialog";
import { useSherlockLevel } from "@/v2/hooks/useSherlockLevels";
import { SherlockLevelBadge } from "../atoms/SherlockLevelBadge";
import type { SherlockLevel } from "@/v2/services/sherlock/sherlockTypes";

interface Props {
  readonly partnerId: string | null;
  readonly onClose: () => void;
}

export function PartnerDetailInline({ partnerId, onClose }: Props): React.ReactElement | null {
  const { data: partner, isLoading } = usePartner(partnerId ?? "");
  const toggleFavorite = useToggleFavorite();
  const sherlockLevel = useSherlockLevel("partner", partnerId);
  const [launcherOpen, setLauncherOpen] = React.useState(false);
  const [launcherLevel, setLauncherLevel] = React.useState<SherlockLevel | undefined>(undefined);

  if (!partnerId) return null;

  const vm = partner as unknown as PartnerViewModel | undefined;
  const title = isLoading
    ? "Caricamento…"
    : (vm?.company_name as string | undefined) ?? "Partner";

  const target: SherlockLauncherTarget | null = vm
    ? {
        partnerId,
        contactId: null,
        companyName: (vm.company_name as string | null) ?? null,
        city: (vm.city as string | null) ?? null,
        countryName: (vm.country_name as string | null) ?? null,
        countryCode: (vm.country_code as string | null) ?? null,
        website: (vm.website as string | null) ?? null,
        linkedinUrl: (vm.linkedin_url as string | null) ?? null,
      }
    : null;

  const launchSherlock = (level: SherlockLevel) => {
    setLauncherLevel(level);
    setLauncherOpen(true);
  };

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="flex items-center justify-between p-3 border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
          {sherlockLevel && (
            <SherlockLevelBadge
              level={sherlockLevel.level}
              completedAt={sherlockLevel.completed_at}
            />
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {vm && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1">
                  <Search className="w-3.5 h-3.5" /> Deep Search
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-[10px] uppercase">Sherlock — 3 livelli</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => launchSherlock(1)} className="text-xs">
                  <Search className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                  Scout
                  <span className="ml-auto text-[10px] text-muted-foreground">~30s</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => launchSherlock(2)} className="text-xs">
                  <ScanSearch className="w-3.5 h-3.5 mr-2 text-primary" />
                  Detective
                  <span className="ml-auto text-[10px] text-muted-foreground">~2min</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => launchSherlock(3)} className="text-xs">
                  <Telescope className="w-3.5 h-3.5 mr-2 text-amber-500" />
                  Sherlock
                  <span className="ml-auto text-[10px] text-muted-foreground">~5min</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Chiudi">
            <X className="h-4 w-4" />
          </Button>
        </div>
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
      <SherlockLauncherDialog
        open={launcherOpen}
        onOpenChange={setLauncherOpen}
        target={target}
        autoStartLevel={launcherLevel}
      />
    </div>
  );
}

export default PartnerDetailInline;