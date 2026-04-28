/**
 * ESLint rule: no-direct-ai-invoke
 * Charter R3: vietato chiamare edge function AI senza passare da invokeAi.
 */
const AI_FUNCTIONS = new Set([
  "ai-assistant", "agent-execute", "agent-loop", "agent-simulate",
  "agent-prompt-refiner", "agent-task-drainer", "unified-assistant",
  "generate-email", "generate-outreach", "improve-email",
  "classify-email-response", "classify-inbound-message",
  "categorize-content", "suggest-email-groups", "parse-business-card",
  "agentic-decide", "sherlock-extract", "prompt-test-runner", "daily-briefing",
]);

const ALLOWED_FILES = [
  "src/lib/ai/invokeAi.ts",
  "src/lib/api/invokeEdge.ts",
  "src/test/invoke-edge.test.ts",
];

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Vietato chiamare edge function AI senza il gateway invokeAi (AI Invocation Charter R3)",
    },
    schema: [],
    messages: {
      direct: "Charter R3: '{{ fn }}' è una edge function AI — usare invokeAi() invece di {{ method }}().",
    },
  },
  create(context) {
    const filename = context.getFilename().replace(/\\/g, "/");
    if (ALLOWED_FILES.some((f) => filename.endsWith(f))) return {};

    function checkCall(node, methodName) {
      const arg = node.arguments[0];
      if (!arg || arg.type !== "Literal" || typeof arg.value !== "string") return;
      if (!AI_FUNCTIONS.has(arg.value)) return;
      context.report({
        node,
        messageId: "direct",
        data: { fn: arg.value, method: methodName },
      });
    }

    return {
      CallExpression(node) {
        // supabase.functions.invoke("ai-assistant", ...)
        const c = node.callee;
        if (
          c.type === "MemberExpression" &&
          c.property.type === "Identifier" &&
          c.property.name === "invoke" &&
          c.object.type === "MemberExpression" &&
          c.object.property.type === "Identifier" &&
          c.object.property.name === "functions"
        ) {
          checkCall(node, "supabase.functions.invoke");
        }
        // invokeEdge("ai-assistant", ...)
        if (c.type === "Identifier" && c.name === "invokeEdge") {
          checkCall(node, "invokeEdge");
        }
      },
    };
  },
};