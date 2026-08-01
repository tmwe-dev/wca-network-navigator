import { describe, it, expect } from "vitest";
import { autoMapColumns } from "../heuristicMapper";

describe("heuristicMapper - autoMapColumns", () => {
  it("returns a mapping array for given headers", () => {
    const result = autoMapColumns(["Nome", "Email", "Telefono"], []);
    expect(result.length).toBe(3);
    expect(result.every((m) => m.sourceColumn)).toBe(true);
  });

  it("maps email-like headers to email target", () => {
    const result = autoMapColumns(["email"], []);
    expect(result[0].targetColumn).toBe("email");
  });

  it("maps phone-like headers to phone target", () => {
    const result = autoMapColumns(["phone"], []);
    expect(result[0].targetColumn).toBe("phone");
  });

  it("handles unknown headers gracefully", () => {
    const result = autoMapColumns(["XYZ_Random_Column_999"], []);
    expect(result.length).toBe(1);
    const mapping = result[0] as any;
    expect(mapping.confidence === undefined || mapping.confidence < 1).toBe(true);
  });
});
