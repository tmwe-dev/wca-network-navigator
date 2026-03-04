import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, ArrowRight, Mail, Phone, ChevronLeft, ChevronRight, Users,
} from "lucide-react";
import { CompactContactCard } from "./CompactContactCard";
import { AdvancedActivityForm } from "./AdvancedActivityForm";
import type { ImportedContact } from "@/hooks/useImportLogs";
import {
  useToggleContactSelection,
  useTransferToPartners,
  useCreateActivitiesFromImport,
} from "@/hooks/useImportLogs";

interface ContactsGridTabProps {
  contacts: ImportedContact[];
  activeLogId: string | null;
}

const PAGE_SIZES = [25, 50, 100, 250];

export function ContactsGridTab({ contacts, activeLogId }: ContactsGridTabProps) {
  const [search, setSearch] = useState("");
  const [filterOrigin, setFilterOrigin] = useState<string>("__all__");
  const [filterCountry, setFilterCountry] = useState<string>("__all__");
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(0);
  const [localSelection, setLocalSelection] = useState<Set<string>>(new Set());
  const [activityFormOpen, setActivityFormOpen] = useState(false);

  const toggleSelection = useToggleContactSelection();
  const transferToPartners = useTransferToPartners();
  const createActivities = useCreateActivitiesFromImport();

  // Derive unique origins and countries
  const origins = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => c.origin && set.add(c.origin));
    return Array.from(set).sort();
  }, [contacts]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => c.country && set.add(c.country));
    return Array.from(set).sort();
  }, [contacts]);

  // Filter
  const filtered = useMemo(() => {
    let result = contacts;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          (c.company_name || "").toLowerCase().includes(q) ||
          (c.name || "").toLowerCase().includes(q) ||
          (c.city || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q)
      );
    }
    if (filterOrigin !== "__all__") {
      result = result.filter((c) => c.origin === filterOrigin);
    }
    if (filterCountry !== "__all__") {
      result = result.filter((c) => c.country === filterCountry);
    }
    return result;
  }, [contacts, search, filterOrigin, filterCountry]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages - 1);
  const pageContacts = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  // Selection helpers
  const toggleLocal = useCallback((id: string, selected: boolean) => {
    setLocalSelection((prev) => {
      const next = new Set(prev);
      selected ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  const selectAllPage = useCallback(
    (selected: boolean) => {
      setLocalSelection((prev) => {
        const next = new Set(prev);
        pageContacts
          .filter((c) => !c.is_transferred)
          .forEach((c) => (selected ? next.add(c.id) : next.delete(c.id)));
        return next;
      });
    },
    [pageContacts]
  );

  const selectedContacts = useMemo(
    () => contacts.filter((c) => localSelection.has(c.id) && !c.is_transferred),
    [contacts, localSelection]
  );

  const allPageSelected =
    pageContacts.filter((c) => !c.is_transferred).length > 0 &&
    pageContacts.filter((c) => !c.is_transferred).every((c) => localSelection.has(c.id));

  // Handlers
  const handleTransfer = useCallback(() => {
    if (selectedContacts.length === 0) return;
    transferToPartners.mutate(selectedContacts);
    setLocalSelection(new Set());
  }, [selectedContacts, transferToPartners]);

  const handleQuickActivity = useCallback(
    (contact: ImportedContact, type: "send_email" | "phone_call") => {
      const batchId = `import_${Date.now()}`;
      createActivities.mutate({
        contacts: [contact],
        activityType: type,
        campaignBatchId: batchId,
      });
    },
    [createActivities]
  );

  const handleBulkActivitySubmit = useCallback(
    (params: {
      activityType: "send_email" | "phone_call";
      priority: string;
      sendNow: boolean;
    }) => {
      const batchId = `import_${Date.now()}`;
      createActivities.mutate(
        {
          contacts: selectedContacts,
          activityType: params.activityType,
          campaignBatchId: batchId,
        },
        {
          onSuccess: () => {
            setActivityFormOpen(false);
            setLocalSelection(new Set());
          },
        }
      );
    },
    [selectedContacts, createActivities]
  );

  return (
    <div className="space-y-3">
      {/* Filters bar */}
      <Card>
        <CardContent className="py-2.5 px-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Cerca azienda, nome, città, email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(0); }}
                className="pl-8 h-8 text-xs"
              />
            </div>

            {origins.length > 0 && (
              <Select value={filterOrigin} onValueChange={(v) => { setFilterOrigin(v); setCurrentPage(0); }}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue placeholder="Origine" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutte le origini</SelectItem>
                  {origins.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {countries.length > 1 && (
              <Select value={filterCountry} onValueChange={(v) => { setFilterCountry(v); setCurrentPage(0); }}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue placeholder="Paese" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti i paesi</SelectItem>
                  {countries.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(0); }}>
              <SelectTrigger className="w-20 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)}>{s}/pag</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {filtered.length} risultati
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Bulk action bar */}
      {selectedContacts.length > 0 && (
        <Card className="border-primary/30">
          <CardContent className="py-2 px-3 flex items-center gap-2 flex-wrap">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{selectedContacts.length} selezionati</span>
            <Button size="sm" variant="outline" onClick={() => setActivityFormOpen(true)}>
              <Mail className="w-3.5 h-3.5 mr-1" />Crea Attività
            </Button>
            <Button size="sm" variant="outline" onClick={handleTransfer}>
              <ArrowRight className="w-3.5 h-3.5 mr-1" />Trasferisci a Partner
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Select all + grid */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <Checkbox
              checked={allPageSelected}
              onCheckedChange={(v) => selectAllPage(!!v)}
            />
            <span className="text-xs text-muted-foreground">
              Seleziona pagina ({pageContacts.filter((c) => !c.is_transferred).length})
            </span>
          </div>

          <ScrollArea className="h-[calc(100vh-460px)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-2">
              {pageContacts.map((c) => (
                <CompactContactCard
                  key={c.id}
                  contact={c}
                  isSelected={localSelection.has(c.id)}
                  onToggleSelect={(sel) => toggleLocal(c.id, sel)}
                  onQuickEmail={() => handleQuickActivity(c, "send_email")}
                  onQuickCall={() => handleQuickActivity(c, "phone_call")}
                />
              ))}
            </div>
            {pageContacts.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-12">
                Nessun contatto trovato
              </p>
            )}
          </ScrollArea>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground">
              <span>
                Pagina {safePage + 1} di {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={safePage === 0}
                  onClick={() => setCurrentPage(safePage - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setCurrentPage(safePage + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced Activity Form */}
      <AdvancedActivityForm
        open={activityFormOpen}
        onOpenChange={setActivityFormOpen}
        contacts={selectedContacts}
        onSubmit={handleBulkActivitySubmit}
        isSubmitting={createActivities.isPending}
      />
    </div>
  );
}
