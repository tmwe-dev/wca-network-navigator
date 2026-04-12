import { useState } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { insertCockpitQueueItems } from "@/data/cockpitQueue";

type Destination = "contacts" | "network" | "cockpit";

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select destination */
  defaultDestination?: Destination;
  /** For network destination: pre-fill partner_id */
  partnerId?: string;
  /** For network destination: pre-fill partner name (display only) */
  partnerName?: string;
}

export default function AddContactDialog({
  open, onOpenChange, defaultDestination = "contacts", partnerId, partnerName,
}: AddContactDialogProps) {
  const navigate = useAppNavigate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [destination, setDestination] = useState<Destination>(defaultDestination);

  const [form, setForm] = useState({
    name: "", company: "", email: "", phone: "", mobile: "",
    country: "", city: "", position: "", notes: "",
  });

  const update = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const resetForm = () => {
    setForm({ name: "", company: "", email: "", phone: "", mobile: "", country: "", city: "", position: "", notes: "" });
  };

  const handleSave = async () => {
    if (!form.name.trim() && !form.company.trim()) {
      toast({ title: "Inserisci almeno nome o azienda", variant: "destructive" });
      return;
    }
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      let sourceId: string | null = null;
      let sourceType: string | null = null;

      if (destination === "contacts") {
        // Get or create "manual" import log
        let { data: existingLog } = await supabase
          .from("import_logs")
          .select("id")
          .eq("user_id", user.id)
          .eq("file_name", "__manual_entry__")
          .limit(1)
          .single();

        let logId: string;
        if (existingLog) {
          logId = existingLog.id;
        } else {
          const { data: newLog, error: logErr } = await supabase
            .from("import_logs")
            .insert({
              user_id: user.id,
              file_name: "__manual_entry__",
              file_size: 0,
              total_rows: 0,
              imported_rows: 0,
              status: "completed",
              normalization_method: "manual",
            })
            .select("id")
            .single();
          if (logErr) throw logErr;
          logId = newLog!.id;
        }

        const { data: contact, error } = await supabase
          .from("imported_contacts")
          .insert({
            import_log_id: logId,
            user_id: user.id,
            company_name: form.company.trim() || null,
            name: form.name.trim() || null,
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            mobile: form.mobile.trim() || null,
            country: form.country.trim() || null,
            city: form.city.trim() || null,
            position: form.position.trim() || null,
            note: form.notes.trim() || null,
            origin: "Manuale",
            lead_status: "new",
            row_number: 0,
          })
          .select("id")
          .single();
        if (error) throw error;
        sourceId = contact!.id;
        sourceType = "contact";
        queryClient.invalidateQueries({ queryKey: ["contact-group-counts"] });
        queryClient.invalidateQueries({ queryKey: ["contacts-by-group"] });

      } else if (destination === "network") {
        if (!partnerId) {
          toast({ title: "Seleziona un partner dal Network", variant: "destructive" });
          setSaving(false);
          return;
        }
        const { data: pc, error } = await supabase
          .from("partner_contacts")
          .insert({
            partner_id: partnerId,
            user_id: user.id,
            name: form.name.trim() || form.company.trim() || "—",
            title: form.position.trim() || null,
            email: form.email.trim() || null,
            direct_phone: form.phone.trim() || null,
            mobile: form.mobile.trim() || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        sourceId = pc!.id;
        sourceType = "partner_contact";
        queryClient.invalidateQueries({ queryKey: ["partners"] });
      }

      // If cockpit destination OR user wants it queued
      if (destination === "cockpit" && sourceId && sourceType) {
        await insertCockpitQueueItems([{
          user_id: user.id,
          source_id: sourceId,
          source_type: sourceType,
          partner_id: partnerId || null,
        }]);
        queryClient.invalidateQueries({ queryKey: ["cockpit-queue"] });
      } else if (destination === "cockpit" && !sourceId) {
        // Create as imported_contact first, then queue
        let { data: existingLog } = await supabase
          .from("import_logs")
          .select("id")
          .eq("user_id", user.id)
          .eq("file_name", "__manual_entry__")
          .limit(1)
          .single();

        let logId: string;
        if (existingLog) {
          logId = existingLog.id;
        } else {
          const { data: newLog, error: logErr } = await supabase
            .from("import_logs")
            .insert({
              user_id: user.id,
              file_name: "__manual_entry__",
              file_size: 0,
              total_rows: 0,
              imported_rows: 0,
              status: "completed",
              normalization_method: "manual",
            })
            .select("id")
            .single();
          if (logErr) throw logErr;
          logId = newLog!.id;
        }

        const { data: contact, error } = await supabase
          .from("imported_contacts")
          .insert({
            import_log_id: logId,
            user_id: user.id,
            company_name: form.company.trim() || null,
            name: form.name.trim() || null,
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            mobile: form.mobile.trim() || null,
            country: form.country.trim() || null,
            city: form.city.trim() || null,
            position: form.position.trim() || null,
            note: form.notes.trim() || null,
            origin: "Manuale",
            lead_status: "new",
            row_number: 0,
          })
          .select("id")
          .single();
        if (error) throw error;

        await insertCockpitQueueItems([{
          user_id: user.id,
          source_id: contact!.id,
          source_type: "contact",
        }]);
        queryClient.invalidateQueries({ queryKey: ["cockpit-queue"] });
        queryClient.invalidateQueries({ queryKey: ["contact-group-counts"] });
      }

      toast({ title: "✅ Contatto aggiunto", description: `${form.name || form.company} → ${destination === "contacts" ? "Contatti" : destination === "network" ? "Network" : "Cockpit"}` });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Nuovo Contatto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Destination */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Destinazione</Label>
            <Select value={destination} onValueChange={(v) => setDestination(v as Destination)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contacts">📋 Contatti (imported_contacts)</SelectItem>
                <SelectItem value="network" disabled={!partnerId}>🌐 Network (partner_contacts){partnerId ? ` → ${partnerName}` : ""}</SelectItem>
                <SelectItem value="cockpit">🎯 Cockpit (coda lavoro)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input value={form.name} onChange={e => update("name", e.target.value)} placeholder="Mario Rossi" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Azienda</Label>
              <Input value={form.company} onChange={e => update("company", e.target.value)} placeholder="Acme Srl" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="mario@acme.it" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ruolo / Posizione</Label>
              <Input value={form.position} onChange={e => update("position", e.target.value)} placeholder="Sales Manager" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefono</Label>
              <Input value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="+39 02 1234567" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cellulare</Label>
              <Input value={form.mobile} onChange={e => update("mobile", e.target.value)} placeholder="+39 333 1234567" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Paese</Label>
              <Input value={form.country} onChange={e => update("country", e.target.value)} placeholder="IT" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Città</Label>
              <Input value={form.city} onChange={e => update("city", e.target.value)} placeholder="Milano" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Note</Label>
            <Textarea value={form.notes} onChange={e => update("notes", e.target.value)} placeholder="Appunti sul contatto..." rows={2} className="resize-none" />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            disabled={!form.email.trim()}
            onClick={() => {
              navigate("/email-composer", {
                state: {
                  prefilledRecipient: {
                    email: form.email.trim(),
                    name: form.name.trim() || undefined,
                    company: form.company.trim() || undefined,
                    city: form.city.trim() || undefined,
                    countryCode: form.country.trim() || undefined,
                  },
                },
              });
              onOpenChange(false);
            }}
          >
            <Mail className="w-3.5 h-3.5" />
            Scrivi email
          </Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">Annulla</Button>
            <Button onClick={handleSave} disabled={saving || (!form.name.trim() && !form.company.trim())} size="sm" className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              Salva
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
