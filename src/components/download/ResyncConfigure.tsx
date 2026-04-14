import { useState, useEffect, useContext, createContext } from "react";
import { getWcaCookie, setWcaCookie } from "@/lib/wcaCookieStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw, Play, Users, Mail, Phone, AlertTriangle, ArrowRight, Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";

const log = createLogger("ResyncConfigure");
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { WCA_NETWORKS } from "@/data/wcaFilters";

const ThemeCtx = createContext(true);

interface NetworkStats {
  network_name: string;
  total_partners: number;
  missing_contacts: number;
  wca_ids: number[];
}

import { useScrapingSettings } from "@/hooks/useScrapingSettings";

function t(_dark: boolean) {
  return {
    panel: "bg-card/80 backdrop-blur-xl",
    h1: "text-foreground",
    h2: "text-foreground",
    sub: "text-muted-foreground",
    body: "text-foreground/80",
    label: "text-muted-foreground",
    cardBg: "bg-card border-border",
    btnPri: "bg-primary hover:bg-primary/90 text-primary-foreground",
    hi: "text-primary",
    acEm: "text-emerald-500",
    acAmber: "text-primary",
    infoBox: "bg-muted/50 border-border text-foreground/80",
    input: "bg-muted border-border text-foreground",
    hover: "hover:bg-accent/50",
    dim: "text-muted-foreground",
  };
}

export function ResyncConfigure({ isDark, onStartRunning }: { isDark: boolean; onStartRunning: () => void }) {
  const th = t(isDark);
  const queryClient = useQueryClient();
  const { settings: scrapingSettings } = useScrapingSettings();
  const [loading, setLoading] = useState(true);
  const [networkStats, setNetworkStats] = useState<NetworkStats[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [delay, setDelay] = useState(scrapingSettings.baseDelay);
  const [prioritizeMissing, setPrioritizeMissing] = useState(true);
  const [starting, setStarting] = useState(false);
  const [hasCookie, setHasCookie] = useState<boolean | null>(null);

  useEffect(() => {
    loadStats();
    checkCookie();
  }, []);

  // 🤖 Claude Engine V8: verifica connessione wca-app (non più cookie DB)
  async function checkCookie() {
    try {
      const cached = getWcaCookie();
      if (cached) {
        setHasCookie(true); return;
      }
      // Try a fresh login to verify
      const res = await fetch("https://wca-app.vercel.app/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      setHasCookie(data.success && !!data.cookies);
      if (data.success && data.cookies) {
        setWcaCookie(data.cookies);
      }
    } catch (e) { log.warn("operation failed, state reset", { error: e instanceof Error ? e.message : String(e) }); setHasCookie(false); }
  }

  async function loadStats() {
    setLoading(true);
    try {
      const { data: pnData } = await supabase
        .from("partner_networks")
        .select("network_name, partner_id, partners!inner(wca_id)");

      const { data: contactsData } = await supabase
        .from("partner_contacts")
        .select("partner_id, email");

      const partnersWithEmail = new Set(
        (contactsData || []).filter(c => c.email).map(c => c.partner_id)
      );

      const byNetwork = new Map<string, { partnerIds: Set<string>; wcaIds: Set<number> }>();
      for (const pn of (pnData || [])) {
        const nn = pn.network_name;
        if (!byNetwork.has(nn)) byNetwork.set(nn, { partnerIds: new Set(), wcaIds: new Set() });
        const entry = byNetwork.get(nn)!;
        entry.partnerIds.add(pn.partner_id);
        const wcaId = (pn as any).partners?.wca_id;
        if (wcaId) entry.wcaIds.add(wcaId);
      }

      const stats: NetworkStats[] = [];
      for (const [nn, entry] of byNetwork) {
        const missing = [...entry.partnerIds].filter(pid => !partnersWithEmail.has(pid)).length;
        stats.push({
          network_name: nn,
          total_partners: entry.partnerIds.size,
          missing_contacts: missing,
          wca_ids: [...entry.wcaIds],
        });
      }
      stats.sort((a, b) => b.total_partners - a.total_partners);
      setNetworkStats(stats);
    } catch (err) {
      log.error("load network stats failed", { message: err instanceof Error ? err.message : String(err) });
    }
    setLoading(false);
  }

  function toggleNetwork(name: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === networkStats.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(networkStats.map(n => n.network_name)));
    }
  }

  const totalSelected = networkStats.filter(n => selected.has(n.network_name));
  const totalPartners = totalSelected.reduce((s, n) => s + n.total_partners, 0);
  const totalMissing = totalSelected.reduce((s, n) => s + n.missing_contacts, 0);

  async function startResync() {
    if (selected.size === 0) return;
    setStarting(true);

    try {
      let allWcaIds: number[] = [];
      for (const ns of totalSelected) {
        allWcaIds.push(...ns.wca_ids);
      }
      allWcaIds = [...new Set(allWcaIds)];

      if (prioritizeMissing) {
        const { data: partnersAll } = await supabase
          .from("partners")
          .select("id, wca_id")
          .in("wca_id", allWcaIds)
          .not("wca_id", "is", null);

        const { data: contactsWithEmail } = await supabase
          .from("partner_contacts")
          .select("partner_id, email")
          .not("email", "is", null);

        const partnerIdsWithEmail = new Set(
          (contactsWithEmail || []).map(c => c.partner_id)
        );

        const withEmailWcaIds = new Set<number>();
        const withoutEmailWcaIds: number[] = [];

        for (const p of (partnersAll || [])) {
          if (partnerIdsWithEmail.has(p.id)) {
            withEmailWcaIds.add(p.wca_id!);
          } else {
            withoutEmailWcaIds.push(p.wca_id!);
          }
        }

        const orderedIds = [
          ...withoutEmailWcaIds,
          ...allWcaIds.filter(id => withEmailWcaIds.has(id)),
        ];
        allWcaIds = [...new Set(orderedIds)];
      }

      const networkNames = [...selected].join(", ");

      const { data, error } = await supabase
        .from("download_jobs")
        .insert({
          country_code: "ALL",
          country_name: "Re-sync Contatti",
          network_name: networkNames,
          wca_ids: allWcaIds as any,
          total_count: allWcaIds.length,
          delay_seconds: delay,
          status: "pending",
          job_type: "resync",
        })
        .select("id")
        .single();

      if (error) throw error;

      // 🤖 Claude Engine V8: il job viene processato dal motore V8 nella UI
      // Non serve più chiamare Edge Function process-download-job
      queryClient.invalidateQueries({ queryKey: ["download-jobs"] });
      toast({ title: "Re-sync creato", description: `${allWcaIds.length} partner da aggiornare. Premi Avvia nella barra download.` });
      onStartRunning();
    } catch (err: unknown) {
      toast({ title: "Errore", description: (err instanceof Error ? err.message : String(err)), variant: "destructive" });
    }
    setStarting(false);
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className={`w-8 h-8 animate-spin ${th.hi}`} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-3xl mx-auto w-full">
      <div>
        <h2 className={`text-xl font-semibold ${th.h1}`}>
          <RefreshCw className={`w-5 h-5 inline mr-2 ${th.hi}`} />
          Aggiorna Contatti
        </h2>
        <p className={`text-sm mt-1 ${th.sub}`}>
          Ri-scarica i partner per network per recuperare email e telefoni dei contatti
        </p>
      </div>

      {hasCookie === false && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/30 bg-primary/10">
          <AlertTriangle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className={`text-sm font-medium ${th.h2}`}>Connessione WCA non disponibile</p>
            <p className={`text-xs mt-1 ${th.sub}`}>
              Il server wca-app non risponde. Verifica la connessione in Diagnostics.
            </p>
          </div>
        </div>
      )}

      <div className={`${th.panel} border border-border rounded-2xl p-5`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-sm font-medium ${th.h2}`}>Seleziona Network</h3>
          <button onClick={selectAll} className={`text-xs ${th.hi}`}>
            {selected.size === networkStats.length ? "Deseleziona tutti" : "Seleziona tutti"}
          </button>
        </div>

        {networkStats.length === 0 ? (
          <p className={`text-sm ${th.sub}`}>Nessun partner trovato nel database</p>
        ) : (
          <div className="space-y-2">
            {networkStats.map(ns => {
              const pct = ns.total_partners > 0
                ? Math.round(((ns.total_partners - ns.missing_contacts) / ns.total_partners) * 100)
                : 0;
              const isComplete = ns.missing_contacts === 0;

              return (
                <label
                  key={ns.network_name}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${th.cardBg} ${th.hover}`}
                >
                  <Checkbox
                    checked={selected.has(ns.network_name)}
                    onCheckedChange={() => toggleNetwork(ns.network_name)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${th.h2}`}>{ns.network_name}</span>
                      <Badge
                        variant="outline"
                        className={isComplete
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]"
                          : "bg-primary/10 text-primary border-primary/30 text-[10px]"
                        }
                      >
                        {isComplete ? "Completo" : `${ns.missing_contacts} mancanti`}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className={`text-xs ${th.dim}`}>
                        <Users className="w-3 h-3 inline mr-1" />
                        {ns.total_partners} partner
                      </span>
                      <span className={`text-xs ${th.dim}`}>
                        <Mail className="w-3 h-3 inline mr-1" />
                        {pct}% con email
                      </span>
                    </div>
                  </div>
                  <div className="w-20">
                    <Progress value={pct} className="h-1.5" />
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <div className={`${th.panel} border border-border rounded-2xl p-5 space-y-5`}>
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={prioritizeMissing}
              onCheckedChange={(v) => setPrioritizeMissing(!!v)}
            />
            <div>
              <span className={`text-sm ${th.h2}`}>Priorità ai contatti mancanti</span>
              <p className={`text-xs ${th.sub}`}>Scarica prima i partner senza email/telefono</p>
            </div>
          </label>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm ${th.label}`}>Delay</span>
              <span className={`text-sm font-mono ${th.hi}`}>{delay}s</span>
            </div>
            <Slider
              min={10}
              max={60}
              step={1}
              value={[delay]}
              onValueChange={([v]) => setDelay(v)}
            />
            <div className={`flex justify-between text-[10px] mt-1 ${th.dim}`}>
              <span>Veloce</span>
              <span>Lento</span>
            </div>
          </div>

          <div className={`${th.infoBox} rounded-xl p-4 border`}>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className={`text-2xl font-bold ${th.h1}`}>{totalPartners}</p>
                <p className={`text-xs ${th.sub}`}>Partner totali</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{totalMissing}</p>
                <p className={`text-xs ${th.sub}`}>Senza contatti</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${th.acEm}`}>{totalPartners - totalMissing}</p>
                <p className={`text-xs ${th.sub}`}>Con email</p>
              </div>
            </div>
          </div>

          <Button
            onClick={startResync}
            disabled={starting || hasCookie === false}
            className={`w-full ${th.btnPri}`}
          >
            {starting ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Avvio in corso...</>
            ) : (
              <><Play className="w-4 h-4 mr-2" /> Avvia Re-sync ({totalPartners} partner)</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
