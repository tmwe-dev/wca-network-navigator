import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
/* eslint-disable @typescript-eslint/no-explicit-any -- test file with mocks */
  sanitizeVisibleAiText,
  parseAiAgentResponse,
  dispatchAiUiActions,
  dispatchAiAgentEffects,
} from "@/lib/ai/agentResponse";

describe("ai/agentResponse", () => {
  describe("sanitizeVisibleAiText", () => {
    it("rimuove la parte dopo il primo marker", () => {
      const r = sanitizeVisibleAiText("Hello world\n---STRUCTURED_DATA---\n[]");
      expect(r).toBe("Hello world");
    });

    it("rimuove blocchi codice json/js", () => {
      const r = sanitizeVisibleAiText("Risultato:\n```json\n{}\n```\nFine");
      expect(r).not.toContain("```");
      expect(r).toContain("Risultato");
      expect(r).toContain("Fine");
    });

    it("ritorna stringa vuota su input vuoto", () => {
      expect(sanitizeVisibleAiText("")).toBe("");
      expect(sanitizeVisibleAiText(null as any)).toBe("");
    });

    it("collassa più newline consecutivi", () => {
      const r = sanitizeVisibleAiText("a\n\n\n\n\nb");
      expect(r).toBe("a\n\nb");
    });
  });

  describe("parseAiAgentResponse", () => {
    it("estrae partners da STRUCTURED_DATA", () => {
      const content = `Trovati 2 partner.
---STRUCTURED_DATA---
{"type":"partners","data":[{"id":1},{"id":2}]}`;
      const r = parseAiAgentResponse<{ id: number }>(content);
      expect(r.partners).toHaveLength(2);
      expect(r.partners[0].id).toBe(1);
      expect(r.text).toBe("Trovati 2 partner.");
    });

    it("ignora STRUCTURED_DATA con type diverso", () => {
      const content = `x
---STRUCTURED_DATA---
{"type":"other","data":[1,2]}`;
      const r = parseAiAgentResponse(content);
      expect(r.partners).toEqual([]);
    });

    it("estrae jobCreated e auto-genera operation card", () => {
      const content = `Avvio job
---JOB_CREATED---
{"job_id":"j1","country":"IT","mode":"directory","total_partners":50,"estimated_time_minutes":10}`;
      const r = parseAiAgentResponse(content);
      expect(r.jobCreated?.job_id).toBe("j1");
      expect(r.operations).toHaveLength(1);
      expect(r.operations[0].job_id).toBe("j1");
      expect(r.operations[0].count).toBe(50);
      expect(r.operations[0].eta_minutes).toBe(10);
      expect(r.operations[0].status).toBe("running");
    });

    it("non duplica operation card se già esistente per stesso job_id", () => {
      const content = `x
---JOB_CREATED---
{"job_id":"jX","country":"DE","mode":"d","total_partners":1,"estimated_time_minutes":1}
---OPERATIONS---
[{"op_type":"download","status":"running","title":"existing","target":"DE","job_id":"jX"}]`;
      const r = parseAiAgentResponse(content);
      expect(r.operations).toHaveLength(1);
      expect(r.operations[0].title).toBe("existing");
    });

    it("estrae uiActions valide", () => {
      const content = `x
---UI_ACTIONS---
[{"action_type":"navigate","path":"/cockpit"}]`;
      const r = parseAiAgentResponse(content);
      expect(r.uiActions).toHaveLength(1);
      expect(r.uiActions[0].action_type).toBe("navigate");
      expect(r.uiActions[0].path).toBe("/cockpit");
    });

    it("ritorna fallback su payload JSON malformato", () => {
      const content = `x
---STRUCTURED_DATA---
{not valid json
---UI_ACTIONS---
[invalid`;
      const r = parseAiAgentResponse(content);
      expect(r.partners).toEqual([]);
      expect(r.uiActions).toEqual([]);
    });

    it("text non contiene marker o blocchi codice", () => {
      const content = "Ciao\n```json\n{}\n```\n---UI_ACTIONS---\n[]";
      const r = parseAiAgentResponse(content);
      expect(r.text).not.toMatch(/STRUCTURED|UI_ACTIONS|```/);
      expect(r.text).toBe("Ciao");
    });
  });

  describe("dispatchAiUiActions / dispatchAiAgentEffects", () => {
    let dispatched: CustomEvent[] = [];
    let dispatchSpy: any;

    beforeEach(() => {
      dispatched = [];
      dispatchSpy = vi.spyOn(window, "dispatchEvent").mockImplementation((evt: Event) => {
        dispatched.push(evt as CustomEvent);
        return true;
      });
    });

    afterEach(() => {
      dispatchSpy.mockRestore();
    });

    it("dispatchAiUiActions emette un evento per azione", () => {
      dispatchAiUiActions([
        { action_type: "navigate", path: "/x" },
        { action_type: "show_toast", message: "ok" },
      ]);
      expect(dispatched).toHaveLength(2);
      expect(dispatched[0].type).toBe("ai-ui-action");
      expect((dispatched[0] as any).detail.action_type).toBe("navigate");
    });

    it("dispatchAiAgentEffects auto-aggiunge start_download_job dal jobCreated", () => {
      dispatchAiAgentEffects({
        text: "",
        partners: [],
        operations: [],
        uiActions: [],
        jobCreated: {
          job_id: "j99",
          country: "IT",
          mode: "d",
          total_partners: 1,
          estimated_time_minutes: 1,
        },
      });
      expect(dispatched).toHaveLength(1);
      const detail = (dispatched[0] as any).detail;
      expect(detail.action_type).toBe("start_download_job");
      expect(detail.job_id).toBe("j99");
    });

    it("dispatchAiAgentEffects non duplica se start_download_job già presente", () => {
      dispatchAiAgentEffects({
        text: "",
        partners: [],
        operations: [],
        uiActions: [{ action_type: "start_download_job", job_id: "j99" }],
        jobCreated: {
          job_id: "j99",
          country: "IT",
          mode: "d",
          total_partners: 1,
          estimated_time_minutes: 1,
        },
      });
      expect(dispatched).toHaveLength(1);
    });
  });
});
