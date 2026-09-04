/**
 * SystemHub — UNICA icona in top bar che raccoglie tutto lo stato e tutti i
 * comandi di sistema in una sola tendina con tab orizzontali.
 *
 * Tab: Stato · Automazioni · Notifiche · Operazioni · Contesto
 * Nessuna logica nuova: riusa i pannelli/pulsanti esistenti (nessun side-effect duplicato).
 */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Activity,
  Bell,
  Cog,
  DatabaseZap,
  FlaskConical,
  Gauge,
  LogOut,
  Moon,
  Plus,
  Stethoscope,
  Sun,
  UserCog,
  Wrench,
} from "lucide-react";
import { StatusPanelBody } from "./StatusPill";
import { AutomationsBody } from "./AutomationsPanel";
import { NotificationsBody } from "@/components/notifications/NotificationCenter";
import { GlobalSyncButton } from "./WhatsAppSyncButton";
import { DownloadExtensionsButton } from "./DownloadExtensionsButton";
import { OperationalContextSelector } from "@/components/header/OperationalContextSelector";
import { useUnreadCount } from "@/hooks/useNotifications";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";

interface OutreachQueue {
  pendingCount: number;
  processing: boolean;
  paused: boolean;
  setPaused: (v: boolean) => void;
}
interface GlobalSyncState {
  nightPause: boolean;
  isNightTime: boolean;
  manualOverride: boolean;
  toggleNightPause: () => void;
  resumeMinutes: number;
}

interface Props {
  onAiClick: () => void;
  outreachQueue: OutreachQueue;
  globalSync: GlobalSyncState;
  onAddContact: () => void;
  onAgentDash: () => void;
  onTestExt: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

type TabKey = "stato" | "automazioni" | "notifiche" | "operazioni" | "contesto";

const TABS: Array<{ key: TabKey; label: string; icon: React.ElementType }> = [
  { key: "stato", label: "Stato", icon: Activity },
  { key: "automazioni", label: "Automazioni", icon: Cog },
  { key: "notifiche", label: "Notifiche", icon: Bell },
  { key: "operazioni", label: "Operazioni", icon: Wrench },
  { key: "contesto", label: "Contesto", icon: UserCog },
];

function CommandRow({
  icon: Icon,
  title,
  desc,
  action,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  action: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-card px-2.5 py-2">
      <div className="flex min-w-0 items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="truncate text-xs font-medium">{title}</div>
          <div className="truncate text-[11px] text-muted-foreground">{desc}</div>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

export function SystemHub({
  onAiClick,
  outreachQueue,
  globalSync,
  onAddContact,
  onAgentDash,
  onTestExt,
  isDark,
  onToggleTheme,
}: Props): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<TabKey>("stato");
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { data: unreadCount = 0 } = useUnreadCount();
  const { signOut } = useAuthV2();

  const hasIssue = !isOnline || outreachQueue.paused || globalSync.nightPause;
  const dot = !isOnline ? "bg-destructive" : hasIssue ? "bg-amber-500" : "bg-emerald-500";

  const go = React.useCallback(
    (path: string) => {
      navigate(path);
      setOpen(false);
    },
    [navigate],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-8 gap-1.5 px-2"
          aria-label="Centro di controllo sistema"
          title="Centro di controllo sistema"
        >
          <Gauge className="h-4 w-4" />
          <span className={cn("inline-block h-2 w-2 rounded-full", dot)} />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px] tabular-nums">
              {Math.min(unreadCount, 99)}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[38rem] max-w-[calc(100vw-1rem)] p-0">
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border/50 px-2 py-1.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                {t.key === "notifiche" && unreadCount > 0 && (
                  <Badge variant="destructive" className="h-4 px-1 text-[10px] tabular-nums">
                    {Math.min(unreadCount, 99)}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-3">
            {tab === "stato" && (
              <StatusPanelBody onAiClick={onAiClick} outreachQueue={outreachQueue} globalSync={globalSync} />
            )}

            {tab === "automazioni" && <AutomationsBody active={open} />}

            {tab === "notifiche" && <NotificationsBody onClose={() => setOpen(false)} />}

            {tab === "operazioni" && (
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Aggiornamenti e caricamenti
                </div>
                <CommandRow
                  icon={Activity}
                  title="Scarica ora"
                  desc="Sincronizza Email · WhatsApp · LinkedIn"
                  action={<GlobalSyncButton />}
                />
                <CommandRow
                  icon={DatabaseZap}
                  title="Estensioni Chrome"
                  desc="Scarica gli ZIP aggiornati"
                  action={<DownloadExtensionsButton />}
                />

                <div className="pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">Azioni rapide</div>
                <CommandRow
                  icon={Plus}
                  title="Nuovo contatto"
                  desc="Crea un contatto nel CRM"
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => {
                        onAddContact();
                        setOpen(false);
                      }}
                    >
                      Apri
                    </Button>
                  }
                />
                <CommandRow
                  icon={Activity}
                  title="Agent Operations"
                  desc="Stato e controllo agenti"
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => {
                        onAgentDash();
                        setOpen(false);
                      }}
                    >
                      Apri
                    </Button>
                  }
                />
                <CommandRow
                  icon={DatabaseZap}
                  title="Enrichment Center"
                  desc="Arricchimento dati contatti"
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => go("/v2/settings?tab=enrichment")}
                    >
                      Apri
                    </Button>
                  }
                />

                <div className="pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">Diagnostica</div>
                <CommandRow
                  icon={Stethoscope}
                  title="Trace Console"
                  desc="Sequenza passo-passo delle operazioni AI (⌘⇧T)"
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("trace-console-open"));
                        setOpen(false);
                      }}
                    >
                      Apri
                    </Button>
                  }
                />
                <CommandRow
                  icon={FlaskConical}
                  title="Test estensioni"
                  desc="Verifica bridge WhatsApp / LinkedIn"
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => {
                        onTestExt();
                        setOpen(false);
                      }}
                    >
                      Apri
                    </Button>
                  }
                />

                <div className="pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">Sessione</div>
                <CommandRow
                  icon={isDark ? Sun : Moon}
                  title={`Tema ${isDark ? "chiaro" : "scuro"}`}
                  desc="Cambia aspetto dell'interfaccia"
                  action={
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={onToggleTheme}>
                      Cambia
                    </Button>
                  }
                />
                <CommandRow
                  icon={LogOut}
                  title="Logout"
                  desc="Esci dall'account corrente"
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px] text-destructive"
                      onClick={() => void signOut()}
                    >
                      Esci
                    </Button>
                  }
                />
              </div>
            )}

            {tab === "contesto" && (
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Operatore e casella attiva
                </div>
                <CommandRow
                  icon={UserCog}
                  title="Contesto operativo"
                  desc="Visibilità operatori e casella di posta"
                  action={<OperationalContextSelector />}
                />
                <CommandRow
                  icon={Gauge}
                  title="Token cockpit"
                  desc="Consumi live e per funzione"
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => go("/v2/token-cockpit")}
                    >
                      Apri
                    </Button>
                  }
                />
                <CommandRow
                  icon={Cog}
                  title="Impostazioni"
                  desc="Configurazione completa del sistema"
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => go("/v2/settings")}
                    >
                      Apri
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
