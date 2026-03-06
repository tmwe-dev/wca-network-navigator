import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Search, ChevronDown, Sparkles } from "lucide-react";
import { countryFlag } from "./contactHelpers";
import type { ContactGroupCount } from "@/hooks/useContactGroups";

interface GroupStripProps {
  group: ContactGroupCount;
  groupBy: string;
  isOpen: boolean;
  onToggle: () => void;
  onDeepSearch: () => void;
  onAlias: () => void;
  isGroupSelected: boolean;
  onToggleGroupSelect: () => void;
}

export function GroupStrip({ group, groupBy, isOpen, onToggle, onDeepSearch, onAlias, isGroupSelected, onToggleGroupSelect }: GroupStripProps) {
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-muted backdrop-blur-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <Checkbox
          checked={isGroupSelected}
          onCheckedChange={onToggleGroupSelect}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
        />
        <button
          className="flex-1 flex items-center gap-2 text-left hover:bg-accent/50 rounded transition-colors -mx-1 px-1"
          onClick={onToggle}
        >
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />

          {groupBy === "country" && (
            <span className="text-sm shrink-0">{countryFlag(group.group_key)}</span>
          )}

          <span className="text-xs font-bold uppercase tracking-wide text-foreground truncate">
            {group.group_label}
          </span>

          {/* Inline counters */}
          <div className="flex items-center gap-2 ml-auto shrink-0 text-[10px] text-muted-foreground">
            {group.with_email > 0 && (
              <span className="flex items-center gap-0.5" title={`${group.with_email} con email`}>
                <Mail className="w-3 h-3" />{group.with_email}
              </span>
            )}
            {group.with_phone > 0 && (
              <span className="flex items-center gap-0.5" title={`${group.with_phone} con telefono`}>
                <Phone className="w-3 h-3" />{group.with_phone}
              </span>
            )}
            {group.with_deep_search > 0 && (
              <span className="flex items-center gap-0.5 text-success" title={`${group.with_deep_search} deep search`}>
                <Search className="w-3 h-3" />{group.with_deep_search}
              </span>
            )}
            {group.with_alias > 0 && (
              <span className="flex items-center gap-0.5 text-primary" title={`${group.with_alias} con alias`}>
                <Sparkles className="w-3 h-3" />{group.with_alias}
              </span>
            )}
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-bold">
              {group.contact_count}
            </Badge>
          </div>
        </button>
      </div>

      {isOpen && (
        <div className="flex items-center gap-1 px-3 pb-1.5 text-[10px]">
          <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-1 px-1.5" onClick={(e) => { e.stopPropagation(); onDeepSearch(); }}>
            <Search className="w-3 h-3" /> Deep Search
          </Button>
          <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-1 px-1.5" onClick={(e) => { e.stopPropagation(); onAlias(); }}>
            <Sparkles className="w-3 h-3" /> Alias
          </Button>
        </div>
      )}
    </div>
  );
}
