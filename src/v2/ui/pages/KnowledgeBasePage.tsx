/**
 * KnowledgeBasePage — KB entries and AI memory management
 */
import * as React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Book, Brain, Search } from "lucide-react";
import { StatusBadge } from "../atoms/StatusBadge";

export function KnowledgeBasePage(): React.ReactElement {
  const [search, setSearch] = useState("");

  const { data: kbEntries, isLoading: kbLoading } = useQuery({
    queryKey: ["v2-kb-entries", search],
    queryFn: async () => {
      let q = supabase
        .from("kb_entries")
        .select("id, title, category, chapter, tags, priority, is_active, created_at")
        .order("priority", { ascending: false })
        .limit(100);
      if (search) q = q.ilike("title", `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: memories, isLoading: memLoading } = useQuery({
    queryKey: ["v2-ai-memories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_memory")
        .select("id, content, memory_type, importance, access_count, created_at")
        .order("importance", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Knowledge Base</h1>
        <p className="text-sm text-muted-foreground">Gestione conoscenza AI e memoria episodica.</p>
      </div>

      <Tabs defaultValue="kb">
        <TabsList>
          <TabsTrigger value="kb" className="gap-1.5"><Book className="h-3.5 w-3.5" />Knowledge Base</TabsTrigger>
          <TabsTrigger value="memory" className="gap-1.5"><Brain className="h-3.5 w-3.5" />Memoria</TabsTrigger>
        </TabsList>

        <TabsContent value="kb" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Cerca nella KB..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {kbLoading ? (
            <p className="text-sm text-muted-foreground">Caricamento...</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Titolo</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Categoria</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Priorità</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {kbEntries?.map((e) => (
                    <tr key={e.id} className="border-t">
                      <td className="px-4 py-2 text-foreground font-medium">{e.title}</td>
                      <td className="px-4 py-2 text-muted-foreground">{e.category}</td>
                      <td className="px-4 py-2 text-foreground">{e.priority}</td>
                      <td className="px-4 py-2">
                        <StatusBadge status={e.is_active ? "success" : "neutral"} label={e.is_active ? "Attivo" : "Inattivo"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="memory" className="mt-4 space-y-4">
          {memLoading ? (
            <p className="text-sm text-muted-foreground">Caricamento...</p>
          ) : (
            <div className="space-y-3">
              {memories?.map((m) => (
                <div key={m.id} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">{m.memory_type} • importanza: {m.importance}</span>
                    <span className="text-xs text-muted-foreground">accessi: {m.access_count}</span>
                  </div>
                  <p className="text-sm text-foreground">{m.content}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
