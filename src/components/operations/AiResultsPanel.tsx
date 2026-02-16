import { useState, useContext } from "react";
import { ChevronDown, ChevronUp, Star, Heart, Globe, Mail, Phone, ExternalLink, Building2, MapPin } from "lucide-react";
import { ThemeCtx, t } from "@/components/download/theme";
import { Badge } from "@/components/ui/badge";

export interface StructuredPartner {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  country_name: string;
  email?: string | null;
  phone?: string | null;
  rating?: number | null;
  has_profile?: boolean;
  is_favorite?: boolean;
  office_type?: string;
  website?: string | null;
  wca_id?: number;
  services?: string[];
  certifications?: string[];
}

interface Props {
  partners: StructuredPartner[];
}

const SERVICE_LABELS: Record<string, string> = {
  air_freight: "Aereo",
  ocean_fcl: "FCL",
  ocean_lcl: "LCL",
  road_freight: "Strada",
  rail_freight: "Ferrovia",
  project_cargo: "Progetti",
  dangerous_goods: "DG",
  perishables: "Deperibili",
  pharma: "Pharma",
  ecommerce: "eComm",
  relocations: "Traslochi",
  customs_broker: "Dogana",
  warehousing: "Magazzino",
  nvocc: "NVOCC",
};

function RatingStars({ rating }: { rating: number | null | undefined }) {
  if (rating == null) return <span className="text-[9px] opacity-40">N/A</span>;
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-2.5 h-2.5 ${
            i < full
              ? "fill-amber-400 text-amber-400"
              : i === full && half
              ? "fill-amber-400/50 text-amber-400"
              : "text-slate-300 dark:text-slate-600"
          }`}
        />
      ))}
      <span className="text-[9px] ml-0.5 opacity-60">{rating.toFixed(1)}</span>
    </span>
  );
}

function PartnerCard({ partner, isDark }: { partner: StructuredPartner; isDark: boolean }) {
  const [expanded, setExpanded] = useState(false);

  const flagUrl = `https://flagcdn.com/16x12/${partner.country_code?.toLowerCase()}.png`;

  return (
    <div
      className={`rounded-lg border transition-all cursor-pointer ${
        isDark
          ? "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
          : "border-slate-200 bg-white hover:bg-slate-50"
      } ${expanded ? (isDark ? "ring-1 ring-violet-500/30" : "ring-1 ring-violet-300") : ""}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="px-2.5 py-2 flex items-start gap-2">
        <img src={flagUrl} alt={partner.country_code} className="w-4 h-3 mt-0.5 rounded-[1px] object-cover" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className={`text-[11px] font-semibold truncate ${isDark ? "text-white" : "text-slate-900"}`}>
              {partner.company_name}
            </span>
            {partner.is_favorite && <Heart className="w-2.5 h-2.5 fill-rose-500 text-rose-500 shrink-0" />}
          </div>
          <div className={`flex items-center gap-1.5 text-[9px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            <MapPin className="w-2.5 h-2.5" />
            <span>{partner.city}, {partner.country_name}</span>
            {partner.office_type === "branch" && (
              <span className={`px-1 rounded text-[8px] ${isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-50 text-blue-600"}`}>filiale</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <RatingStars rating={partner.rating} />
            {partner.email && <Mail className={`w-2.5 h-2.5 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />}
            {partner.has_profile && <Globe className={`w-2.5 h-2.5 ${isDark ? "text-violet-400" : "text-violet-500"}`} />}
          </div>
        </div>
        <ChevronDown className={`w-3 h-3 shrink-0 mt-1 transition-transform ${isDark ? "text-slate-500" : "text-slate-400"} ${expanded ? "rotate-180" : ""}`} />
      </div>

      {expanded && (
        <div className={`px-2.5 pb-2.5 pt-1 border-t ${isDark ? "border-white/5" : "border-slate-100"}`}>
          <div className={`space-y-1 text-[10px] ${isDark ? "text-slate-300" : "text-slate-600"}`}>
            {partner.email && (
              <div className="flex items-center gap-1.5">
                <Mail className="w-3 h-3" />
                <a href={`mailto:${partner.email}`} className="hover:underline truncate" onClick={e => e.stopPropagation()}>
                  {partner.email}
                </a>
              </div>
            )}
            {partner.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-3 h-3" />
                <span>{partner.phone}</span>
              </div>
            )}
            {partner.website && (
              <div className="flex items-center gap-1.5">
                <ExternalLink className="w-3 h-3" />
                <a
                  href={partner.website.startsWith("http") ? partner.website : `https://${partner.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline truncate"
                  onClick={e => e.stopPropagation()}
                >
                  {partner.website}
                </a>
              </div>
            )}
            {partner.wca_id && (
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3 h-3" />
                <span>WCA ID: {partner.wca_id}</span>
              </div>
            )}
          </div>

          {(partner.services?.length || partner.certifications?.length) ? (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {partner.certifications?.map(c => (
                <Badge key={c} variant="outline" className={`text-[8px] px-1 py-0 h-3.5 ${isDark ? "border-amber-500/30 text-amber-300" : "border-amber-300 text-amber-700"}`}>
                  {c}
                </Badge>
              ))}
              {partner.services?.slice(0, 5).map(s => (
                <Badge key={s} variant="secondary" className={`text-[8px] px-1 py-0 h-3.5 ${isDark ? "bg-white/5 text-slate-400" : ""}`}>
                  {SERVICE_LABELS[s] || s}
                </Badge>
              ))}
              {(partner.services?.length || 0) > 5 && (
                <span className={`text-[8px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>+{(partner.services?.length || 0) - 5}</span>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function AiResultsPanel({ partners }: Props) {
  const isDark = useContext(ThemeCtx);
  const [collapsed, setCollapsed] = useState(false);

  if (!partners.length) return null;

  return (
    <div className={`mt-2 rounded-xl border ${isDark ? "border-white/10 bg-white/[0.02]" : "border-slate-200 bg-slate-50/50"}`}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-medium ${
          isDark ? "text-violet-300 hover:bg-white/5" : "text-violet-700 hover:bg-slate-100"
        } rounded-t-xl transition-colors`}
      >
        <span>{partners.length} partner trovati</span>
        {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </button>

      {!collapsed && (
        <div className="px-2 pb-2 space-y-1.5 max-h-[300px] overflow-auto">
          {partners.map(p => (
            <PartnerCard key={p.id} partner={p} isDark={isDark} />
          ))}
        </div>
      )}
    </div>
  );
}
