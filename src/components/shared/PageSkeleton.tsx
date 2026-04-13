/**
 * PageSkeleton — Generic loading skeleton for lazy-loaded page fallbacks.
 * Renders animated placeholder blocks that mimic a typical page layout.
 */
export function PageSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="h-4 w-full bg-muted rounded" />
      <div className="h-4 w-3/4 bg-muted rounded" />
      <div className="h-64 w-full bg-muted rounded-lg mt-6" />
    </div>
  );
}
