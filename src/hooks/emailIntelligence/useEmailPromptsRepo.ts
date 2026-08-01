/**
 * useEmailPromptsRepo — accesso tipizzato al DAL `emailPrompts` per la UI
 * Email Intelligence. Stesse firme, nessun cambio di semantica.
 */
import { useMemo } from "react";
import {
  findAllEmailPrompts,
  updateEmailPromptById,
  insertEmailPrompt,
  setEmailPromptActive,
  deleteEmailPrompt,
  findActiveEmailPromptTemplates,
  findPromptTemplatesForUser,
  hasSystemPromptTemplates,
  insertSystemPromptTemplates,
} from "@/data/emailPrompts";

export type { EmailPromptRow } from "@/data/emailPrompts";

const repo = {
  findAllEmailPrompts,
  updateEmailPromptById,
  insertEmailPrompt,
  setEmailPromptActive,
  deleteEmailPrompt,
  findActiveEmailPromptTemplates,
  findPromptTemplatesForUser,
  hasSystemPromptTemplates,
  insertSystemPromptTemplates,
} as const;

export type EmailPromptsRepo = typeof repo;

export function useEmailPromptsRepo(): EmailPromptsRepo {
  return useMemo(() => repo, []);
}