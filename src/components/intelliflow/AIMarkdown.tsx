import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMemo } from "react";

interface Props {
  content: string;
}

/**
 * Renders AI responses with:
 * 1. Proper GFM tables
 * 2. Stripped raw structured data (---STRUCTURED_DATA---, ---COMMAND---)
 * 3. "Azioni Suggerite" sections in a special callout
 */
export default function AIMarkdown({ content }: Props) {
  const segments = useMemo(() => {
    // Strip raw structured data blocks that should never be shown to the user
    let cleaned = content
      .replace(/---STRUCTURED_DATA---[\s\S]*?(?=\n\n|$)/g, "")
      .replace(/---COMMAND---[\s\S]*?(?=\n\n|$)/g, "")
      .replace(/```json[\s\S]*?```/g, "")
      .trim();

    // Split on action-related headings
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
        result.push({ type: "actions", text: part + "\n" + body });
        i++;
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
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.text}</ReactMarkdown>
          </div>
        ) : (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>{seg.text}</ReactMarkdown>
        )
      )}
    </>
  );
}
