import {
  Handshake, RefreshCw, Search, Briefcase, Globe, FileText,
  Target, Mail, TrendingUp, Users, Package, FileCheck,
} from "lucide-react";
import { createLogger } from "@/lib/log";

const log = createLogger("ContentManager");

export const CATEGORY_ICONS: Record<string, React.ElementType> = {
  primo_contatto: Handshake,
  follow_up: RefreshCw,
  richiesta: Search,
  proposta_servizi: Briefcase,
  partnership: Globe,
  altro: FileText,
};

export const CARD_ICONS = [Target, Handshake, Mail, Search, Globe, Briefcase, TrendingUp, Users, Package, FileCheck];

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function hostname(url: string) {
  try { return new URL(url).hostname; } catch (e) { log.debug("fallback used after parse failure", { error: e instanceof Error ? e.message : String(e) }); return url; }
}
