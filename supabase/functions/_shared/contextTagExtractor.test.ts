import { describe, it, expect } from "vitest";
import { extractContextTags, type ConversationContext } from "./contextTagExtractor.ts";

describe("extractContextTags", () => {
  it("estrae paese da messaggio con nome paese", () => {
    const result = extractContextTags({
      last_user_message: "Come contatto i partner in Germania?",
    });
    expect(result.tags).toContain("de");
    expect(result.categories).toContain("country_culture");
  });

  it("estrae canale email da messaggio", () => {
    const result = extractContextTags({
      last_user_message: "Scrivi una email di follow-up",
    });
    expect(result.tags).toContain("email");
    expect(result.tags).toContain("follow_up");
    expect(result.categories).toContain("communication_pattern");
  });

  it("usa email_type dal contesto", () => {
    const result = extractContextTags({
      last_user_message: "genera",
      email_type: "follow_up",
    });
    expect(result.tags).toContain("follow_up");
  });

  it("estrae scope e mappa a categorie", () => {
    const result = extractContextTags({
      last_user_message: "mostra i partner",
      scope: "cockpit",
    });
    expect(result.categories).toContain("operative_procedure");
  });

  it("rileva canale LinkedIn", () => {
    const result = extractContextTags({
      last_user_message: "Scrivi un messaggio linkedin",
    });
    expect(result.tags).toContain("linkedin");
  });

  it("rileva canale WhatsApp", () => {
    const result = extractContextTags({
      last_user_message: "manda un whatsapp",
    });
    expect(result.tags).toContain("whatsapp");
  });

  it("ritorna array vuoti per contesto vuoto", () => {
    const result = extractContextTags({});
    expect(result.tags).toEqual([]);
    expect(result.categories).toEqual([]);
    expect(result.priority_boost).toBe(0);
  });

  it("gestisce keyword multiple e deduplicazione", () => {
    const result = extractContextTags({
      last_user_message: "Email per partner in Turchia, settore logistica Turchia",
    });
    const trCount = result.tags.filter((t) => t === "tr").length;
    expect(trCount).toBe(1); // deduplicated
  });

  it("aumenta priority_boost con partner_country", () => {
    const result = extractContextTags({
      partner_country: "DE",
    });
    expect(result.priority_boost).toBe(2);
    expect(result.tags).toContain("de");
  });

  it("mappa page context a categorie", () => {
    const result = extractContextTags({
      last_user_message: "test",
      page: "/outreach/campaign",
    });
    expect(result.categories).toContain("communication_pattern");
  });

  it("mappa page partner a competitive_intelligence", () => {
    const result = extractContextTags({
      last_user_message: "test",
      page: "/network/partners",
    });
    expect(result.categories).toContain("competitive_intelligence");
  });

  it("rileva strategia e mappa a learning_metric", () => {
    const result = extractContextTags({
      last_user_message: "qual è la strategia migliore?",
    });
    expect(result.categories).toContain("user_preference");
    expect(result.categories).toContain("learning_metric");
  });
});
