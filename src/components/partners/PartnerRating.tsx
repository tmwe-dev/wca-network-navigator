import { Star, StarHalf } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Legacy rating details (backward compatible)
interface RatingDetails {
  website_quality?: number;
  service_mix?: number;
  network_size?: number;
  seniority?: number;
  international?: number;
  linkedin_presence?: number;
  company_profile?: number;
}

// LOVABLE-93: New Partner Quality Score format
interface QualityDimensions {
  profilo_e_presenza: number;
  solidita_aziendale: number;
  servizi_e_capacita: number;
  intelligence: number;
}

interface NewRatingDetails extends RatingDetails {
  total_score?: number;
  star_rating?: number;
  dimensions?: QualityDimensions;
  data_completeness_percent?: number;
  calculated_at?: string;
}

interface PartnerRatingProps {
  rating: number | null;
  ratingDetails?: NewRatingDetails | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const CRITERIA_LABELS: Record<string, string> = {
  // Legacy labels
  website_quality: "Qualità Sito Web",
  service_mix: "Mix Servizi",
  network_size: "Dimensione Network",
  seniority: "Anzianità WCA",
  international: "Presenza Internazionale",
  linkedin_presence: "LinkedIn Manager",
  company_profile: "Profilo Aziendale",
  // LOVABLE-93: New quality dimensions (Italian)
  profilo_e_presenza: "Profilo e Presenza",
  solidita_aziendale: "Solidità Aziendale",
  servizi_e_capacita: "Servizi e Capacità",
  intelligence: "Intelligence",
};

// Star color mapping based on rating
function getStarColor(rating: number): string {
  if (rating >= 4.5) return "text-yellow-400 fill-yellow-400"; // Gold
  if (rating >= 4) return "text-green-500 fill-green-500"; // Green
  if (rating >= 3) return "text-yellow-500 fill-yellow-500"; // Yellow
  if (rating >= 2) return "text-orange-500 fill-orange-500"; // Orange
  return "text-red-500 fill-red-500"; // Red
}

function StarDisplay({ rating, size, colorClass }: { rating: number; size: "sm" | "md" | "lg"; colorClass?: string }) {
  const sizeClass = size === "sm" ? "w-3.5 h-3.5" : size === "md" ? "w-4 h-4" : "w-5 h-5";
  const color = colorClass || "text-primary fill-primary";
  const stars = [];

  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating)) {
      stars.push(<Star key={i} className={`${sizeClass} ${color}`} />);
    } else if (i - 0.5 <= rating) {
      stars.push(<StarHalf key={i} className={`${sizeClass} ${color}`} />);
    } else {
      stars.push(<Star key={i} className={`${sizeClass} text-muted-foreground/30`} />);
    }
  }

  return <div className="flex items-center gap-0.5">{stars}</div>;
}

function MiniBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${(value / 5) * 100}%` }}
        />
      </div>
      <span className="w-6 text-right font-medium">{value.toFixed(1)}</span>
    </div>
  );
}

// LOVABLE-93: Component for displaying 4 quality dimensions (0-100 scale)
function DimensionBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}/100</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function PartnerRating({ rating, ratingDetails, size = "md", showLabel = true }: PartnerRatingProps) {
  if (!rating) return null;

  // LOVABLE-93: Detect new quality score format vs legacy rating format
  const isNewFormat = ratingDetails && ratingDetails.dimensions && ratingDetails.total_score !== undefined;
  const colorClass = isNewFormat ? getStarColor(rating) : undefined;

  const content = (
    <div className="flex items-center gap-1.5">
      <StarDisplay rating={rating} size={size} colorClass={colorClass} />
      {showLabel && (
        <span className={`font-semibold ${size === "sm" ? "text-xs" : "text-sm"}`}>
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );

  if (!ratingDetails) return content;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">{content}</div>
        </TooltipTrigger>
        <TooltipContent className="w-72 p-4" side="bottom">
          {isNewFormat ? (
            // LOVABLE-93: New quality score format with 4 dimensions
            <div className="space-y-3">
              <div>
                <p className="font-semibold text-sm mb-1">Qualità Partner</p>
                <p className="text-xs text-muted-foreground">
                  {rating.toFixed(1)}★ (score: {ratingDetails.total_score}/100)
                </p>
              </div>
              <div className="space-y-2">
                <DimensionBar
                  label="Profilo e Presenza"
                  value={ratingDetails.dimensions!.profilo_e_presenza}
                />
                <DimensionBar
                  label="Solidità Aziendale"
                  value={ratingDetails.dimensions!.solidita_aziendale}
                />
                <DimensionBar
                  label="Servizi e Capacità"
                  value={ratingDetails.dimensions!.servizi_e_capacita}
                />
                <DimensionBar
                  label="Intelligence"
                  value={ratingDetails.dimensions!.intelligence}
                />
              </div>
              {ratingDetails.data_completeness_percent !== undefined && (
                <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
                  Dati: {ratingDetails.data_completeness_percent}% completi
                </div>
              )}
            </div>
          ) : (
            // Legacy rating format
            <div>
              <p className="font-semibold mb-2 text-sm">Valutazione Partner</p>
              <div className="space-y-1.5">
                {Object.entries(ratingDetails).map(([key, val]) => (
                  <MiniBar key={key} value={val as number} label={CRITERIA_LABELS[key] || key} />
                ))}
              </div>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
