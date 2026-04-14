import { useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDownloadJobs } from "@/hooks/useDownloadJobs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Mail, Phone, Globe, User, Sparkles } from "lucide-react";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { queryKeys } from "@/lib/queryKeys";

interface ProfileData {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  wca_id: number | null;
  partner_networks: { network_name: string }[];
  partner_contacts: { name: string; email: string | null; title: string | null }[];
}

export function LiveProfileCards() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: jobs } = useDownloadJobs();

  const activeJob = useMemo(() => {
    if (!jobs) return null;
    return jobs.find(j => j.status === "running") || jobs.find(j => j.status === "pending") || jobs[0];
  }, [jobs]);

  const processedIds = useMemo(() => {
    if (!activeJob) return [];
    return (activeJob.processed_ids || []) as number[];
  }, [activeJob]);

  // Fetch last 20 processed partners
  const { data: profiles } = useQuery({
    queryKey: queryKeys.downloads.liveProfiles(processedIds.slice(-20).join(",")),
    queryFn: async () => {
      const lastIds = processedIds.slice(-20);
      if (lastIds.length === 0) return [];
      const { data } = await supabase
        .from("partners")
        .select("id, company_name, city, country_code, email, phone, website, wca_id, partner_networks(network_name), partner_contacts(name, email, title)")
        .in("wca_id", lastIds);
      // Sort by processedIds order (most recent last)
      const idOrder = new Map(lastIds.map((id, i) => [id, i]));
      return ((data || []) as ProfileData[]).sort((a, b) =>
        (idOrder.get(b.wca_id!) ?? 0) - (idOrder.get(a.wca_id!) ?? 0)
      );
    },
    enabled: processedIds.length > 0,
    refetchInterval: 5000,
  });

  // Auto-scroll to latest
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [profiles?.length]);

  if (!profiles || profiles.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground/50">
        <div className="text-center">
          <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">I profili appariranno qui durante il download</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full" ref={scrollRef}>
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AnimatePresence mode="popLayout">
          {profiles.map((p, idx) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className={cn(
                "rounded-lg border p-3 bg-card/60 backdrop-blur-sm transition-all",
                idx === 0 && "ring-2 ring-primary/40 border-primary/30 shadow-lg shadow-primary/5"
              )}
            >
              {/* Header */}
              <div className="flex items-start gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center text-lg shrink-0">
                  {getCountryFlag(p.country_code)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold truncate">{p.company_name}</h4>
                  <p className="text-[10px] text-muted-foreground truncate">{p.city}</p>
                </div>
                {idx === 0 && (
                  <Badge className="text-[8px] px-1.5 py-0 h-4 bg-primary/15 text-primary border-primary/30 shrink-0">
                    ULTIMO
                  </Badge>
                )}
              </div>

              {/* Networks */}
              {p.partner_networks?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {p.partner_networks.map(n => (
                    <Badge key={n.network_name} variant="outline" className="text-[8px] px-1.5 py-0 h-3.5">
                      {n.network_name}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Contact info */}
              <div className="space-y-1">
                {p.email && (
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-500">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{p.email}</span>
                  </div>
                )}
                {p.phone && (
                  <div className="flex items-center gap-1.5 text-[10px] text-blue-400">
                    <Phone className="w-3 h-3" />
                    <span>{p.phone}</span>
                  </div>
                )}
                {p.website && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Globe className="w-3 h-3" />
                    <span className="truncate">{p.website}</span>
                  </div>
                )}
              </div>

              {/* Contacts */}
              {p.partner_contacts?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
                  {p.partner_contacts.slice(0, 3).map((c, ci) => (
                    <div key={ci} className="flex items-center gap-1.5 text-[10px]">
                      <User className="w-2.5 h-2.5 text-muted-foreground/50" />
                      <span className="font-medium truncate">{c.name}</span>
                      {c.title && <span className="text-muted-foreground truncate">· {c.title}</span>}
                      {c.email && <Mail className="w-2.5 h-2.5 text-emerald-400 ml-auto shrink-0" />}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ScrollArea>
  );
}
