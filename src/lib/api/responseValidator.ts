/**
 * ResponseValidator — Lightweight runtime shape validation for AI responses.
 *
 * No Zod dependency. Validates required/optional fields and primitive types.
 * Throws ApiError(SCHEMA_MISMATCH) on failure.
 */
import { ApiError } from "@/lib/api/apiError";

export type FieldType = "string" | "number" | "boolean" | "object" | "array";

export interface ResponseSchema {
  required?: Record<string, FieldType>;
  optional?: Record<string, FieldType>;
}

function checkType(value: unknown, expected: FieldType): boolean {
  if (expected === "array") return Array.isArray(value);
  if (expected === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  return typeof value === expected;
}

/**
 * Validates `data` against `schema`. Returns `data` typed as T on success.
 * Throws ApiError with code SCHEMA_MISMATCH listing all violations.
 */
export function validateResponse<T = unknown>(data: unknown, schema: ResponseSchema): T {
  if (data === null || data === undefined || typeof data !== "object" || Array.isArray(data)) {
    throw new ApiError({
      code: "SCHEMA_MISMATCH",
      message: "La risposta AI non è un oggetto valido",
      details: { received: data === null ? "null" : typeof data },
    });
  }

  const obj = data as Record<string, unknown>;
  const errors: string[] = [];

  if (schema.required) {
    for (const [field, type] of Object.entries(schema.required)) {
      if (!(field in obj) || obj[field] === undefined) {
        errors.push(`campo obbligatorio mancante: "${field}" (atteso ${type})`);
      } else if (obj[field] !== null && !checkType(obj[field], type)) {
        errors.push(`"${field}": atteso ${type}, ricevuto ${typeof obj[field]}`);
      }
    }
  }

  if (schema.optional) {
    for (const [field, type] of Object.entries(schema.optional)) {
      if (field in obj && obj[field] !== undefined && obj[field] !== null && !checkType(obj[field], type)) {
        errors.push(`"${field}": atteso ${type}, ricevuto ${typeof obj[field]}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new ApiError({
      code: "SCHEMA_MISMATCH",
      message: `Risposta AI non conforme: ${errors.join("; ")}`,
      details: { violations: errors, receivedKeys: Object.keys(obj) },
    });
  }

  return data as T;
}

// ── Pre-built schemas for common AI responses ──

export const outreachSchema: ResponseSchema = {
  required: { channel: "string", body: "string", language: "string" },
  optional: { subject: "string", contact_name: "string", contact_email: "string", company_name: "string", _debug: "object" },
};

export const emailSchema: ResponseSchema = {
  required: { subject: "string", body: "string" },
  optional: { recipient: "string", cc: "string" },
};

export const assistantSchema: ResponseSchema = {
  required: { reply: "string" },
  optional: { tool_calls: "array", _debug: "object" },
};
