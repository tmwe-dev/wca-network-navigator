/**
 * Typed Settings hooks — Unit tests
 */
import { describe, it, expect } from "vitest";
import * as typedSettings from "@/hooks/useTypedSettings";

describe("useTypedSettings", () => {
  it("exports useCredentialSettings hook", () => {
    expect(typeof typedSettings.useCredentialSettings).toBe("function");
  });

  it("exports useAIConfigSettings hook", () => {
    expect(typeof typedSettings.useAIConfigSettings).toBe("function");
  });

  it("exports useTypedSettingUpdate hook", () => {
    expect(typeof typedSettings.useTypedSettingUpdate).toBe("function");
  });

  it("CredentialSettings interface has expected shape", () => {
    const mock: typedSettings.CredentialSettings = {
      smtpHost: "smtp.example.com",
      smtpPort: "587",
      smtpUser: "user",
      smtpPass: "pass",
      smtpFrom: "from@example.com",
      imapHost: "imap.example.com",
      imapPort: "993",
      imapUser: "user",
      imapPass: "pass",
      linkedinCookie: "",
      linkedinUserAgent: "",
      whatsappConnected: "false",
      whatsappDomSchema: "",
      raUsername: "",
      raPassword: "",
      raNetwork: "",
    };
    expect(mock.smtpHost).toBe("smtp.example.com");
  });

  it("AIConfigSettings interface has expected shape", () => {
    const mock: typedSettings.AIConfigSettings = {
      tone: "professionale",
      language: "it",
      salesKnowledgeBase: "",
      customEmailTypes: "[]",
      customGoals: "[]",
      customProposals: "[]",
      deepSearchConfig: "{}",
      agentMaxActions: 10,
      agentWorkStartHour: 8,
      agentWorkEndHour: 18,
    };
    expect(mock.agentMaxActions).toBe(10);
  });
});
