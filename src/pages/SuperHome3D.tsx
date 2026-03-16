import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
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

  const { data: activities = [] } = useAllActivities();
  const { data: jobs = [] } = useDownloadJobs();
  const { data: prospectStats } = useProspectStats();
  const { contacts = [] } = useCockpitContacts();
  const { data: partnerCount = 0 } = useCount("partners");
  const { data: partnerContactCount = 0 } = useCount("partner_contacts");
  const { data: campaignCount = 0 } = useCount("email_drafts");

  const openActivities = useMemo(
    () => activities.filter((activity) => !["completed", "cancelled"].includes(activity.status)).length,
    [activities]
  );
  const activeJobs = useMemo(
    () => jobs.filter((job) => ["pending", "running"].includes(job.status)).length,
    [jobs]
  );
  const readyContacts = useMemo(
    () => contacts.filter((contact) => Boolean(contact.email)).length,
    [contacts]
  );
  const campaignQueue = useMemo(
    () => activities.filter((activity) => activity.activity_type === "add_to_campaign" && activity.status !== "completed").length,
    [activities]
  );
  const systemSignals = [activeJobs > 0, openActivities > 0, readyContacts > 0, campaignCount > 0].filter(Boolean).length;

  const worlds = useMemo<WorldConfig[]>(() => [
    {
      key: "cockpit",
      title: "Cockpit",
      action: "Scrivi",
      outcome: "e avvia outreach",
      description: "AI actions, follow-up e priorità commerciali in un unico flusso.",
      route: "/cockpit",
      icon: BrainCircuit,
      theme: { ring: "border-chart-1/50", glow: "shadow-[0_0_60px_hsl(var(--chart-1)/0.22)]", soft: "bg-chart-1/12" },
      stat: `${formatCompact(readyContacts)} contatti pronti`,
      helper: `${formatCompact(openActivities)} attività aperte`,
    },
    {
      key: "acquisition",
      title: "Acquisition",
      action: "Scarica",
      outcome: "e arricchisci dati",
      description: "Directory, import e download WCA orchestrati da una sola porta.",
      route: "/operations",
      icon: Radar,
      theme: { ring: "border-chart-2/50", glow: "shadow-[0_0_60px_hsl(var(--chart-2)/0.22)]", soft: "bg-chart-2/12" },
      stat: `${formatCompact(activeJobs)} job attivi`,
      helper: `${formatCompact(partnerCount)} partner in rete`,
    },
    {
      key: "network",
      title: "Network",
      action: "Gestisci",
      outcome: "relazioni partner",
      description: "Vista relazionale della rete, qualità contatti e stato dei partner.",
      route: "/partner-hub",
      icon: Network,
      theme: { ring: "border-chart-3/50", glow: "shadow-[0_0_60px_hsl(var(--chart-3)/0.22)]", soft: "bg-chart-3/12" },
      stat: `${formatCompact(partnerCount)} partner attivi`,
      helper: `${formatCompact(partnerContactCount)} contatti collegati`,
    },
    {
      key: "prospects",
      title: "Prospects",
      action: "Scopri",
      outcome: "e qualifica opportunità",
      description: "Scouting, scoring e segmentazione delle nuove opportunità.",
      route: "/prospects",
      icon: Compass,
      theme: { ring: "border-chart-4/50", glow: "shadow-[0_0_60px_hsl(var(--chart-4)/0.22)]", soft: "bg-chart-4/12" },
      stat: `${formatCompact(prospectStats?.total ?? 0)} prospect`,
      helper: `${formatCompact(prospectStats?.withEmail ?? 0)} con email`,
    },
    {
      key: "campaigns",
      title: "Campaigns",
      action: "Seleziona",
      outcome: "e lancia campagne",
      description: "Code, batch e monitoraggio di invii e selezioni operative.",
      route: "/campaigns",
      icon: Sparkles,
      theme: { ring: "border-chart-5/50", glow: "shadow-[0_0_60px_hsl(var(--chart-5)/0.22)]", soft: "bg-chart-5/12" },
      stat: `${formatCompact(campaignCount)} campagne`,
      helper: `${formatCompact(campaignQueue)} task in coda`,
    },
    {
      key: "contacts",
      title: "Contacts",
      action: "Organizza",
      outcome: "i contatti",
      description: "Anagrafica, dettaglio operativo e prontezza dei canali di contatto.",
      route: "/contacts",
      icon: Users,
      theme: { ring: "border-primary/50", glow: "shadow-[0_0_60px_hsl(var(--primary)/0.22)]", soft: "bg-primary/12" },
      stat: `${formatCompact(contacts.length)} contatti`,
      helper: `${formatCompact(readyContacts)} pronti all'outreach`,
    },
    {
      key: "operations",
      title: "Operations",
      action: "Coordina",
      outcome: "i processi interni",
      description: "Assegnazioni, avanzamento attività e sincronizzazione del lavoro interno.",
      route: "/hub",
      icon: Briefcase,
      theme: { ring: "border-accent/60", glow: "shadow-[0_0_60px_hsl(var(--accent)/0.22)]", soft: "bg-accent/15" },
      stat: `${formatCompact(openActivities)} attività aperte`,
      helper: `${formatCompact(activeJobs)} flussi attivi`,
    },
    {
      key: "system",
      title: "System",
      action: "Configura",
      outcome: "e controlla il sistema",
      description: "Impostazioni, diagnostica e controllo dei segnali vitali della piattaforma.",
      route: "/settings",
      icon: Settings2,
      theme: { ring: "border-muted-foreground/50", glow: "shadow-[0_0_60px_hsl(var(--foreground)/0.12)]", soft: "bg-muted/40" },
      stat: `${formatCompact(systemSignals)} segnali attivi`,
      helper: "Diagnostica e setup",
    },
  ], [activeJobs, campaignCount, campaignQueue, contacts.length, openActivities, partnerContactCount, partnerCount, prospectStats?.total, prospectStats?.withEmail, readyContacts, systemSignals]);

  const activeWorld = worlds[activeIndex];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        setActiveIndex((current) => (current + 1) % worlds.length);
      }
      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => (current - 1 + worlds.length) % worlds.length);
      }
      if (event.key === "Enter") {
        navigate(activeWorld.route);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeWorld.route, navigate, worlds.length]);

  const missionStats = [
    { label: "Nuovi contatti", value: contacts.length, icon: Users },
    { label: "Partner attivi", value: partnerCount, icon: Network },
    { label: "Campagne", value: campaignCount, icon: Sparkles },
    { label: "Attività aperte", value: openActivities, icon: Gauge },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--chart-1)/0.18),transparent_34%),radial-gradient(circle_at_20%_70%,hsl(var(--chart-3)/0.16),transparent_28%),radial-gradient(circle_at_80%_65%,hsl(var(--chart-5)/0.14),transparent_24%)]" />
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-30" />
      <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,hsl(var(--background)/0.95),transparent)]" />

      <div className="relative z-10 flex min-h-screen flex-col px-4 py-5 sm:px-6 lg:px-10">
        <header className="flex items-center justify-between rounded-2xl border border-border/70 bg-card/65 px-4 py-3 shadow-glass backdrop-blur-2xl">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              <Orbit className="h-3.5 w-3.5 text-primary" />
              Mission Control
            </div>
            <h1 className="mt-1 font-display text-xl font-semibold tracking-tight sm:text-2xl">8 mondi. Una sola porta d&apos;ingresso.</h1>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground md:flex">
            <Layers3 className="h-3.5 w-3.5 text-primary" />
            Frecce per orbitare · Invio per entrare
          </div>
        </header>

        <div className="grid flex-1 gap-8 py-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-10">
          <section className="order-2 flex flex-col justify-center lg:order-1">
            <motion.div
              key={activeWorld.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={cn(
                "max-w-xl rounded-[2rem] border bg-card/65 p-6 shadow-glass backdrop-blur-2xl sm:p-8",
                activeWorld.theme.ring,
                activeWorld.theme.glow
              )}
            >
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className={cn("rounded-2xl border border-border/70 p-3", activeWorld.theme.soft)}>
                  <activeWorld.icon className="h-6 w-6 text-foreground" />
                </div>
                <span className="uppercase tracking-[0.28em] text-[11px] font-semibold">{activeWorld.title}</span>
              </div>

              <h2 className="mt-6 font-display text-4xl font-semibold leading-none tracking-tight sm:text-5xl">
                {activeWorld.action}
                <span className="block text-muted-foreground">{activeWorld.outcome}</span>
              </h2>

              <p className="mt-5 max-w-lg text-base leading-7 text-foreground/85">{activeWorld.description}</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-background/65 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Segnale primario</div>
                  <div className="mt-2 text-xl font-semibold text-foreground">{activeWorld.stat}</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/65 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Context</div>
                  <div className="mt-2 text-xl font-semibold text-foreground">{activeWorld.helper}</div>
                </div>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button size="lg" className="rounded-full px-6" onClick={() => navigate(activeWorld.route)}>
                  Entra nel mondo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <div className="text-sm text-muted-foreground">{activeIndex + 1} / {worlds.length} · {activeWorld.title}</div>
              </div>
            </motion.div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {missionStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-border/70 bg-card/55 p-4 shadow-glass backdrop-blur-xl">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    <stat.icon className="h-3.5 w-3.5 text-primary" />
                    {stat.label}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">{formatCompact(stat.value)}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="order-1 flex items-center justify-center lg:order-2">
            <div className="relative flex h-[420px] w-full max-w-[620px] items-center justify-center overflow-hidden sm:h-[520px]">
              <div className="pointer-events-none absolute inset-1/2 z-20 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/30 bg-background/75 shadow-[0_0_90px_hsl(var(--primary)/0.24)] backdrop-blur-3xl sm:h-56 sm:w-56">
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Sistema vivo</div>
                  <div className="mt-3 font-display text-4xl font-semibold text-foreground">{formatCompact(openActivities + activeJobs + campaignCount)}</div>
                  <div className="mt-2 max-w-[10rem] text-sm leading-5 text-muted-foreground">segnali combinati tra attività, job e campagne</div>
                </div>
              </div>

              <div
                className="relative isolate h-full w-full"
                onWheel={(event) => {
                  event.preventDefault();
                  setActiveIndex((current) => (event.deltaY > 0 ? (current + 1) % worlds.length : (current - 1 + worlds.length) % worlds.length));
                }}
              >
                {worlds.map((world, index) => {
                  const offset = (index - activeIndex + worlds.length) % worlds.length;
                  const normalizedOffset = offset > worlds.length / 2 ? offset - worlds.length : offset;
                  const isActive = normalizedOffset === 0;
                  const distance = Math.abs(normalizedOffset);
                  const x = normalizedOffset * 132;
                  const y = distance * 18;
                  const scale = isActive ? 1 : Math.max(0.8, 1 - distance * 0.09);
                  const opacity = Math.max(0.28, 1 - distance * 0.24);
                  const zIndex = 40 - distance;

                  return (
                    <motion.button
                      key={world.key}
                      type="button"
                      onClick={() => (isActive ? navigate(world.route) : setActiveIndex(index))}
                      className={cn(
                        "absolute left-1/2 top-1/2 flex h-44 w-[15.5rem] -translate-x-1/2 -translate-y-1/2 select-none flex-col justify-between rounded-[1.75rem] border bg-card/70 p-5 text-left shadow-glass backdrop-blur-2xl transition-colors duration-200 touch-manipulation sm:h-52 sm:w-[18rem]",
                        world.theme.ring,
                        isActive ? world.theme.glow : "hover:bg-card/80"
                      )}
                      style={{ zIndex, pointerEvents: distance <= 2 ? "auto" : "none" }}
                      animate={{ x, y, scale, opacity }}
                      transition={{ duration: 0.28, ease: "easeOut" }}
                      whileHover={isActive ? { scale: 1.02 } : { scale: scale + 0.03 }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className={cn("rounded-2xl border border-border/70 p-2.5", world.theme.soft)}>
                          <world.icon className="h-5 w-5 text-foreground" />
                        </div>
                        <div className="rounded-full border border-border/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                          {world.title}
                        </div>
                      </div>

                      <div>
                        <div className="text-2xl font-semibold leading-tight text-foreground">{world.action}</div>
                        <div className="text-lg text-foreground/80">{world.outcome}</div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="font-medium text-foreground">{world.stat}</div>
                        <div className="text-muted-foreground">{world.helper}</div>
                        <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                          {isActive ? "Clicca per entrare" : "Clicca per selezionare"}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
