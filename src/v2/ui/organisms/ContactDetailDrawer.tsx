/**
 * ContactDetailDrawer — Contact detail side panel
 */
import * as React from "react";
import { useContactDetail } from "@/v2/hooks/useContactsV2";
import { contactCompletenessScore } from "@/v2/core/domain/rules/contact-rules";
import { StatusBadge } from "../atoms/StatusBadge";
import { Button } from "../atoms/Button";
import {
  X, Mail, Phone, MapPin, Building2, User, Briefcase,
  Hash, Clock,
} from "lucide-react";

interface ContactDetailDrawerProps {
  readonly contactId: string | null;
  readonly onClose: () => void;
}

export function ContactDetailDrawer({
  contactId,
  onClose,
}: ContactDetailDrawerProps): React.ReactElement | null {
  const { data: contact, isLoading } = useContactDetail(contactId);

  if (!contactId) return null;

  const score = contact ? contactCompletenessScore(contact) : 0;
  const statusColor = score >= 70 ? "text-green-500" : score >= 40 ? "text-yellow-500" : "text-red-500";

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md border-l bg-card shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold text-foreground truncate">
          {isLoading ? "Caricamento..." : contact?.name ?? contact?.companyName ?? "Contatto"}
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : contact ? (
          <>
            <div className="flex items-center gap-3">
              <div className={`text-2xl font-bold ${statusColor}`}>{score}%</div>
              <div>
                <p className="text-sm font-medium">Completezza</p>
                <StatusBadge
                  status={contact.leadStatus === "converted" ? "success" : contact.leadStatus === "new" ? "warning" : "info"}
                  label={contact.leadStatus}
                />
              </div>
            </div>

            <div className="space-y-3">
              {contact.name ? <InfoRow icon={<User className="h-4 w-4" />} label="Nome" value={contact.name} /> : null}
              {contact.companyName ? <InfoRow icon={<Building2 className="h-4 w-4" />} label="Azienda" value={contact.companyName} /> : null}
              {contact.position ? <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Ruolo" value={contact.position} /> : null}
              {contact.email ? (
                <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={contact.email} href={`mailto:${contact.email}`} />
              ) : null}
              {contact.phone ? (
                <InfoRow icon={<Phone className="h-4 w-4" />} label="Telefono" value={contact.phone} href={`tel:${contact.phone}`} />
              ) : null}
              {contact.mobile ? (
                <InfoRow icon={<Phone className="h-4 w-4" />} label="Mobile" value={contact.mobile} href={`tel:${contact.mobile}`} />
              ) : null}
              {contact.city ? <InfoRow icon={<MapPin className="h-4 w-4" />} label="Città" value={contact.city} /> : null}
              {contact.country ? <InfoRow icon={<MapPin className="h-4 w-4" />} label="Paese" value={contact.country} /> : null}
              {contact.origin ? <InfoRow icon={<Hash className="h-4 w-4" />} label="Origine" value={contact.origin} /> : null}
              <InfoRow icon={<Clock className="h-4 w-4" />} label="Interazioni" value={String(contact.interactionCount)} />
              {contact.lastInteractionAt ? (
                <InfoRow icon={<Clock className="h-4 w-4" />} label="Ultima interazione" value={new Date(contact.lastInteractionAt).toLocaleDateString("it-IT")} />
              ) : null}
            </div>

            {contact.wcaPartnerId ? (
              <div className="p-3 rounded-md bg-accent/50 text-sm">
                <p className="text-xs text-muted-foreground">Partner WCA collegato</p>
                <p className="font-mono text-xs mt-1">{String(contact.wcaPartnerId)}</p>
                {contact.wcaMatchConfidence ? (
                  <p className="text-xs text-muted-foreground mt-1">Confidenza match: {contact.wcaMatchConfidence}%</p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Contatto non trovato.</p>
        )}
      </div>
    </div>
  );
}

interface InfoRowProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: string;
  readonly href?: string;
}

function InfoRow({ icon, label, value, href }: InfoRowProps): React.ReactElement {
  return (
    <div className="flex items-start gap-3">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {href ? (
          <a href={href} className="text-sm text-primary hover:underline">{value}</a>
        ) : (
          <p className="text-sm text-foreground">{value}</p>
        )}
      </div>
    </div>
  );
}
