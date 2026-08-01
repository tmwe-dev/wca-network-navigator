/**
 * Health Check Registry — Vol. II §12
 *
 * Registra check per servizi e li esegue tutti con checkAll().
 */

import { createLogger } from "./internal-logger";

const logger = createLogger("Health");

// ── Types ────────────────────────────────────────────────────────────

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface ServiceHealth {
  readonly name: string;
  readonly status: HealthStatus;
  readonly latencyMs: number;
  readonly message?: string;
  readonly checkedAt: string;
}

export interface HealthReport {
  readonly overallStatus: HealthStatus;
  readonly services: ReadonlyArray<ServiceHealth>;
  readonly checkedAt: string;
}

export type HealthCheckFn = () => Promise<ServiceHealth>;

// ── Registry ─────────────────────────────────────────────────────────

const checks = new Map<string, HealthCheckFn>();

export function registerHealthCheck(
  serviceName: string,
  checkFn: HealthCheckFn,
): void {
  checks.set(serviceName, checkFn);
  logger.debug("health check registered", { service: serviceName });
}

export function unregisterHealthCheck(serviceName: string): void {
  checks.delete(serviceName);
}

export async function checkAll(): Promise<HealthReport> {
  const services: ServiceHealth[] = [];

  for (const [name, checkFn] of checks) {
    try {
      const serviceHealth = await checkFn();
      services.push(serviceHealth);
    } catch (caught: unknown) {
      services.push({
        name,
        status: "unhealthy",
        latencyMs: -1,
        message: caught instanceof Error ? caught.message : String(caught),
        checkedAt: new Date().toISOString(),
      });
    }
  }

  const hasUnhealthy = services.some((s) => s.status === "unhealthy");
  const hasDegraded = services.some((s) => s.status === "degraded");

  const overallStatus: HealthStatus = hasUnhealthy
    ? "unhealthy"
    : hasDegraded
      ? "degraded"
      : "healthy";

  const report: HealthReport = {
    overallStatus,
    services,
    checkedAt: new Date().toISOString(),
  };

  logger.info("health check completed", {
    overall: overallStatus,
    serviceCount: services.length,
  });

  return report;
}

export function resetHealthChecks(): void {
  checks.clear();
}
