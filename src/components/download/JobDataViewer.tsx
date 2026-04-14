import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  ChevronLeft, ChevronRight, Mail, Phone, Smartphone, User,
  CheckCircle, XCircle, Building2, Loader2, MapPin, Radio, ExternalLink, AlertTriangle,
} from "lucide-react";
import { getCountryFlag } from "@/lib/countries";
import { queryKeys } from "@/lib/queryKeys";

interface JobDataViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processedIds: number[];
  failedIds?: number[];
  countryName: string;
  countryCode: string;
  networkName: string;
  isDark: boolean;
  jobStatus?: string;
}

interface PartnerWithContacts {
  id: string;
  wca_id: number | null;
  company_name: string;
  city: string;
  country_code: string;
  email: string | null;
  phone: string | null;
  partner_contacts: {
    id: string;
    name: string;
    title: string | null;
    email: string | null;
    direct_phone: string | null;
    mobile: string | null;
    is_primary: boolean | null;
  }[];
}

type AnimPhase = "idle" | "exit" | "enter";

export function JobDataViewer({
  open, onOpenChange, processedIds, failedIds = [], countryName, countryCode, networkName, isDark, jobStatus,
}: JobDataViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [liveMode, setLiveMode] = useState(false);
  const [animPhase, setAnimPhase] = useState<AnimPhase>("idle");
  const prevIdsLenRef = useRef(processedIds.length);

  const isJobActive = jobStatus === "running" || jobStatus === "pending";

  const { data: partners, isLoading } = useQuery({
    queryKey: queryKeys.downloads.dataViewer(processedIds),
    queryFn: async () => {
      if (!processedIds.length) return [];
      const chunks: number[][] = [];
      for (let i = 0; i < processedIds.length; i += 100) {
        chunks.push(processedIds.slice(i, i + 100));
      }
      const allPartners: PartnerWithContacts[] = [];
      for (const chunk of chunks) {
        const { data, error } = await supabase
          .from("partners")
          .select(`
            id, wca_id, company_name, city, country_code, email, phone,
            partner_contacts (id, name, title, email, direct_phone, mobile, is_primary)
          `)
          .in("wca_id", chunk)
          .order("company_name");
        if (error) throw error;
        if (data) allPartners.push(...(data as unknown as PartnerWithContacts[]));
      }
      const idOrder = new Map(processedIds.map((id, idx) => [id, idx]));
      allPartners.sort((a, b) => (idOrder.get(a.wca_id!) ?? 999) - (idOrder.get(b.wca_id!) ?? 999));
      return allPartners;
    },
    enabled: open && processedIds.length > 0,
    refetchInterval: liveMode && isJobActive ? 5000 : false,
  });

  // Query failed profile names from directory_cache
  const { data: failedNames } = useQuery({
    queryKey: queryKeys.downloads.failedIdsNames(failedIds),
    queryFn: async () => {
      if (!failedIds.length) return new Map<number, string>();
      const { data: cacheEntries } = await supabase
        .from("directory_cache").select("members").eq("country_code", countryCode);
      const nameMap = new Map<number, string>();
      for (const entry of cacheEntries || []) {
        const members = (entry.members || []) as Array<{ wca_id?: number; company_name?: string }>;
        for (const m of members) {
          if (m.wca_id && failedIds.includes(m.wca_id)) {
            nameMap.set(m.wca_id, m.company_name || `WCA ${m.wca_id}`);
          }
        }
      }
      return nameMap;
    },
    enabled: open && failedIds.length > 0,
  });

  useEffect(() => {
    if (!liveMode || !partners) return;
    const newLen = partners.length;
    const oldLen = prevIdsLenRef.current;

    if (newLen > oldLen && oldLen > 0) {
      // New partner arrived — trigger exit animation
      setAnimPhase("exit");
      setTimeout(() => {
        setCurrentIndex(newLen - 1);
        setAnimPhase("enter");
        setTimeout(() => setAnimPhase("idle"), 400);
      }, 400);
    } else if (newLen > 0 && currentIndex !== newLen - 1) {
      // First load in live mode — jump to end
      setCurrentIndex(newLen - 1);
    }
    prevIdsLenRef.current = newLen;
  }, [partners?.length, liveMode]);

  // Reset live mode when dialog closes or job finishes
  useEffect(() => {
    if (!open || !isJobActive) setLiveMode(false);
  }, [open, isJobActive]);

  const total = partners?.length ?? 0;
  const current = partners?.[currentIndex];

  const goPrev = () => setCurrentIndex(i => Math.max(0, i - 1));
  const goNext = () => setCurrentIndex(i => Math.min(total - 1, i + 1));

  const bg = "bg-card backdrop-blur-xl border-border text-foreground";
  const subColor = "text-muted-foreground";
  const dimColor = "text-muted-foreground/70";
  const bodyColor = "text-foreground/80";
  const cardBg = "bg-muted/30 border-border";
  const hi = "text-primary";

  // 3D animation styles
  const getCardStyle = (): React.CSSProperties => {
    switch (animPhase) {
      case "exit":
        return {
          transform: "perspective(800px) rotateX(-90deg)",
          opacity: 0,
          transition: "transform 0.4s ease-in, opacity 0.3s ease-in",
          transformOrigin: "center top",
        };
      case "enter":
        return {
          transform: "perspective(800px) rotateX(0deg)",
          opacity: 1,
          transition: "transform 0.4s ease-out, opacity 0.3s ease-out",
          transformOrigin: "center bottom",
        };
      default:
        return {
          transform: "perspective(800px) rotateX(0deg)",
          opacity: 1,
          transition: "transform 0.3s ease, opacity 0.3s ease",
        };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${bg} sm:max-w-2xl max-h-[85vh] flex flex-col`}>
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {getCountryFlag(countryCode)} Dati Scaricati — {countryName}
          </DialogTitle>
          <DialogDescription className={subColor}>
            {networkName} • {processedIds.length} partner processati
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-2">
            <Loader2 className={`w-5 h-5 animate-spin ${subColor}`} />
            <span className={`text-sm ${subColor}`}>Caricamento dati...</span>
          </div>
        ) : total === 0 ? (
          <div className={`text-center py-12 text-sm ${subColor}`}>
            Nessun partner trovato nel database per questi ID.
          </div>
        ) : (
          <>
            {/* Navigation + Live toggle */}
            <div className="flex items-center justify-between gap-2">
              <Button size="sm" variant="outline" onClick={goPrev}
                disabled={currentIndex === 0 || liveMode}>
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="flex items-center gap-2">
                {liveMode && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                )}
                <span className={`text-sm font-mono ${liveMode ? "text-emerald-400" : hi}`}>
                  {liveMode ? "LIVE" : "Partner"} {currentIndex + 1} di {total}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isJobActive && (
                  <div className="flex items-center gap-1.5">
                    <Radio className={`w-3.5 h-3.5 ${liveMode ? "text-emerald-400" : dimColor}`} />
                    <Switch
                      checked={liveMode}
                      onCheckedChange={(v) => {
                        setLiveMode(v);
                        if (v && total > 0) setCurrentIndex(total - 1);
                      }}
                      className="scale-75"
                    />
                  </div>
                )}
                <Button size="sm" variant="outline" onClick={goNext}
                  disabled={currentIndex >= total - 1 || liveMode}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Partner detail with 3D animation */}
            {current && (
              <ScrollArea className="flex-1 min-h-0">
                <div style={getCardStyle()}>
                  <div className="space-y-4 pr-2">
                    {/* Company info */}
                    <div className={`p-4 rounded-xl border ${cardBg} space-y-2`}>
                      <div className="flex items-center gap-2">
                        <Building2 className={`w-4 h-4 ${hi}`} />
                        <span className={`font-semibold ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                          {current.company_name}
                        </span>
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${dimColor}`}>
                        <MapPin className="w-3 h-3" />
                        {current.city}, {current.country_code}
                        <span className="mx-1">•</span>
                        WCA #{current.wca_id}
                      </div>
                      <div className="flex flex-col gap-1 mt-2">
                        <DataRow icon={<Mail className="w-3.5 h-3.5" />} value={current.email} label="Email" isDark={isDark} />
                        <DataRow icon={<Phone className="w-3.5 h-3.5" />} value={current.phone} label="Telefono" isDark={isDark} />
                      </div>
                    </div>

                    {/* Contacts */}
                    <div>
                      <p className={`text-xs font-medium mb-2 ${subColor}`}>
                        <User className="w-3.5 h-3.5 inline mr-1" />
                        Contatti ({current.partner_contacts?.length || 0})
                      </p>
                      {(!current.partner_contacts || current.partner_contacts.length === 0) ? (
                        <div className={`text-xs py-3 text-center ${dimColor}`}>
                          Nessun contatto salvato
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {current.partner_contacts.map(c => (
                            <div key={c.id} className={`p-3 rounded-lg border ${cardBg} space-y-1.5`}>
                              <div className="flex items-center gap-2">
                       <span className={`text-sm font-medium ${bodyColor}`}>{c.name}</span>
                                {c.is_primary && (
                                  <Badge className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30">
                                    Primario
                                  </Badge>
                                )}
                              </div>
                              {c.title && (
                                <p className={`text-xs ${dimColor}`}>{c.title}</p>
                              )}
                              <div className="flex flex-col gap-1 mt-1">
                                <DataRow icon={<Mail className="w-3 h-3" />} value={c.email} label="Email" isDark={isDark} />
                                <DataRow icon={<Phone className="w-3 h-3" />} value={c.direct_phone} label="Telefono" isDark={isDark} />
                                <DataRow icon={<Smartphone className="w-3 h-3" />} value={c.mobile} label="Mobile" isDark={isDark} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Failed profiles section */}
                    {failedIds.length > 0 && (
                      <div className="mt-4">
                        <p className={`text-xs font-medium mb-2 ${subColor}`}>
                          <AlertTriangle className="w-3.5 h-3.5 inline mr-1 text-destructive" />
                          Profili non scaricati ({failedIds.length})
                        </p>
                        <div className="space-y-1.5">
                          {failedIds.map(fid => (
                            <div key={fid} className={`flex items-center justify-between p-2 rounded-lg border ${cardBg}`}>
                              <div className="flex items-center gap-2">
                                <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                                <span className={`text-xs ${bodyColor}`}>
                                  {failedNames?.get(fid) || `WCA ${fid}`}
                                </span>
                                <span className={`text-[10px] font-mono ${dimColor}`}>#{fid}</span>
                              </div>
                              <a
                                href={`https://members.wcaworld.com/profile/${fid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Apri su WCA
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DataRow({ icon, value, label, isDark }: { icon: React.ReactNode; value: string | null; label: string; isDark: boolean }) {
  const has = !!value && value.trim().length > 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      {has ? (
        <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />
      ) : (
        <XCircle className="w-3 h-3 text-destructive flex-shrink-0" />
      )}
      <span className="text-muted-foreground/70">{icon}</span>
      {has ? (
        <span className="text-foreground">{value}</span>
      ) : (
        <span className="text-destructive/70">{label} mancante</span>
      )}
    </div>
  );
}
