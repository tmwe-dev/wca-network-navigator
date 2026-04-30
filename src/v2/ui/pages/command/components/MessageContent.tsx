/**
 * MessageContent — Standardized markdown renderer for AI messages in Command.
 * Uses react-markdown + remark-gfm. Tags mapped to design tokens (no HSL hardcoded).
 * No raw HTML allowed (XSS-safe by default).
 */
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  readonly content: string;
}

export default function MessageContent({ content }: Props) {
  return (
    <div className="text-[14px] leading-[1.7] font-light text-foreground/100 space-y-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-[15px] font-light text-primary/95 mt-2 mb-1">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[14px] font-light text-primary/95 mt-2 mb-1">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[13px] font-light text-primary/95 mt-2 mb-1 tracking-wide">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-[12px] font-medium text-foreground/95 mt-1.5 mb-0.5 uppercase tracking-wider">{children}</h4>
          ),
          p: ({ children }) => (
            <p className="text-[14px] leading-[1.7] text-foreground/95 whitespace-pre-line">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1 text-[13px] text-foreground/95 marker:text-primary/70">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1 text-[13px] text-foreground/95 marker:text-primary/70">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-[1.6]">{children}</li>,
          strong: ({ children }) => (
            <span className="text-primary/92 font-mono text-[12px]">{children}</span>
          ),
          em: ({ children }) => <em className="italic text-foreground/85">{children}</em>,
          code: ({ children }) => (
            <code className="font-mono text-[11px] px-1 py-0.5 rounded bg-muted/30 text-foreground/95">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="font-mono text-[11px] p-3 rounded-lg bg-muted/30 text-foreground/95 overflow-x-auto whitespace-pre">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/40 pl-3 italic text-muted-foreground/95">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-0 border-t border-primary/20 my-3" />,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-primary/95 underline underline-offset-2 hover:text-primary">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="text-[12px] border-collapse w-full">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border/40 bg-muted/30 px-2 py-1 text-left font-medium text-foreground/95">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border/30 px-2 py-1 text-foreground/90">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}