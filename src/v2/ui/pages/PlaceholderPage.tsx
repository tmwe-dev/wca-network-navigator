import { motion } from "framer-motion";

const ease = [0.2, 0.8, 0.2, 1] as const;

const pages: Record<string, { title: string; subtitle: string }> = {
  engine: { title: "Engine", subtitle: "Motore di orchestrazione AI" },
  architecture: { title: "Architecture", subtitle: "Architettura del sistema" },
  connections: { title: "Connections", subtitle: "Integrazioni e connettori" },
  templates: { title: "Templates", subtitle: "Template email e messaggi" },
  automations: { title: "Automations", subtitle: "Regole e automazioni" },
  audit: { title: "Audit", subtitle: "Log di audit e governance" },
};

export function PlaceholderPage({ pageKey }: { pageKey: string }) {
  const info = pages[pageKey] ?? { title: pageKey, subtitle: "In costruzione" };

  return (
    <div className="h-full flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="text-center space-y-2"
      >
        <h1 className="text-2xl font-light tracking-[-0.03em] text-gradient-hero">{info.title}</h1>
        <p className="text-[12px] text-muted-foreground">{info.subtitle}</p>
        <p className="text-[10px] text-muted-foreground/50 font-mono mt-4">Disponibile nella prossima versione</p>
      </motion.div>
    </div>
  );
}
