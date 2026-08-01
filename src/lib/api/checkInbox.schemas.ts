/**
 * checkInbox.schemas — Contratto runtime per la edge function `check-inbox`.
 *
 * Vol. II §5.3 — Validazione del payload remoto via zod (strangler).
 * `safeParseCheckInboxResult` non lancia mai: log warn + null su mismatch.
 */
import { z } from "zod";
import { createLogger } from "@/lib/log";

const log = createLogger("checkInbox.schemas");

export const CheckInboxMessageSchema = z
  .object({
    id: z.string().optional(),
    subject: z.string().optional(),
    from_address: z.string().optional(),
    from: z.string().optional(),
    email_date: z.string().optional(),
    date: z.string().optional(),
    body_html: z.string().nullable().optional(),
    body_text: z.string().nullable().optional(),
  })
  .passthrough();

export const CheckInboxResultSchema = z
  .object({
    total: z.number(),
    has_more: z.boolean().optional(),
    remaining: z.number().optional(),
    messages: z.array(CheckInboxMessageSchema).optional(),
  })
  .passthrough();

export type CheckInboxResult = z.infer<typeof CheckInboxResultSchema>;

export function safeParseCheckInboxResult(data: unknown): CheckInboxResult | null {
  const result = CheckInboxResultSchema.safeParse(data);
  if (result.success) return result.data;
  log.warn("schema validation failed", {
    context: "checkInbox",
    issues: result.error.issues.slice(0, 3).map((i) => ({
      path: i.path.join("."),
      code: i.code,
      message: i.message,
    })),
  });
  return null;
}
