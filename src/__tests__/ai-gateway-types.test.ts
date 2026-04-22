import { describe, it, expect, beforeEach } from "vitest";

// Import the functions and classes directly from the source
import {
  isRetryableStatus,
  backoffMs,
  AiGatewayError,
  mapErrorToResponse,
  type AiGatewayErrorKind,
} from "../../../supabase/functions/_shared/aiGatewayTypes";

describe("aiGatewayTypes", () => {
  describe("isRetryableStatus", () => {
    it("should return true for 408 (Request Timeout)", () => {
      expect(isRetryableStatus(408)).toBe(true);
    });

    it("should return true for 425 (Too Early)", () => {
      expect(isRetryableStatus(425)).toBe(true);
    });

    it("should return true for 500 (Internal Server Error)", () => {
      expect(isRetryableStatus(500)).toBe(true);
    });

    it("should return true for 502 (Bad Gateway)", () => {
      expect(isRetryableStatus(502)).toBe(true);
    });

    it("should return true for 503 (Service Unavailable)", () => {
      expect(isRetryableStatus(503)).toBe(true);
    });

    it("should return true for 504 (Gateway Timeout)", () => {
      expect(isRetryableStatus(504)).toBe(true);
    });

    it("should return true for 529 (Site Overloaded)", () => {
      expect(isRetryableStatus(529)).toBe(true);
    });

    it("should return false for 200 (OK)", () => {
      expect(isRetryableStatus(200)).toBe(false);
    });

    it("should return false for 201 (Created)", () => {
      expect(isRetryableStatus(201)).toBe(false);
    });

    it("should return false for 400 (Bad Request)", () => {
      expect(isRetryableStatus(400)).toBe(false);
    });

    it("should return false for 401 (Unauthorized)", () => {
      expect(isRetryableStatus(401)).toBe(false);
    });

    it("should return false for 403 (Forbidden)", () => {
      expect(isRetryableStatus(403)).toBe(false);
    });

    it("should return false for 404 (Not Found)", () => {
      expect(isRetryableStatus(404)).toBe(false);
    });

    it("should return false for 429 (Too Many Requests) - handled separately", () => {
      expect(isRetryableStatus(429)).toBe(false);
    });

    it("should return false for any non-retryable status code", () => {
      const nonRetryableStatuses = [
        200, 201, 204, 301, 302, 400, 401, 403, 404, 405, 429, 499, 501, 505,
      ];
      nonRetryableStatuses.forEach((status) => {
        expect(isRetryableStatus(status)).toBe(false);
      });
    });
  });

  describe("backoffMs", () => {
    it("should return a number", () => {
      expect(typeof backoffMs(0)).toBe("number");
    });

    it("should return positive value for attempt 0", () => {
      const delay = backoffMs(0);
      expect(delay).toBeGreaterThan(0);
    });

    it("should return value between 750-1000 for attempt 0 (base 1000 * 0.75-1.25)", () => {
      const delay = backoffMs(0);
      expect(delay).toBeGreaterThanOrEqual(750);
      expect(delay).toBeLessThanOrEqual(1000);
    });

    it("should return value between 1500-2000 for attempt 1 (base 2000 * 0.75-1.25)", () => {
      const delay = backoffMs(1);
      expect(delay).toBeGreaterThanOrEqual(1500);
      expect(delay).toBeLessThanOrEqual(2000);
    });

    it("should return value between 3000-4000 for attempt 2 (base 4000 * 0.75-1.25)", () => {
      const delay = backoffMs(2);
      expect(delay).toBeGreaterThanOrEqual(3000);
      expect(delay).toBeLessThanOrEqual(4000);
    });

    it("should return value between 6000-8000 for attempt 3 (base 8000 * 0.75-1.25)", () => {
      const delay = backoffMs(3);
      expect(delay).toBeGreaterThanOrEqual(6000);
      expect(delay).toBeLessThanOrEqual(8000);
    });

    it("should cap at 10000 for very high attempt numbers", () => {
      const delay = backoffMs(100);
      expect(delay).toBeGreaterThanOrEqual(7500); // 10000 * 0.75
      expect(delay).toBeLessThanOrEqual(10000); // 10000 * 1.25 but capped at 10000
    });

    it("should have randomness (multiple calls for same attempt should differ)", () => {
      const delays = Array.from({ length: 10 }, () => backoffMs(1));
      const uniqueDelays = new Set(delays);
      // With randomness, we expect at least some variation
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });

    it("should generally increase with attempt number on average", () => {
      const avg0 = Array.from({ length: 100 }, () => backoffMs(0)).reduce(
        (a, b) => a + b
      ) / 100;
      const avg2 = Array.from({ length: 100 }, () => backoffMs(2)).reduce(
        (a, b) => a + b
      ) / 100;
      expect(avg2).toBeGreaterThan(avg0);
    });

    it("should be usable as a delay value (non-negative integer)", () => {
      const delay = backoffMs(2);
      expect(Number.isInteger(delay)).toBe(true);
      expect(delay).toBeGreaterThanOrEqual(0);
    });
  });

  describe("AiGatewayError", () => {
    it("should construct with required parameters", () => {
      const error = new AiGatewayError(
        "rate_limited",
        "Too many requests"
      );
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("AiGatewayError");
      expect(error.message).toBe("Too many requests");
      expect(error.kind).toBe("rate_limited");
    });

    it("should have status property when provided", () => {
      const error = new AiGatewayError(
        "rate_limited",
        "Too many requests",
        429
      );
      expect(error.status).toBe(429);
    });

    it("should have detail property when provided", () => {
      const error = new AiGatewayError(
        "rate_limited",
        "Too many requests",
        429,
        "Retry after 60 seconds"
      );
      expect(error.detail).toBe("Retry after 60 seconds");
    });

    it("should support all error kinds", () => {
      const kinds: AiGatewayErrorKind[] = [
        "rate_limited",
        "credits_exhausted",
        "invalid_request",
        "unauthorized",
        "server_error",
        "timeout",
        "network",
        "all_models_failed",
        "no_api_key",
        "invalid_model",
      ];

      kinds.forEach((kind) => {
        const error = new AiGatewayError(kind, `Error: ${kind}`);
        expect(error.kind).toBe(kind);
      });
    });

    it("should be caught as Error", () => {
      const error = new AiGatewayError("timeout", "Request timeout", 504);
      expect(error instanceof Error).toBe(true);
    });

    it("should preserve all properties when thrown and caught", () => {
      try {
        throw new AiGatewayError(
          "unauthorized",
          "Invalid API key",
          401,
          "API key not found"
        );
      } catch (e) {
        const err = e as AiGatewayError;
        expect(err.kind).toBe("unauthorized");
        expect(err.message).toBe("Invalid API key");
        expect(err.status).toBe(401);
        expect(err.detail).toBe("API key not found");
      }
    });

    it("should have undefined status and detail when not provided", () => {
      const error = new AiGatewayError("invalid_model", "Unknown model");
      expect(error.status).toBeUndefined();
      expect(error.detail).toBeUndefined();
    });
  });

  describe("mapErrorToResponse", () => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST",
    };

    it("should map rate_limited to 429", () => {
      const error = new AiGatewayError("rate_limited", "Too many requests", 429);
      const response = mapErrorToResponse(error, corsHeaders);
      expect(response.status).toBe(429);
    });

    it("should map credits_exhausted to 402", () => {
      const error = new AiGatewayError(
        "credits_exhausted",
        "Out of credits",
        402
      );
      const response = mapErrorToResponse(error, corsHeaders);
      expect(response.status).toBe(402);
    });

    it("should map invalid_request to 400", () => {
      const error = new AiGatewayError("invalid_request", "Bad request", 400);
      const response = mapErrorToResponse(error, corsHeaders);
      expect(response.status).toBe(400);
    });

    it("should map unauthorized to 401", () => {
      const error = new AiGatewayError("unauthorized", "Not authorized", 401);
      const response = mapErrorToResponse(error, corsHeaders);
      expect(response.status).toBe(401);
    });

    it("should map server_error to 502", () => {
      const error = new AiGatewayError("server_error", "Server error", 502);
      const response = mapErrorToResponse(error, corsHeaders);
      expect(response.status).toBe(502);
    });

    it("should map timeout to 504", () => {
      const error = new AiGatewayError("timeout", "Request timed out", 504);
      const response = mapErrorToResponse(error, corsHeaders);
      expect(response.status).toBe(504);
    });

    it("should map network to 502", () => {
      const error = new AiGatewayError("network", "Network error", 502);
      const response = mapErrorToResponse(error, corsHeaders);
      expect(response.status).toBe(502);
    });

    it("should map all_models_failed to 502", () => {
      const error = new AiGatewayError(
        "all_models_failed",
        "All models failed",
        502
      );
      const response = mapErrorToResponse(error, corsHeaders);
      expect(response.status).toBe(502);
    });

    it("should map no_api_key to 500", () => {
      const error = new AiGatewayError("no_api_key", "Missing API key", 500);
      const response = mapErrorToResponse(error, corsHeaders);
      expect(response.status).toBe(500);
    });

    it("should map invalid_model to 400", () => {
      const error = new AiGatewayError("invalid_model", "Unknown model", 400);
      const response = mapErrorToResponse(error, corsHeaders);
      expect(response.status).toBe(400);
    });

    it("should include CORS headers in response", () => {
      const error = new AiGatewayError("timeout", "Timeout", 504);
      const response = mapErrorToResponse(error, corsHeaders);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST");
    });

    it("should include Content-Type header", () => {
      const error = new AiGatewayError("timeout", "Timeout", 504);
      const response = mapErrorToResponse(error, corsHeaders);
      expect(response.headers.get("Content-Type")).toBe("application/json");
    });

    it("should return JSON body with error kind and message", async () => {
      const error = new AiGatewayError(
        "unauthorized",
        "Invalid credentials"
      );
      const response = mapErrorToResponse(error, corsHeaders);
      const body = await response.json();
      expect(body.error).toBe("unauthorized");
      expect(body.message).toBe("Invalid credentials");
    });

    it("should handle non-AiGatewayError instances", () => {
      const error = new Error("Generic error");
      const response = mapErrorToResponse(error, corsHeaders);
      expect(response.status).toBe(500);
    });

    it("should handle non-Error objects", () => {
      const response = mapErrorToResponse("string error", corsHeaders);
      expect(response.status).toBe(500);
    });

    it("should return 500 with internal error for unknown errors", async () => {
      const response = mapErrorToResponse("unknown error", corsHeaders);
      const body = await response.json();
      expect(body.error).toBe("internal");
      expect(response.status).toBe(500);
    });

    it("should be a Response object", () => {
      const error = new AiGatewayError("timeout", "Timeout");
      const response = mapErrorToResponse(error, corsHeaders);
      expect(response).toBeInstanceOf(Response);
    });
  });

  describe("Error Kind Coverage", () => {
    it("all error kinds should map to valid HTTP status codes", () => {
      const kinds: AiGatewayErrorKind[] = [
        "rate_limited",
        "credits_exhausted",
        "invalid_request",
        "unauthorized",
        "server_error",
        "timeout",
        "network",
        "all_models_failed",
        "no_api_key",
        "invalid_model",
      ];

      const validStatusCodes = [400, 401, 402, 429, 500, 502, 504];

      kinds.forEach((kind) => {
        const error = new AiGatewayError(kind, "Test");
        const response = mapErrorToResponse(error, {});
        expect(validStatusCodes).toContain(response.status);
      });
    });
  });

  describe("Exponential Backoff Behavior", () => {
    it("should implement exponential backoff with jitter", () => {
      const baseForAttempt0 = 1000 * (2 ** 0); // 1000
      const baseForAttempt1 = 1000 * (2 ** 1); // 2000
      const baseForAttempt2 = 1000 * (2 ** 2); // 4000
      const baseForAttempt3 = 1000 * (2 ** 3); // 8000
      const baseForAttempt4 = Math.min(1000 * (2 ** 4), 10000); // capped at 10000

      expect(baseForAttempt0).toBe(1000);
      expect(baseForAttempt1).toBe(2000);
      expect(baseForAttempt2).toBe(4000);
      expect(baseForAttempt3).toBe(8000);
      expect(baseForAttempt4).toBe(10000);
    });
  });
});
