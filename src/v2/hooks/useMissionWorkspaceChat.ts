/**
 * useMissionWorkspaceChat — thread conversazionale della maschera Missioni.
 *
 * Riusa il gateway AI esistente (`invokeAi` → unified-assistant, scope
 * "missions"). Nessuna nuova pipeline: solo un thread locale per missione con
 * il contesto della missione aperta passato come `extra`.
 */
import { useCallback, useState } from "react";
import { invokeAi } from "@/lib/ai/invokeAi";

export interface WorkspaceMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly createdAt: string;
}

interface MissionContextInfo {
  readonly id: string;
  readonly title: string;
  readonly goalType: string;
  readonly goalDescription: string | null;
  readonly status: string;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useMissionWorkspaceChat() {
  const [threads, setThreads] = useState<Record<string, readonly WorkspaceMessage[]>>({});
  const [isSending, setIsSending] = useState(false);

  const send = useCallback(
    async (mission: MissionContextInfo, text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;

      const userMsg: WorkspaceMessage = {
        id: newId(),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      const history = threads[mission.id] ?? [];
      setThreads((prev) => ({ ...prev, [mission.id]: [...(prev[mission.id] ?? []), userMsg] }));
      setIsSending(true);

      try {
        const data = await invokeAi<{ content?: string }>("unified-assistant", {
          scope: "missions",
          body: {
            messages: [...history, userMsg].map((m) => ({ role: m.role, content: m.content })),
          },
          context: {
            source: "MissionWorkspace",
            route: "/v2/agents/autopilot",
            mode: "mission-workspace",
            extra: {
              mission_id: mission.id,
              mission_title: mission.title,
              mission_status: mission.status,
              goal_type: mission.goalType,
              goal_description: mission.goalDescription,
            },
          },
        });

        const reply: WorkspaceMessage = {
          id: newId(),
          role: "assistant",
          content: data?.content?.trim() || "Nessuna risposta disponibile.",
          createdAt: new Date().toISOString(),
        };
        setThreads((prev) => ({ ...prev, [mission.id]: [...(prev[mission.id] ?? []), reply] }));
      } catch (e) {
        const reply: WorkspaceMessage = {
          id: newId(),
          role: "assistant",
          content: `Non sono riuscita a rispondere: ${e instanceof Error ? e.message : "errore sconosciuto"}`,
          createdAt: new Date().toISOString(),
        };
        setThreads((prev) => ({ ...prev, [mission.id]: [...(prev[mission.id] ?? []), reply] }));
      } finally {
        setIsSending(false);
      }
    },
    [isSending, threads],
  );

  const messagesFor = useCallback(
    (missionId: string | null): readonly WorkspaceMessage[] => (missionId ? (threads[missionId] ?? []) : []),
    [threads],
  );

  return { messagesFor, send, isSending };
}
