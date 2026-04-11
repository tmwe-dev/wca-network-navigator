/**
 * InreachPage — Inbound email management
 */
import * as React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mail, ArrowDownLeft, Search } from "lucide-react";
import { StatusBadge } from "../atoms/StatusBadge";

export function InreachPage(): React.ReactElement {
  const [search, setSearch] = useState("");

  const { data: messages, isLoading } = useQuery({
    queryKey: ["v2-inreach", search],
    queryFn: async () => {
      let q = supabase
        .from("channel_messages")
        .select("id, from_address, subject, body_text, channel, direction, created_at, read_at, category")
        .eq("direction", "inbound")
        .order("created_at", { ascending: false })
        .limit(100);
      if (search) q = q.ilike("subject", `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ArrowDownLeft className="h-6 w-6" />Inreach
          </h1>
          <p className="text-sm text-muted-foreground">Email ricevute e messaggi in entrata.</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm text-foreground"
          placeholder="Cerca per oggetto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      ) : messages && messages.length > 0 ? (
        <div className="space-y-2">
          {messages.map((msg) => (
            <div key={msg.id} className={`p-4 rounded-lg border bg-card ${!msg.read_at ? "border-l-4 border-l-primary" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm text-foreground">{msg.from_address ?? "Sconosciuto"}</span>
                  {msg.category ? <StatusBadge status="info" label={msg.category} /> : null}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(msg.created_at).toLocaleDateString("it")}</span>
              </div>
              <p className="text-sm text-foreground mt-1 font-medium">{msg.subject ?? "(Senza oggetto)"}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{msg.body_text?.slice(0, 200)}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Mail className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nessun messaggio in entrata</p>
        </div>
      )}
    </div>
  );
}
