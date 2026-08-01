/**
 * Agent Mapper — DB row → Domain entity
 */
import { type Result, ok, err } from "../domain/result";
import { ioError, type AppError } from "../domain/errors";
import { AgentRowSchema } from "../../io/supabase/schemas/agent-schema";
import { type Agent, agentId, userId } from "../domain/entities";

export function mapAgentRow(row: unknown): Result<Agent, AppError> {
  const parsed = AgentRowSchema.safeParse(row);
  if (!parsed.success) {
    return err(ioError("SCHEMA_MISMATCH", `Agent row validation failed: ${parsed.error.message}`, {
      issues: parsed.error.issues,
    }, "agent-mapper"));
  }

  const r = parsed.data;
  return ok({
    id: agentId(r.id),
    userId: userId(r.user_id),
    name: r.name,
    role: r.role,
    avatarEmoji: r.avatar_emoji,
    systemPrompt: r.system_prompt,
    isActive: r.is_active,
    territoryCodes: r.territory_codes ?? [],
    assignedTools: Array.isArray(r.assigned_tools) ? r.assigned_tools : [],
    knowledgeBase: Array.isArray(r.knowledge_base) ? r.knowledge_base : [],
    stats: r.stats,
    scheduleConfig: r.schedule_config,
    signatureHtml: r.signature_html,
    signatureImageUrl: r.signature_image_url,
    elevenlabsVoiceId: r.elevenlabs_voice_id,
    elevenlabsAgentId: r.elevenlabs_agent_id,
    voiceCallUrl: r.voice_call_url,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
}
