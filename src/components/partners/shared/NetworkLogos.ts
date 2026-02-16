export const NETWORK_LOGOS: Record<string, string> = {
  "wca expo": "/logos/wca-expo.png",
  "wca live events & expo": "/logos/wca-expo.png",
  "wca ecommerce": "/logos/wca-ecommerce.png",
  "wca ecommerce solutions": "/logos/wca-ecommerce.png",
  "wca pharma": "/logos/wca-pharma.png",
  "wca time critical": "/logos/wca-time-critical.png",
  "wca perishables": "/logos/wca-perishables.png",
  "wca relocations": "/logos/wca-relocations.png",
  "wca dangerous goods": "/logos/wca-dangerous-goods.png",
  "wca projects": "/logos/wca-projects.png",
  "wca inter global": "/logos/wca-inter-global.png",
  "wca interglobal": "/logos/wca-inter-global.png",
  "wca china global": "/logos/wca-china-global.png",
  "wca advanced professionals": "/logos/wca-advanced-professionals.png",
  "wca first": "/logos/wca-first.png",
  "global affinity alliance": "/logos/gaa-global-affinity.png",
  "gaa": "/logos/gaa-global-affinity.png",
  "lognet global": "/logos/lognet-global.png",
  "lognet": "/logos/lognet-global.png",
  "infinite connection": "/logos/ifc-infinite-connection.png",
  "ifc": "/logos/ifc-infinite-connection.png",
  "elite global logistics network": "/logos/elite-global-logistics.png",
  "egln": "/logos/elite-global-logistics.png",
};

export function getNetworkLogo(name: string): string | null {
  const key = name.toLowerCase().trim();
  if (NETWORK_LOGOS[key]) return NETWORK_LOGOS[key];
  for (const [k, v] of Object.entries(NETWORK_LOGOS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}
