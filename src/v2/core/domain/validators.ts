/**
 * Domain Validators — Vol. III §2 Perfection Matrix
 *
 * Pure functions, no IO. Testabili in isolamento.
 */
import { type Result, ok, err } from "./result";
import { domainError, type AppError } from "./errors";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;

/**
 * Validates email format.
 */
export function validateEmail(email: string): Result<string, AppError> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    return err(domainError("VALIDATION_FAILED", "Email is required", { field: "email" }));
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return err(domainError("VALIDATION_FAILED", `Invalid email format: ${trimmed}`, { field: "email", value: trimmed }));
  }
  return ok(trimmed);
}

/**
 * Validates ISO 3166-1 alpha-2 country code.
 */
export function validateCountryCode(code: string): Result<string, AppError> {
  const upper = code.trim().toUpperCase();
  if (!COUNTRY_CODE_REGEX.test(upper)) {
    return err(domainError("VALIDATION_FAILED", `Invalid country code: ${upper}`, { field: "countryCode", value: upper }));
  }
  return ok(upper);
}

/**
 * Validates company name is non-empty.
 */
export function validateCompanyName(name: string): Result<string, AppError> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2) {
    return err(domainError("VALIDATION_FAILED", "Company name must be at least 2 characters", { field: "companyName" }));
  }
  return ok(trimmed);
}

/**
 * Validates date range (start < end).
 */
export interface DateRange {
  readonly start: string;
  readonly end: string;
}

export function validateDateRange(
  start: string,
  end: string,
): Result<DateRange, AppError> {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (isNaN(startDate.getTime())) {
    return err(domainError("VALIDATION_FAILED", "Invalid start date", { field: "start", value: start }));
  }
  if (isNaN(endDate.getTime())) {
    return err(domainError("VALIDATION_FAILED", "Invalid end date", { field: "end", value: end }));
  }
  if (startDate >= endDate) {
    return err(domainError("BUSINESS_RULE_VIOLATED", "Start date must be before end date", {
      start, end,
    }));
  }
  return ok({ start, end });
}

/**
 * Validates partner creation data.
 */
export interface ValidPartnerInput {
  readonly companyName: string;
  readonly countryCode: string;
  readonly email: string | null;
}

export function validatePartnerInput(input: {
  companyName: string;
  countryCode: string;
  email?: string | null;
}): Result<ValidPartnerInput, AppError> {
  const nameResult = validateCompanyName(input.companyName);
  if (nameResult._tag === "Err") return nameResult;

  const codeResult = validateCountryCode(input.countryCode);
  if (codeResult._tag === "Err") return codeResult;

  let validEmail: string | null = null;
  if (input.email) {
    const emailResult = validateEmail(input.email);
    if (emailResult._tag === "Err") return emailResult;
    validEmail = emailResult.value;
  }

  return ok({
    companyName: nameResult.value,
    countryCode: codeResult.value,
    email: validEmail,
  });
}
