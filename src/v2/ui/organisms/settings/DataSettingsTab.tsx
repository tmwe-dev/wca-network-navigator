/**
 * DataSettingsTab — Data management (export, backup info)
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "../../molecules/StatCard";
import { Database, Users, FileText, Mail } from "lucide-react";

export function DataSettingsTab(): React.ReactElement {
  const { data: counts } = useQuery({
    queryKey: ["v2-data-counts"],
    queryFn: async () => {
      const [partners, contacts, activities, messages] = await Promise.all([
        supabase.from("partners").select("id", { count: "exact", head: true }),
        supabase.from("imported_contacts").select("id", { count: "exact", head: true }),
        supabase.from("activities").select("id", { count: "exact", head: true }),
        supabase.from("channel_messages").select("id", { count: "exact", head: true }),
      ]);
      return {
        partners: partners.count ?? 0,
        contacts: contacts.count ?? 0,
        activities: activities.count ?? 0,
        messages: messages.count ?? 0,
      };
    },
  });

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Stato dati</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Partner" value={String(counts?.partners ?? "—")} icon={<Database className="h-4 w-4" />} />
        <StatCard title="Contatti" value={String(counts?.contacts ?? "—")} icon={<Users className="h-4 w-4" />} />
        <StatCard title="Attività" value={String(counts?.activities ?? "—")} icon={<FileText className="h-4 w-4" />} />
        <StatCard title="Messaggi" value={String(counts?.messages ?? "—")} icon={<Mail className="h-4 w-4" />} />
      </div>
      <div className="p-4 rounded-lg border bg-card">
        <h4 className="font-medium text-foreground mb-2">Export dati</h4>
        <p className="text-sm text-muted-foreground">
          Per esportare i dati in formato CSV o Excel, utilizza le funzioni di export disponibili
          nelle pagine Network e CRM.
        </p>
      </div>
    </div>
  );
}
