import { describe, it, expect } from "vitest";
import { mapColumns } from "../heuristicMapper";

describe("heuristicMapper - mapColumns", () => {
  it("maps 'Nome' header to name field", () => {
    const result = mapColumns(["Nome", "Email", "Telefono"], []);
    const nameMapping = result.find(m => m.source === "Nome");
    expect(nameMapping).toBeDefined();
    expect(nameMapping!.target).toBe("name");
  });

  it("maps 'Email' header to email field", () => {
    const result = mapColumns(["Email"], []);
    const emailMapping = result.find(m => m.source === "Email");
    expect(emailMapping).toBeDefined();
    expect(emailMapping!.target).toBe("email");
  });

  it("maps 'Telefono' header to phone field", () => {
    const result = mapColumns(["Telefono"], []);
    const phoneMapping = result.find(m => m.source === "Telefono");
    expect(phoneMapping).toBeDefined();
    expect(phoneMapping!.target).toBe("phone");
  });

  it("maps 'Azienda' to company_name", () => {
    const result = mapColumns(["Azienda"], []);
    const companyMapping = result.find(m => m.source === "Azienda");
    expect(companyMapping).toBeDefined();
    expect(companyMapping!.target).toBe("company_name");
  });

  it("returns unmapped for unknown headers", () => {
    const result = mapColumns(["XYZ_Random_Column"], []);
    const mapping = result.find(m => m.source === "XYZ_Random_Column");
    expect(mapping).toBeDefined();
    // Should be unmapped or have low confidence
    expect(mapping!.confidence).toBeLessThan(1);
  });
});
