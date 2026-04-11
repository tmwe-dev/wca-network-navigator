/**
 * IO Mutations: Workspace Documents — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import type { Database } from "@/integrations/supabase/types";

type WorkspaceDocInsert = Database["public"]["Tables"]["workspace_documents"]["Insert"];

export async function createWorkspaceDoc(
  doc: WorkspaceDocInsert,
): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabase.from("workspace_documents").insert(doc);
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "workspace_documents" }, "createWorkspaceDoc"));
    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "createWorkspaceDoc"));
  }
}

export async function deleteWorkspaceDoc(id: string): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabase.from("workspace_documents").delete().eq("id", id);
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "workspace_documents", id }, "deleteWorkspaceDoc"));
    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "deleteWorkspaceDoc"));
  }
}
