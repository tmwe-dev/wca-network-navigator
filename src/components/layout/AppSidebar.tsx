import { useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Calendar, Mail, Globe, Home, Moon, Sun, Settings,
  Wifi, WifiOff, BookOpen, Send, Sparkles,
  Users, Command, Upload, UserCheck, Zap,
  Rocket, Microscope, Compass,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWcaSession } from "@/hooks/useWcaSession";
import { useState } from "react";

const navSections = [
  {
    label: "Mission Control",
    items: [
      { title: "Super Home", url: "/", icon: Home },
      { title: "Acquisition", url: "/operations", icon: Globe },
      { title: "Network", url: "/partner-hub", icon: Users },
      { title: "Global", url: "/global", icon: Sparkles },
    ],
  },
  {
    label: "Execution",
    items: [
      { title: "Cockpit", url: "/cockpit", icon: Rocket },
      { title: "Campaigns", url: "/campaigns", icon: Mail },
      { title: "Email", url: "/email-composer", icon: Send },
      { title: "Operations", url: "/hub", icon: Zap },
    ],
  },
  {
    label: "Data & System",
    items: [
      { title: "Prospects", url: "/prospects", icon: Compass },
      { title: "Contatti", url: "/contacts", icon: UserCheck },
      { title: "Agenda", url: "/reminders", icon: Calendar },
      { title: "Import", url: "/import", icon: Upload },
      { title: "Impostazioni", url: "/settings", icon: Settings },
      { title: "Diagnostica", url: "/diagnostics", icon: Microscope },
      { title: "Guida", url: "/guida", icon: BookOpen },
    ],
  },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains("dark")
  );
  const { isSessionActive } = useWcaSession();
  const wcaStatus =
    isSessionActive === true ? "ok"
    : isSessionActive === false ? "expired"
    : "checking";

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  let itemIndex = 0;

  return (
    <aside className="sidebar-drawer flex flex-col w-[220px] h-screen text-sidebar-foreground select-none">
      {/* Brand */}
      <div className="flex items-center gap-2.5 h-14 px-4 border-b border-sidebar-border">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex items-center justify-center w-7 h-7 rounded-md bg-sidebar-primary/90"
        >
          <Command className="w-4 h-4 text-sidebar-primary-foreground" />
        </motion.div>
        <motion.span
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="text-[13px] font-semibold tracking-tight truncate"
        >
          WCA Partners
        </motion.span>
      </div>

      {/* Sections */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
        {navSections.map((section) => (
          <div key={section.label}>
            <span className="block px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              {section.label}
            </span>
            <div className="space-y-px">
              {section.items.map((item) => {
                const isActive = location.pathname === item.url;
                const delay = itemIndex * 0.03;
                itemIndex++;
                return (
                  <motion.div
                    key={item.url}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay, duration: 0.25, ease: "easeOut" }}
                  >
                    <Link
                      to={item.url}
                      className={cn(
                        "group relative flex items-center gap-2.5 px-2 py-[7px] rounded-md text-[13px] font-medium transition-all duration-150",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-foreground"
                          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "w-4 h-4 flex-shrink-0 transition-all duration-150",
                          isActive
                            ? "text-sidebar-primary"
                            : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70 group-hover:scale-110"
                        )}
                      />
                      <span className="truncate">{item.title}</span>
                      {isActive && (
                        <motion.span
                          layoutId="sidebar-indicator"
                          className="ml-auto w-1 h-4 rounded-full bg-sidebar-primary"
                          transition={{ type: "spring", stiffness: 500, damping: 35 }}
                        />
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 py-2 border-t border-sidebar-border space-y-px">
        {/* WCA status */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {wcaStatus === "expired" ? (
              <Link
                to="/settings"
                className="flex items-center gap-2.5 px-2 py-[7px] rounded-md text-[13px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <span className="relative flex-shrink-0">
                  <WifiOff className="w-4 h-4" />
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                </span>
                <span>WCA Offline</span>
              </Link>
            ) : (
              <div
                className={cn(
                  "flex items-center gap-2.5 px-2 py-[7px] rounded-md text-[13px] font-medium transition-colors",
                  wcaStatus === "ok" ? "text-success" : "text-muted-foreground"
                )}
              >
                <span className="relative flex-shrink-0">
                  <Wifi className="w-4 h-4" />
                  {wcaStatus === "ok" && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  )}
                </span>
                <span>{wcaStatus === "ok" ? "WCA Online" : "Verifica…"}</span>
              </div>
            )}
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {wcaStatus === "ok"
              ? "Sessione WCA attiva"
              : wcaStatus === "expired"
                ? "Sessione scaduta — clicca per configurare"
                : "Verifica in corso…"}
          </TooltipContent>
        </Tooltip>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2.5 w-full px-2 py-[7px] rounded-md text-[13px] font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors group"
        >
          <motion.div
            key={isDark ? "sun" : "moon"}
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {isDark ? <Sun className="w-4 h-4 group-hover:text-warning" /> : <Moon className="w-4 h-4" />}
          </motion.div>
          <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
        </button>
      </div>
    </aside>
  );
}
