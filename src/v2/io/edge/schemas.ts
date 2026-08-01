/**
 * Zod schemas for edge function responses
 */
import { z } from "zod";

export const AiChatResponseSchema = z.object({
  reply: z.string(),
  tokens_used: z.number().optional(),
  model: z.string().optional(),
});

export type AiChatResponse = z.infer<typeof AiChatResponseSchema>;

export const GenericSuccessSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export type GenericSuccess = z.infer<typeof GenericSuccessSchema>;
