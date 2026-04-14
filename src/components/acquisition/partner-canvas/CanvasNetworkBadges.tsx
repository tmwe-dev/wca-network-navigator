import { Linkedin } from "lucide-react";
import { cn } from "@/lib/utils";
import { OptimizedImage } from "@/components/shared/OptimizedImage";

const NETWORK_LOGOS: Record<string, string> = {
  "wca inter global": "/logos/wca-inter-global.png",
  "wca china global": "/logos/wca-china-global.png",
  "wca first": "/logos/wca-first.png",
  "wca advanced professionals": "/logos/wca-advanced-professionals.png",
  "wca projects": "/logos/wca-projects.png",
  "wca dangerous goods": "/logos/wca-dangerous-goods.png",
  "wca perishables": "/logos/wca-perishables.png",
  "wca time critical": "/logos/wca-time-critical.png",
  "wca pharma": "/logos/wca-pharma.png",
  "wca ecommerce": "/logos/wca-ecommerce.png",
  "wca relocations": "/logos/wca-relocations.png",
  "wca expo": "/logos/wca-expo.png",
  "elite global logistics": "/logos/elite-global-logistics.png",
  "ifc (infinite connections)": "/logos/ifc-infinite-connection.png",
  "lognet global": "/logos/lognet-global.png",
  "gaa (global affinity alliance)": "/logos/gaa-global-affinity.png",
};

function getNetworkLogo(name: string): string | null {
  const key = name.toLowerCase().trim();
  if (NETWORK_LOGOS[key]) return NETWORK_LOGOS[key];
  for (const [k, v] of Object.entries(NETWORK_LOGOS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

interface Props {
  networks: string[];
  linkedinLinks: Array<{ name: string; url: string }>;
  showNetworks: boolean;
  showLinkedin: boolean;
}

export function CanvasNetworkBadges({ networks, linkedinLinks, showNetworks, showLinkedin }: Props) {
  return (
    <>
      {networks.length > 0 && (
        <div className={cn("transition-all duration-500", showNetworks ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4")}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Network WCA</h3>
          <div className="flex flex-wrap gap-2">
            {networks.map((net) => {
              const logo = getNetworkLogo(net);
              return (
                <div key={net} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-border text-xs">
                  {logo && <OptimizedImage src={logo} alt="" className="w-5 h-5 object-contain" />}
                  <span className="text-muted-foreground">{net}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {linkedinLinks.length > 0 && (
        <div className={cn("transition-all duration-500", showLinkedin ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4")}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">LinkedIn</h3>
          <div className="flex flex-wrap gap-2">
            {linkedinLinks.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                <Linkedin className="w-3 h-3" />
                {l.name}
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
