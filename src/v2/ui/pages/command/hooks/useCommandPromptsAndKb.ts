/**
 * useCommandPromptsAndKb — load operative prompts (context=command) and KB
 * entries (category=command_tools) for the Command Help page.
 *
 * Read-only listing used to make Command's behavior transparent: which prompts
 * are active, and which KB cards inform its reasoning.
 */
import { useQuery } from "@tanstack/react-query";
import {
  findCommandHelpPromptsAndKb,
  type CommandHelpPromptRow as CommandPromptRow,
  type CommandHelpKbRow as CommandKbRow,
} from "@/data/commandPromptsV2";

export type { CommandPromptRow, CommandKbRow };

export function useCommandPromptsAndKb() {
  return useQuery({
    queryKey: ["v2", "command", "help", "prompts-and-kb"],
    queryFn: findCommandHelpPromptsAndKb,
    staleTime: 60_000,
  });
}