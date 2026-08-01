/**
 * useOnboardingV2 — Onboarding wizard state
 */
import { useState, useCallback } from "react";

export type OnboardingStep = "welcome" | "credentials" | "agents" | "preferences" | "complete";

const STEPS: OnboardingStep[] = ["welcome", "credentials", "agents", "preferences", "complete"];

export function useOnboardingV2() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");

  const nextStep = useCallback(() => {
    const idx = STEPS.indexOf(currentStep);
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1]);
  }, [currentStep]);

  const prevStep = useCallback(() => {
    const idx = STEPS.indexOf(currentStep);
    if (idx > 0) setCurrentStep(STEPS[idx - 1]);
  }, [currentStep]);

  const goToStep = useCallback((step: OnboardingStep) => {
    setCurrentStep(step);
  }, []);

  return {
    currentStep,
    stepIndex: STEPS.indexOf(currentStep),
    totalSteps: STEPS.length,
    nextStep,
    prevStep,
    goToStep,
    isFirst: currentStep === STEPS[0],
    isLast: currentStep === STEPS[STEPS.length - 1],
  };
}
