/**
 * LiveRegion — Accessible live region for screen reader announcements.
 *
 * Renders a visually hidden element with `aria-live="polite"` that announces
 * dynamic content changes to assistive technology users.
 *
 * @param message - The text to announce to screen readers
 *
 * @example
 * <LiveRegion message={isLoading ? "Caricamento..." : `${count} risultati trovati`} />
 */
interface LiveRegionProps {
  message: string;
}

export function LiveRegion({ message }: LiveRegionProps) {
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
