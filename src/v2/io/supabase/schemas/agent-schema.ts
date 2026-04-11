/**
 * Zod Schema: Agents
 */
import { z } from "zod";

export const AgentRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  role: z.string(),
  avatar_emoji: z.string(),
  system_prompt: z.string(),
  is_active: z.boolean(),
  territory_codes: z.array(z.string()).nullable(),
  assigned_tools: z.unknown(),
  knowledge_base: z.unknown(),
  stats: z.record(z.string(), z.unknown()),
  schedule_config: z.record(z.string(), z.unknown()),
  signature_html: z.string().nullable(),
  signature_image_url: z.string().nullable(),
  elevenlabs_voice_id: z.string().nullable(),
  elevenlabs_agent_id: z.string().nullable(),
  voice_call_url: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type AgentRow = z.infer<typeof AgentRowSchema>;

export const AgentListResponseSchema = z.array(AgentRowSchema);
