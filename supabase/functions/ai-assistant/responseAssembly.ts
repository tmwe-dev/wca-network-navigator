/**
 * responseAssembly.ts
 * Formats and assembles the final response with structured data and UI actions.
 */

export interface ResponseData {
  type: string;
  data: Record<string, unknown>;
}

export interface FinalResponsePayload {
  content: string;
}

/**
 * Append structured data to response text
 */
export function appendStructuredData(
  text: string,
  lastPartnerResult?: Record<string, unknown>[],
  lastJobCreated?: Record<string, unknown>,
  uiActions?: Record<string, unknown>[]
): string {
  let out = text;

  if (lastPartnerResult && lastPartnerResult.length > 0) {
    out += `\n\n---STRUCTURED_DATA---\n${JSON.stringify({
      type: "partners",
      data: lastPartnerResult,
    })}`;
  }

  if (lastJobCreated) {
    out += `\n\n---JOB_CREATED---\n${JSON.stringify(lastJobCreated)}`;
  }

  if (uiActions && uiActions.length > 0) {
    out += `\n\n---UI_ACTIONS---\n${JSON.stringify(uiActions)}`;
  }

  return out;
}

/**
 * Format final response payload
 */
export function formatFinalResponse(content: string): FinalResponsePayload {
  return {
    content,
  };
}

/**
 * Format error response
 */
export function formatErrorResponse(
  error: string,
  code?: string
): FinalResponsePayload {
  return {
    content: JSON.stringify({
      ok: false,
      error,
      code,
    }),
  };
}
