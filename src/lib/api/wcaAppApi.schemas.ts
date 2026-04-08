/**
 * wcaAppApi.schemas — Zod runtime schemas per i contratti API wca-app.vercel.app
 *
 * Vol. II cap. V "Contratti API" §5.3 — Validazione runtime dei payload remoti.
 *
 * Strategia strangler: gli schemi sono **best-effort** e non lanciano mai.
 * Se la validazione fallisce, viene loggato un warning strutturato e il
 * chiamante riceve `null`. Sta al chiamante decidere come degradare.
 *
 * Uso:
 *   const parsed = safeParseDiscover(rawJson);
 *   if (!parsed) handleError();
 */
import { z } from "zod";
import { createLogger } from "@/lib/log";

const log = createLogger("wcaAppApi.schemas");

// ─── Atomic schemas ──────────────────────────────────────────

export const WcaMemberSchema = z.object({
  id: z.number(),
  name: z.string(),
  href: z.string().optional(),
  company: z.string().optional(),
  networks: z.array(z.string()).optional(),
});

export const WcaContactSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  email: z.string().optional(),
  direct_line: z.string().optional(),
  fax: z.string().optional(),
  mobile: z.string().optional(),
  skype: z.string().optional(),
});

export const ScrapeProfileSchema = z
  .object({
    wca_id: z.number().optional(),
    state: z.string().optional(),
    company_name: z.string().optional(),
    logo_url: z.string().nullable().optional(),
    branch: z.string().optional(),
    networks: z.array(z.string()).optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    website: z.string().optional(),
    email: z.string().optional(),
    contacts: z.array(WcaContactSchema).optional(),
    country_code: z.string().optional(),
  })
  .passthrough(); // accetta campi extra dal backend senza rompere

// ─── Response schemas ────────────────────────────────────────

export const DiscoverResultSchema = z.object({
  success: z.boolean(),
  members: z.array(WcaMemberSchema),
  page: z.number(),
  hasNext: z.boolean(),
  totalResults: z.number().nullable(),
  isLoggedIn: z.boolean().optional(),
  error: z.string().optional(),
});

export const ScrapeResultSchema = z.object({
  success: z.boolean(),
  results: z.array(ScrapeProfileSchema).optional(),
  error: z.string().optional(),
});

export const CheckIdsResultSchema = z.object({
  success: z.boolean(),
  total_in_db: z.number(),
  checked: z.number(),
  found: z.number(),
  missing: z.array(z.number()),
  elapsed_ms: z.number(),
  error: z.string().optional(),
});

export const JobStartResultSchema = z.object({
  success: z.boolean(),
  action: z.enum(["paused", "resumed", "cancelled"]).optional(),
  jobId: z.string().optional(),
  status: z.string().optional(),
  error: z.string().optional(),
});

// ─── Safe parsers (best-effort, never throw) ─────────────────

function safeParse<T>(
  schema: z.ZodType<T>,
  data: unknown,
  context: string
): T | null {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  log.warn("schema validation failed", {
    context,
    issues: result.error.issues.slice(0, 3).map((i) => ({
      path: i.path.join("."),
      code: i.code,
      message: i.message,
    })),
  });
  return null;
}

export const safeParseDiscover = (data: unknown) =>
  safeParse(DiscoverResultSchema, data, "wcaDiscover");

export const safeParseScrape = (data: unknown) =>
  safeParse(ScrapeResultSchema, data, "wcaScrape");

export const safeParseCheckIds = (data: unknown) =>
  safeParse(CheckIdsResultSchema, data, "wcaCheckIds");

export const safeParseJobStart = (data: unknown) =>
  safeParse(JobStartResultSchema, data, "wcaJobStart");
