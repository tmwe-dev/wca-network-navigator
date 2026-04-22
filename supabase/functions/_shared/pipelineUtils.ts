/**
 * pipelineUtils.ts — Utility functions for post-send pipeline.
 */
import type { SendChannel, SourceType } from "./postSendPipeline.ts";

export function channelToActivityType(channel: SendChannel): string {
  switch (channel) {
    case "email":
      return "send_email";
    case "whatsapp":
      return "whatsapp_message";
    case "linkedin":
      return "linkedin_message";
    case "sms":
      return "sms_message";
  }
}

export function channelLabel(channel: SendChannel): string {
  switch (channel) {
    case "email":
      return "Email";
    case "whatsapp":
      return "WhatsApp";
    case "linkedin":
      return "LinkedIn";
    case "sms":
      return "SMS";
  }
}

export function buildActivityTitle(channel: SendChannel, subject?: string): string {
  const label = channelLabel(channel);
  const subj = subject ? `: ${subject}` : "";
  return `${label} inviata${subj}`;
}

export async function getPartnerStatus(
  supabase: any,
  partnerId: string,
  userId: string,
): Promise<string> {
  try {
    const { data } = await supabase
      .from("partners")
      .select("lead_status")
      .eq("id", partnerId)
      .eq("user_id", userId)
      .maybeSingle();
    return data?.lead_status || "new";
  } catch {
    return "new";
  }
}
