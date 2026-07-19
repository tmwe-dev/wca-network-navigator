/**
 * ExportSendersDialog — Dialog per esportare i sender selezionati.
 *
 * Due modalità (RadioGroup):
 *  • addresses: CSV con 1 sola colonna (email_address) → utile per liste rapide
 *  • messages : CSV con metadata complete delle email da channel_messages
 *               (subject, date, direction, from, to, body_text troncato).
 *
 * Nessuna logica di business modificata: legge solo `channel_messages`
 * filtrato per `from_address IN (...)` e `channel='email'`.
 */
import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ExportSendersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Email dei sender selezionati */
  senderEmails: string[];
}

type ExportMode = "addresses" | "messages";

/** Escape minimale CSV (RFC4180): doppia-virgolette + wrapping. */
function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  // BOM per compatibilità Excel con caratteri italiani.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportSendersDialog({ open, onOpenChange, senderEmails }: ExportSendersDialogProps) {
  const [mode, setMode] = useState<ExportMode>("addresses");
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    if (senderEmails.length === 0) {
      toast.error("Nessun mittente selezionato");
      return;
    }
    setBusy(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      if (mode === "addresses") {
        const rows = [["email_address"], ...senderEmails.map((e) => [e])];
        downloadCSV(`mittenti-${stamp}.csv`, rows);
        toast.success(`Esportati ${senderEmails.length} indirizzi`);
      } else {
        const { data, error } = await supabase
          .from("channel_messages")
          .select("id, email_date, direction, from_address, to_address, subject, body_text")
          .eq("channel", "email")
          .in("from_address", senderEmails)
          .order("email_date", { ascending: false })
          .limit(2000);
        if (error) throw error;
        const rows: string[][] = [
          ["id", "data", "direzione", "mittente", "destinatario", "oggetto", "anteprima_corpo"],
        ];
        for (const m of data ?? []) {
          rows.push([
            m.id,
            m.email_date ?? "",
            m.direction ?? "",
            m.from_address ?? "",
            m.to_address ?? "",
            m.subject ?? "",
            (m.body_text ?? "").replace(/\s+/g, " ").slice(0, 500),
          ]);
        }
        downloadCSV(`mittenti-messaggi-${stamp}.csv`, rows);
        toast.success(`Esportati ${(data ?? []).length} messaggi`);
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore export");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Esporta mittenti</DialogTitle>
          <DialogDescription>
            {senderEmails.length} mittente{senderEmails.length !== 1 ? "i" : ""} selezionato
            {senderEmails.length !== 1 ? "i" : ""}. Scegli cosa esportare.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={mode} onValueChange={(v) => setMode(v as ExportMode)} className="space-y-3 py-2">
          <div className="flex items-start gap-3 p-3 rounded-md border hover:bg-muted/30 transition-colors">
            <RadioGroupItem value="addresses" id="opt-addresses" className="mt-0.5" />
            <Label htmlFor="opt-addresses" className="flex-1 cursor-pointer space-y-1">
              <div className="font-medium text-sm">Solo indirizzi email</div>
              <div className="text-xs text-muted-foreground">
                CSV con 1 colonna (email_address). Utile per liste rapide o blacklist.
              </div>
            </Label>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-md border hover:bg-muted/30 transition-colors">
            <RadioGroupItem value="messages" id="opt-messages" className="mt-0.5" />
            <Label htmlFor="opt-messages" className="flex-1 cursor-pointer space-y-1">
              <div className="font-medium text-sm">Tutte le email</div>
              <div className="text-xs text-muted-foreground">
                CSV con metadata complete: data, direzione, oggetto, anteprima corpo
                (max 2000 messaggi).
              </div>
            </Label>
          </div>
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Annulla
          </Button>
          <Button onClick={handleExport} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Esporta CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}