/**
 * Queries for Command Jobs — persistent agenda for the Command system.
 * Inspired by swiftpack-studio's import_jobs pattern.
 */
import { type Result, ok, err } from "../../../core/domain/result";
import { fromUnknown } from "../../../core/domain/errors";
import { untypedFrom } from "@/lib/supabaseUntyped";

export type CommandJobStatus =
  | "open"
  | "in_progress"
  | "awaiting_approval"
  | "paused"
  | "done"
  | "error"
  | "cancelled";

export type CommandJobPhase =
  | "discovery"
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "review"
  | "done";

export type CommandJobStepStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "done"
  | "error"
  | "skipped";

export interface CommandJob {
  id: string;
  user_id: string;
  operator_id: string | null;
  conversation_id: string | null;
  title: string;
  goal: string | null;
  origin_prompt: string | null;
  status: CommandJobStatus;
  phase: CommandJobPhase;
  snapshot: Record<string, unknown>;
  ai_summary: string | null;
  progress: Record<string, unknown>;
  tags: string[];
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  completed_at: string | null;
}

export interface CommandJobStep {
  id: string;
  job_id: string;
  step_number: number;
  tool_id: string | null;
  status: CommandJobStepStatus;
  params: Record<string, unknown>;
  result: unknown;
  ai_reasoning: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
}

/** Load open / actively-worked jobs for the current operator (sidebar feed). */
export async function fetchOpenCommandJobs(limit = 25): Promise<Result<CommandJob[]>> {
  try {
    const { data, error } = await untypedFrom("command_jobs")
      .select("*")
      .in("status", ["open", "in_progress", "awaiting_approval", "paused"])
      .order("last_activity_at", { ascending: false })
      .limit(limit);
    if (error) return err(fromUnknown(error, "DATABASE_ERROR"));
    return ok((data ?? []) as CommandJob[]);
  } catch (e) {
    return err(fromUnknown(e, "DATABASE_ERROR"));
  }
}

/** Load all jobs (open + recently completed) for richer history views. */
export async function fetchRecentCommandJobs(limit = 50): Promise<Result<CommandJob[]>> {
  try {
    const { data, error } = await untypedFrom("command_jobs")
      .select("*")
      .order("last_activity_at", { ascending: false })
      .limit(limit);
    if (error) return err(fromUnknown(error, "DATABASE_ERROR"));
    return ok((data ?? []) as CommandJob[]);
  } catch (e) {
    return err(fromUnknown(e, "DATABASE_ERROR"));
  }
}

export async function fetchCommandJob(jobId: string): Promise<Result<CommandJob | null>> {
  try {
    const { data, error } = await untypedFrom("command_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();
    if (error) return err(fromUnknown(error, "DATABASE_ERROR"));
    return ok((data ?? null) as CommandJob | null);
  } catch (e) {
    return err(fromUnknown(e, "DATABASE_ERROR"));
  }
}

export async function fetchCommandJobsByConversation(
  conversationId: string,
): Promise<Result<CommandJob[]>> {
  try {
    const { data, error } = await untypedFrom("command_jobs")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) return err(fromUnknown(error, "DATABASE_ERROR"));
    return ok((data ?? []) as CommandJob[]);
  } catch (e) {
    return err(fromUnknown(e, "DATABASE_ERROR"));
  }
}

export async function fetchCommandJobSteps(jobId: string): Promise<Result<CommandJobStep[]>> {
  try {
    const { data, error } = await untypedFrom("command_job_steps")
      .select("*")
      .eq("job_id", jobId)
      .order("step_number", { ascending: true });
    if (error) return err(fromUnknown(error, "DATABASE_ERROR"));
    return ok((data ?? []) as CommandJobStep[]);
  } catch (e) {
    return err(fromUnknown(e, "DATABASE_ERROR"));
  }
}