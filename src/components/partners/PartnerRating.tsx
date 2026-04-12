import { Star, StarHalf } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RatingDetails {
  website_quality: number;
  service_mix: number;
  network_size: number;
  seniority: number;
  international: number;
  linkedin_presence: number;
  company_profile: number;
}

interface PartnerRatingProps {
  rating: number | null;
  ratingDetails?: RatingDetails | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const CRITERIA_LABELS: Record<string, string> = {
  website_quality: "Qualità Sito Web",
  service_mix: "Mix Servizi",
  network_size: "Dimensione Network",
  seniority: "Anzianità WCA",
  international: "Presenza Internazionale",
  linkedin_presence: "LinkedIn Manager",
  company_profile: "Profilo Aziendale",
};

function StarDisplay({ rating, size }: { rating: number; size: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "w-3.5 h-3.5" : size === "md" ? "w-4 h-4" : "w-5 h-5";
  const stars = [];

  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating)) {
      stars.push(<Star key={i} className={`${sizeClass} fill-primary text-primary`} />);
    } else if (i - 0.5 <= rating) {
      stars.push(<StarHalf key={i} className={`${sizeClass} fill-primary text-primary`} />);
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

export function PartnerRating({ rating, ratingDetails, size = "md", showLabel = true }: PartnerRatingProps) {
  if (!rating) return null;

  const content = (
    <div className="flex items-center gap-1.5">
      <StarDisplay rating={rating} size={size} />
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
        <TooltipContent className="w-64 p-3" side="bottom">
          <p className="font-semibold mb-2 text-sm">Valutazione Partner</p>
          <div className="space-y-1.5">
            {Object.entries(ratingDetails).map(([key, val]) => (
              <MiniBar key={key} value={val as number} label={CRITERIA_LABELS[key] || key} />
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
