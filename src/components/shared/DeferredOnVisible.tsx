/**
 * DeferredOnVisible — Renders children only after the placeholder enters the viewport.
 *
 * Use to defer expensive widgets (charts, heavy lazy chunks, AI calls) so they
 * don't compete with above-the-fold rendering. Falls back to immediate render
 * if IntersectionObserver is unavailable.
 */
import * as React from "react";

interface Props {
  /** Skeleton/placeholder shown until the element scrolls into view. */
  readonly placeholder: React.ReactNode;
  /** rootMargin for the IntersectionObserver — preload slightly before visible. */
  readonly rootMargin?: string;
  readonly children: React.ReactNode;
}

export function DeferredOnVisible({
  placeholder,
  rootMargin = "200px",
  children,
}: Props): React.ReactElement {
  const [visible, setVisible] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (visible) return;
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  if (visible) return <>{children}</>;
  return <div ref={ref}>{placeholder}</div>;
}
