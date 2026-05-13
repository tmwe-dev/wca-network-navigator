/**
 * SiblingRiskBadge — banner rosso che evidenzia un'azione di invio
 * verso un contatto i cui "sibling" (stesso partner o stessa azienda
 * con sedi diverse) sono già stati contattati di recente.
 *
 * Mostra la lista dei sibling, da quanti giorni, e richiede doppia
 * conferma esplicita prima di poter approvare l'azione nella coda.
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { checkSiblingRisk, type SiblingRiskRow } from "@/data/siblingRisk";

interface Props {
  readonly partnerId: string | null | undefined;
  readonly contactId: string | null | undefined;
  readonly confirmed: boolean;
  readonly onConfirmedChange: (next: boolean) => void;
}

export function SiblingRiskBadge({ partnerId, contactId, confirmed, onConfirmedChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { data: rows = [] } = useQuery({
    queryKey: ["sibling-risk", partnerId ?? "none", contactId ?? "none"],
    queryFn: () => checkSiblingRisk(partnerId ?? "", contactId),
    enabled: !!partnerId,
    staleTime: 60_000,
  });

  if (!partnerId || rows.length === 0) return null;

  const sameCompanyCount = rows.filter((r: SiblingRiskRow) => r.same_company).length;
  const samePartnerCount = rows.length - sameCompanyCount;

  return (
    <div className="border-2 border-red-500/60 bg-red-500/10 rounded-lg p-3 space-y-2">
      <div className="flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 text-xs">
          <p className="font-semibold text-red-300">
            Attenzione: contatto a rischio "spam aziendale"
          </p>
          <p className="text-red-200/80 mt-0.5">
            {rows.length} contatto/i fratello/i già contattati negli ultimi 30 giorni
            {samePartnerCount > 0 && ` (${samePartnerCount} nello stesso partner)`}
            {sameCompanyCount > 0 && ` (${sameCompanyCount} in altra sede stessa azienda)`}.
          </p>
          <button
            type="button"
            className="text-red-300 underline hover:text-red-200 mt-1"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? "Nascondi dettagli" : "Mostra dettagli"}
          </button>
        </div>
      </div>

      {expanded && (
        <ul className="text-[11px] space-y-1 pl-6 text-red-100/90">
          {rows.slice(0, 8).map((r) => (
            <li key={r.sibling_contact_id} className="flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-red-400" />
              <span className="font-medium">{r.sibling_contact_name ?? "(senza nome)"}</span>
              {r.same_company && (
                <span className="text-red-300/80">· altra sede ({r.sibling_company_name})</span>
              )}
              <span className="text-red-300/60">
                · {r.channel ?? "?"} ·{" "}
                {formatDistanceToNow(new Date(r.last_outbound_at), { addSuffix: true, locale: it })}
              </span>
            </li>
          ))}
          {rows.length > 8 && (
            <li className="text-red-300/60">+ altri {rows.length - 8} sibling…</li>
          )}
        </ul>
      )}

      <label className="flex items-center gap-2 text-xs text-red-100 cursor-pointer pt-1 border-t border-red-500/30">
        <Checkbox
          checked={confirmed}
          onCheckedChange={(c) => onConfirmedChange(c === true)}
          className="border-red-400 data-[state=checked]:bg-red-500"
        />
        <span>
          Confermo: voglio inviare comunque, accetto il rischio di apparire come spam.
        </span>
      </label>

      {!confirmed && (
        <p className="text-[11px] text-red-300/80 italic">
          ⚠️ Devi spuntare la conferma per poter approvare questa azione.
        </p>
      )}
    </div>
  );
}

/**
 * Hook helper: ritorna `true` se quell'azione è a rischio sibling.
 * Usato per disabilitare il bottone Approva quando confirmed=false.
 */
export function useHasSiblingRisk(partnerId: string | null | undefined, contactId: string | null | undefined) {
  const { data: rows = [] } = useQuery({
    queryKey: ["sibling-risk", partnerId ?? "none", contactId ?? "none"],
    queryFn: () => checkSiblingRisk(partnerId ?? "", contactId),
    enabled: !!partnerId,
    staleTime: 60_000,
  });
  return rows.length > 0;
}
