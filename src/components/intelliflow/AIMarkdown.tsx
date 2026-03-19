import ReactMarkdown from "react-markdown";
import { useMemo } from "react";

interface Props {
  content: string;
}

/**
 * Splits AI response into segments, wrapping "Azioni Suggerite" sections
 * in a special brown/amber callout container.
 */
export default function AIMarkdown({ content }: Props) {
  const segments = useMemo(() => {
    // Split on action-related headings (### or ####) with 🎯 or "Azioni"
    const actionPattern = /^(#{2,4}\s*(?:🎯|💡|🚀)?\s*Azioni\s+Suggerite.*)/im;
    const parts = content.split(actionPattern);

    if (parts.length <= 1) {
      return [{ type: "normal" as const, text: content }];
    }

    const result: { type: "normal" | "actions"; text: string }[] = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part?.trim()) continue;

      if (actionPattern.test(part)) {
        // This is the heading — combine with the next part (the body)
        const body = parts[i + 1] || "";
        result.push({ type: "actions", text: part + "\n" + body });
        i++; // skip body part
      } else {
        result.push({ type: "normal", text: part });
      }
    }

    return result;
  }, [content]);

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "actions" ? (
          <div key={i} className="ai-actions-callout">
            <ReactMarkdown>{seg.text}</ReactMarkdown>
          </div>
        ) : (
          <ReactMarkdown key={i}>{seg.text}</ReactMarkdown>
        )
      )}
    </>
  );
}
