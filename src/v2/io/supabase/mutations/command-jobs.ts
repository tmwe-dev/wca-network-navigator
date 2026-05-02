/**
 * Mutations for Command Jobs.
 * Inspired by swiftpack-studio's import_jobs CRUD layer.
 */
import { type Result, ok, err } from "../../../core/domain/result";
import { fromUnknown } from "../../../core/domain/errors";
import { untypedFrom } from "@/lib/supabaseUntyped";
import type {
  CommandJob,
  CommandJobPhase,
  CommandJobStatus,
  CommandJobStep,
  CommandJobStepStatus,
} from "../queries/command-jobs";

export interface CreateCommandJobInput {
  user_id: string;
  conversation_id?: string | null;
  title: string;
  goal?: string | null;
  origin_prompt?: string | null;
  phase?: CommandJobPhase;
  status?: CommandJobStatus;
  snapshot?: Record<string, unknown>;
  tags?: string[];
}

export async function createCommandJob(
  input: CreateCommandJobInput,
): Promise<Result<CommandJob>> {
  try {
    const { data, error } = await untypedFrom("command_jobs")
      .insert({
        user_id: input.user_id,
        conversation_id: input.conversation_id ?? null,
        title: input.title.slice(0, 200),
        goal: input.goal ?? null,
        origin_prompt: input.origin_prompt ?? null,
        phase: input.phase ?? "discovery",
        status: input.status ?? "open",
        snapshot: input.snapshot ?? {},
        tags: input.tags ?? [],
      })
      .select()
      .single();
    if (error) return err(fromUnknown(error, "DATABASE_ERROR"));
    return ok(data as CommandJob);
  } catch (e) {
    return err(fromUnknown(e, "DATABASE_ERROR"));
  }
}

export interface UpdateCommandJobPatch {
  title?: string;
  goal?: string | null;
  status?: CommandJobStatus;
  phase?: CommandJobPhase;
  snapshot?: Record<string, unknown>;
  ai_summary?: string | null;
  progress?: Record<string, unknown>;
  tags?: string[];
  conversation_id?: string | null;
  completed_at?: string | null;
  bump_activity?: boolean;
}

export async function updateCommandJob(
  jobId: string,
  patch: UpdateCommandJobPatch,
): Promise<Result<CommandJob>> {
  try {
    const payload: Record<string, unknown> = {};
    if (patch.title !== undefined) payload.title = patch.title.slice(0, 200);
    if (patch.goal !== undefined) payload.goal = patch.goal;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.phase !== undefined) payload.phase = patch.phase;
    if (patch.snapshot !== undefined) payload.snapshot = patch.snapshot;
    if (patch.ai_summary !== undefined) payload.ai_summary = patch.ai_summary;
    if (patch.progress !== undefined) payload.progress = patch.progress;
    if (patch.tags !== undefined) payload.tags = patch.tags;
    if (patch.conversation_id !== undefined) payload.conversation_id = patch.conversation_id;
    if (patch.completed_at !== undefined) payload.completed_at = patch.completed_at;
    if (patch.bump_activity !== false) payload.last_activity_at = new Date().toISOString();

    const { data, error } = await untypedFrom("command_jobs")
      .update(payload)
      .eq("id", jobId)
      .select()
      .single();
    if (error) return err(fromUnknown(error, "DATABASE_ERROR"));
    return ok(data as CommandJob);
  } catch (e) {
    return err(fromUnknown(e, "DATABASE_ERROR"));
  }
}

/** Soft-delete a job (sets deleted_at). */
export async function deleteCommandJob(jobId: string): Promise<Result<void>> {
  try {
    const { error } = await untypedFrom("command_jobs")
      .update({ deleted_at: new Date().toISOString(), status: "cancelled" })
      .eq("id", jobId);
    if (error) return err(fromUnknown(error, "DATABASE_ERROR"));
    return ok(undefined);
  } catch (e) {
    return err(fromUnknown(e, "DATABASE_ERROR"));
  }
}

export interface AppendStepInput {
  job_id: string;
  step_number: number;
  tool_id?: string | null;
  params?: Record<string, unknown>;
  ai_reasoning?: string | null;
  status?: CommandJobStepStatus;
}

export async function appendCommandJobStep(
  input: AppendStepInput,
): Promise<Result<CommandJobStep>> {
  try {
    const { data, error } = await untypedFrom("command_job_steps")
      .insert({
        job_id: input.job_id,
        step_number: input.step_number,
        tool_id: input.tool_id ?? null,
        params: input.params ?? {},
        ai_reasoning: input.ai_reasoning ?? null,
        status: input.status ?? "pending",
        started_at: input.status === "running" ? new Date().toISOString() : null,
      })
      .select()
      .single();
    if (error) return err(fromUnknown(error, "DATABASE_ERROR"));
    return ok(data as CommandJobStep);
  } catch (e) {
    return err(fromUnknown(e, "DATABASE_ERROR"));
  }
}

export interface UpdateStepPatch {
  status?: CommandJobStepStatus;
  result?: unknown;
  error_message?: string | null;
  ai_reasoning?: string | null;
  duration_ms?: number | null;
  mark_completed?: boolean;
}

export async function updateCommandJobStep(
  stepId: string,
  patch: UpdateStepPatch,
): Promise<Result<CommandJobStep>> {
  try {
    const payload: Record<string, unknown> = {};
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.result !== undefined) payload.result = patch.result;
    if (patch.error_message !== undefined) payload.error_message = patch.error_message;
    if (patch.ai_reasoning !== undefined) payload.ai_reasoning = patch.ai_reasoning;
    if (patch.duration_ms !== undefined) payload.duration_ms = patch.duration_ms;
    if (patch.mark_completed) payload.completed_at = new Date().toISOString();

    const { data, error } = await untypedFrom("command_job_steps")
      .update(payload)
      .eq("id", stepId)
      .select()
      .single();
    if (error) return err(fromUnknown(error, "DATABASE_ERROR"));
    return ok(data as CommandJobStep);
  } catch (e) {
    return err(fromUnknown(e, "DATABASE_ERROR"));
  }
}