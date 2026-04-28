/**
 * useForgeKb — list/edit/toggle/insert KB entries for the Email Forge Lab.
 * Direct supabase queries (no DAL wrapper) to keep this scoped to the Lab page.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ForgeKbEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  chapter: string | null;
  priority: number;
  is_active: boolean;
  tags: string[] | null;
  updated_at: string;
}

export function useForgeKb(categories: string[] | null) {
  const [entries, setEntries] = useState<ForgeKbEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("kb_entries")
        .select("id,title,content,category,chapter,priority,is_active,tags,updated_at")
        .order("priority", { ascending: false })
        .order("title", { ascending: true })
        .limit(200);
      if (categories && categories.length > 0) q = q.in("category", categories);
      const { data, error } = await q;
      if (error) throw error;
      setEntries((data ?? []) as ForgeKbEntry[]);
    } catch (e) {
      toast.error("Impossibile caricare KB", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }, [categories]);

  useEffect(() => { void load(); }, [load]);

  const update = useCallback(async (id: string, patch: Partial<Pick<ForgeKbEntry, "title" | "content" | "priority" | "is_active">>) => {
    setSavingId(id);
    try {
      const { error } = await supabase.from("kb_entries").update(patch).eq("id", id);
      if (error) throw error;
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch, updated_at: new Date().toISOString() } : e)));
      toast.success("Voce KB aggiornata");
    } catch (e) {
      toast.error("Salvataggio fallito", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSavingId(null);
    }
  }, []);

  const toggleActive = useCallback((id: string, value: boolean) => update(id, { is_active: value }), [update]);

  const insert = useCallback(async (input: { title: string; content: string; category: string; priority?: number }) => {
    try {
      const { data: userRes } = await supabase.auth.getSession().then(r => ({ data: { user: r.data.session?.user ?? null } }));
      const user_id = userRes.user?.id ?? null;
      const { data, error } = await supabase
        .from("kb_entries")
        .insert({
          title: input.title,
          content: input.content,
          category: input.category,
          priority: input.priority ?? 5,
          is_active: true,
          user_id,
        })
        .select("id,title,content,category,chapter,priority,is_active,tags,updated_at")
        .single();
      if (error) throw error;
      setEntries((prev) => [data as ForgeKbEntry, ...prev]);
      toast.success("Voce KB creata");
      return data as ForgeKbEntry;
    } catch (e) {
      toast.error("Creazione fallita", { description: e instanceof Error ? e.message : String(e) });
      return null;
    }
  }, []);

  return { entries, loading, savingId, reload: load, update, toggleActive, insert };
}
