import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Building2 } from "lucide-react";
import { searchPartners } from "@/data/partners";
import { macroAreaGroups, type NavItemDef } from "@/v2/ui/templates/navConfig";

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
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [search, setSearch] = useState("");

  // SSOT navigazione: stesse 7 macro-aree del menu principale (navConfig).
  const labelOf = (item: NavItemDef): string => {
    const translated = t(item.labelKey);
    return translated === item.labelKey
      ? item.labelKey.replace(/^nav\./, "").replace(/_/g, " ")
      : translated;
  };

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
                onSelect={() => runCommand(() => navigate("/v2/network"))}
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

        {macroAreaGroups.map((group) => (
          <CommandGroup key={group.key} heading={group.label}>
            {group.items.map((item) => (
              <CommandItem
                key={item.path}
                value={`${labelOf(item)} ${group.label}`}
                onSelect={() => runCommand(() => navigate(item.path))}
              >
                <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">{item.icon}</span>
                <span>{labelOf(item)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
