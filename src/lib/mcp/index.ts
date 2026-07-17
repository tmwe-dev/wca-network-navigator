import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listAgentsTool from "./tools/list-agents";
import searchContactsTool from "./tools/search-contacts";

// Il project ref è inlinato da Vite a build time (import-safe: nessun read a runtime).
// Il fallback tiene l'issuer ben formato durante l'eval per l'estrazione del manifest.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "wca-network-navigator-mcp",
  title: "WCA Network Navigator",
  version: "0.1.0",
  instructions:
    "Strumenti per il CRM WCA Network Navigator. Usa `list_agents` per vedere gli agenti AI configurati e `search_contacts` per cercare partner/contatti CRM. Ogni tool opera come l'utente autenticato e rispetta RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listAgentsTool, searchContactsTool],
});