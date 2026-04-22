import React from "react";

export function KpiCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn";
}) {
  const toneCls =
    tone === "warn"
      ? "text-primary"
      : tone === "ok"
      ? "text-emerald-500"
      : "text-foreground";
  return (
    <div className="p-4 rounded-xl border border-border bg-card">
      <div className="text-[11px] uppercase font-semibold text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${toneCls}`}>{value}</div>
    </div>
  );
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-4 py-2 border-b border-border text-[11px] uppercase font-semibold text-muted-foreground">
        {title}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    error: "bg-destructive/10 text-destructive",
    timeout: "bg-primary/10 text-primary",
    rate_limited: "bg-primary/10 text-primary",
    blocked: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

export function SkeletonRows() {
  return (
    <div className="space-y-2 max-w-6xl">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
      ))}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="max-w-3xl p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-sm text-destructive">
      <div className="font-semibold mb-1">Errore caricamento telemetria</div>
      <div className="text-xs font-mono">{message}</div>
      <div className="text-[11px] text-destructive/80 mt-2">
        Verifica che la migration Wave 6 sia stata applicata e che le RLS permettano la lettura.
      </div>
    </div>
  );
}

export function EmptyTelemetry({ label }: { label: string }) {
  return (
    <div className="max-w-md mx-auto text-center py-16">
      <p className="text-6xl mb-4">📭</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
