import { Trophy } from "lucide-react";

interface TrophyRowProps {
  years: number;
}

export function TrophyRow({ years }: TrophyRowProps) {
  if (years <= 0) return null;
  return (
    <div className="flex items-center gap-1">
      <Trophy className="w-4 h-4 text-amber-500 fill-amber-500" />
      <span className="text-sm font-bold text-amber-500">{years}</span>
      <span className="text-[10px] text-muted-foreground">yrs</span>
    </div>
  );
}
