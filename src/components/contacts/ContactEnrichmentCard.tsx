import { Sparkles, Award, Globe2, Users, Briefcase, ChevronDown, Coins, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ContactEnrichmentCardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enrichmentData: Record<string, unknown>;
  deepSearchAt: string | null;
}

const confidenceColors: Record<string, string> = {
  high: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  medium: "bg-primary/15 text-primary border-primary/20",
  low: "bg-destructive/15 text-destructive border-destructive/20",
};

const seniorityColors: Record<string, string> = {
  senior: "bg-primary/20 text-primary border-primary/30",
  mid: "bg-muted text-muted-foreground border-border",
  junior: "bg-emerald-500/20 text-emerald-200 border-emerald-500/30",
};

function SocialButton({ url, label, icon }: { url: string; label: string; icon: string }) {
  return (
    <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 border-primary/15 hover:bg-primary/10" asChild>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <span>{icon}</span> {label}
        <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-50" />
      </a>
    </Button>
  );
}

export function ContactEnrichmentCard({ enrichmentData, deepSearchAt }: ContactEnrichmentCardProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = enrichmentData as Record<string, unknown>;
  if (!e && !deepSearchAt) return null;

  const companyProfile = e?.company_profile;
  const contactProfile = e?.contact_profile;
  const tokensUsed = e?.tokens_used;
  const confidence = e?.confidence;
  const websiteQuality = e?.website_quality_score;

  const hasCompanyData = companyProfile && (
    companyProfile.awards?.length > 0 ||
    companyProfile.specialties?.length > 0 ||
    companyProfile.recent_news ||
    companyProfile.founded_year ||
    companyProfile.employee_count_estimate
  );

  const hasContactProfile = contactProfile && (
    contactProfile.background ||
    contactProfile.languages?.length > 0 ||
    contactProfile.interests?.length > 0 ||
    contactProfile.seniority
  );

  const socialLinks = [
    e?.linkedin_url && { url: e.linkedin_url, label: "LinkedIn", icon: "🔗" },
    e?.facebook_url && { url: e.facebook_url, label: "Facebook", icon: "📘" },
    e?.instagram_url && { url: e.instagram_url, label: "Instagram", icon: "📷" },
    e?.whatsapp_url && { url: e.whatsapp_url, label: "WhatsApp", icon: "💬" },
    e?.company_linkedin_url && { url: e.company_linkedin_url, label: "Company LI", icon: "🏢" },
    e?.company_website && { url: e.company_website, label: "Website", icon: "🌐" },
  ].filter(Boolean) as { url: string; label: string; icon: string }[];

  const hasSocialLinks = socialLinks.length > 0;

  if (!hasCompanyData && !hasContactProfile && !hasSocialLinks && !deepSearchAt) return null;

  return (
    <div className="bg-gradient-to-br from-primary/5 via-card to-primary/5 backdrop-blur-sm border border-primary/10 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Enrichment</p>
        {confidence && (
          <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 ml-1", confidenceColors[confidence])}>
            {confidence}
          </Badge>
        )}
        {deepSearchAt && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            {format(new Date(deepSearchAt), "dd MMM yyyy", { locale: it })}
          </span>
        )}
      </div>

      {/* Logo + Website quality */}
      {(e?.logo_url || websiteQuality) && (
        <div className="flex items-center gap-3">
          {e?.logo_url && (
            <img src={e.logo_url} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-background border border-border/50" />
          )}
          {websiteQuality && (
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={cn(
                  "w-2 h-2 rounded-full",
                  i < websiteQuality ? "bg-primary" : "bg-muted-foreground/20"
                )} />
              ))}
              <span className="text-[10px] text-muted-foreground ml-1">Sito web</span>
            </div>
          )}
        </div>
      )}

      {/* Social Links */}
      {hasSocialLinks && (
        <div className="flex flex-wrap gap-1.5">
          {socialLinks.map((link, i) => (
            <SocialButton key={i} {...link} />
          ))}
        </div>
      )}

      {/* Contact Profile */}
      {hasContactProfile && (
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center gap-2 cursor-pointer hover:bg-primary/5 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
              <Briefcase className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-foreground">Profilo Professionale</span>
              {contactProfile.seniority && (
                <span className={cn(
                  "text-[9px] px-1.5 py-0.5 rounded-full border font-medium uppercase ml-1",
                  seniorityColors[contactProfile.seniority] || "bg-secondary text-secondary-foreground"
                )}>
                  {contactProfile.seniority}
                </span>
              )}
              <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 mt-1.5 pl-1">
              {contactProfile.linkedin_title && (
                <p className="text-[11px] text-primary font-medium">{contactProfile.linkedin_title}</p>
              )}
              {contactProfile.background && (
                <p className="text-[11px] text-foreground leading-relaxed">{contactProfile.background}</p>
              )}
              <div className="flex flex-wrap gap-1">
                {contactProfile.languages?.map((l: string, i: number) => (
                  <span key={i} className="text-[9px] px-1 py-0 rounded bg-muted text-muted-foreground">{l}</span>
                ))}
                {contactProfile.interests?.map((int: string, i: number) => (
                  <span key={i} className="text-[9px] px-1 py-0 rounded bg-emerald-500/20 text-emerald-200">{int}</span>
                ))}
              </div>
              {contactProfile.other_companies?.length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Altre aziende: {contactProfile.other_companies.join(", ")}
                </p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Company Profile */}
      {hasCompanyData && (
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center gap-2 cursor-pointer hover:bg-primary/5 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
              <Globe2 className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-foreground">Profilo Aziendale</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 mt-1.5 pl-1">
              {(companyProfile.founded_year || companyProfile.employee_count_estimate) && (
                <div className="flex flex-wrap gap-2">
                  {companyProfile.founded_year && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-foreground font-medium">
                      Fondata: {companyProfile.founded_year}
                    </Badge>
                  )}
                  {companyProfile.employee_count_estimate && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-foreground font-medium">
                      <Users className="w-2.5 h-2.5 mr-0.5" /> ~{companyProfile.employee_count_estimate}
                    </Badge>
                  )}
                </div>
              )}
              {companyProfile.specialties?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {companyProfile.specialties.map((s: string, i: number) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/20 text-primary border border-primary/30">
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {companyProfile.awards?.length > 0 && (
                <div className="space-y-1">
                  {companyProfile.awards.map((a: any, i: number) => {
                    const label = typeof a === "string" ? a : (a?.name || JSON.stringify(a));
                    return (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-foreground">
                        <Award className="w-3 h-3 text-primary" />
                        <span>{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {companyProfile.recent_news && (
                <p className="text-xs text-foreground leading-relaxed">{companyProfile.recent_news}</p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Token consumption */}
      {tokensUsed && tokensUsed.credits_consumed > 0 && (
        <div className="flex items-center gap-2 pt-1 border-t border-primary/10">
          <Coins className={cn("w-3.5 h-3.5",
            tokensUsed.credits_consumed > 50 ? "text-destructive" :
            tokensUsed.credits_consumed > 20 ? "text-primary" : "text-emerald-500"
          )} />
          <span className="text-[10px] text-muted-foreground">
            {tokensUsed.credits_consumed} crediti AI
          </span>
          <span className="text-[9px] text-muted-foreground/60 ml-auto">
            {tokensUsed.prompt?.toLocaleString()}↑ {tokensUsed.completion?.toLocaleString()}↓
          </span>
        </div>
      )}
    </div>
  );
}
