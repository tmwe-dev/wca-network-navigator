/**
 * IO Queries: Workspace Documents — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type WorkspaceDoc } from "../../../core/domain/entities";
import { WorkspaceDocRowSchema } from "../schemas/workspace-doc-schema";
import { workspaceDocId, userId } from "../../../core/domain/entities";

export async function fetchWorkspaceDocs(): Promise<Result<WorkspaceDoc[], AppError>> {
  try {
    const { data, error } = await supabase
      .from("workspace_documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "workspace_documents" }, "fetchWorkspaceDocs"));
    if (!data) return ok([]);
    const docs: WorkspaceDoc[] = [];
    for (const row of data) {
      const parsed = WorkspaceDocRowSchema.safeParse(row);
      if (!parsed.success) return err(ioError("SCHEMA_MISMATCH", parsed.error.message, {}, "fetchWorkspaceDocs"));
      const r = parsed.data;
      docs.push({
        id: workspaceDocId(r.id),
        userId: r.user_id ? userId(r.user_id) : userId(""),
        title: r.file_name,
        content: r.extracted_text,
        category: null,
        createdAt: r.created_at,
      });
    }
    return ok(docs);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchWorkspaceDocs"));
  }
}
