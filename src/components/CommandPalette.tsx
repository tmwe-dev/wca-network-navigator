import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  { label: "Dashboard", icon: LayoutDashboard, path: "/v1" },
  { label: "Network", icon: Globe, path: "/v1/network" },
  { label: "CRM Contatti", icon: Users, path: "/v1/crm" },
  { label: "Outreach", icon: Rocket, path: "/v1/outreach" },
  { label: "Inreach", icon: Inbox, path: "/v1/inreach" },
  { label: "Nuova Email", icon: Mail, path: "/v1/email-composer" },
  { label: "AI Arena", icon: Gamepad2, path: "/v1/ai-arena" },
  { label: "AI Control", icon: Target, path: "/v1/ai-control" },
  { label: "Email Intelligence", icon: Brain, path: "/v1/email-intelligence" },
  { label: "Campagne", icon: Send, path: "/v1/campaigns" },
  { label: "Agenda", icon: Calendar, path: "/v1/agenda" },
  { label: "Chat Agenti", icon: MessageCircle, path: "/v1/agent-chat" },
  { label: "Staff Direzionale", icon: BookOpen, path: "/v1/staff-direzionale" },
  { label: "Mission Builder", icon: Target, path: "/v1/mission-builder" },
  { label: "Telemetria", icon: BarChart3, path: "/v1/telemetry" },
  { label: "Diagnostica", icon: Wrench, path: "/v1/diagnostics" },
  { label: "Impostazioni", icon: Settings, path: "/v1/settings" },
];

const QUICK_ACTIONS = [
  { label: "Nuova Missione", icon: Target, path: "/v1/mission-builder" },
  { label: "Nuova Email", icon: Mail, path: "/v1/email-composer" },
  { label: "Visualizza Preferiti", icon: Star, path: "/v1/network?favorites=true" },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open && search.length >= 2) {
      searchPartners(search, 5).then((data) => {
        setPartners(data.map(d => ({ ...d, city: (d as any).city ?? "" })) as Partner[]);
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
                onSelect={() => runCommand(() => navigate(`/v1/network`))}
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
              key={item.path}
              onSelect={() => runCommand(() => navigate(item.path))}
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
              onSelect={() => runCommand(() => navigate(item.path))}
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
