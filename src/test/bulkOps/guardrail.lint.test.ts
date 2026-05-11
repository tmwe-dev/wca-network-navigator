import { describe, it, expect } from "vitest";
import { Linter } from "eslint";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rule = require("../../../eslint-rules/no-direct-bulk-op.cjs");

function lint(code: string, filename: string): readonly Linter.LintMessage[] {
  const linter = new Linter();
  linter.defineRule("no-direct-bulk-op", rule);
  return linter.verify(code, {
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    rules: { "no-direct-bulk-op": "error" },
  }, { filename });
}

describe("ESLint rule no-direct-bulk-op", () => {
  it("blocca invokeEdge('enrich-partner-website') in src/components/", () => {
    const code = `import { invokeEdge } from "x"; invokeEdge("enrich-partner-website", {});`;
    const msgs = lint(code, "/src/components/Foo.tsx");
    expect(msgs.length).toBe(1);
    expect(msgs[0].messageId).toBe("edge");
  });

  it("permette invokeEdge('enrich-partner-website') dentro src/v2/services/bulkOps", () => {
    const code = `import { invokeEdge } from "x"; invokeEdge("enrich-partner-website", {});`;
    const msgs = lint(code, "/src/v2/services/bulkOps/entries/enrichBase.ts");
    expect(msgs.length).toBe(0);
  });

  it("blocca import di useDeepSearchV2 in UI", () => {
    const code = `import { useDeepSearchV2 } from "@/v2/hooks/useDeepSearchV2";`;
    const msgs = lint(code, "/src/v2/ui/pages/NetworkPage.tsx");
    expect(msgs.length).toBe(1);
    expect(msgs[0].messageId).toBe("hook");
  });

  it("blocca supabase.functions.invoke('sherlock-extract') in UI", () => {
    const code = `supabase.functions.invoke("sherlock-extract", {});`;
    const msgs = lint(code, "/src/components/network/Card.tsx");
    expect(msgs.length).toBe(1);
  });

  it("permette edge non listate", () => {
    const code = `import { invokeEdge } from "x"; invokeEdge("send-email", {});`;
    const msgs = lint(code, "/src/components/Foo.tsx");
    expect(msgs.length).toBe(0);
  });
});