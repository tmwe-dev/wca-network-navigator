/**
 * DuplicateReviewList — Displays list of duplicate contact pairs
 * Shows confidence %, differences, and merge/dismiss buttons
 */
import { useState, useMemo } from "react";
import { DuplicatePair, useFindDuplicates } from "@/hooks/useContactMerge";
import { ContactMergeDialog } from "./ContactMergeDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Trash2, Merge2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function DuplicateReviewList() {
  const { data: duplicates, isLoading, refetch } = useFindDuplicates();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedPair, setSelectedPair] = useState<DuplicatePair | null>(null);

  const visibleDuplicates = useMemo(() => {
    if (!duplicates) return [];
    return duplicates.filter((pair) => {
      const pairKey = [pair.contact1.id, pair.contact2.id].sort().join("-");
      return !dismissed.has(pairKey);
    });
  }, [duplicates, dismissed]);

  const handleDismiss = (pair: DuplicatePair) => {
    const pairKey = [pair.contact1.id, pair.contact2.id].sort().join("-");
    setDismissed((prev) => new Set(prev).add(pairKey));
    toast.info(`Coppia ignorata`);
  };

  const handleMergeClick = (pair: DuplicatePair) => {
    setSelectedPair(pair);
    setMergeDialogOpen(true);
  };

  const handleMergeComplete = async () => {
    setMergeDialogOpen(false);
    setSelectedPair(null);
    // Refresh the list
    await refetch();
    toast.success("Elenco duplicati aggiornato");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!duplicates || duplicates.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <div className="text-sm">Nessun contatto duplicato rilevato</div>
      </Card>
    );
  }

  if (visibleDuplicates.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <div className="text-sm">Tutti i duplicati sono stati revisionati</div>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => {
            setDismissed(new Set());
            refetch();
          }}
        >
          Ripristina elenco
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Possibili Duplicati</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {visibleDuplicates.length} di {duplicates.length} coppie
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Ricarica
        </Button>
      </div>

      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {visibleDuplicates.map((pair, idx) => (
          <Card key={idx} className="p-4 space-y-3">
            {/* Header with confidence */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant="secondary"
                    className={
                      pair.matchConfidence >= 90
                        ? "bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-200"
                        : pair.matchConfidence >= 75
                          ? "bg-orange-100 dark:bg-orange-950 text-orange-900 dark:text-orange-200"
                          : "bg-yellow-100 dark:bg-yellow-950 text-yellow-900 dark:text-yellow-200"
                    }
                  >
                    {pair.matchConfidence}% corrispondenza
                  </Badge>
                  <span className="text-xs text-muted-foreground">{pair.reason}</span>
                </div>

                {/* Contacts side-by-side */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {[pair.contact1, pair.contact2].map((contact) => (
                    <div key={contact.id} className="bg-muted p-2 rounded text-sm space-y-1">
                      <div className="font-medium truncate">{contact.name || "Senza nome"}</div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {contact.email && <div>Email: {contact.email}</div>}
                        {contact.company_name && <div>Azienda: {contact.company_name}</div>}
                        {contact.phone && <div>Tel: {contact.phone}</div>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Creato: {new Date(contact.created_at).toLocaleDateString("it-IT")}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Differences */}
                {pair.differences.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Differenze</label>
                    <ul className="text-xs space-y-0.5 text-muted-foreground">
                      {pair.differences.map((diff, i) => (
                        <li key={i} className="flex gap-1">
                          <span className="text-orange-500">•</span>
                          <span>{diff}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDismiss(pair)}
                className="text-xs"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                Non è un duplicato
              </Button>
              <Button
                size="sm"
                onClick={() => handleMergeClick(pair)}
                className="text-xs"
              >
                <Merge2 className="h-3 w-3 mr-1" />
                Rivedi e unisci
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Merge Dialog */}
      {selectedPair && (
        <ContactMergeDialog
          contact1={selectedPair.contact1}
          contact2={selectedPair.contact2}
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          onMergeComplete={handleMergeComplete}
        />
      )}
    </div>
  );
}
