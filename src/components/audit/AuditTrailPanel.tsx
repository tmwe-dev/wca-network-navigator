/**
 * AuditTrailPanel — Displays chronological audit trail with filters
 * Shows activities from supervisor_audit_log table
 */
import { useState, useCallback } from "react";
import { useAuditTrail } from "@/hooks/useAuditTrail";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ChevronDown, LogSquare } from "lucide-react";

interface AuditFilters {
  offset: number;
  limit: number;
  actionCategory?: string;
  actorType?: string;
  dateRange?: {
    from: string;
    to: string;
  };
  searchText?: string;
}

const BATCH_SIZE = 20;

const ACTION_CATEGORIES = [
  { value: "contact_created", label: "Contatto creato" },
  { value: "contact_updated", label: "Contatto aggiornato" },
  { value: "contact_deleted", label: "Contatto eliminato" },
  { value: "deal_created", label: "Affare creato" },
  { value: "deal_updated", label: "Affare aggiornato" },
  { value: "email_sent", label: "Email inviata" },
  { value: "email_received", label: "Email ricevuta" },
  { value: "activity_logged", label: "Attività registrata" },
  { value: "partner_added", label: "Partner aggiunto" },
];

const ACTOR_TYPES = [
  { value: "user", label: "Utente" },
  { value: "system", label: "Sistema" },
  { value: "automation", label: "Automazione" },
  { value: "api", label: "API" },
];

export function AuditTrailPanel() {
  const [filters, setFilters] = useState<AuditFilters>({
    offset: 0,
    limit: BATCH_SIZE,
  });
  const [searchText, setSearchText] = useState("");
  const [actionCategory, setActionCategory] = useState("");
  const [actorType, setActorType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: auditEntries, isLoading } = useAuditTrail({
    ...filters,
    actionCategory: actionCategory || undefined,
    actorType: actorType || undefined,
    searchText: searchText || undefined,
    dateRange:
      dateFrom || dateTo
        ? {
            from: dateFrom || "1900-01-01",
            to: dateTo || new Date().toISOString().split("T")[0],
          }
        : undefined,
  });

  const handleApplyFilters = useCallback(() => {
    setFilters((prev) => ({ ...prev, offset: 0 }));
  }, []);

  const handleLoadMore = useCallback(() => {
    setFilters((prev) => ({ ...prev, offset: prev.offset + BATCH_SIZE }));
  }, []);

  const canLoadMore = auditEntries && auditEntries.length === BATCH_SIZE;

  const getActionBadgeColor = (action: string) => {
    if (action.includes("deleted")) return "destructive";
    if (action.includes("created")) return "default";
    if (action.includes("updated")) return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4 space-y-4">
        <h3 className="font-semibold text-sm">Filtri</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Ricerca</label>
            <Input
              placeholder="Descrizione, entità, email..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Categoria</label>
            <Select value={actionCategory} onValueChange={setActionCategory}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Tutte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tutte</SelectItem>
                {ACTION_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Attore</label>
            <Select value={actorType} onValueChange={setActorType}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Tutti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tutti</SelectItem>
                {ACTOR_TYPES.map((actor) => (
                  <SelectItem key={actor.value} value={actor.value}>
                    {actor.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Intervallo date</label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 text-xs"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSearchText("");
              setActionCategory("");
              setActorType("");
              setDateFrom("");
              setDateTo("");
              setFilters({ offset: 0, limit: BATCH_SIZE });
            }}
          >
            Ripristina
          </Button>
          <Button size="sm" onClick={handleApplyFilters}>
            Applica filtri
          </Button>
        </div>
      </Card>

      {/* Audit Entries List */}
      <div className="space-y-3">
        {isLoading && filters.offset === 0 ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : auditEntries && auditEntries.length > 0 ? (
          <>
            {auditEntries.map((entry) => (
              <Card key={entry.id} className="p-4 space-y-2">
                {/* Header: timestamp, action, actor */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <LogSquare className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={getActionBadgeColor(entry.action_category)}>
                          {entry.action_category}
                        </Badge>
                        {entry.actor_type && (
                          <Badge variant="outline" className="text-xs">
                            {entry.actor_type}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {entry.action_detail}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                    {new Date(entry.created_at).toLocaleString("it-IT")}
                  </div>
                </div>

                {/* Target info */}
                {entry.target_label && (
                  <div className="text-sm ml-7 text-muted-foreground">
                    Entità: <strong>{entry.target_type}</strong> — {entry.target_label}
                  </div>
                )}

                {/* Actor info */}
                {entry.actor_name && (
                  <div className="text-sm ml-7 text-muted-foreground">
                    Attore: <strong>{entry.actor_name}</strong>
                    {entry.actor_id && ` (${entry.actor_id})`}
                  </div>
                )}

                {/* Metadata */}
                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                  <div className="text-xs ml-7 text-muted-foreground">
                    <details className="cursor-pointer">
                      <summary>Metadati</summary>
                      <pre className="mt-1 bg-muted p-2 rounded text-xs overflow-x-auto">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}

                {/* IP info */}
                {entry.ip_address && (
                  <div className="text-xs ml-7 text-muted-foreground">
                    IP: {entry.ip_address}
                  </div>
                )}
              </Card>
            ))}

            {/* Load More */}
            {canLoadMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <ChevronDown className="mr-2 h-4 w-4" />
                  Carica altri
                </Button>
              </div>
            )}
          </>
        ) : (
          <Card className="p-8 text-center text-muted-foreground">
            <div className="text-sm">Nessun evento di audit trovato</div>
          </Card>
        )}
      </div>
    </div>
  );
}
