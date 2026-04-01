import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Globe, Users, ArrowRight, Activity, Mail, Bot } from "lucide-react";
import { useCountryStats } from "@/hooks/useCountryStats";
import { useOperationsCenter } from "@/hooks/useOperationsCenter";
import OperationsCenter from "@/components/home/OperationsCenter";

export default function Dashboard() {
  const navigate = useNavigate();
  const countryStats = useCountryStats();
  const globalStats = countryStats.data?.global;
  const totalPartners = globalStats?.total ?? 0;
  const { stats } = useOperationsCenter();

  const areas = [
    {
      key: "network",
      title: "Network",
      subtitle: "WCA Partners Hub",
      icon: Globe,
      path: "/network",
      stat: totalPartners,
      statLabel: "partner",
      description: "Gestisci partner per paese, qualità network, deep search",
      gradient: "from-primary/15 to-primary/5",
      iconColor: "text-primary",
      borderColor: "border-primary/20",
    },
    {
      key: "crm",
      title: "CRM",
      subtitle: "Contatti Hub",
      icon: Users,
      path: "/crm",
      stat: 0,
      statLabel: "contatti",
      description: "Rubrica contatti, import, biglietti da visita, gruppi",
      gradient: "from-accent/15 to-accent/5",
      iconColor: "text-accent-foreground",
      borderColor: "border-accent/20",
    },
  ];

  const quickStats = [
    { icon: Activity, label: "Attività in sospeso", value: stats.pendingActivities },
    { icon: Mail, label: "Email in coda", value: stats.pendingEmails },
    { icon: Bot, label: "Task agenti attivi", value: stats.runningTasks },
  ];

  return (
    <div className="flex flex-col items-center p-6 overflow-auto h-full">
      <div className="w-full max-w-3xl space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-1"
        >
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            WCA Partners
          </h1>
          <p className="text-sm text-muted-foreground">
            Scegli la tua area di lavoro
          </p>
        </motion.div>

        {/* Two main cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {areas.map((area, i) => (
            <motion.button
              key={area.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.1, duration: 0.4 }}
              onClick={() => navigate(area.path)}
              className={`group relative flex flex-col items-start gap-4 rounded-xl border ${area.borderColor} bg-gradient-to-br ${area.gradient} p-6 text-left transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.99]`}
            >
              <div className="flex w-full items-start justify-between">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-background/80 shadow-sm ${area.iconColor}`}>
                  <area.icon className="h-6 w-6" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
              </div>

              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">{area.title}</h2>
                <p className="text-xs text-muted-foreground">{area.subtitle}</p>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tabular-nums text-foreground">
                  {area.stat.toLocaleString("it-IT")}
                </span>
                <span className="text-sm text-muted-foreground">{area.statLabel}</span>
              </div>

              <p className="text-xs text-muted-foreground/80 leading-relaxed">
                {area.description}
              </p>
            </motion.button>
          ))}
        </div>

        {/* Quick stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="flex justify-center gap-6"
        >
          {quickStats.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-muted-foreground">
              <s.icon className="h-3.5 w-3.5" />
              <span className="text-xs">{s.label}:</span>
              <span className="text-xs font-semibold text-foreground">{s.value}</span>
            </div>
          ))}
        </motion.div>

        {/* Operations Center */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <OperationsCenter />
        </motion.div>
      </div>
    </div>
  );
}
