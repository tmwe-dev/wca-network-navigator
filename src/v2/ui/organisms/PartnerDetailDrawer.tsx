/**
 * PartnerDetailDrawer — Partner detail panel with actions
 */
import * as React from "react";
import { usePartnerDetail } from "@/v2/hooks/usePartnersV2";
import { partnerCompletenessScore, isEligibleForEnrichment } from "@/v2/core/domain/rules/partner-rules";
import { StatusBadge } from "../atoms/StatusBadge";
import { Button } from "../atoms/Button";
import type { PartnerV2 } from "@/v2/core/domain/partner-entity";
import {
  X, Globe, Mail, Phone, MapPin, Building2, Calendar,
  ExternalLink, Star, Loader2, Copy, Sparkles,
} from "lucide-react";

interface Props {
  readonly partnerId: string | null;
  readonly onClose: () => void;
  readonly onToggleFavorite?: (partner: PartnerV2) => void;
}

export function PartnerDetailDrawer({ partnerId, onClose, onToggleFavorite }: Props): React.ReactElement | null {
  const { data: partner, isLoading } = usePartnerDetail(partnerId);

  if (!partnerId) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md border-l bg-card shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold text-foreground truncate">
          {isLoading ? "Caricamento..." : partner?.companyName ?? "Partner"}
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : partner ? (
          <PartnerContent partner={partner} onToggleFavorite={onToggleFavorite} />
        ) : (
          <p className="text-sm text-muted-foreground">Partner non trovato.</p>
        )}
      </div>
    </div>
  );
}

function PartnerContent({ partner, onToggleFavorite }: {
  readonly partner: PartnerV2;
  readonly onToggleFavorite?: (partner: PartnerV2) => void;
}): React.ReactElement {
  const score = partnerCompletenessScore(partner);
  const enrichable = isEligibleForEnrichment(partner);

  return (
    <>
      {/* Score + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScoreRing score={score} />
          <div>
            <p className="text-sm font-medium">Completezza profilo</p>
            <p className="text-xs text-muted-foreground">{score}% dei dati</p>
          </div>
        </div>
        <div className="flex gap-1">
          {onToggleFavorite && (
            <Button variant="ghost" size="sm" onClick={() => onToggleFavorite(partner)}>
              <Star className={`h-4 w-4 ${partner.isFavorite ? "text-yellow-500 fill-yellow-500" : ""}`} />
            </Button>
          )}
          {enrichable && (
            <Button variant="ghost" size="sm" title="Enrich">
              <Sparkles className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Status badges */}
      <div className="flex gap-2 flex-wrap">
        <StatusBadge status={partner.isActive ? "success" : "error"} label={partner.isActive ? "Attivo" : "Inattivo"} />
        <StatusBadge
          status={partner.leadStatus === "converted" ? "success" : partner.leadStatus === "new" ? "info" : "warning"}
          label={partner.leadStatus}
        />
        {partner.partnerType && <StatusBadge status="neutral" label={partner.partnerType} />}
      </div>

      {/* Info rows */}
      <div className="space-y-2.5">
        <InfoRow icon={<MapPin className="h-4 w-4" />} label="Paese" value={`${partner.countryName} (${partner.countryCode})`} />
        <InfoRow icon={<MapPin className="h-4 w-4" />} label="Città" value={partner.city} />
        {partner.address && <InfoRow icon={<MapPin className="h-4 w-4" />} label="Indirizzo" value={partner.address} />}
        {partner.officeType && <InfoRow icon={<Building2 className="h-4 w-4" />} label="Tipo ufficio" value={partner.officeType} />}

        {partner.email ? (
          <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={partner.email} href={`mailto:${partner.email}`} copyable />
        ) : (
          <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value="Non disponibile" missing />
        )}
        {partner.phone && <InfoRow icon={<Phone className="h-4 w-4" />} label="Telefono" value={partner.phone} href={`tel:${partner.phone}`} />}
        {partner.mobile && <InfoRow icon={<Phone className="h-4 w-4" />} label="Mobile" value={partner.mobile} href={`tel:${partner.mobile}`} />}
        {partner.website && (
          <InfoRow icon={<Globe className="h-4 w-4" />} label="Sito web" value={partner.website} href={partner.website} external />
        )}
        {partner.memberSince && <InfoRow icon={<Calendar className="h-4 w-4" />} label="Membro dal" value={partner.memberSince} />}
        {partner.wcaId != null && <InfoRow icon={<Building2 className="h-4 w-4" />} label="WCA ID" value={String(partner.wcaId)} />}
        {partner.rating != null && <InfoRow icon={<Star className="h-4 w-4" />} label="Rating" value={`${partner.rating} ★`} />}
        <InfoRow icon={<Mail className="h-4 w-4" />} label="Interazioni" value={String(partner.interactionCount)} />
        {partner.lastInteractionAt && (
          <InfoRow icon={<Calendar className="h-4 w-4" />} label="Ultima interazione" value={new Date(partner.lastInteractionAt).toLocaleDateString("it-IT")} />
        )}
      </div>

      {/* Description */}
      {partner.profileDescription && (
        <div className="space-y-1 border-t pt-3">
          <p className="text-xs text-muted-foreground font-medium">Descrizione</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{partner.profileDescription}</p>
        </div>
      )}
    </>
  );
}

function ScoreRing({ score }: { readonly score: number }): React.ReactElement {
  const color = score >= 70 ? "text-green-500" : score >= 40 ? "text-yellow-500" : "text-red-500";
  return <div className={`text-2xl font-bold ${color}`}>{score}%</div>;
}

interface InfoRowProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: string;
  readonly href?: string;
  readonly external?: boolean;
  readonly missing?: boolean;
  readonly copyable?: boolean;
}

function InfoRow({ icon, label, value, href, external, missing, copyable }: InfoRowProps): React.ReactElement {
  const handleCopy = () => { void navigator.clipboard.writeText(value); };

  return (
    <div className="flex items-start gap-3">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1">
          {href ? (
            <a
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className="text-sm text-primary hover:underline flex items-center gap-1 truncate"
            >
              {value}
              {external && <ExternalLink className="h-3 w-3 flex-shrink-0" />}
            </a>
          ) : (
            <p className={`text-sm truncate ${missing ? "text-muted-foreground italic" : "text-foreground"}`}>{value}</p>
          )}
          {copyable && (
            <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground flex-shrink-0">
              <Copy className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
