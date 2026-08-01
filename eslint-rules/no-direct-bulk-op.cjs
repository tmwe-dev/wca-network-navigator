/**
 * ESLint rule: no-direct-bulk-op
 * Vieta di chiamare dalle UI le edge / hook bulk senza passare dal runner bulkOps.
 */
const FORBIDDEN_EDGE = new Set([
  "enrich-partner-website", "batch-enrichment-worker", "sherlock-extract",
  "process-download-job", "process-inbound-enrichment", "suggest-email-groups",
  "verify-whatsapp-number", "verify-linkedin-profile", "verify-email-address",
  "find-import-duplicates", "extension-dispatch-enqueue", "backfill-email-rules",
]);

const FORBIDDEN_HOOKS = new Set([
  "useDeepSearchV2", "useDeepSearchRunner", "useDeepSearchLocal",
  "useBulkLinkedInDispatch", "useBaseEnrichment",
]);

function isAllowed(filename) {
  const f = filename.replace(/\\/g, "/");
  return (
    f.includes("/src/v2/services/bulkOps/") ||
    f.includes("/src/data/") ||
    f.includes("/src/lib/api/") ||
    f.includes("/src/lib/ai/") ||
    f.endsWith(".test.ts") || f.endsWith(".test.tsx")
  );
}

module.exports = {
  meta: {
    type: "problem",
    docs: { description: "Vietato chiamare edge/hook bulk fuori da runBulkOp." },
    schema: [],
    messages: {
      edge: "[bulkOps] '{{ fn }}' è un'edge bulk: usa runBulkOp(scope, items).",
      hook: "[bulkOps] hook '{{ name }}' è interno a bulkOps: importa solo da src/v2/services/bulkOps/.",
    },
  },
  create(context) {
    if (isAllowed(context.getFilename())) return {};
    function checkInvoke(node) {
      const arg = node.arguments[0];
      if (!arg || arg.type !== "Literal" || typeof arg.value !== "string") return;
      if (FORBIDDEN_EDGE.has(arg.value)) {
        context.report({ node, messageId: "edge", data: { fn: arg.value } });
      }
    }
    return {
      ImportDeclaration(node) {
        for (const spec of node.specifiers) {
          if (spec.type === "ImportSpecifier" && FORBIDDEN_HOOKS.has(spec.imported.name)) {
            context.report({ node: spec, messageId: "hook", data: { name: spec.imported.name } });
          }
        }
      },
      CallExpression(node) {
        const c = node.callee;
        if (
          c.type === "MemberExpression" &&
          c.property.type === "Identifier" && c.property.name === "invoke" &&
          c.object.type === "MemberExpression" &&
          c.object.property.type === "Identifier" && c.object.property.name === "functions"
        ) checkInvoke(node);
        if (c.type === "Identifier" && c.name === "invokeEdge") checkInvoke(node);
      },
    };
  },
};