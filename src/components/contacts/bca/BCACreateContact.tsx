/**
 * BCACreateContact — Create imported_contact from a business card
 */
import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, Loader2, CheckCircle2, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { insertContacts } from "@/data/contacts";
import { searchPartnersByNameAlias } from "@/data/partners";
import { updateBusinessCard } from "@/data/businessCards";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import type { BusinessCardWithPartner } from "@/hooks/useBusinessCards";

interface Props {
  card: BusinessCardWithPartner;
}

export function BCACreateContact({ card }: Props) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [partnerResults, setPartnerResults] = useState<any[]>([]);
  const [_searching, setSearching] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(card.matched_partner_id);

  // Split contact_name into first/last
  const _nameParts = useMemo(() => {
    if (!card.contact_name) return { first: "", last: "" };
    const parts = card.contact_name.trim().split(/\s+/);
    return { first: parts[0] || "", last: parts.slice(1).join(" ") || "" };
  }, [card.contact_name]);

  const [form, setForm] = useState({
    name: card.contact_name || "",
    company_name: card.company_name || "",
    email: card.email || "",
    phone: card.phone || "",
    mobile: card.mobile || "",
    position: card.position || "",
  });

  const searchPartners = useCallback(async () => {
    if (!form.company_name.trim()) return;
    setSearching(true);
    try {
      const data = await searchPartnersByNameAlias(form.company_name.trim(), "id, company_name, country_code, city");
      setPartnerResults(data ?? []);
    } catch { /* ignore */ }
    finally { setSearching(false); }
  }, [form.company_name]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const contact: Record<string, unknown> = {
        name: form.name || null,
        company_name: form.company_name || null,
        email: form.email || null,
        phone: form.phone || null,
        mobile: form.mobile || null,
        position: form.position || null,
        origin: "business_card",
        lead_status: "new",
        wca_partner_id: selectedPartnerId || null,
      };
      await insertContacts([contact]);

      // Update BCA with matched partner if selected
      if (selectedPartnerId && !card.matched_partner_id) {
        await updateBusinessCard(card.id, {
          matched_partner_id: selectedPartnerId,
          match_status: "matched",
          match_confidence: 100,
        });
      }

      qc.invalidateQueries({ queryKey: ["business-cards"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: "✅ Contatto creato da biglietto" });
      setShowForm(false);
    } catch (e: unknown) {
      toast({ title: "Errore", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setCreating(false); }
  }, [form, selectedPartnerId, card, qc]);

  if (card.matched_contact_id) return null;

  if (!showForm) {
    return (
      <Button variant="outline" size="sm" className="w-full text-xs gap-2 border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-400" onClick={() => { setShowForm(true); searchPartners(); }}>
        <UserPlus className="w-3.5 h-3.5" /> Crea Contatto
      </Button>
    );
  }

  return (
    <div className="space-y-2 bg-emerald-500/5 rounded-lg p-3 border border-emerald-500/15">
      <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-medium flex items-center gap-1">
        <UserPlus className="w-3 h-3" /> Crea contatto dal biglietto
      </p>

      <div className="space-y-1.5">
        {(["name", "company_name", "email", "phone", "position"] as const).map((field) => (
          <Input
            key={field}
            value={form[field]}
            onChange={(e) => setForm(prev => ({ ...prev, [field]: e.target.value }))}
            placeholder={field === "name" ? "Nome" : field === "company_name" ? "Azienda" : field === "email" ? "Email" : field === "phone" ? "Telefono" : "Posizione"}
            className="h-7 text-xs"
          />
        ))}
      </div>

      {/* Partner suggestions */}
      {partnerResults.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground">Partner simili trovati:</p>
          {partnerResults.slice(0, 3).map((p) => (
            <button key={p.id}
              className={cn("w-full text-left px-2 py-1.5 rounded-md border transition-colors text-xs",
                selectedPartnerId === p.id ? "bg-primary/15 border-primary/30 text-primary" : "border-border/30 hover:bg-muted/50")}
              onClick={() => setSelectedPartnerId(p.id === selectedPartnerId ? null : p.id)}
            >
              <div className="flex items-center gap-2">
                <Link2 className="w-3 h-3 shrink-0" />
                <span className="truncate">{p.company_name}</span>
                {selectedPartnerId === p.id && <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-auto shrink-0" />}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-1.5">
        <Button size="sm" className="h-7 text-xs flex-1 gap-1" onClick={handleCreate} disabled={creating}>
          {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
          Conferma
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowForm(false)}>Annulla</Button>
      </div>
    </div>
  );
}
