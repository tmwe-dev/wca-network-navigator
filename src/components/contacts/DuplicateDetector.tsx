import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Merge, Ban, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { clean } from "./contactHelpers";

interface DuplicateContact {
  id: string;
  name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  country: string | null;
  lead_status: string | null;
  created_at: string;
  interaction_count: number | null;
}

interface DuplicateGroup {
  group: DuplicateContact[];
  reason: string;
  ignored?: boolean;
}

export function DuplicateDetector() {
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState<string | null>(null);

  const scan = async () => {
    setLoading(true);
    try {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) return;

      const { data: contacts } = await supabase
        .from("imported_contacts")
        .select("id, name, company_name, email, phone, mobile, country, lead_status, created_at, interaction_count")
        .or("company_name.not.is.null,name.not.is.null,email.not.is.null")
        .limit(1000);

      if (!contacts || contacts.length === 0) { setDuplicates([]); return; }

      const groups: DuplicateGroup[] = [];
      const seen = new Set<string>();

      // Group by email
      const emailMap = new Map<string, DuplicateContact[]>();
      for (const c of contacts) {
        if (c.email) {
          const key = c.email.toLowerCase().trim();
          const list = emailMap.get(key) || [];
          list.push(c);
          emailMap.set(key, list);
        }
      }
      for (const [email, group] of emailMap) {
        if (group.length > 1) {
          groups.push({ group, reason: `Email identica: ${email}` });
          group.forEach(c => seen.add(c.id));
        }
      }

      // Group by phone
      const phoneMap = new Map<string, DuplicateContact[]>();
      for (const c of contacts) {
        const raw = (c.phone || c.mobile || "").replace(/\D/g, "");
        if (raw.length >= 8) {
          const list = phoneMap.get(raw) || [];
          list.push(c);
          phoneMap.set(raw, list);
        }
      }
      for (const [phone, group] of phoneMap) {
        if (group.length > 1 && !group.every(c => seen.has(c.id))) {
          groups.push({ group, reason: `Telefono identico: ${phone}` });
          group.forEach(c => seen.add(c.id));
        }
      }

      // Group by company name similarity
      const byCompany = new Map<string, DuplicateContact[]>();
      for (const c of contacts) {
        if (c.company_name && !seen.has(c.id)) {
          const key = c.company_name.toLowerCase().trim();
          const list = byCompany.get(key) || [];
          list.push(c);
          byCompany.set(key, list);
        }
      }
      for (const [, group] of byCompany) {
        if (group.length > 1) {
          groups.push({ group, reason: `Stessa azienda` });
        }
      }

      setDuplicates(groups);
    } catch (_e) {
      toast.error("Errore nella scansione duplicati");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { scan(); }, []);

  const handleMerge = async (group: DuplicateContact[]) => {
    if (group.length < 2) return;
    setMerging(group[0].id);
    try {
      const ids = group.map(c => c.id);
      const { data, error } = await supabase.functions.invoke("deduplicate-contacts", {
        body: { contactIds: ids },
      });
      if (error) throw error;
      toast.success(`Uniti ${data.deletedRecords} duplicati`);
      scan();
    } catch (_e) {
      toast.error("Errore durante il merge");
    } finally {
      setMerging(null);
    }
  };

  const handleIgnore = (idx: number) => {
    setDuplicates(prev => prev.map((d, i) => i === idx ? { ...d, ignored: true } : d));
  };

  const activeGroups = duplicates.filter(d => !d.ignored);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold">Duplicati rilevati</span>
          <Badge variant="outline" className="text-xs">{activeGroups.length} gruppi</Badge>
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={scan} disabled={loading}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Riscansiona
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && activeGroups.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && activeGroups.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm font-medium">Nessun duplicato trovato</p>
            <p className="text-xs mt-1">I contatti sono tutti unici</p>
          </div>
        )}

        {activeGroups.map((dup, idx) => (
          <div key={idx} className="border border-border/60 rounded-lg bg-card/50 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/30">
              <span className="text-xs font-medium text-amber-400">{dup.reason}</span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] gap-1 text-muted-foreground"
                  onClick={() => handleIgnore(duplicates.indexOf(dup))}
                >
                  <Ban className="w-3 h-3" /> Ignora
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-6 text-[10px] gap-1"
                  onClick={() => handleMerge(dup.group)}
                  disabled={merging === dup.group[0].id}
                >
                  {merging === dup.group[0].id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Merge className="w-3 h-3" />}
                  Unisci
                </Button>
              </div>
            </div>
            <div className="divide-y divide-border/20">
              {dup.group.map((c, _ci) => (
                <div key={c.id} className="px-3 py-2 grid grid-cols-5 gap-2 text-xs">
                  <div>
                    <span className="text-[9px] text-muted-foreground block">Azienda</span>
                    <span className="font-medium truncate block">{clean(c.company_name) || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-foreground block">Nome</span>
                    <span className="truncate block">{clean(c.name) || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-foreground block">Email</span>
                    <span className="truncate block text-primary">{clean(c.email) || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-foreground block">Telefono</span>
                    <span className="truncate block">{clean(c.phone) || clean(c.mobile) || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-foreground block">Paese</span>
                    <span className="truncate block">{clean(c.country) || "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
