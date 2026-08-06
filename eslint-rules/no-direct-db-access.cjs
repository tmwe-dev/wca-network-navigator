/**
 * ESLint rule: no-direct-db-access
 *
 * Fase 1 del piano di consolidamento: il client del database ha UN SOLO
 * confine autorizzato. Nessun modulo fuori dal data layer può importare
 * `@/integrations/supabase/client` e usare `.from(...)`.
 *
 * Perimetro autorizzato:
 *  - src/data/**            → Data Access Layer v1 (fonte autorevole)
 *  - src/v2/io/supabase/**  → I/O layer v2
 *  - src/lib/typedSupabase.ts        → frontiera documentata per tabelle a nome runtime
 *  - src/v2/observability/supabaseTraceProxy.ts → strumentazione trace (wrappa il client)
 *  - test e file di test
 *
 * L'accesso a `supabase.auth`, `supabase.functions`, `supabase.storage`,
 * `supabase.channel` e `supabase.rpc` NON è vietato: riguardano sessione,
 * edge functions, storage e realtime, non l'accesso diretto alle tabelle.
 */
const ALLOWED_PATHS = [
  "/src/data/",
  "/src/v2/io/supabase/",
  "/src/lib/typedSupabase.ts",
  "/src/v2/observability/supabaseTraceProxy.ts",
  "/src/test/",
  "/__tests__/",
];

function isAllowed(filename) {
  const f = String(filename).replace(/\\/g, "/");
  if (f.endsWith(".test.ts") || f.endsWith(".test.tsx")) return true;
  return ALLOWED_PATHS.some((p) => f.includes(p));
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Vieta l'accesso diretto alle tabelle del database fuori dal data layer.",
    },
    schema: [],
    messages: {
      from:
        "[dal] Accesso diretto alla tabella '{{ table }}': passa dal data layer (src/data/ o src/v2/io/supabase/). Sessione, edge functions e storage restano consentiti.",
    },
  },
  create(context) {
    const filename =
      typeof context.getFilename === "function" ? context.getFilename() : context.filename;
    if (isAllowed(filename)) return {};

    // Nomi locali legati al client del database importato in questo file.
    const clientLocals = new Set();

    return {
      ImportDeclaration(node) {
        const source = String(node.source.value || "");
        if (
          source === "@/integrations/supabase/client" ||
          source.endsWith("/integrations/supabase/client")
        ) {
          for (const spec of node.specifiers) {
            if (spec.local && spec.local.name) clientLocals.add(spec.local.name);
          }
        }
      },
      CallExpression(node) {
        const callee = node.callee;
        if (!callee || callee.type !== "MemberExpression") return;
        if (callee.property.type !== "Identifier" || callee.property.name !== "from") return;
        const obj = callee.object;
        if (obj.type !== "Identifier" || !clientLocals.has(obj.name)) return;

        const arg = node.arguments[0];
        const table =
          arg && arg.type === "Literal" && typeof arg.value === "string" ? arg.value : "?";
        context.report({ node, messageId: "from", data: { table } });
      },
    };
  },
};