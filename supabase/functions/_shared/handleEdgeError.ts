import { corsHeaders } from "./cors.ts";

interface EdgeErrorResponse {
  error: string;
  code: string;
  details?: string;
}

type ErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

const STATUS_MAP: Record<ErrorCode, number> = {
  AUTH_REQUIRED: 401,
  AUTH_INVALID: 403,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  UPSTREAM_ERROR: 502,
  INTERNAL_ERROR: 500,
};

export function edgeError(
  code: ErrorCode,
  message: string,
  details?: string,
  customHeaders?: Record<string, string>,
): Response {
  const status = STATUS_MAP[code];
  const body: EdgeErrorResponse = { error: message, code };
  if (details) body.details = details;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(customHeaders || corsHeaders), "Content-Type": "application/json" },
  });
}

export function extractErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Unknown error";
}
