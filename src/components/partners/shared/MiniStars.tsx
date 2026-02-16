import { Star, StarHalf } from "lucide-react";

interface MiniStarsProps {
  rating: number;
  size?: string;
}

export function MiniStars({ rating, size = "w-3 h-3" }: MiniStarsProps) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        if (i + 1 <= Math.floor(rating)) return <Star key={i} className={`${size} fill-amber-400 text-amber-400`} />;
        if (i + 0.5 <= rating) return <StarHalf key={i} className={`${size} fill-amber-400 text-amber-400`} />;
        return <Star key={i} className={`${size} text-muted-foreground/30`} />;
      })}
    </div>
  );
}
