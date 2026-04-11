/**
 * useMissionBuilderV2 — Mission creation wizard
 */
import { useState, useCallback } from "react";
import { invokeEdge } from "@/lib/api/invokeEdge";

export type MissionStep = "target" | "channel" | "communication" | "agents" | "schedule" | "confirm";

const STEPS: MissionStep[] = ["target", "channel", "communication", "agents", "schedule", "confirm"];

interface MissionConfig {
  targetFilter: Record<string, unknown>;
  channel: string;
  messageTemplate: string;
  agentId: string | null;
  scheduledAt: string | null;
}

export function useMissionBuilderV2() {
  const [currentStep, setCurrentStep] = useState<MissionStep>("target");
  const [config, setConfig] = useState<MissionConfig>({
    targetFilter: {},
    channel: "email",
    messageTemplate: "",
    agentId: null,
    scheduledAt: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextStep = useCallback(() => {
    const idx = STEPS.indexOf(currentStep);
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1]);
  }, [currentStep]);

  const prevStep = useCallback(() => {
    const idx = STEPS.indexOf(currentStep);
    if (idx > 0) setCurrentStep(STEPS[idx - 1]);
  }, [currentStep]);

  const updateConfig = useCallback((updates: Partial<MissionConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const submitMission = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await invokeEdge("unified-assistant", {
        body: { message: "create_mission", scope: "mission-builder", config },
        context: "missionBuilderV2",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [config]);

  return {
    currentStep,
    stepIndex: STEPS.indexOf(currentStep),
    totalSteps: STEPS.length,
    config,
    nextStep,
    prevStep,
    updateConfig,
    submitMission,
    isSubmitting,
  };
}
