import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-var": "error",
      "prefer-const": "error",
      "eqeqeq": ["error", "always"],
    },
  },
  // ── DAL enforcement: ban supabase.from() outside src/data/ ──
  {
    files: [
      "src/**/*.{ts,tsx}",
    ],
    ignores: [
      "src/data/**",
      "src/integrations/**",
      "src/test/**",
      "src/**/*.test.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='supabase'][callee.property.name='from']",
          message: "Direct supabase.from() is forbidden outside src/data/. Use the DAL layer instead. See src/data/README.md",
        },
      ],
    },
  },
  // ── V2 migration guardrail: warn on v1 page imports in v2 pages ──
  {
    files: ["src/v2/ui/pages/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@/pages/*", "@/pages/**"],
              message: "V2 pages should not import from v1 src/pages/. See docs/v2/MIGRATION_STATUS.md",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "warn",
        {
          selector: "CallExpression[callee.type='Import'][arguments.0.value=/^\\/pages\\//]",
          message: "V2 pages should not lazy-import from v1 src/pages/. See docs/v2/MIGRATION_STATUS.md",
        },
        {
          selector: "CallExpression[callee.type='Import'][arguments.0.value=/^@\\/pages\\//]",
          message: "V2 pages should not lazy-import from v1 src/pages/. See docs/v2/MIGRATION_STATUS.md",
        },
      ],
    },
  },
);
