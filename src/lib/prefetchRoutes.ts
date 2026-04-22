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
  // CRM: V2 standalone (migrated from V1)
  "/v2/crm": [
    () => import("@/v2/ui/pages/CRMPage"),
  ],
  // Contacts hub (canonical /v2/crm/contacts, migrated from V1)
  "/v2/crm/contacts": [
    () => import("@/v2/ui/pages/ContactsPage"),
  ],
  // Outreach: V2 standalone (migrated from V1)
  "/v2/outreach": [
    () => import("@/v2/ui/pages/OutreachPage"),
  ],
  // Agents
  "/v2/agents": [
    () => import("@/v2/ui/pages/AgentsPage"),
    () => import("@/pages/AgentChatHub"),
  ],
  // Settings: V2 standalone (migrated from V1)
  "/v2/settings": [
    () => import("@/v2/ui/pages/SettingsPage"),
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
  // ⚡ Perf: only prefetch the single hottest route after the dashboard.
  // CRM/Outreach are 200-300kb chunks each — letting them prefetch by hover
  // (via prefetchRoute on link mouseenter) avoids burning bandwidth and
  // competing with the active Dashboard queries on first paint.
  const top = ["/v2/network"];
  const ric: typeof window.requestIdleCallback | undefined =
    typeof window !== "undefined" ? window.requestIdleCallback : undefined;
  const run = () => top.forEach((p) => prefetchRoute(p));
  if (ric) {
    ric(run, { timeout: 5000 });
  } else if (typeof window !== "undefined") {
    setTimeout(run, 2500);
  }
}
