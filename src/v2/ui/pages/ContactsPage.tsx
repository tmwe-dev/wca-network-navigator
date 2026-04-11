/**
 * ContactsPage — Contacts with resizable panels and detail drawer
 */
import * as React from "react";
import { useState } from "react";
import { useContactsV2 } from "@/v2/hooks/useContactsV2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Search, Mail, Phone } from "lucide-react";

export function ContactsPage(): React.ReactElement {
  const { data: contacts } = useContactsV2();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = (contacts ?? []).filter((c) => {
    const q = search.toLowerCase();
    return !q ||
      c.name?.toLowerCase().includes(q) ||
      c.companyName?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q);
  });

  const selected = filtered.find((c) => c.id === selectedId);

  return (
    <div className="h-full flex gap-4 p-4">
      {/* Contact list */}
      <Card className="w-96 shrink-0 flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Contatti ({filtered.length})</CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca..." className="pl-8 h-8 text-xs" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-[calc(100vh-220px)]">
            <div className="space-y-0.5 p-2">
              {filtered.slice(0, 200).map((c) => (
                <button key={c.id} onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left p-2 rounded text-xs transition-colors ${selectedId === c.id ? "bg-primary/10" : "hover:bg-muted"}`}>
                  <p className="font-medium truncate">{c.name ?? c.companyName ?? "N/A"}</p>
                  <p className="text-muted-foreground truncate">{c.companyName}</p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Detail panel */}
      <Card className="flex-1">
        <CardContent className="p-6">
          {!selected ? (
            <p className="text-center text-muted-foreground py-20">Seleziona un contatto</p>
          ) : (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">{selected.name ?? "N/A"}</h2>
              <p className="text-sm text-muted-foreground">{selected.companyName}</p>
              <Badge>{selected.leadStatus}</Badge>
              <div className="grid grid-cols-2 gap-4 mt-4">
                {selected.email && (
                  <div className="flex items-center gap-2 text-sm"><Mail className="h-3.5 w-3.5" /> {selected.email}</div>
                )}
                {selected.phone && (
                  <div className="flex items-center gap-2 text-sm"><Phone className="h-3.5 w-3.5" /> {selected.phone}</div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                <div><span className="text-muted-foreground">Paese:</span> {selected.country ?? "N/A"}</div>
                <div><span className="text-muted-foreground">Città:</span> {selected.city ?? "N/A"}</div>
                <div><span className="text-muted-foreground">Origine:</span> {selected.origin ?? "N/A"}</div>
                <div><span className="text-muted-foreground">Interazioni:</span> {selected.interactionCount}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
