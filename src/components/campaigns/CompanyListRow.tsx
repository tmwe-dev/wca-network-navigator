import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getCountryFlag, formatPartnerType } from "@/lib/countries";
import { Mail, MapPin, Handshake, ChevronDown, Users, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PartnerContact } from "@/hooks/usePartnerContacts";

interface Partner {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  email: string | null;
  partner_type: string | null;
  partner_certifications?: { certification: string }[];
  is_bca?: boolean;
  bca_event?: string;
  bca_contact?: string;
}

interface BcaInfo {
  contact_name: string | null;
  event_name: string | null;
  met_at: string | null;
}

interface CompanyListRowProps {
  partner: Partner;
  isSelected: boolean;
  hasBca: boolean;
  bcaInfo?: BcaInfo;
  contacts: PartnerContact[];
  isExpanded: boolean;
  isBcaSource: boolean;
  selectedContacts?: Set<string>;
  onTogglePartner: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onToggleContact?: (contactId: string) => void;
}

export function CompanyListRow({
  partner, isSelected, hasBca, bcaInfo, contacts, isExpanded,
  isBcaSource, selectedContacts, onTogglePartner, onToggleExpand, onToggleContact,
}: CompanyListRowProps) {
  return (
    <div>
      <div className={cn("flex items-start gap-3 p-3 hover:bg-muted/30 transition-colors", hasBca && "border-l-2 border-l-primary/60")}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onTogglePartner(partner.id)}
          className="mt-1 cursor-pointer"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getCountryFlag(partner.country_code)}</span>
            <span className="truncate text-foreground cursor-pointer" onClick={() => onTogglePartner(partner.id)}>
              {partner.company_name}
            </span>
            {hasBca && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary shrink-0">
                    🤝 Incontrato
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="text-xs space-y-1">
                    {(bcaInfo?.event_name || partner.bca_event) && (
                      <p>📍 Evento: <strong>{bcaInfo?.event_name || partner.bca_event}</strong></p>
                    )}
                    {(bcaInfo?.contact_name || partner.bca_contact) && (
                      <p>👤 Contatto: {bcaInfo?.contact_name || partner.bca_contact}</p>
                    )}
                    {bcaInfo?.met_at && (
                      <p>📅 Data: {new Date(bcaInfo.met_at).toLocaleDateString("it")}</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
            {contacts.length > 0 && (
              <button
                onClick={() => onToggleExpand(partner.id)}
                className={cn(
                  "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border transition-colors shrink-0",
                  isExpanded
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "bg-muted border-border text-muted-foreground hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
                )}
              >
                <Users className="w-3 h-3" />
                {contacts.length}
                <ChevronDown className={cn("w-3 h-3 transition-transform", isExpanded && "rotate-180")} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-muted-foreground" />{partner.city}</span>
            {partner.partner_type && !isBcaSource && (
              <Badge variant="outline" className="text-xs">{formatPartnerType(partner.partner_type)}</Badge>
            )}
          </div>
          {partner.email && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Mail className="w-3 h-3" />{partner.email}
            </div>
          )}
          {partner.partner_certifications && partner.partner_certifications.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {partner.partner_certifications.map((cert, i) => (
                <Badge key={i} className="text-xs bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                  {cert.certification}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {isExpanded && contacts.length > 0 && (
        <div className="bg-muted/20 border-l-2 border-l-primary/30 ml-6 mr-2 mb-1 rounded-b-lg overflow-hidden">
          {contacts.map((contact) => (
            <label
              key={contact.id}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 hover:bg-muted/30 cursor-pointer transition-colors text-sm border-b border-border/30 last:border-0",
                contact.is_primary && "bg-primary/5"
              )}
            >
              {onToggleContact && selectedContacts && (
                <Checkbox
                  checked={selectedContacts.has(contact.id)}
                  onCheckedChange={() => onToggleContact(contact.id)}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground truncate">{contact.name}</span>
                  {contact.is_primary && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 text-primary border-primary/40">Primario</Badge>
                  )}
                </div>
                {contact.title && (
                  <span className="text-[11px] text-muted-foreground block truncate">{contact.title}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {contact.email && (
                  <Tooltip>
                    <TooltipTrigger asChild><Mail className="w-3 h-3 text-emerald-500/60" /></TooltipTrigger>
                    <TooltipContent className="text-xs">{contact.email}</TooltipContent>
                  </Tooltip>
                )}
                {(contact.direct_phone || contact.mobile) && (
                  <Tooltip>
                    <TooltipTrigger asChild><Phone className="w-3 h-3 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="text-xs">{contact.direct_phone || contact.mobile}</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
