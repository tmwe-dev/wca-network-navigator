import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft, ChevronRight, Mail, Phone, Smartphone, User,
  CheckCircle, XCircle, Building2, Loader2, MapPin,
} from "lucide-react";
import { getCountryFlag } from "@/lib/countries";

interface JobDataViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processedIds: number[];
  countryName: string;
  countryCode: string;
  networkName: string;
  isDark: boolean;
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

export function JobDataViewer({
  open, onOpenChange, processedIds, countryName, countryCode, networkName, isDark,
}: JobDataViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: partners, isLoading } = useQuery({
    queryKey: ["job-data-viewer", processedIds],
    queryFn: async () => {
      if (!processedIds.length) return [];
      // Batch in chunks of 100 to avoid query limits
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
      // Sort by processedIds order
      const idOrder = new Map(processedIds.map((id, idx) => [id, idx]));
      allPartners.sort((a, b) => (idOrder.get(a.wca_id!) ?? 999) - (idOrder.get(b.wca_id!) ?? 999));
      return allPartners;
    },
    enabled: open && processedIds.length > 0,
  });

  const total = partners?.length ?? 0;
  const current = partners?.[currentIndex];

  const goPrev = () => setCurrentIndex(i => Math.max(0, i - 1));
  const goNext = () => setCurrentIndex(i => Math.min(total - 1, i + 1));

  const bg = isDark ? "bg-slate-900/95 backdrop-blur-xl border-amber-500/20 text-slate-100" : "bg-white border-slate-200 text-slate-800";
  const subColor = isDark ? "text-slate-400" : "text-slate-500";
  const dimColor = isDark ? "text-slate-500" : "text-slate-400";
  const bodyColor = isDark ? "text-slate-300" : "text-slate-600";
  const cardBg = isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-slate-50 border-slate-200";
  const hi = isDark ? "text-amber-400" : "text-sky-600";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${bg} sm:max-w-2xl max-h-[85vh] flex flex-col`}>
        <DialogHeader>
          <DialogTitle className={isDark ? "text-slate-100" : "text-slate-800"}>
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
            {/* Navigation */}
            <div className="flex items-center justify-between gap-2">
              <Button size="sm" variant="outline" onClick={goPrev} disabled={currentIndex === 0}
                className={isDark ? "border-slate-700 text-slate-300" : ""}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className={`text-sm font-mono ${hi}`}>
                Partner {currentIndex + 1} di {total}
              </span>
              <Button size="sm" variant="outline" onClick={goNext} disabled={currentIndex >= total - 1}
                className={isDark ? "border-slate-700 text-slate-300" : ""}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Partner detail */}
            {current && (
              <ScrollArea className="flex-1 min-h-0">
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
                                <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-500 border-amber-500/30">
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
        <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
      )}
      <span className={isDark ? "text-slate-500" : "text-slate-400"}>{icon}</span>
      {has ? (
        <span className={isDark ? "text-slate-200" : "text-slate-700"}>{value}</span>
      ) : (
        <span className={isDark ? "text-red-400/70" : "text-red-400"}>{label} mancante</span>
      )}
    </div>
  );
}
