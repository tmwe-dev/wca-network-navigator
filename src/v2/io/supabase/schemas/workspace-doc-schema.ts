/**
 * Zod Schema: Workspace Documents
 */
import { z } from "zod";

export const WorkspaceDocRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  content: z.string().nullable(),
  category: z.string().nullable(),
  created_at: z.string(),
});

export type WorkspaceDocRow = z.infer<typeof WorkspaceDocRowSchema>;
