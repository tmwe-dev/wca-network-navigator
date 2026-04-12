/**
 * stepRegistry — Maps step index to component
 */
import type { ComponentType } from "react";
import type { MissionStepProps } from "./types";
import { TargetStep } from "./TargetStep";
import { BatchStep } from "./BatchStep";
import { ChannelStep } from "./ChannelStep";
import { DeepSearchStep } from "./DeepSearchStep";
import { CommunicationStep } from "./CommunicationStep";
import { AttachmentStep } from "./AttachmentStep";
import { ToneStep } from "./ToneStep";
import { AgentStep } from "./AgentStep";
import { ScheduleStep } from "./ScheduleStep";
import { ConfirmStep } from "./ConfirmStep";

const STEP_COMPONENTS: Record<number, ComponentType<MissionStepProps>> = {
  0: TargetStep,
  1: BatchStep,
  2: ChannelStep,
  3: DeepSearchStep,
  4: CommunicationStep,
  5: AttachmentStep,
  6: ToneStep,
  7: AgentStep,
  8: ScheduleStep,
  9: ConfirmStep,
};

export function getStepComponent(stepIndex: number): ComponentType<MissionStepProps> | null {
  return STEP_COMPONENTS[stepIndex] || null;
}
