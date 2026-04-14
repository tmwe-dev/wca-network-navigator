import { TrendingUp, DollarSign, Users, Star } from "lucide-react";

function formatCurrency(n: number | null) {
  if (!n) return "—";
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`;
  return `€${n.toFixed(0)}`;
}

interface RACompanyKPIProps {
  prospect: any;
}

export function RACompanyKPI({ prospect }: RACompanyKPIProps) {
  return (
    <div className="flex-shrink-0 px-6 py-4 border-b border-white/5 bg-white/1">
      <div className="grid grid-cols-4 gap-4">
        <KPICard icon={TrendingUp} iconColor="text-amber-400" label="Fatturato" value={formatCurrency(prospect.fatturato)}
          subtitle={prospect.fatturato && prospect.utile ? `Margine: ${((prospect.utile / prospect.fatturato) * 100).toFixed(1)}%` : undefined} />
        <KPICard icon={DollarSign} iconColor="text-green-400" label="Utile" value={formatCurrency(prospect.utile)}
          subtitle={prospect.anno_bilancio ? `Anno ${prospect.anno_bilancio}` : undefined} />
        <KPICard icon={Users} iconColor="text-blue-400" label="Dipendenti" value={String(prospect.dipendenti ?? "—")} subtitle="Organico" />
        <KPICard icon={Star} iconColor="text-yellow-400" label="Credit Score" value={String(prospect.credit_score ?? "—")}
          subtitle={prospect.rating_affidabilita || "N/A"} />
      </div>
    </div>
  );
}

function KPICard({ icon: Icon, iconColor, label, value, subtitle }: {
  icon: React.ElementType; iconColor: string; label: string; value: string; subtitle?: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-xl hover:border-white/20 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white/95">{value}</div>
      {subtitle && <p className="text-xs text-white/50 mt-1">{subtitle}</p>}
    </div>
  );
}

export { formatCurrency };
