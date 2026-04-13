/**
 * Route prefetcher — preloads page chunks on hover for instant navigation.
 */
const routePrefetchMap: Record<string, () => Promise<unknown>> = {
  "/v2": () => import("@/v2/ui/pages/DashboardPage"),
  "/v2/network": () => import("@/v2/ui/pages/NetworkPage"),
  "/v2/crm": () => import("@/v2/ui/pages/CRMPage"),
  "/v2/contacts": () => import("@/v2/ui/pages/ContactsPage"),
  "/v2/outreach": () => import("@/v2/ui/pages/OutreachPage"),
  "/v2/agents": () => import("@/v2/ui/pages/AgentsPage"),
  "/v2/settings": () => import("@/v2/ui/pages/SettingsPage"),
  "/v2/email-intelligence": () => import("@/v2/ui/pages/EmailIntelligencePage"),
};

const prefetched = new Set<string>();

export function prefetchRoute(path: string): void {
  if (prefetched.has(path)) return;
  const prefetcher = routePrefetchMap[path];
  if (prefetcher) {
    prefetched.add(path);
    prefetcher().catch(() => {
      prefetched.delete(path);
    });
  }
}
