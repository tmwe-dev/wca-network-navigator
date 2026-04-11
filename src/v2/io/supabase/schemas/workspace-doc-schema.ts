/**
 * Zod Schema: Workspace Documents
 */
import { z } from "zod";

export const WorkspaceDocRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().nullable(),
  file_name: z.string(),
  file_url: z.string(),
  file_size: z.number(),
  extracted_text: z.string().nullable(),
  created_at: z.string(),
});

export type WorkspaceDocRow = z.infer<typeof WorkspaceDocRowSchema>;
