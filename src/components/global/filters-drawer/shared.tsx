/**
 * Shared primitives for FiltersDrawer sub-sections.
 * Estratti dal monolite per riuso e testabilità isolata.
 */
import { cn } from "@/lib/utils";

export function FilterSection({
  icon: Icon,
  label,
  trailing,
  children,
}: {
  icon: React.ElementType;
  label: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
          <Icon className="w-3.5 h-3.5 text-primary" />
          <span>{label}</span>
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function ChipGroup({
  children,
  columns,
}: {
  children: React.ReactNode;
  columns?: 2 | 3;
}) {
  if (columns) {
    const colsClass = columns === 2 ? "grid-cols-2" : "grid-cols-3";
    return <div className={cn("grid gap-1.5", colsClass)}>{children}</div>;
  }
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

export function Chip({
  active,
  onClick,
  children,
  block,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  block?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-8 px-2.5 rounded-md text-[11px] font-medium transition-all border flex items-center justify-center gap-1 whitespace-nowrap",
        block && "w-full",
        active
          ? "bg-primary/15 border-primary text-primary shadow-sm shadow-primary/10"
          : "border-border/60 bg-background/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-border"
      )}
    >
      {children}
    </button>
  );
}
