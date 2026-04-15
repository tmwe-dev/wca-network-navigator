import { motion, AnimatePresence } from "framer-motion";
import { Wand2, ThumbsUp, Download, X, CheckCircle2, Upload, FileText, Users } from "lucide-react";
import TemplateSuggest from "./TemplateSuggest";

const ease = [0.2, 0.8, 0.2, 1] as const;

/* ── Table Canvas ── */
interface TableRow { name: string; sector: string; revenue: string; days: string; churn: number }

export const TableCanvas = ({
  data, onClose, title = "ANALISI · PROPOSTA"
}: { data: TableRow[]; onClose: () => void; title?: string }) => (
  <CanvasShell onClose={onClose} title={title}>
    <div className="grid grid-cols-3 gap-3 mb-8">
      {[
        { label: "Account a rischio", value: "34" },
        { label: "Fatturato esposto", value: "€4.2M" },
        { label: "Score medio", value: "76" },
      ].map((kpi, i) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.4 + i * 0.1, duration: 0.5, ease }}
          className="p-4 rounded-xl text-center"
          style={{ background: "hsl(240 5% 7% / 0.7)", border: "1px solid hsl(0 0% 100% / 0.1)" }}
        >
          <div className="text-2xl font-extralight tracking-tight text-foreground/100">{kpi.value}</div>
          <div className="text-[9px] text-muted-foreground/97 mt-1.5 tracking-wider uppercase">{kpi.label}</div>
        </motion.div>
      ))}
    </div>

    {/* Source indicator */}
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="flex items-center gap-3 mb-4 px-1"
    >
      <span className="text-[8px] text-muted-foreground/100 tracking-[0.2em] uppercase font-mono">FONTE</span>
      <span className="text-[9px] text-muted-foreground/100 font-light">Partner DB · Contact Import · Activity Engine · ML Scoring</span>
    </motion.div>

    <table className="w-full">
      <thead>
        <tr className="text-[9px] text-muted-foreground/97 font-mono tracking-wider">
          <th className="text-left pb-3 font-normal">PARTNER</th>
          <th className="text-left pb-3 font-normal">SETTORE</th>
          <th className="text-right pb-3 font-normal">REVENUE</th>
          <th className="text-right pb-3 font-normal">INATTIVITÀ</th>
          <th className="text-right pb-3 font-normal">SCORE</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <motion.tr
            key={row.name}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 + i * 0.06, duration: 0.35, ease }}
            className="border-t border-border/[0.12] group cursor-pointer"
          >
            <td className="py-3 text-[13px] font-light text-foreground/100 group-hover:text-primary/96 transition-colors duration-500">{row.name}</td>
            <td className="py-3 text-[11px] text-muted-foreground/97">{row.sector}</td>
            <td className="py-3 text-[13px] text-right font-mono text-muted-foreground/100">{row.revenue}</td>
            <td className="py-3 text-[12px] text-right text-muted-foreground/97">{row.days} gg</td>
            <td className="py-3 text-right">
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded-lg ${
                row.churn >= 85 ? "text-destructive/75 bg-destructive/[0.06]"
                : row.churn >= 70 ? "text-warning/96 bg-warning/[0.06]"
                : "text-success/95 bg-success/[0.06]"
              }`}>{row.churn}</span>
            </td>
          </motion.tr>
        ))}
      </tbody>
    </table>
    <TemplateSuggest visible label="Salva questa vista come template" />
  </CanvasShell>
);

/* ── Campaign Canvas ── */
export const CampaignCanvas = ({ onClose }: { onClose: () => void }) => (
  <CanvasShell onClose={onClose} title="CAMPAGNA · ANTEPRIMA">
    <div className="grid grid-cols-2 gap-3 mb-6">
      {[
        { label: "Destinatari", value: "50 lead importati" },
        { label: "Sorgente", value: "CRM Import · Network" },
        { label: "Template base", value: "Re-engagement Q1" },
        { label: "Personalizzazione", value: "Per contatto" },
      ].map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 + i * 0.08, ease }}
          className="p-3.5 rounded-xl"
          style={{ background: "hsl(240 5% 7% / 0.7)", border: "1px solid hsl(0 0% 100% / 0.1)" }}
        >
          <div className="text-[9px] text-muted-foreground/97 tracking-wider uppercase mb-1">{item.label}</div>
          <div className="text-[13px] font-light text-foreground/100">{item.value}</div>
        </motion.div>
      ))}
    </div>

    {/* Email preview */}
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8, ease }}
      className="rounded-xl p-5 mb-4"
      style={{ background: "hsl(240 5% 8% / 0.75)", border: "1px solid hsl(0 0% 100% / 0.1)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] text-muted-foreground/97 tracking-wider uppercase">ANTEPRIMA BOZZA · 1 DI 50</span>
        <span className="text-[8px] text-muted-foreground/100 font-mono">Email Draft #2847</span>
      </div>
      <div className="text-[11px] text-primary/92 mb-3 font-mono">A: marco.bianchi@techbridge.jp</div>
      <div className="text-[11px] text-foreground/100 mb-3 font-mono">Oggetto: È passato un po', Marco — aggiornamenti per TechBridge</div>
      <div className="text-[12px] text-foreground/100 leading-relaxed font-light space-y-2">
        <p>Gentile Marco,</p>
        <p>Sono passati 98 giorni dal nostro ultimo contatto. Nel frattempo, il settore Technology in Asia ha visto sviluppi significativi che potrebbero interessare TechBridge Japan.</p>
        <p>Sulla base del vostro storico di acquisti nel segmento infrastrutture cloud, abbiamo preparato un'analisi dedicata che vorremmo condividere.</p>
        <p className="text-muted-foreground/100 italic">— Bozza generata da Communication Agent · Dati da Contact Memory + Activity Engine</p>
      </div>
    </motion.div>

    {/* Delivery plan */}
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1, ease }}
      className="rounded-xl p-4 mb-4"
      style={{ background: "hsl(240 5% 7% / 0.65)", border: "1px solid hsl(0 0% 100% / 0.1)" }}
    >
      <div className="text-[9px] text-muted-foreground/97 tracking-wider uppercase mb-3">PIANO DI INVIO</div>
      <div className="space-y-2">
        {[
          { wave: "Wave 1", count: "17 email", time: "Immediato", targets: "Score ≥85 · Priorità alta" },
          { wave: "Wave 2", count: "17 email", time: "+40 min", targets: "Score 70-84 · Priorità media" },
          { wave: "Wave 3", count: "16 email", time: "+80 min", targets: "Score <70 · Nurturing" },
        ].map((w) => (
          <div key={w.wave} className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-3">
              <span className="text-foreground/100 font-light">{w.wave}</span>
              <span className="text-muted-foreground/100 font-mono text-[9px]">{w.count}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground/100 text-[9px]">{w.targets}</span>
              <span className="text-muted-foreground/100 font-mono text-[9px]">{w.time}</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>

    <div className="flex items-start gap-3 mt-2">
      <Wand2 className="w-3 h-3 text-primary/92 mt-0.5 flex-shrink-0" />
      <p className="text-[11px] text-muted-foreground/97 leading-relaxed font-light">
        Ogni email generata dal Communication Agent usando dati da Contact Memory, Activity Engine e Template Library. Governance check completato.
      </p>
    </div>

    <TemplateSuggest visible label="Salva questa campagna come template" />
  </CanvasShell>
);

/* ── Report Canvas ── */
export const ReportCanvas = ({ onClose }: { onClose: () => void }) => (
  <CanvasShell onClose={onClose} title="REPORT · EXECUTIVE">
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, ease }}
      className="mb-8"
    >
      <div className="text-[9px] text-muted-foreground/100 tracking-wider uppercase mb-4">PARTNER PERFORMANCE · ASIA PACIFIC · Q1 2026</div>
      <h3 className="text-xl font-extralight tracking-tight text-foreground/100 mb-1">Executive Summary</h3>
      <p className="text-[12px] text-muted-foreground/98 font-light">
        Generato da Data Analyst Agent · Fonti: Partner DB, Activity Engine, Campaign History
      </p>
    </motion.div>

    <div className="grid grid-cols-4 gap-2.5 mb-8">
      {[
        { label: "Partner attivi", value: "23" },
        { label: "Revenue YTD", value: "€8.7M" },
        { label: "Crescita YoY", value: "+14%" },
        { label: "NPS medio", value: "72" },
      ].map((kpi, i) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 + i * 0.08, ease }}
          className="p-3 rounded-xl text-center"
          style={{ background: "hsl(240 5% 7% / 0.7)", border: "1px solid hsl(0 0% 100% / 0.1)" }}
        >
          <div className="text-lg font-extralight text-foreground/100">{kpi.value}</div>
          <div className="text-[8px] text-muted-foreground/100 mt-1 tracking-wider uppercase">{kpi.label}</div>
        </motion.div>
      ))}
    </div>

    {[
      { title: "Performance", body: "Il portafoglio Asia (23 partner attivi) ha registrato una crescita del 14% YoY, trainata dal segmento Technology (+22%). Il Giappone resta il mercato più maturo con €3.1M di revenue e 8 partner. Il Sud-est Asiatico mostra il tasso di crescita più alto (+31%) con 6 partner in espansione." },
      { title: "Rischi identificati", body: "3 partner con revenue >€400k mostrano segni di disengagement (NPS <50, attività in calo del 40% nel trimestre). TechBridge Japan ha ridotto il volume ordini del 28%. Nota: 2 dei 3 partner a rischio non hanno ricevuto campagne negli ultimi 90 giorni." },
      { title: "Raccomandazioni AI", body: "1) Avviare re-engagement strutturato per i 3 partner a rischio — template già disponibile in Campaign Engine. 2) Intensificare il programma partner per il SEA — 4 prospect identificati da Deep Search. 3) Valutare l'ingresso nel mercato indiano tramite il partner Meridian." },
    ].map((section, i) => (
      <motion.div
        key={section.title}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 + i * 0.15, ease }}
        className="mb-6"
      >
        <div className="text-[10px] text-primary/96 tracking-wider uppercase mb-2 font-mono">{section.title}</div>
        <p className="text-[12px] text-foreground/100 leading-[1.8] font-light">{section.body}</p>
      </motion.div>
    ))}

    <TemplateSuggest visible label="Salva questo formato report" />
  </CanvasShell>
);

/* ── Execution Result Canvas (Scenario-Aware) ── */
interface ResultCanvasProps {
  onClose: () => void;
  scenarioKey?: string;
}

const resultConfigs: Record<string, { title: string; subtitle: string; kpis: { label: string; value: string }[]; audit: { action: string; agent: string; time: string }[] }> = {
  import: {
    title: "Importazione completata",
    subtitle: "287 contatti importati · 23 match WCA · Audit log aggiornato",
    kpis: [
      { label: "Importati", value: "287" },
      { label: "Match WCA", value: "23" },
      { label: "Arricchiti", value: "42" },
    ],
    audit: [
      { action: "Parse Contact File", agent: "CRM Core Agent", time: "14:01" },
      { action: "Deduplicate & Merge", agent: "CRM Core Agent", time: "14:01" },
      { action: "Deep Search enrichment", agent: "Data Agent", time: "14:02" },
      { action: "Approvazione utente", agent: "Marco R.", time: "14:03" },
      { action: "Update CRM Records", agent: "Automation Agent", time: "14:03" },
      { action: "Audit Action registrato", agent: "Governance Agent", time: "14:03" },
    ],
  },
  campaign: {
    title: "Campagna avviata con successo",
    subtitle: "50 email personalizzate in coda · 3 wave · Audit log aggiornato",
    kpis: [
      { label: "In coda", value: "50" },
      { label: "Inviate", value: "0" },
      { label: "Wave attiva", value: "1/3" },
    ],
    audit: [
      { action: "Proposta generata", agent: "Communication Agent", time: "14:02" },
      { action: "Governance check", agent: "Governance Agent", time: "14:02" },
      { action: "Approvazione utente", agent: "Marco R.", time: "14:03" },
      { action: "Esecuzione avviata", agent: "Automation Agent", time: "14:03" },
    ],
  },
  batch: {
    title: "Invio batch completato",
    subtitle: "120 email inviate · 4 wave · Governance verificata",
    kpis: [
      { label: "Inviate", value: "120" },
      { label: "Wave", value: "4/4" },
      { label: "Errori", value: "0" },
    ],
    audit: [
      { action: "Validazione contatti", agent: "CRM Core Agent", time: "14:01" },
      { action: "Governance pre-check", agent: "Governance Agent", time: "14:01" },
      { action: "Approvazione step-by-step", agent: "Marco R.", time: "14:02" },
      { action: "Send Email Batch ×4", agent: "Automation Agent", time: "14:03" },
      { action: "Audit Action registrato", agent: "Governance Agent", time: "14:04" },
    ],
  },
  template: {
    title: "Template salvato",
    subtitle: "Disponibile in Template Library · Riutilizzabile",
    kpis: [
      { label: "Template ID", value: "#T-0042" },
      { label: "Step", value: "6" },
      { label: "Stato", value: "Attivo" },
    ],
    audit: [
      { action: "Flusso analizzato", agent: "Orchestratore", time: "14:02" },
      { action: "Template creato", agent: "Memory Agent", time: "14:02" },
      { action: "Audit Action registrato", agent: "Governance Agent", time: "14:02" },
    ],
  },
};

export const ResultCanvas = ({ onClose, scenarioKey }: ResultCanvasProps) => {
  const config = resultConfigs[scenarioKey || ""] || resultConfigs.campaign;

  return (
    <CanvasShell onClose={onClose} title="ESECUZIONE · COMPLETATA">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, ease }}
        className="text-center py-8"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
          className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"
        >
          <ThumbsUp className="w-5 h-5 text-success/95" />
        </motion.div>
        <div className="text-lg font-extralight text-foreground/100 mb-2">{config.title}</div>
        <p className="text-[12px] text-muted-foreground/97 font-light">{config.subtitle}</p>
      </motion.div>

      <div className="grid grid-cols-3 gap-3 mt-4 mb-6">
        {config.kpis.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 + i * 0.1, ease }}
            className="p-3 rounded-xl text-center"
            style={{ background: "hsl(240 5% 7% / 0.7)", border: "1px solid hsl(0 0% 100% / 0.1)" }}
          >
            <div className="text-lg font-extralight text-foreground/100">{s.value}</div>
            <div className="text-[9px] text-muted-foreground/100 mt-1 tracking-wider uppercase">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Audit reference */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="px-4 py-3 rounded-xl mb-4"
        style={{ background: "hsl(240 5% 7% / 0.65)", border: "1px solid hsl(0 0% 100% / 0.1)" }}
      >
        <div className="text-[9px] text-muted-foreground/100 tracking-wider uppercase mb-2">AUDIT TRAIL</div>
        <div className="space-y-1">
          {config.audit.map((log) => (
            <div key={log.action} className="flex items-center justify-between text-[10px]">
              <span className="text-foreground/100 font-light">{log.action}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground/100 font-mono text-[9px]">{log.agent}</span>
                <span className="text-muted-foreground/100 font-mono text-[9px]">{log.time}</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <TemplateSuggest visible label="Salva questo flusso come automazione ripetibile" />
    </CanvasShell>
  );
};

/* ── Shell ── */
export const CanvasShell = ({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) => (
  <div className="h-full flex flex-col rounded-2xl p-6" style={{
    background: "hsl(240 5% 6% / 0.75)",
    backdropFilter: "blur(40px) saturate(1.1)",
    border: "1px solid hsl(0 0% 100% / 0.12)",
    boxShadow: "0 0 80px hsl(210 100% 66% / 0.03), 0 30px 60px -20px hsl(0 0% 0% / 0.65)",
  }}>
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <motion.div
          className="w-1.5 h-1.5 rounded-full bg-primary/95"
          animate={{ opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <span className="text-[10px] text-muted-foreground/97 font-mono tracking-wider">{title}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button className="text-muted-foreground/100 hover:text-muted-foreground/98 transition-colors duration-500 p-1.5">
          <Download className="w-3 h-3" />
        </button>
        <button onClick={onClose} className="text-muted-foreground/100 hover:text-muted-foreground/98 transition-colors duration-500 p-1.5">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
    <div className="flex-1 overflow-y-auto">{children}</div>
  </div>
);

export default CanvasShell;