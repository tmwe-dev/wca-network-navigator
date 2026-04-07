import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { RALeadStatus } from "@/types/ra";

const LEAD_STATUS_LABELS: Record<RALeadStatus, { label: string; color: string }> = {
  new: { label: "Nuovo", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  contacted: { label: "Contattato", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  qualified: { label: "Qualificato", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  negotiation: { label: "Negoziazione", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  converted: { label: "Convertito", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  lost: { label: "Perso", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

interface RACompanyHeaderProps {
  prospect: any;
}

export function RACompanyHeader({ prospect }: RACompanyHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex-shrink-0 p-6 border-b border-white/5 bg-white/2 backdrop-blur-xl">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-white/10" onClick={() => navigate("/ra/explorer")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold text-white/95">{prospect.company_name}</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {prospect.city && (
              <Badge className="gap-1 bg-white/10 text-white/80 border border-white/20">
                {prospect.city}{prospect.province && `, ${prospect.province}`}
              </Badge>
            )}
            {prospect.codice_ateco && (
              <Badge className="gap-1 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                {prospect.codice_ateco}
              </Badge>
            )}
            {prospect.lead_status && (
              <Badge className={`gap-1 border ${LEAD_STATUS_LABELS[prospect.lead_status as RALeadStatus]?.color}`}>
                {LEAD_STATUS_LABELS[prospect.lead_status as RALeadStatus]?.label}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/5">
            <Download className="w-4 h-4 mr-1" /> Esporta
          </Button>
        </div>
      </div>
    </div>
  );
}

export { LEAD_STATUS_LABELS };
