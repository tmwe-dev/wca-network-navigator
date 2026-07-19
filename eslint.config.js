import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import unusedImports from "eslint-plugin-unused-imports";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "build",
      "coverage",
      "node_modules",
      "archive/**",
      "supabase/functions/**",
      "public/**",
      "e2e/**",
      "scripts/**",
      "src/v2/ui/pages/command/_legacy/**",
    ],
  },
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
      "unused-imports": unusedImports,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Explicit pin: prevents accidental downgrade if recommended preset changes.
      "react-hooks/rules-of-hooks": "error",
      // Cosmetic HMR-only rule: silenced to reduce warning noise.
      // Impatta solo hot-reload in dev; non è un bug di produzione.
      "react-refresh/only-export-components": "off",
      // Silenced: molte deps sono intenzionalmente omesse per evitare
      // re-render loop; le eccezioni sono già annotate con eslint-disable
      // dove serve. Rimane attivo `rules-of-hooks` (bug reale).
      "react-hooks/exhaustive-deps": "off",
      // Delega unused-vars a `unused-imports` che offre auto-fix per gli import.
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "warn",
      "unused-imports/no-unused-vars": [
        "warn",
        { vars: "all", varsIgnorePattern: "^_", args: "after-used", argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "error",
      "no-var": "error",
      "prefer-const": "error",
      // `!= null` è idioma legittimo per (null||undefined); vietiamo == e != su tutto il resto.
      "eqeqeq": ["error", "always", { "null": "ignore" }],
    },
  },
  // ── Test files override: mocks & console-based assertions are legitimate ──
  // Allow `any` and `console` in test code; production rules still enforced elsewhere.
  {
    files: [
      "src/test/**/*.{ts,tsx}",
      "src/**/*.test.{ts,tsx}",
      "src/__tests__/**/*.{ts,tsx}",
      "src/**/__tests__/**/*.{ts,tsx}",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
  // ── Ambient .d.ts declarations: `any` is idiomatic for external module shims ──
  {
    files: ["src/**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
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
  // ── Layer enforcement: components should not import from DAL directly ──
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@/data/*"],
              message: "Components should not import from src/data/ directly. Use a hook instead. See docs/architecture/OVERVIEW-2026-04-14.md",
            },
          ],
        },
      ],
    },
  },
  // ── Layer enforcement: hooks should not import types from components (except ui) ──
  {
    files: ["src/hooks/**/*.{ts,tsx}"],
    ignores: ["src/hooks/use-toast.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/acquisition/*", "@/components/cockpit/*", "@/components/contacts/*", "@/components/email/*", "@/components/operations/*", "@/components/global/*"],
              message: "Hooks should not import from src/components/. Move shared types to src/types/. See docs/architecture/OVERVIEW-2026-04-14.md",
            },
          ],
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
          selector: "ImportExpression > Literal[value=/^@\\/pages/]",
          message: "V2 pages should not lazy-import from v1 src/pages/. See docs/v2/MIGRATION_STATUS.md",
        },
      ],
    },
  },
  // ── public/ browser extensions: basic JS linting ──
  {
    files: ["public/**/*.js", "public/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        chrome: "readonly",
      },
    },
    rules: {
      "no-var": "error",
      "prefer-const": "error",
      "eqeqeq": ["error", "always"],
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  // ── Multichannel send governance (no-direct-extension-send) ──
  // Fuori da src/lib/messaging/* e dai bridge stessi, scoraggia chiamate
  // dirette a `.sendWhatsApp(...)` sui bridge: usa sendWhatsAppDirect /
  // queueWhatsAppForApproval da src/lib/messaging/whatsappSender.ts.
  // Stesso principio per LinkedIn (sendLinkedInDirect / queueLinkedInForApproval).
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/lib/messaging/**",
      "src/lib/inbox/sendMessage.ts",
      "src/hooks/useLinkedInMessagingBridge.ts",
      "src/hooks/useWhatsAppExtensionBridge.ts",
      "src/hooks/useApproveAndDispatch.ts",
      "src/components/test-extensions/**",
      "src/test/**",
      "src/**/*.test.{ts,tsx}",
      "src/hooks/__tests__/**",
    ],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "CallExpression[callee.property.name='sendWhatsApp']",
          message: "no-direct-extension-send: usa sendWhatsAppDirect / queueWhatsAppForApproval da src/lib/messaging/whatsappSender.ts.",
        },
      ],
    },
  },
);
