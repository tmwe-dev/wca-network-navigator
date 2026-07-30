import { describe, it, expect } from "vitest";
import { buildSelectWherePredicate } from "@/hooks/useCockpitLogic";
import type { CockpitContact } from "@/hooks/useCockpitContacts";

const contact = { id: "1", name: "Acme", priority: 5, channels: ["email"] } as unknown as CockpitContact;

describe("buildSelectWherePredicate", () => {
  it("costruisce il predicato con field valido", () => {
    const gte = buildSelectWherePredicate("priority", ">=", 3);
    expect(gte).not.toBeNull();
    expect(gte?.(contact)).toBe(true);
    expect(buildSelectWherePredicate("priority", ">=", 9)?.(contact)).toBe(false);
    expect(buildSelectWherePredicate("name", "==", "Acme")?.(contact)).toBe(true);
    expect(buildSelectWherePredicate("channels", "includes", "email")?.(contact)).toBe(true);
    expect(buildSelectWherePredicate("channels", "includes", "sms")?.(contact)).toBe(false);
  });

  it("ritorna null per field mancante o non valido", () => {
    expect(buildSelectWherePredicate(undefined, "==", "x")).toBeNull();
    expect(buildSelectWherePredicate(null, "==", "x")).toBeNull();
    expect(buildSelectWherePredicate("", "==", "x")).toBeNull();
    expect(buildSelectWherePredicate(42, "==", "x")).toBeNull();
    expect(buildSelectWherePredicate({ a: 1 }, "==", "x")).toBeNull();
  });

  it("operatore sconosciuto non seleziona nulla", () => {
    expect(buildSelectWherePredicate("name", "~=", "Acme")?.(contact)).toBe(false);
  });
});
