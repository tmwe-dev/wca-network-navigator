/**
 * PartnerDetailDrawer — Partner detail side panel
 */
import * as React from "react";
import { usePartnerDetail } from "@/v2/hooks/usePartnersV2";
import { partnerCompletenessScore } from "@/v2/core/domain/rules/partner-rules";
import { StatusBadge } from "../atoms/StatusBadge";
import { Button } from "../atoms/Button";
import {
  X, Globe, Mail, Phone, MapPin, Building2, Calendar,
  ExternalLink, AlertTriangle,
} from "lucide-react";

interface PartnerDetailDrawerProps {
  readonly partnerId: string | null;
  readonly onClose: () => void;
}

export function PartnerDetailDrawer({
  partnerId,
  onClose,
}: PartnerDetailDrawerProps): React.ReactElement | null {
  const { data: partner, isLoading } = usePartnerDetail(partnerId);

  if (!partnerId) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md border-l bg-card shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold text-foreground truncate">
          {isLoading ? "Caricamento..." : partner?.companyName ?? "Partner"}
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : partner ? (
          <>
            {/* Score */}
            <div className="flex items-center gap-3">
              <ScoreRing score={partnerCompletenessScore(partner)} />
              <div>
                <p className="text-sm font-medium">Completezza profilo</p>
                <p className="text-xs text-muted-foreground">
                  {partnerCompletenessScore(partner)}% dei dati compilati
                </p>
              </div>
              {partner.isBlacklisted ? (
                <StatusBadge status="error" label="Blacklist" />
              ) : null}
            </div>

            {/* Info grid */}
            <div className="space-y-3">
              <InfoRow icon={<Building2 className="h-4 w-4" />} label="Network" value={partner.networkName} />
              <InfoRow icon={<MapPin className="h-4 w-4" />} label="Paese" value={`${partner.countryName} (${partner.countryCode})`} />
              {partner.city ? <InfoRow icon={<MapPin className="h-4 w-4" />} label="Città" value={partner.city} /> : null}
              {partner.address ? <InfoRow icon={<MapPin className="h-4 w-4" />} label="Indirizzo" value={partner.address} /> : null}
              {partner.email ? (
                <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={partner.email} href={`mailto:${partner.email}`} />
              ) : (
                <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value="Non disponibile" missing />
              )}
              {partner.phone ? (
                <InfoRow icon={<Phone className="h-4 w-4" />} label="Telefono" value={partner.phone} href={`tel:${partner.phone}`} />
              ) : (
                <InfoRow icon={<Phone className="h-4 w-4" />} label="Telefono" value="Non disponibile" missing />
              )}
              {partner.website ? (
                <InfoRow icon={<Globe className="h-4 w-4" />} label="Sito web" value={partner.website} href={partner.website} external />
              ) : null}
              {partner.memberSince ? (
                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Membro dal" value={partner.memberSince} />
              ) : null}
              {partner.wcaId ? (
                <InfoRow icon={<Building2 className="h-4 w-4" />} label="WCA ID" value={String(partner.wcaId)} />
              ) : null}
            </div>

            {/* Blacklist warning */}
            {partner.isBlacklisted ? (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                Partner in blacklist — operazioni di outreach bloccate.
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Partner non trovato.</p>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function ScoreRing({ score }: { readonly score: number }): React.ReactElement {
  const color = score >= 70 ? "text-green-500" : score >= 40 ? "text-yellow-500" : "text-red-500";
  return (
    <div className={`text-2xl font-bold ${color}`}>
      {score}%
    </div>
  );
}

interface InfoRowProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: string;
  readonly href?: string;
  readonly external?: boolean;
  readonly missing?: boolean;
}

function InfoRow({ icon, label, value, href, external, missing }: InfoRowProps): React.ReactElement {
  return (
    <div className="flex items-start gap-3">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {href ? (
          <a
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            {value}
            {external ? <ExternalLink className="h-3 w-3" /> : null}
          </a>
        ) : (
          <p className={`text-sm ${missing ? "text-muted-foreground italic" : "text-foreground"}`}>
            {value}
          </p>
        )}
      </div>
    </div>
  );
}
