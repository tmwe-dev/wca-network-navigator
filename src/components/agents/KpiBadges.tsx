import { Calendar, Building2, Globe, Award, ShieldCheck } from "lucide-react";
import { getYearsMember } from "@/lib/countries";

interface KpiBadgesProps {
  partner: any;
  compact?: boolean;
}

function getBranchCount(partner: any): number {
  if (!partner.branch_cities) return 0;
  const branches = Array.isArray(partner.branch_cities) ? partner.branch_cities : [];
  return branches.length;
}

function getUniqueCountries(partner: any): number {
  if (!partner.branch_cities) return 1;
  const branches = Array.isArray(partner.branch_cities) ? partner.branch_cities : [];
  const countries = new Set<string>();
  countries.add(partner.country_code);
  branches.forEach((b: any) => {
    if (b?.country_code) countries.add(b.country_code);
    if (b?.country) countries.add(b.country);
  });
  return countries.size;
}

function hasGoldMedallion(partner: any): boolean {
  return partner.partner_networks?.some(
    (n: any) => n.network_name?.toLowerCase().includes("gold") || n.network_name?.toLowerCase().includes("medallion")
  ) ?? false;
}

export function KpiBadges({ partner, compact = false }: KpiBadgesProps) {
  const years = getYearsMember(partner.member_since);
  const branches = getBranchCount(partner);
  const countries = getUniqueCountries(partner);
  const certCount = partner.partner_certifications?.length || 0;
  const gold = hasGoldMedallion(partner);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        {years > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
            <Calendar className="w-2.5 h-2.5" />
            {years}a
          </span>
        )}
        {branches > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
            <Building2 className="w-2.5 h-2.5" />
            {branches}
          </span>
        )}
        {gold && (
          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
            <Award className="w-2.5 h-2.5" />
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {years > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <Calendar className="w-4 h-4 text-primary" />
          <div>
            <p className="text-lg font-semibold text-primary leading-none">{years}</p>
            <p className="text-[10px] text-muted-foreground">Anni WCA</p>
          </div>
        </div>
      )}
      {branches > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <Building2 className="w-4 h-4 text-primary" />
          <div>
            <p className="text-lg font-semibold text-primary leading-none">{branches}</p>
            <p className="text-[10px] text-muted-foreground">Filiali</p>
          </div>
        </div>
      )}
      {countries > 1 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <Globe className="w-4 h-4 text-primary" />
          <div>
            <p className="text-lg font-semibold text-primary leading-none">{countries}</p>
            <p className="text-[10px] text-muted-foreground">Paesi</p>
          </div>
        </div>
      )}
      {certCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <div>
            <p className="text-lg font-semibold text-primary leading-none">{certCount}</p>
            <p className="text-[10px] text-muted-foreground">Cert.</p>
          </div>
        </div>
      )}
      {gold && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <Award className="w-4 h-4 text-primary" />
          <div>
            <p className="text-sm font-semibold text-primary leading-none">🏅</p>
            <p className="text-[10px] text-muted-foreground">Gold</p>
          </div>
        </div>
      )}
    </div>
  );
}
