import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  Mail, Phone, MessageCircle, Users, Search, Megaphone, StickyNote,
  Bot, Linkedin, ChevronDown, ChevronUp, Filter as FilterIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { ContactInteraction } from "@/hooks/useContacts";

const TYPE_CONFIG: Record<string, { icon: typeof Mail; color: string; label: string }> = {
  email_sent: { icon: Mail, color: "text-blue-400", label: "Email inviata" },
  email_received: { icon: Mail, color: "text-blue-300", label: "Email ricevuta" },
  email_reply: { icon: Mail, color: "text-blue-300", label: "Risposta email" },
  phone_call: { icon: Phone, color: "text-amber-400", label: "Chiamata" },
  whatsapp: { icon: MessageCircle, color: "text-emerald-400", label: "WhatsApp" },
  meeting: { icon: Users, color: "text-purple-400", label: "Incontro" },
  deep_search: { icon: Search, color: "text-cyan-400", label: "Deep Search" },
  campaign: { icon: Megaphone, color: "text-rose-400", label: "Campagna" },
  note: { icon: StickyNote, color: "text-muted-foreground", label: "Nota" },
  linkedin: { icon: Linkedin, color: "text-indigo-400", label: "LinkedIn" },
  ai_action: { icon: Bot, color: "text-cyan-400", label: "Azione AI" },
  ai_classification: { icon: Bot, color: "text-cyan-300", label: "Classificazione AI" },
};

const OUTCOME_COLORS: Record<string, string> = {
  positive: "bg-emerald-500/20 text-emerald-400",
  neutral: "bg-muted text-muted-foreground",
  negative: "bg-destructive/20 text-destructive",
};

interface TimelineItem {
  id: string;
  type: string;
  title: string;
  description: string | null;
  outcome: string | null;
  created_at: string;
  source: "interaction" | "activity" | "email" | "ai";
  isAI?: boolean;
}

interface Props {
  contactId: string;
  contactEmail?: string | null;
}

const PAGE_SIZE = 20;

export function ContactInteractionTimeline({ contactId, contactEmail }: Props) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [channelFilter, setChannelFilter] = useState("all");

  const loadItems = useCallback(async (pageNum: number, append = false) => {
    setLoading(true);
    try {
      const allItems: TimelineItem[] = append ? [...items] : [];

      // 1. contact_interactions
      const { data: interactions } = await supabase
        .from("contact_interactions")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      for (const i of interactions || []) {
        allItems.push({
          id: `ci-${i.id}`,
          type: i.interaction_type,
          title: i.title,
          description: i.description,
          outcome: i.outcome,
          created_at: i.created_at,
          source: "interaction",
        });
      }

      // 2. channel_messages by email
      if (contactEmail) {
        const { data: msgs } = await supabase
          .from("channel_messages")
          .select("id, channel, direction, subject, body_text, created_at, from_address, to_address")
          .or(`from_address.ilike.%${contactEmail}%,to_address.ilike.%${contactEmail}%`)
          .order("created_at", { ascending: false })
          .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

        for (const m of msgs || []) {
          const isInbound = m.from_address?.toLowerCase().includes(contactEmail.toLowerCase());
          allItems.push({
            id: `cm-${m.id}`,
            type: m.channel === "whatsapp" ? "whatsapp" : isInbound ? "email_received" : "email_sent",
            title: m.subject || (isInbound ? "Email ricevuta" : "Email inviata"),
            description: m.body_text?.substring(0, 200) || null,
            outcome: null,
            created_at: m.created_at,
            source: "email",
          });
        }
      }

      // 3. activities linked to this contact
      const { data: activities } = await supabase
        .from("activities")
        .select("id, activity_type, title, description, status, created_at, response_received")
        .eq("selected_contact_id", contactId)
        .order("created_at", { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      for (const a of activities || []) {
        allItems.push({
          id: `act-${a.id}`,
          type: a.activity_type || "note",
          title: a.title,
          description: a.description,
          outcome: a.response_received ? "positive" : null,
          created_at: a.created_at,
          source: "activity",
        });
      }

      // Sort all by date descending
      allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Deduplicate by id
      const seen = new Set<string>();
      const unique = allItems.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });

      setItems(unique);
      setHasMore((interactions?.length || 0) === PAGE_SIZE);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [contactId, contactEmail, items]);

  useEffect(() => { setPage(0); loadItems(0); }, [contactId]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    loadItems(next, true);
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = channelFilter === "all"
    ? items
    : items.filter(i => i.type.includes(channelFilter));

  if (!loading && items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        Nessuna interazione registrata
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {/* Filters */}
      <div className="flex items-center gap-2">
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="h-6 text-[10px] w-24">
            <FilterIcon className="w-3 h-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="phone">Telefono</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
            <SelectItem value="note">Note</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-[9px] text-muted-foreground">{filtered.length} eventi</span>
      </div>

      {/* Timeline */}
      <div className="relative pl-5 space-y-2">
        <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />
        {filtered.map((item) => {
          const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.note;
          const Icon = cfg.icon;
          const isExpanded = expanded.has(item.id);

          return (
            <div key={item.id} className="relative flex gap-2 group">
              <div className={cn("absolute -left-5 top-0.5 w-4 h-4 rounded-full bg-card border border-border flex items-center justify-center")}>
                <Icon className={cn("w-2.5 h-2.5", cfg.color)} />
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => item.description && toggleExpand(item.id)}>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium truncate max-w-[180px]">{item.title}</span>
                  {item.outcome && (
                    <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-3.5", OUTCOME_COLORS[item.outcome] ?? "")}>
                      {item.outcome === "positive" ? "Positivo" : item.outcome === "negative" ? "Negativo" : "Neutro"}
                    </Badge>
                  )}
                  {item.source === "ai" && (
                    <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 bg-cyan-500/10 text-cyan-400 border-cyan-500/20">AI</Badge>
                  )}
                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5">{cfg.label}</Badge>
                </div>
                {item.description && (
                  <p className={cn("text-[11px] text-muted-foreground mt-0.5", isExpanded ? "" : "line-clamp-1")}>
                    {item.description}
                  </p>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(item.created_at), "dd MMM yyyy HH:mm", { locale: it })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {hasMore && (
        <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={loadMore} disabled={loading}>
          {loading ? "Caricamento…" : "Carica altri"}
        </Button>
      )}
    </div>
  );
}
