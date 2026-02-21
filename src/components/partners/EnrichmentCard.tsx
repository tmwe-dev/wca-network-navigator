import { Sparkles, Award, Briefcase, Globe2, Users, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface EnrichmentCardProps {
  partner: {
    id: string;
    enriched_at?: string | null;
    enrichment_data?: any;
    ai_parsed_at?: string | null;
  };
}

const seniorityColors: Record<string, string> = {
  senior: "bg-amber-500/15 text-amber-600 border-amber-500/20",
  mid: "bg-sky-500/15 text-sky-600 border-sky-500/20",
  junior: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
};

export function EnrichmentCard({ partner }: EnrichmentCardProps) {
  const enrichment = partner.enrichment_data as any;
  if (!enrichment && !partner.enriched_at && !partner.ai_parsed_at) return null;

  const companyProfile = enrichment?.company_profile;
  const contactProfiles = enrichment?.contact_profiles;
  const deepSearchAt = enrichment?.deep_search_at;
  const hasCompanyData = companyProfile && (
    companyProfile.awards?.length > 0 ||
    companyProfile.specialties?.length > 0 ||
    companyProfile.recent_news ||
    companyProfile.founded_year ||
    companyProfile.employee_count_estimate
  );
  const hasContactData = contactProfiles && Object.keys(contactProfiles).length > 0;

  if (!hasCompanyData && !hasContactData && !partner.enriched_at && !partner.ai_parsed_at && !deepSearchAt) return null;

  return (
    <div className="bg-gradient-to-br from-violet-500/5 via-card to-purple-500/5 backdrop-blur-sm border border-violet-500/10 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-violet-400" />
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Enrichment</p>
        {deepSearchAt && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            Deep Search: {format(new Date(deepSearchAt), "dd MMM yyyy", { locale: it })}
          </span>
        )}
      </div>

      {/* Dates */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {partner.enriched_at && (
          <span>🌐 Website: {format(new Date(partner.enriched_at), "dd MMM yyyy", { locale: it })}</span>
        )}
        {partner.ai_parsed_at && (
          <span>🤖 AI: {format(new Date(partner.ai_parsed_at), "dd MMM yyyy", { locale: it })}</span>
        )}
      </div>

      {/* Company Profile */}
      {hasCompanyData && (
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center gap-2 cursor-pointer hover:bg-violet-500/5 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
              <Globe2 className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs font-medium text-foreground">Profilo Aziendale</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 mt-1.5 pl-1">
              {(companyProfile.founded_year || companyProfile.employee_count_estimate) && (
                <div className="flex flex-wrap gap-2">
                  {companyProfile.founded_year && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      Fondata: {companyProfile.founded_year}
                    </Badge>
                  )}
                  {companyProfile.employee_count_estimate && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      <Users className="w-2.5 h-2.5 mr-0.5" /> ~{companyProfile.employee_count_estimate}
                    </Badge>
                  )}
                </div>
              )}
              {companyProfile.specialties?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {companyProfile.specialties.map((s: string, i: number) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/15">
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {companyProfile.awards?.length > 0 && (
                <div className="space-y-1">
                  {companyProfile.awards.map((a: string, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Award className="w-3 h-3 text-amber-500" />
                      <span>{a}</span>
                    </div>
                  ))}
                </div>
              )}
              {companyProfile.recent_news && (
                <p className="text-xs text-muted-foreground leading-relaxed">{companyProfile.recent_news}</p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Contact Profiles */}
      {hasContactData && (
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center gap-2 cursor-pointer hover:bg-violet-500/5 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
              <Briefcase className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs font-medium text-foreground">
                Profili Contatti ({Object.keys(contactProfiles).length})
              </span>
              <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 mt-1.5">
              {Object.entries(contactProfiles).map(([id, profile]: [string, any]) => (
                <div key={id} className="bg-card/60 border border-violet-500/10 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-foreground">{profile.name}</span>
                    {profile.linkedin_title && (
                      <span className="text-[10px] text-muted-foreground">{profile.linkedin_title}</span>
                    )}
                    {profile.seniority && (
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded-full border font-medium uppercase",
                        seniorityColors[profile.seniority] || "bg-secondary text-secondary-foreground"
                      )}>
                        {profile.seniority}
                      </span>
                    )}
                  </div>
                  {profile.background && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{profile.background}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {profile.languages?.map((l: string, i: number) => (
                      <span key={i} className="text-[9px] px-1 py-0 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400">
                        {l}
                      </span>
                    ))}
                    {profile.interests?.map((int: string, i: number) => (
                      <span key={i} className="text-[9px] px-1 py-0 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        {int}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
