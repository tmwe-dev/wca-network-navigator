/**
 * Loading skeletons — Sprint J UX hardening.
 * Provides placeholder layouts for pages, tables, cards, and forms.
 */
import { Skeleton } from "@/components/ui/skeleton";

/* ── Page skeleton ─────────────────────────────────────────────────── */

export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      {/* Content blocks */}
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/* ── Table skeleton ────────────────────────────────────────────────── */

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="space-y-2 p-4">
      {/* Header row */}
      <div className="flex gap-4">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={`header-${i}`} className="h-6 flex-1" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }, (_, ri) => (
        <div key={`row-${ri}`} className="flex gap-4">
          {Array.from({ length: columns }, (_, ci) => (
            <Skeleton key={`cell-${ri}-${ci}`} className="h-10 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Card skeleton ─────────────────────────────────────────────────── */

interface CardSkeletonProps {
  count?: number;
}

export function CardSkeleton({ count = 3 }: CardSkeletonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={`card-${i}`} className="rounded-lg border p-4 space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Form skeleton ─────────────────────────────────────────────────── */

interface FormSkeletonProps {
  fields?: number;
}

export function FormSkeleton({ fields = 4 }: FormSkeletonProps) {
  return (
    <div className="space-y-6 p-6 max-w-lg">
      {Array.from({ length: fields }, (_, i) => (
        <div key={`field-${i}`} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
      <Skeleton className="h-10 w-32 rounded-md" />
    </div>
  );
}
