import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMemo } from "react";
import { sanitizeVisibleAiText } from "@/lib/ai/agentResponse";

interface Props {
  content: string;
}

/**
 * Central AI markdown renderer with a hard guardrail against leaked
 * structured payloads, UI actions, commands, and raw JSON/code.
 */
export default function AIMarkdown({ content }: Props) {
  const segments = useMemo(() => {
    const cleaned = sanitizeVisibleAiText(content);

    const actionPattern = /^(#{2,4}\s*(?:🎯|💡|🚀)?\s*Azioni\s+Suggerite.*)/im;
    const parts = cleaned.split(actionPattern);

    if (parts.length <= 1) {
      return [{ type: "normal" as const, text: cleaned }];
    }

    const result: { type: "normal" | "actions"; text: string }[] = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part?.trim()) continue;

      if (actionPattern.test(part)) {
        const body = parts[i + 1] || "";
        result.push({ type: "actions", text: `${part}\n${body}`.trim() });
        i++;
      } else {
        result.push({ type: "normal", text: part.trim() });
      }
    }

    return result;
  }, [content]);

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "actions" ? (
          <div key={i} className="ai-actions-callout">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.text}</ReactMarkdown>
          </div>
        ) : (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>{seg.text}</ReactMarkdown>
        ),
      )}
    </>
  );
}
