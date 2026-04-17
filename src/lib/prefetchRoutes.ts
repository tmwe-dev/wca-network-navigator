/**
 * Route prefetcher — preloads page chunks (incl. real V1 content) on hover.
 * Each entry returns ALL chunks needed to display the route, so when the user
 * actually clicks no further network round-trips are required.
 */
type Loader = () => Promise<unknown>;

const routePrefetchMap: Record<string, readonly Loader[]> = {
  // Dashboard: V2 wrapper + V1 SuperHome3D
  "/v2": [
    () => import("@/v2/ui/pages/DashboardPage"),
    () => import("@/pages/SuperHome3D"),
  ],
  // Network: V2 + V1 Operations (now imported directly)
  "/v2/network": [
    () => import("@/v2/ui/pages/NetworkPage"),
    () => import("@/pages/Operations"),
  ],
  // CRM: V2 + V1 CRM
  "/v2/crm": [
    () => import("@/v2/ui/pages/CRMPage"),
    () => import("@/pages/CRM"),
  ],
  // Contacts hub
  "/v2/contacts": [
    () => import("@/v2/ui/pages/ContactsPage"),
    () => import("@/pages/Contacts"),
  ],
  // Outreach: V2 + V1
  "/v2/outreach": [
    () => import("@/v2/ui/pages/OutreachPage"),
    () => import("@/pages/Outreach"),
  ],
  // Agents
  "/v2/agents": [
    () => import("@/v2/ui/pages/AgentsPage"),
    () => import("@/pages/AgentChatHub"),
  ],
  // Settings
  "/v2/settings": [
    () => import("@/v2/ui/pages/SettingsPage"),
    () => import("@/pages/Settings"),
  ],
  // Email Intelligence (no V1 wrapper)
  "/v2/email-intelligence": [
    () => import("@/v2/ui/pages/EmailIntelligencePage"),
  ],
};

const prefetched = new Set<string>();

export function prefetchRoute(path: string): void {
  if (prefetched.has(path)) return;
  const loaders = routePrefetchMap[path];
  if (!loaders) return;
  prefetched.add(path);
  // Fire all loaders in parallel; failures don't poison subsequent attempts.
  Promise.all(loaders.map((l) => l().catch(() => null))).catch(() => {
    prefetched.delete(path);
  });
}

/**
 * Schedule auto-prefetch of the most-used routes during idle time.
 * Call once after first paint — not blocking TTI.
 */
export function scheduleIdlePrefetch(): void {
  const top = ["/v2", "/v2/network", "/v2/crm", "/v2/outreach"];
  const ric: typeof window.requestIdleCallback | undefined =
    typeof window !== "undefined" ? window.requestIdleCallback : undefined;
  const run = () => top.forEach((p) => prefetchRoute(p));
  if (ric) {
    ric(run, { timeout: 3000 });
  } else if (typeof window !== "undefined") {
    setTimeout(run, 1500);
  }
}
