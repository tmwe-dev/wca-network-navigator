import { useCallback } from "react";
import { SCENARIOS } from "../scenarios";
import type { CommandPageState } from "./useCommandPageState";

export function useScenarioFlow(pageState: CommandPageState) {
  return useCallback(
    (scenarioKey: string) => {
      const scenario = SCENARIOS[scenarioKey];
      if (!scenario) return;

      pageState.setActiveScenario(scenario);
      pageState.setActiveScenarioKey(scenarioKey);
      pageState.setFlowPhase("thinking");
      pageState.setShowTools(true);
      pageState.setToolPhase("activating");
      pageState.setChainHighlight(0);

      pageState.addMessage({
        role: "assistant",
        content: "",
        timestamp: "",
        thinking: true,
      });

      const chainInterval = setInterval(() => {
        pageState.setChainHighlight((prev) => {
          if (prev === undefined || prev >= 2) return prev;
          return prev + 1;
        });
      }, 700);

      setTimeout(() => {
        clearInterval(chainInterval);
        pageState.setToolPhase("active");
        pageState.setChainHighlight(3);
        pageState.setMessages((prev) => prev.filter((m) => !m.thinking));

        scenario.assistantMessages.forEach((am) => {
          pageState.addMessage({
            role: "assistant",
            content: am.content,
            timestamp: pageState.ts(),
            agentName: am.agentName,
            meta: am.meta,
            governance: am.governance,
          });
        });

        pageState.setCanvas(scenario.canvas);
        pageState.setFlowPhase(scenario.approval ? "proposal" : "done");

        if (scenario.autoVoice) {
          setTimeout(() => pageState.setVoiceSpeaking(true), 800);
        }
      }, 2200);
    },
    [pageState],
  );
}
