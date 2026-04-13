/**
 * PickerHeader — Tabs, selected recipients row, search + settings popover
 */
import { Search, Users, Globe, CreditCard, X, Plane, ListChecks, Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getCountryFlag } from "@/lib/countries";
import { TABS_CONFIG, type PartnerSort, type ContactSort, type BcaSort } from "./types";
import type { UseEmailContactPickerReturn } from "@/hooks/useEmailContactPicker";

const ICON_MAP = { Globe, Users, CreditCard } as const;

interface PickerHeaderProps {
  readonly picker: UseEmailContactPickerReturn;
}

export function PickerHeader({ picker }: PickerHeaderProps) {
  const { state, dispatch, recipients, removeRecipient, clearRecipients, shouldSearch, currentCount, originOptions, handleSelectAll } = picker;

  return (
    <div className="flex-shrink-0 pb-1.5 mb-1 border-b border-border/30 space-y-1">
      {/* Tabs */}
      <div className="flex gap-1">
        {TABS_CONFIG.map(t => {
          const Icon = ICON_MAP[t.iconName];
          return (
            <button
              key={t.value}
              onClick={() => dispatch({ type: "SET_TAB", tab: t.value })}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all border",
                state.tab === t.value
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "border-border/40 text-muted-foreground hover:bg-muted/40"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Selected recipients row */}
      <div className="flex items-center gap-1.5 min-h-[22px]">
        {recipients.length > 0 ? (
          <>
            <div className="flex-1 flex gap-1 overflow-x-auto scrollbar-none min-w-0">
              {recipients.map((r, i) => (
                <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-medium border border-primary/20 shrink-0 max-w-[140px]">
                  <span className="text-xs leading-none">{getCountryFlag(r.countryCode || "")}</span>
                  <span className="truncate">{r.contactAlias || r.contactName || r.companyAlias || r.companyName}</span>
                  <button onClick={() => removeRecipient(i)} className="hover:text-destructive ml-0.5">
                    <X className="w-2 h-2" />
                  </button>
                </span>
              ))}
            </div>
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">{recipients.length}</Badge>
            <Button onClick={clearRecipients} size="sm" variant="ghost" className="h-5 px-1.5 text-[9px] text-muted-foreground shrink-0">
              <X className="w-2.5 h-2.5" />
            </Button>
          </>
        ) : (
          <span className="text-[9px] text-muted-foreground/50 italic">Nessun destinatario selezionato</span>
        )}
      </div>

      {/* Search + settings */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={state.search}
          onChange={e => dispatch({ type: "SET_SEARCH", search: e.target.value })}
          placeholder="Cerca (min. 3 caratteri)..."
          className="h-7 text-xs bg-muted/30 border-border/40 pl-8 pr-16"
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {shouldSearch && (
            <span className="text-[9px] text-muted-foreground tabular-nums">{currentCount}</span>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <button className={cn(
                "p-1 rounded hover:bg-muted/60 transition-colors",
                (state.hideHolding || state.originFilter !== "all") ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}>
                <Settings2 className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3 space-y-3" align="end" side="bottom">
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ordinamento</label>
                <Select
                  value={state.tab === "partners" ? state.partnerSort : state.tab === "contacts" ? state.contactSort : state.bcaSort}
                  onValueChange={(v) => {
                    if (state.tab === "partners") dispatch({ type: "SET_PARTNER_SORT", sort: v as PartnerSort });
                    else if (state.tab === "contacts") dispatch({ type: "SET_CONTACT_SORT", sort: v as ContactSort });
                    else dispatch({ type: "SET_BCA_SORT", sort: v as BcaSort });
                  }}
                >
                  <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {state.tab === "partners" && <><SelectItem value="name">Nome</SelectItem><SelectItem value="country">Paese</SelectItem><SelectItem value="rating">Rating</SelectItem></>}
                    {state.tab === "contacts" && <><SelectItem value="name">Nome</SelectItem><SelectItem value="company">Azienda</SelectItem><SelectItem value="origin">Origine</SelectItem><SelectItem value="country">Paese</SelectItem></>}
                    {state.tab === "bca" && <><SelectItem value="name">Nome</SelectItem><SelectItem value="company">Azienda</SelectItem><SelectItem value="location">Location</SelectItem></>}
                  </SelectContent>
                </Select>
              </div>
              {state.tab === "contacts" && originOptions.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Origine</label>
                  <Select value={state.originFilter} onValueChange={(v) => dispatch({ type: "SET_ORIGIN_FILTER", origin: v })}>
                    <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Tutte" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutte le origini</SelectItem>
                      {originOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                  <Plane className="w-3 h-3" /> Nascondi in circuito
                </label>
                <Switch checked={state.hideHolding} onCheckedChange={(v) => dispatch({ type: "SET_HIDE_HOLDING", value: v })} className="scale-75" />
              </div>
              {shouldSearch && currentCount > 0 && (
                <Button variant="outline" size="sm" onClick={handleSelectAll} className="w-full h-7 text-[10px] gap-1">
                  <ListChecks className="w-3 h-3" /> Seleziona tutti ({currentCount})
                </Button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
