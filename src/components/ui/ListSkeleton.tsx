import { Skeleton } from "@/components/ui/skeleton";

interface ListSkeletonProps {
  rows?: number;
}

export function ListSkeleton({ rows = 5 }: ListSkeletonProps) {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-md" />
      ))}
    </div>
  );
}
