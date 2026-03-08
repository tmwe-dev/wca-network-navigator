import { useMemo } from "react";
import { motion } from "framer-motion";
import { CockpitContactCard } from "./CockpitContactCard";
import { CockpitContactListItem } from "./CockpitContactListItem";
import type { ViewMode, CockpitFilter } from "@/pages/Cockpit";

// Demo data — will be replaced by real queries
const DEMO_CONTACTS = [
  { id: "1", name: "Marco Bianchi", company: "Logistica Milano Srl", role: "CEO", country: "IT", language: "italiano", lastContact: "2 giorni fa", priority: 9, channels: ["email", "whatsapp", "linkedin"] as string[], email: "marco@logmilano.it" },
  { id: "2", name: "Sarah Johnson", company: "Global Freight Ltd", role: "VP Sales", country: "GB", language: "english", lastContact: "1 settimana fa", priority: 8, channels: ["email", "linkedin"] as string[], email: "sarah@globalfreight.co.uk" },
  { id: "3", name: "Pierre Dupont", company: "TransEurope SA", role: "Directeur Commercial", country: "FR", language: "français", lastContact: "3 giorni fa", priority: 7, channels: ["email", "whatsapp", "linkedin", "sms"] as string[], email: "pierre@transeurope.fr" },
  { id: "4", name: "Hans Weber", company: "Spedition Weber GmbH", role: "Geschäftsführer", country: "DE", language: "deutsch", lastContact: "5 giorni fa", priority: 6, channels: ["email", "linkedin"] as string[], email: "hans@weber-spedition.de" },
  { id: "5", name: "Ana Garcia", company: "Transportes Garcia", role: "Directora", country: "ES", language: "español", lastContact: "2 settimane fa", priority: 5, channels: ["email", "whatsapp", "sms"] as string[], email: "ana@tgarcia.es" },
  { id: "6", name: "Yuki Tanaka", company: "Nippon Logistics KK", role: "Manager", country: "JP", language: "english", lastContact: "1 mese fa", priority: 4, channels: ["email", "linkedin"] as string[], email: "yuki@nipponlog.jp" },
  { id: "7", name: "Roberto Esposito", company: "NaviCargo SpA", role: "Resp. Commerciale", country: "IT", language: "italiano", lastContact: "Ieri", priority: 10, channels: ["email", "whatsapp", "linkedin", "sms"] as string[], email: "roberto@navicargo.it" },
  { id: "8", name: "Elena Volkov", company: "TransSiberian LLC", role: "Business Dev", country: "RU", language: "english", lastContact: "4 giorni fa", priority: 7, channels: ["email"] as string[], email: "elena@transsib.ru" },
];

interface ContactStreamProps {
  viewMode: ViewMode;
  searchQuery: string;
  filters: CockpitFilter[];
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

const FLAG: Record<string, string> = {
  IT: "🇮🇹", GB: "🇬🇧", FR: "🇫🇷", DE: "🇩🇪", ES: "🇪🇸", JP: "🇯🇵", RU: "🇷🇺", US: "🇺🇸",
};

export function ContactStream({ viewMode, searchQuery, filters, onDragStart, onDragEnd }: ContactStreamProps) {
  const filteredContacts = useMemo(() => {
    let result = [...DEMO_CONTACTS];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q)
      );
    }
    // Apply basic filter logic from chips
    for (const f of filters) {
      if (f.type === "language" && f.id.includes("it")) {
        result = result.filter(c => c.language === "italiano");
      }
      if (f.type === "channel" && f.label.toLowerCase().includes("linkedin")) {
        result = result.filter(c => c.channels.includes("linkedin"));
      }
      if (f.type === "priority") {
        result = result.filter(c => c.priority >= 7);
      }
    }
    return result.sort((a, b) => b.priority - a.priority);
  }, [searchQuery, filters]);

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-xs font-medium text-foreground/80">
          {filteredContacts.length} contatti
        </span>
      </div>

      {viewMode === "card" ? (
        <div className="space-y-2.5">
          {filteredContacts.map((contact, i) => (
            <CockpitContactCard
              key={contact.id}
              contact={contact}
              flag={FLAG[contact.country] || "🌍"}
              index={i}
              onDragStart={() => onDragStart(contact.id)}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-px">
          {filteredContacts.map((contact, i) => (
            <CockpitContactListItem
              key={contact.id}
              contact={contact}
              flag={FLAG[contact.country] || "🌍"}
              index={i}
              onDragStart={() => onDragStart(contact.id)}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}
