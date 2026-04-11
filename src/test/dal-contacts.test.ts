/**
 * DAL Contacts — Unit tests
 */
import { describe, it, expect } from "vitest";
import * as contactsDAL from "@/data/contacts";

describe("DAL — contacts", () => {
  it("exports all expected functions", () => {
    expect(typeof contactsDAL.findContacts).toBe("function");
    expect(typeof contactsDAL.getContact).toBe("function");
    expect(typeof contactsDAL.updateContact).toBe("function");
    expect(typeof contactsDAL.invalidateContacts).toBe("function");
  });
});
