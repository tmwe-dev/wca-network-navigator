/**
 * WCA API Client v2 — Result-based wrapper
 *
 * All WCA API calls go through wca-app.vercel.app.
 * This wraps them in Result<T> with proper error handling.
 */
import { type Result } from "../../core/domain/result";
import { type AppError } from "../../core/domain/errors";
import { withCircuitBreaker } from "../../bridge/circuit-breaker";

const WCA_APP_BASE_URL = "https://wca-app.vercel.app";

interface WcaRequestOptions {
  readonly endpoint: string;
  readonly body?: Record<string, unknown>;
  readonly timeoutMs?: number;
}

async function wcaFetch<T>(
  options: WcaRequestOptions,
): Promise<Result<T, AppError>> {
  return withCircuitBreaker(
    `wca:${options.endpoint}`,
    async () => {
      const controller = new AbortController();
      const timeout = options.timeoutMs ?? 30_000;
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(`${WCA_APP_BASE_URL}${options.endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options.body ?? {}),
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          throw new Error(`WCA API ${options.endpoint}: HTTP ${response.status} — ${errorText}`);
        }

        const responseData = await response.json();
        return responseData as T;
      } finally {
        clearTimeout(timer);
      }
    },
  );
}

export async function wcaLogin(): Promise<Result<{ success: boolean }, AppError>> {
  return wcaFetch({ endpoint: "/api/login" });
}

export interface WcaDiscoverResult {
  readonly members: ReadonlyArray<{ wca_id: number; company_name: string }>;
  readonly total: number;
}

export async function wcaDiscover(
  countryCode: string,
  networkName: string,
): Promise<Result<WcaDiscoverResult, AppError>> {
  return wcaFetch({
    endpoint: "/api/discover",
    body: { country_code: countryCode, network_name: networkName },
    timeoutMs: 60_000,
  });
}

export async function wcaScrape(
  wcaIds: number[],
  networkName: string,
): Promise<Result<unknown, AppError>> {
  return wcaFetch({
    endpoint: "/api/scrape",
    body: { wca_ids: wcaIds, network_name: networkName },
    timeoutMs: 120_000,
  });
}

export async function wcaEnrich(
  partnerId: string,
  networks: string[],
): Promise<Result<unknown, AppError>> {
  return wcaFetch({
    endpoint: "/api/enrich",
    body: { partner_id: partnerId, networks },
    timeoutMs: 60_000,
  });
}
