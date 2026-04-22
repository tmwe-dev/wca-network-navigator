/**
 * ContactMergeDialog — Dialog for merging two contact records
 * Shows side-by-side comparison with field selection
 */
import { useState } from "react";
import { ContactForMerge, MergeFieldChoice, useMergeContacts } from "@/hooks/useContactMerge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface ContactMergeDialogProps {
  contact1: ContactForMerge;
  contact2: ContactForMerge;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMergeComplete?: (mergedId: string) => void;
}

interface FieldMergeChoice {
  name: string;
  field: keyof ContactForMerge;
  value1: unknown;
  value2: unknown;
  selected: ContactForMerge | null; // which contact's value is selected
}

const MERGE_FIELDS: Array<{
  name: string;
  field: keyof ContactForMerge;
  label: string;
}> = [
  { name: "name", field: "name", label: "Nome" },
  { name: "email", field: "email", label: "Email" },
  { name: "phone", field: "phone", label: "Telefono" },
  { name: "mobile", field: "mobile", label: "Cellulare" },
  { name: "company_name", field: "company_name", label: "Azienda" },
  { name: "title", field: "title", label: "Posizione" },
  { name: "country", field: "country", label: "Paese" },
];

export function ContactMergeDialog({
  contact1,
  contact2,
  open,
  onOpenChange,
  onMergeComplete,
}: ContactMergeDialogProps) {
  const [keepContact, setKeepContact] = useState<ContactForMerge>(contact1);
  const [fieldChoices, setFieldChoices] = useState<Record<string, ContactForMerge | null>>(() => {
    const choices: Record<string, ContactForMerge | null> = {};
    MERGE_FIELDS.forEach(({ field }) => {
      const v1 = contact1[field];
      const v2 = contact2[field];
      // Default to contact1 if it has a value
      choices[field as string] = v1 ? contact1 : v2 ? contact2 : null;
    });
    return choices;
  });

  const [step, setStep] = useState<"confirm" | "review">("confirm");
  const mergeContactsMutation = useMergeContacts();

  const deleteContact = keepContact.id === contact1.id ? contact2 : contact1;

  const handleSelectFieldValue = (field: string, contact: ContactForMerge | null) => {
    setFieldChoices((prev) => ({ ...prev, [field]: contact }));
  };

  const handleMerge = async () => {
    try {
      const choices: MergeFieldChoice[] = MERGE_FIELDS.map(({ field }) => ({
        fieldName: field as string,
        keepValue: fieldChoices[field as string]?.[field],
      }));

      await mergeContactsMutation.mutateAsync({
        keepId: keepContact.id,
        deleteId: deleteContact.id,
        fieldChoices: choices,
      });

      toast.success(`Contatti uniti con successo. ${deleteContact.name} eliminato.`);
      onOpenChange(false);
      onMergeComplete?.(keepContact.id);
    } catch (error) {
      console.error("Merge error:", error);
      toast.error("Errore durante l'unione dei contatti");
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Unisci Contatti</DialogTitle>
          <DialogDescription>
            Seleziona il contatto da mantenere e i valori di ogni campo.
          </DialogDescription>
        </DialogHeader>

        {step === "confirm" && (
          <div className="space-y-6">
            {/* Which contact to keep */}
            <div className="space-y-3">
              <label className="text-sm font-semibold">Contatto da mantenere</label>
              <div className="grid grid-cols-2 gap-4">
                {[contact1, contact2].map((contact) => (
                  <Card
                    key={contact.id}
                    className={`p-4 cursor-pointer border-2 transition ${
                      keepContact.id === contact.id ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-gray-200 dark:border-gray-700"
                    }`}
                    onClick={() => setKeepContact(contact)}
                  >
                    <div className="space-y-2">
                      <div className="font-semibold">{contact.name || "Senza nome"}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        {contact.email && <div>Email: {contact.email}</div>}
                        {contact.company_name && <div>Azienda: {contact.company_name}</div>}
                        {contact.phone && <div>Telefono: {contact.phone}</div>}
                      </div>
                      <Badge variant={keepContact.id === contact.id ? "default" : "outline"}>
                        {keepContact.id === contact.id ? "Da mantenere" : "Da eliminare"}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Field selection */}
            <div className="space-y-4">
              <label className="text-sm font-semibold">Seleziona i valori per ogni campo</label>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {MERGE_FIELDS.map(({ field, label }) => {
                  const v1 = contact1[field];
                  const v2 = contact2[field];

                  // Skip if both are empty
                  if (!v1 && !v2) return null;

                  const isSameValue = v1 === v2;

                  return (
                    <div key={field} className="border rounded-lg p-3 space-y-2">
                      <div className="text-sm font-medium">{label}</div>
                      <div className="grid grid-cols-2 gap-3">
                        {[contact1, contact2].map((contact) => {
                          const value = contact[field];
                          const isSelected = fieldChoices[field]?.id === contact.id;

                          return (
                            <button
                              key={contact.id}
                              onClick={() => handleSelectFieldValue(field, value ? contact : null)}
                              className={`p-2 rounded-md border-2 text-left text-sm transition ${
                                isSelected
                                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                                  : "border-gray-300 dark:border-gray-600 hover:border-gray-400"
                              } ${!value && "opacity-50 cursor-not-allowed"}`}
                              disabled={!value}
                            >
                              <input
                                type="radio"
                                name={field}
                                checked={isSelected}
                                onChange={() => {}}
                                className="mr-2"
                              />
                              <span className="text-xs text-gray-600 dark:text-gray-400">{contact.name}</span>
                              <div className="font-mono text-xs mt-1 break-words">
                                {value || "—"}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {isSameValue && (
                        <div className="text-xs text-green-600 dark:text-green-400">✓ Identico in entrambi</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annulla
              </Button>
              <Button onClick={() => setStep("review")}>Continua</Button>
            </DialogFooter>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-6">
            {/* Summary of changes */}
            <Card className="p-4 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
              <div className="flex gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <div className="font-semibold text-sm">Riepilogo unione</div>
                  <ul className="text-xs space-y-1 text-yellow-700 dark:text-yellow-300">
                    <li>• Mantieni: <strong>{keepContact.name || keepContact.email}</strong></li>
                    <li>• Elimina: <strong>{deleteContact.name || deleteContact.email}</strong></li>
                    <li>• Attività e email del contatto eliminato saranno riassegnate</li>
                    <li>• Questo non può essere annullato</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Field changes summary */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Campi che verranno aggiornati</label>
              <div className="space-y-1 text-sm">
                {MERGE_FIELDS.map(({ field, label }) => {
                  const selected = fieldChoices[field];
                  const currentValue = keepContact[field];
                  const newValue = selected?.[field];

                  if (currentValue === newValue) return null;

                  return (
                    <div key={field} className="text-xs">
                      <span className="font-medium">{label}:</span>{" "}
                      <span className="text-gray-600 dark:text-gray-400 line-through">
                        {currentValue || "—"}
                      </span>{" "}
                      →{" "}
                      <span className="text-green-600 dark:text-green-400">
                        {newValue || "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("confirm")}>
                Indietro
              </Button>
              <Button
                variant="destructive"
                onClick={handleMerge}
                disabled={mergeContactsMutation.isPending}
              >
                {mergeContactsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Unisci contatti
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
