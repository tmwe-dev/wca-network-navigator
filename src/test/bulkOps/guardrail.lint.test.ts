import { describe, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rule = require("../../../eslint-rules/no-direct-bulk-op.cjs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RuleTester } = require("eslint");

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module" } });

describe("ESLint rule no-direct-bulk-op", () => {
  it("regole valid/invalid", () => {
    tester.run("no-direct-bulk-op", rule, {
      valid: [
        { filename: "/src/v2/services/bulkOps/entries/enrichBase.ts",
          code: `import { invokeEdge } from "x"; invokeEdge("enrich-partner-website", {});` },
        { filename: "/src/components/Foo.tsx",
          code: `import { invokeEdge } from "x"; invokeEdge("send-email", {});` },
      ],
      invalid: [
        { filename: "/src/components/Foo.tsx",
          code: `import { invokeEdge } from "x"; invokeEdge("enrich-partner-website", {});`,
          errors: [{ messageId: "edge" }] },
        { filename: "/src/v2/ui/pages/NetworkPage.tsx",
          code: `import { useDeepSearchV2 } from "y";`,
          errors: [{ messageId: "hook" }] },
      ],
    });
  });
});