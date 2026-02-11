import { useEffect, useRef, useState } from "react";
import { Archive } from "lucide-react";
import { cn } from "@/lib/utils";

interface AcquisitionBinProps {
  count: number;
  total: number;
  showComet: boolean;
}

export function AcquisitionBin({ count, total, showComet }: AcquisitionBinProps) {
  const [pulse, setPulse] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count > prevCount.current) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 600);
      prevCount.current = count;
      return () => clearTimeout(timer);
    }
  }, [count]);

  return (
    <div className="relative">
      {/* Comet animation */}
      {showComet && (
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 comet-particle" />
      )}

      <div
        className={cn(
          "flex items-center justify-center gap-3 px-6 py-3 rounded-xl border transition-all duration-300",
          "bg-card/80 backdrop-blur-sm",
          pulse
            ? "border-primary shadow-lg shadow-primary/20 scale-105"
            : "border-border"
        )}
      >
        <Archive className={cn(
          "w-5 h-5 transition-colors",
          pulse ? "text-primary" : "text-muted-foreground"
        )} />
        <div className="text-sm">
          <span className="font-bold text-foreground">{count}</span>
          <span className="text-muted-foreground"> / {total} partner acquisiti</span>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="w-32 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(count / total) * 100}%` }}
            />
          </div>
        )}
      </div>

      <style>{`
        @keyframes comet-fly {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(80px) scale(0.3);
            opacity: 0;
          }
        }
        .comet-particle {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: linear-gradient(135deg, hsl(199 89% 48%), hsl(38 92% 50%));
          box-shadow: 0 0 20px hsl(199 89% 48% / 0.6), 0 0 40px hsl(38 92% 50% / 0.3);
          animation: comet-fly 0.6s ease-in forwards;
        }
      `}</style>
    </div>
  );
}
