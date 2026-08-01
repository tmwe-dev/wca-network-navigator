import { Ship, Plane, Truck, TrainFront, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const SERVICE_ICONS: Record<string, React.ElementType> = {
  air_freight: Plane,
  ocean_fcl: Ship,
  ocean_lcl: Ship,
  road_freight: Truck,
  rail_freight: TrainFront,
  project_cargo: Package,
};

interface Props {
  services: string[];
  visible: boolean;
}

export function CanvasServiceGrid({ services, visible }: Props) {
  if (services.length === 0) return null;
  return (
    <div className={cn("transition-all duration-500", visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4")}>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Servizi</h3>
      <div className="flex flex-wrap gap-1.5">
        {services.map((s) => {
          const Icon = SERVICE_ICONS[s] || Package;
          return (
            <span key={s} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border text-muted-foreground bg-muted border-border">
              <Icon className="w-3 h-3" />
              {s.replace(/_/g, " ")}
            </span>
          );
        })}
      </div>
    </div>
  );
}
