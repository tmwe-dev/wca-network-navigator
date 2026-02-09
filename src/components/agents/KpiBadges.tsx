import { Calendar, Building2, Globe, Award, ShieldCheck } from "lucide-react";
import { getYearsMember } from "@/lib/countries";
import { cn } from "@/lib/utils";

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
          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium">
            <Calendar className="w-2.5 h-2.5" />
            {years}a
          </span>
        )}
        {branches > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-medium">
            <Building2 className="w-2.5 h-2.5" />
            {branches}
          </span>
        )}
        {gold && (
          <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-medium">
            🏅
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {years > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-300 leading-none">{years}</p>
            <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70">Anni WCA</p>
          </div>
        </div>
      )}
      {branches > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
          <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 leading-none">{branches}</p>
            <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">Filiali</p>
          </div>
        </div>
      )}
      {countries > 1 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
          <Globe className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <div>
            <p className="text-lg font-bold text-violet-700 dark:text-violet-300 leading-none">{countries}</p>
            <p className="text-[10px] text-violet-600/70 dark:text-violet-400/70">Paesi</p>
          </div>
        </div>
      )}
      {certCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
          <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <div>
            <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300 leading-none">{certCount}</p>
            <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70">Cert.</p>
          </div>
        </div>
      )}
      {gold && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-bold text-amber-700 dark:text-amber-300 leading-none">🏅</p>
            <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70">Gold</p>
          </div>
        </div>
      )}
    </div>
  );
}
