import { useEffect, useState } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Download,
  Building2,
  Star,
  Phone,
} from "lucide-react";
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

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useAppNavigate();
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
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput 
        placeholder="Search partners, pages..." 
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        {partners.length > 0 && (
          <CommandGroup heading="Partners">
            {partners.map((partner) => (
              <CommandItem
                key={partner.id}
                onSelect={() => runCommand(() => navigate(`/partners/${partner.id}`))}
              >
                <Building2 className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span>{partner.company_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {partner.city}, {partner.country_name}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/partners"))}>
            <Users className="mr-2 h-4 w-4" />
            <span>Partners</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/reminders"))}>
            <Calendar className="mr-2 h-4 w-4" />
            <span>Reminders</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/export"))}>
            <Download className="mr-2 h-4 w-4" />
            <span>Export</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => runCommand(() => navigate("/partners?favorites=true"))}>
            <Star className="mr-2 h-4 w-4" />
            <span>View Favorites</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
