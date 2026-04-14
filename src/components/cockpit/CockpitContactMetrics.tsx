import { Mail, Linkedin, MessageCircle, Smartphone, Globe, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { resolveAgentAvatar } from "@/data/agentAvatars";
import { Briefcase } from "lucide-react";
import type { ContactOrigin } from "@/pages/Cockpit";
import type { AssignmentInfo } from "./CockpitContactCard";
import { OptimizedImage } from "@/components/shared/OptimizedImage";

interface Contact {
  email: string;
  phone?: string;
  linkedinUrl?: string;
  channels: string[];
  origin: ContactOrigin;
  originDetail: string;
  language: string;
  lastContact: string;
  enrichmentData?: Record<string, unknown>;
  deepSearchAt?: string;
}

interface EnrichmentState {
  linkedinProfile?: { name?: string } | null;
  scrapingPhase: string;
}

const originConfig: Record<ContactOrigin, { text: string }> = {
  wca: { text: "text-chart-1" },
  report_aziende: { text: "text-chart-4" },
  import: { text: "text-chart-3" },
  bca: { text: "text-primary" },
  manual: { text: "text-emerald-500" },
};

function SmartChannelIcons({ contact }: { contact: Contact }) {
  const hasEmail = !!contact.email;
  const hasLinkedin = !!contact.linkedinUrl;
  const hasPhone = !!contact.phone;

  const icons = [
    { key: "Email", Icon: Mail, active: hasEmail, activeClass: "text-primary bg-primary/10", value: contact.email },
    { key: "LinkedIn", Icon: Linkedin, active: hasLinkedin, activeClass: "text-[hsl(210,80%,55%)] bg-[hsl(210,80%,55%)]/10", value: contact.linkedinUrl },
    { key: "WhatsApp", Icon: MessageCircle, active: hasPhone, activeClass: "text-emerald-500 bg-emerald-500/10", value: contact.phone },
    { key: "SMS", Icon: Smartphone, active: hasPhone, activeClass: "text-chart-3 bg-chart-3/10", value: contact.phone },
  ];

  return (
    <div className="flex items-center gap-1">
      {icons.map(({ key, Icon, active, activeClass, value }) => (
        <InfoTooltip key={key} content={active ? `${key}: ${value}` : `${key} non disponibile`}>
          <span className={cn("p-1 rounded-md transition-colors", active ? activeClass : "bg-muted/30 text-muted-foreground/25")}>
            <Icon className="w-3.5 h-3.5" />
          </span>
        </InfoTooltip>
      ))}
    </div>
  );
}

function EnrichBadge({ icon, label, done }: { icon: React.ReactNode; label: string; done: boolean }) {
  return (
    <InfoTooltip content={`${label}: ${done ? "completato" : "mancante"}`}>
      <span className={cn(
        "flex items-center gap-0.5 text-[8px] font-medium px-1 py-0.5 rounded border",
        done ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-muted/30 text-muted-foreground/40 border-border/20"
      )}>
        {icon}
        {done ? <Check className="w-2 h-2" /> : <X className="w-2 h-2" />}
      </span>
    </InfoTooltip>
  );
}

interface CockpitContactMetricsProps {
  contact: Contact;
  assignment?: AssignmentInfo;
  hasLiveLinkedin: boolean;
  enrichmentState?: EnrichmentState;
  scrapingPhase?: string;
}

export function CockpitContactMetrics({ contact, assignment, hasLiveLinkedin, enrichmentState: _enrichmentState }: CockpitContactMetricsProps) {
  const oc = originConfig[contact.origin];
  const e = contact.enrichmentData;
  const hasLinkedin = hasLiveLinkedin || !!(e?.linkedin_url || e?.linkedin_profile_url || contact.linkedinUrl);
  const hasWebsite = !!(e?.company_website);
  const hasAI = !!contact.deepSearchAt;
  const websiteDomain = (e?.company_website as string | undefined)?.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  return (
    <>
      <div className="pt-1.5 border-t border-border/20">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/80 mb-1.5">
          <span className={cn("truncate max-w-[100px]", oc.text)}>{contact.originDetail}</span>
          <span>·</span>
          <span>{contact.language}</span>
          <span>·</span>
          <span>{contact.lastContact}</span>
        </div>
        <div className="flex items-center justify-between">
          <SmartChannelIcons contact={contact} />
          {assignment && (
            <div className="flex items-center gap-1">
              {(() => {
                const avatarSrc = resolveAgentAvatar(assignment.agentName, assignment.agentAvatar);
                return avatarSrc ? (
                  <InfoTooltip content={`Agente: ${assignment.agentName}`}>
                    <OptimizedImage src={avatarSrc} alt={assignment.agentName} className="w-4 h-4 rounded-full ring-1 ring-primary/30" />
                  </InfoTooltip>
                ) : (
                  <InfoTooltip content={`Agente: ${assignment.agentName}`}>
                    <span className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center text-[8px] font-bold text-primary ring-1 ring-primary/30">
                      {assignment.agentName.charAt(0)}
                    </span>
                  </InfoTooltip>
                );
              })()}
              {assignment.managerName && (
                <InfoTooltip content={`Manager: ${assignment.managerName}`}>
                  <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                    <Briefcase className="w-2.5 h-2.5" />
                    <span className="truncate max-w-[40px]">{assignment.managerName.split(" ")[0]}</span>
                  </span>
                </InfoTooltip>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="pt-1.5 border-t border-border/20">
        <div className="flex items-center gap-1.5">
          <EnrichBadge icon={<Linkedin className="w-2.5 h-2.5" />} label="LinkedIn" done={hasLinkedin} />
          <EnrichBadge icon={<Globe className="w-2.5 h-2.5" />} label="Sito" done={hasWebsite} />
          <EnrichBadge icon={<Mail className="w-2.5 h-2.5" />} label="AI" done={hasAI} />
          {websiteDomain && (
            <InfoTooltip content={`Logo: ${websiteDomain}`}>
              <img
                src={`https://www.google.com/s2/favicons?domain=${websiteDomain}&sz=32`}
                alt="logo"
                className="w-4 h-4 rounded-sm"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </InfoTooltip>
          )}
        </div>
      </div>
    </>
  );
}
