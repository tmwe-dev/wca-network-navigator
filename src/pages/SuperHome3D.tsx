import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BrainCircuit,
  Briefcase,
  Compass,
  Gauge,
  Layers3,
  Network,
  Orbit,
  Radar,
  Settings2,
  Sparkles,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAllActivities } from "@/hooks/useActivities";
import { useDownloadJobs } from "@/hooks/useDownloadJobs";
import { useProspectStats } from "@/hooks/useProspectStats";
import { useCockpitContacts } from "@/hooks/useCockpitContacts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface WorldConfig {
  key: string;
  title: string;
  action: string;
  outcome: string;
  description: string;
  route: string;
  icon: typeof Orbit;
  theme: {
    ring: string;
    glow: string;
    soft: string;
  };
  stat: string;
  helper: string;
}

function useCount(table: "partners" | "partner_contacts" | "email_drafts") {
  return useQuery({
    queryKey: ["super-home-count", table],
    queryFn: async () => {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
  });
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("it-IT", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export default function SuperHome3D() {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollCooldown = useRef(false);

  const { data: activities = [] } = useAllActivities();
  const { data: jobs = [] } = useDownloadJobs();
  const { data: prospectStats } = useProspectStats();
  const { contacts = [] } = useCockpitContacts();
  const { data: partnerCount = 0 } = useCount("partners");
  const { data: partnerContactCount = 0 } = useCount("partner_contacts");
  const { data: campaignCount = 0 } = useCount("email_drafts");

  const openActivities = useMemo(
    () => activities.filter((a) => !["completed", "cancelled"].includes(a.status)).length,
    [activities]
  );
  const activeJobs = useMemo(
    () => jobs.filter((j) => ["pending", "running"].includes(j.status)).length,
    [jobs]
  );
  const readyContacts = useMemo(
    () => contacts.filter((c) => Boolean(c.email)).length,
    [contacts]
  );
  const campaignQueue = useMemo(
    () => activities.filter((a) => a.activity_type === "add_to_campaign" && a.status !== "completed").length,
    [activities]
  );
  const systemSignals = [activeJobs > 0, openActivities > 0, readyContacts > 0, campaignCount > 0].filter(Boolean).length;

  const worlds = useMemo<WorldConfig[]>(() => [
    {
      key: "cockpit", title: "Cockpit", action: "Scrivi", outcome: "e avvia outreach",
      description: "AI actions, follow-up e priorità commerciali in un unico flusso.",
      route: "/outreach", icon: BrainCircuit,
      theme: { ring: "border-chart-1/50", glow: "shadow-[0_0_40px_hsl(var(--chart-1)/0.18)]", soft: "bg-chart-1/12" },
      stat: `${formatCompact(readyContacts)} contatti pronti`, helper: `${formatCompact(openActivities)} attività aperte`,
    },
    {
      key: "acquisition", title: "Acquisition", action: "Scarica", outcome: "e arricchisci dati",
      description: "Directory, import e download WCA orchestrati da una sola porta.",
      route: "/network", icon: Radar,
      theme: { ring: "border-chart-2/50", glow: "shadow-[0_0_40px_hsl(var(--chart-2)/0.18)]", soft: "bg-chart-2/12" },
      stat: `${formatCompact(activeJobs)} job attivi`, helper: `${formatCompact(partnerCount)} partner in rete`,
    },
    {
      key: "network", title: "Rubrica Partner", action: "Gestisci", outcome: "relazioni partner",
      description: "Rubrica intelligente della rete: cerca, valuta e contatta i partner nel mondo.",
      route: "/network", icon: Network,
      theme: { ring: "border-chart-3/50", glow: "shadow-[0_0_40px_hsl(var(--chart-3)/0.18)]", soft: "bg-chart-3/12" },
      stat: `${formatCompact(partnerCount)} partner attivi`, helper: `${formatCompact(partnerContactCount)} contatti collegati`,
    },
    {
      key: "prospects", title: "Prospects", action: "Scopri", outcome: "e qualifica opportunità",
      description: "Scouting, scoring e segmentazione delle nuove opportunità.",
      route: "/crm", icon: Compass,
      theme: { ring: "border-chart-4/50", glow: "shadow-[0_0_40px_hsl(var(--chart-4)/0.18)]", soft: "bg-chart-4/12" },
      stat: `${formatCompact(prospectStats?.total ?? 0)} prospect`, helper: `${formatCompact(prospectStats?.withEmail ?? 0)} con email`,
    },
    {
      key: "campaigns", title: "Campaigns", action: "Seleziona", outcome: "e lancia campagne",
      description: "Code, batch e monitoraggio di invii e selezioni operative.",
      route: "/outreach", icon: Sparkles,
      theme: { ring: "border-chart-5/50", glow: "shadow-[0_0_40px_hsl(var(--chart-5)/0.18)]", soft: "bg-chart-5/12" },
      stat: `${formatCompact(campaignCount)} campagne`, helper: `${formatCompact(campaignQueue)} task in coda`,
    },
    {
      key: "contacts", title: "Contacts", action: "Organizza", outcome: "i contatti",
      description: "Anagrafica, dettaglio operativo e prontezza dei canali di contatto.",
      route: "/crm", icon: Users,
      theme: { ring: "border-primary/50", glow: "shadow-[0_0_40px_hsl(var(--primary)/0.18)]", soft: "bg-primary/12" },
      stat: `${formatCompact(contacts.length)} contatti`, helper: `${formatCompact(readyContacts)} pronti all'outreach`,
    },
    {
      key: "operations", title: "Operations", action: "Coordina", outcome: "i processi interni",
      description: "Assegnazioni, avanzamento attività e sincronizzazione del lavoro interno.",
      route: "/agenda", icon: Briefcase,
      theme: { ring: "border-accent/60", glow: "shadow-[0_0_40px_hsl(var(--accent)/0.18)]", soft: "bg-accent/15" },
      stat: `${formatCompact(openActivities)} attività aperte`, helper: `${formatCompact(activeJobs)} flussi attivi`,
    },
    {
      key: "system", title: "System", action: "Configura", outcome: "e controlla il sistema",
      description: "Impostazioni, diagnostica e controllo dei segnali vitali della piattaforma.",
      route: "/settings", icon: Settings2,
      theme: { ring: "border-muted-foreground/50", glow: "shadow-[0_0_40px_hsl(var(--foreground)/0.08)]", soft: "bg-muted/40" },
      stat: `${formatCompact(systemSignals)} segnali attivi`, helper: "Diagnostica e setup",
    },
  ], [activeJobs, campaignCount, campaignQueue, contacts.length, openActivities, partnerContactCount, partnerCount, prospectStats?.total, prospectStats?.withEmail, readyContacts, systemSignals]);

  const activeWorld = worlds[activeIndex];

  const goNext = useCallback(() => setActiveIndex((c) => (c + 1) % worlds.length), [worlds.length]);
  const goPrev = useCallback(() => setActiveIndex((c) => (c - 1 + worlds.length) % worlds.length), [worlds.length]);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Enter") navigate(activeWorld.route);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeWorld.route, navigate, goNext, goPrev]);

  // Wheel navigation with debounce
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (scrollCooldown.current) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 15) return;
      e.preventDefault();
      scrollCooldown.current = true;
      if (delta > 0) goNext();
      else goPrev();
      setTimeout(() => { scrollCooldown.current = false; }, 350);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [goNext, goPrev]);

  const missionStats = [
    { label: "Contatti", value: contacts.length, icon: Users },
    { label: "Partner", value: partnerCount, icon: Network },
    { label: "Campagne", value: campaignCount, icon: Sparkles },
    { label: "Attività", value: openActivities, icon: Gauge },
  ];

  return (
    <div className="relative h-[calc(100vh-3.5rem)] overflow-hidden bg-background text-foreground">
      {/* Background layers */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--chart-1)/0.14),transparent_34%),radial-gradient(circle_at_20%_70%,hsl(var(--chart-3)/0.12),transparent_28%),radial-gradient(circle_at_80%_65%,hsl(var(--chart-5)/0.10),transparent_24%)]" />

      <div className="relative z-10 flex h-full flex-col px-4 py-4 sm:px-6 lg:px-10">
        {/* Header */}
        <header className="flex-shrink-0 flex items-center justify-between rounded-2xl border border-border/70 bg-card/65 px-4 py-3 shadow-glass backdrop-blur-2xl">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              <Orbit className="h-3.5 w-3.5 text-primary" />
              Mission Control
            </div>
            <h1 className="mt-1 font-display text-lg font-semibold tracking-tight sm:text-xl">
              {worlds.length} mondi. Una sola porta d&apos;ingresso.
            </h1>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground md:flex">
            <Layers3 className="h-3.5 w-3.5 text-primary" />
            Scroll o frecce per navigare · Click per entrare
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 min-h-0 grid gap-4 py-4 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-8">
          {/* Left: Active world detail */}
          <section className="order-2 flex flex-col justify-center lg:order-1 min-h-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeWorld.key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className={cn(
                  "max-w-xl rounded-[1.5rem] border bg-card/65 p-5 shadow-glass backdrop-blur-2xl sm:p-6",
                  activeWorld.theme.ring,
                  activeWorld.theme.glow
                )}
              >
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className={cn("rounded-xl border border-border/70 p-2.5", activeWorld.theme.soft)}>
                    <activeWorld.icon className="h-5 w-5 text-foreground" />
                  </div>
                  <span className="uppercase tracking-[0.28em] text-[11px] font-semibold">{activeWorld.title}</span>
                </div>

                <h2 className="mt-4 font-display text-3xl font-semibold leading-none tracking-tight sm:text-4xl">
                  {activeWorld.action}
                  <span className="block text-muted-foreground">{activeWorld.outcome}</span>
                </h2>

                <p className="mt-3 max-w-lg text-sm leading-6 text-foreground/85">{activeWorld.description}</p>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/70 bg-background/65 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Segnale</div>
                    <div className="mt-1 text-lg font-semibold text-foreground">{activeWorld.stat}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/65 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Context</div>
                    <div className="mt-1 text-lg font-semibold text-foreground">{activeWorld.helper}</div>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-3">
                  <Button size="default" className="rounded-full px-5 gap-2" onClick={() => navigate(activeWorld.route)}>
                    <activeWorld.icon className="h-4 w-4" />
                    Entra in {activeWorld.title}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* KPI strip */}
            <div className="mt-4 grid grid-cols-4 gap-2">
              {missionStats.map((stat) => (
                <div key={stat.label} className="rounded-xl border border-border/70 bg-card/55 p-3 shadow-glass backdrop-blur-xl">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    <stat.icon className="h-3 w-3 text-primary" />
                    {stat.label}
                  </div>
                  <div className="mt-1 text-xl font-semibold text-foreground">{formatCompact(stat.value)}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Right: Carousel */}
          <section className="order-1 flex flex-col items-center justify-center lg:order-2 min-h-0">
            <div className="relative flex h-[300px] w-full max-w-[560px] items-center justify-center sm:h-[380px]">
              {/* Central hub */}
              <div className="pointer-events-none absolute z-30 h-32 w-32 rounded-full border border-primary/30 bg-background/80 shadow-[0_0_60px_hsl(var(--primary)/0.18)] backdrop-blur-3xl sm:h-40 sm:w-40">
                <div className="flex h-full flex-col items-center justify-center text-center px-2">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Sistema</div>
                  <div className="mt-1 font-display text-3xl font-semibold text-foreground sm:text-4xl">
                    {formatCompact(openActivities + activeJobs + campaignCount)}
                  </div>
                  <div className="mt-1 text-[10px] leading-tight text-muted-foreground">segnali attivi</div>
                </div>
              </div>

              {/* Cards */}
              <div className="relative isolate h-full w-full">
                {worlds.map((world, index) => {
                  const offset = (index - activeIndex + worlds.length) % worlds.length;
                  const normalizedOffset = offset > worlds.length / 2 ? offset - worlds.length : offset;
                  const isActive = normalizedOffset === 0;
                  const distance = Math.abs(normalizedOffset);
                  const x = normalizedOffset * 110;
                  const y = distance * 14;
                  const scale = isActive ? 1 : Math.max(0.72, 1 - distance * 0.1);
                  const opacity = distance > 3 ? 0 : Math.max(0.2, 1 - distance * 0.28);
                  const zIndex = 40 - distance;

                  return (
                    <motion.button
                      key={world.key}
                      type="button"
                      onClick={() => isActive ? navigate(world.route) : setActiveIndex(index)}
                      className={cn(
                        "absolute left-1/2 top-1/2 flex h-36 w-52 -translate-x-1/2 -translate-y-1/2 select-none flex-col justify-between rounded-2xl border bg-card/75 p-4 text-left shadow-glass backdrop-blur-2xl transition-colors duration-150 sm:h-44 sm:w-60",
                        world.theme.ring,
                        isActive ? world.theme.glow : "hover:bg-card/85"
                      )}
                      style={{ zIndex, pointerEvents: distance <= 2 ? "auto" : "none" }}
                      animate={{ x, y, scale, opacity }}
                      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                      whileHover={isActive ? { scale: 1.03 } : {}}
                    >
                      {/* Card header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className={cn("rounded-lg border border-border/70 p-1.5", world.theme.soft)}>
                          <world.icon className="h-4 w-4 text-foreground" />
                        </div>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                          {world.title}
                        </span>
                      </div>

                      {/* Card body */}
                      <div>
                        <div className="text-lg font-semibold leading-tight text-foreground">{world.action}</div>
                        <div className="text-sm text-foreground/70">{world.outcome}</div>
                      </div>

                      {/* Card footer */}
                      <div className="space-y-0.5">
                        <div className="text-xs font-medium text-foreground">{world.stat}</div>
                        {isActive && (
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                            <ArrowRight className="h-3 w-3" />
                            Clicca per entrare
                          </div>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* Bottom navigation bar */}
        <div className="flex-shrink-0 flex items-center justify-center gap-3 pb-2">
          <button
            onClick={goPrev}
            className="rounded-full border border-border/70 bg-card/60 p-2 text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors backdrop-blur-xl"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1.5">
            {worlds.map((world, i) => (
              <button
                key={world.key}
                onClick={() => setActiveIndex(i)}
                className="group relative flex flex-col items-center gap-1"
              >
                <div
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    i === activeIndex
                      ? "w-8 bg-primary"
                      : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  )}
                />
                <span
                  className={cn(
                    "text-[8px] font-semibold uppercase tracking-[0.15em] transition-all duration-200",
                    i === activeIndex ? "text-primary opacity-100" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                  )}
                >
                  {world.title}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={goNext}
            className="rounded-full border border-border/70 bg-card/60 p-2 text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors backdrop-blur-xl"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
