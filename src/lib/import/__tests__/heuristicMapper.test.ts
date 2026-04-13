import { describe, it, expect } from "vitest";
import { autoMapColumns } from "../heuristicMapper";

describe("heuristicMapper - autoMapColumns", () => {
  it("maps 'Nome' header to name field", () => {
    const result = autoMapColumns(["Nome", "Email", "Telefono"], []);
    const nameMapping = result.find((m: any) => m.source === "Nome");
    expect(nameMapping).toBeDefined();
    expect(nameMapping!.target).toBe("name");
  });

  it("maps 'Email' header to email field", () => {
    const result = autoMapColumns(["Email"], []);
    const emailMapping = result.find((m: any) => m.source === "Email");
    expect(emailMapping).toBeDefined();
    expect(emailMapping!.target).toBe("email");
  });

  it("maps 'Telefono' header to phone field", () => {
    const result = autoMapColumns(["Telefono"], []);
    const phoneMapping = result.find((m: any) => m.source === "Telefono");
    expect(phoneMapping).toBeDefined();
    expect(phoneMapping!.target).toBe("phone");
  });

  it("maps 'Azienda' to company_name", () => {
    const result = autoMapColumns(["Azienda"], []);
    const companyMapping = result.find((m: any) => m.source === "Azienda");
    expect(companyMapping).toBeDefined();
    expect(companyMapping!.target).toBe("company_name");
  });

  it("returns mapping for unknown headers with low confidence", () => {
    const result = autoMapColumns(["XYZ_Random_Column_999"], []);
    expect(result.length).toBe(1);
    // Should be unmapped or have low confidence
    const mapping = result[0] as any;
    expect(mapping.target === "__unmapped__" || mapping.confidence < 0.5).toBe(true);
  });
});
