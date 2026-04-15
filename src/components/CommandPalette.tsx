import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { LayoutDashboard, Users, Calendar, Building2, Star, Mail, Rocket, Gamepad2, Send, Brain, Settings, Globe, MessageCircle, Target, BarChart3, Wrench, BookOpen, Inbox } from "lucide-react";
import { searchPartners } from "@/data/partners";

interface Partner {
  id: string;
  company_name: string;
  city: string;
  country_name?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, v1Path: "/v1", v2Path: "/v2" },
  { label: "Network", icon: Globe, v1Path: "/v1/network", v2Path: "/v2/network" },
  { label: "CRM Contatti", icon: Users, v1Path: "/v1/crm", v2Path: "/v2/crm" },
  { label: "Outreach", icon: Rocket, v1Path: "/v1/outreach", v2Path: "/v2/outreach" },
  { label: "Inreach", icon: Inbox, v1Path: "/v1/inreach", v2Path: "/v2/inreach" },
  { label: "Nuova Email", icon: Mail, v1Path: "/v1/email-composer", v2Path: "/v2/email-composer" },
  { label: "AI Arena", icon: Gamepad2, v1Path: "/v1/ai-arena", v2Path: "/v2/ai-arena" },
  { label: "AI Control", icon: Target, v1Path: "/v1/ai-control", v2Path: "/v2/ai-control" },
  { label: "Email Intelligence", icon: Brain, v1Path: "/v1/email-intelligence", v2Path: "/v2/email-intelligence" },
  { label: "Campagne", icon: Send, v1Path: "/v1/campaigns", v2Path: "/v2/campaigns" },
  { label: "Agenda", icon: Calendar, v1Path: "/v1/agenda", v2Path: "/v2/agenda" },
  { label: "Chat Agenti", icon: MessageCircle, v1Path: "/v1/agent-chat", v2Path: "/v2/agent-chat" },
  { label: "Staff Direzionale", icon: BookOpen, v1Path: "/v1/staff-direzionale", v2Path: "/v2/staff" },
  { label: "Mission Builder", icon: Target, v1Path: "/v1/mission-builder", v2Path: "/v2/missions" },
  { label: "Telemetria", icon: BarChart3, v1Path: "/v1/telemetry", v2Path: "/v2/telemetry" },
  { label: "Diagnostica", icon: Wrench, v1Path: "/v1/diagnostics", v2Path: "/v2/diagnostics" },
  { label: "Impostazioni", icon: Settings, v1Path: "/v1/settings", v2Path: "/v2/settings" },
];

const QUICK_ACTIONS = [
  { label: "Nuova Missione", icon: Target, v1Path: "/v1/mission-builder", v2Path: "/v2/missions" },
  { label: "Nuova Email", icon: Mail, v1Path: "/v1/email-composer", v2Path: "/v2/email-composer" },
  { label: "Visualizza Preferiti", icon: Star, v1Path: "/v1/network?favorites=true", v2Path: "/v2/network?favorites=true" },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [search, setSearch] = useState("");
  const isV2 = location.pathname.startsWith("/v2");
  const resolvePath = (item: { v1Path: string; v2Path: string }) => (isV2 ? item.v2Path : item.v1Path);

  useEffect(() => {
    if (open && search.length >= 2) {
      searchPartners(search, 5).then((data) => {
        setPartners(data.map(d => ({ ...d, city: (d as Record<string, string>).city ?? "" })) as Partner[]);
      });
    } else {
      setPartners([]);
    }
  }, [open, search]);

  const runCommand = (command: () => void) => {
    onOpenChange(false);
    setSearch("");
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput 
        placeholder="Cerca partner, pagine, azioni..." 
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>Nessun risultato trovato.</CommandEmpty>
        
        {partners.length > 0 && (
          <CommandGroup heading="Partner">
            {partners.map((partner) => (
              <CommandItem
                key={partner.id}
                onSelect={() => runCommand(() => navigate(isV2 ? "/v2/network" : "/v1/network"))}
              >
                <Building2 className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span>{partner.company_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {partner.city}{partner.country_name ? `, ${partner.country_name}` : ""}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Navigazione">
          {NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.label}
              onSelect={() => runCommand(() => navigate(resolvePath(item)))}
            >
              <item.icon className="mr-2 h-4 w-4" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Azioni Rapide">
          {QUICK_ACTIONS.map((item) => (
            <CommandItem
              key={item.label}
              onSelect={() => runCommand(() => navigate(resolvePath(item)))}
            >
              <item.icon className="mr-2 h-4 w-4" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
