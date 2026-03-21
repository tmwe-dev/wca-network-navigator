import { lazy, Suspense } from "react";
import type { ComponentProps } from "react";

const ReactMarkdownLazy = lazy(() => import("react-markdown"));

type MarkdownProps = ComponentProps<typeof ReactMarkdownLazy>;

/**
 * Lazy-loaded ReactMarkdown wrapper.
 * Keeps ~45KB of react-markdown out of the initial bundle.
 */
export function LazyMarkdown(props: MarkdownProps) {
  return (
    <Suspense fallback={<div className="animate-pulse text-xs text-muted-foreground">...</div>}>
      <ReactMarkdownLazy {...props} />
    </Suspense>
  );
}
