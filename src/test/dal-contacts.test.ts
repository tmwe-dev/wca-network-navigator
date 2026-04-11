/**
 * DAL Contacts — Unit tests
 */
import { describe, it, expect } from "vitest";
import * as contactsDAL from "@/data/contacts";

describe("DAL — contacts", () => {
  it("exports all expected functions", () => {
    expect(typeof contactsDAL.findContacts).toBe("function");
    expect(typeof contactsDAL.findHoldingPatternContacts).toBe("function");
    expect(typeof contactsDAL.getHoldingPatternStats).toBe("function");
    expect(typeof contactsDAL.getContactFilterOptions).toBe("function");
    expect(typeof contactsDAL.findContactInteractions).toBe("function");
    expect(typeof contactsDAL.updateLeadStatus).toBe("function");
    expect(typeof contactsDAL.createContactInteraction).toBe("function");
    expect(typeof contactsDAL.deleteContacts).toBe("function");
    expect(typeof contactsDAL.updateContact).toBe("function");
    expect(typeof contactsDAL.invalidateContactCache).toBe("function");
  });
});
