import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Loader2, CheckCircle, XCircle, AlertCircle,
  Mail, Phone, User, Building2, Globe, ChevronDown, ChevronRight,
  ShieldCheck, ShieldAlert, ShieldX
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface PreviewResult {
  success: boolean;
  found?: boolean;
  wcaId: number;
  authStatus: "authenticated" | "members_only" | "no_credentials" | "login_failed";
  authDetails?: string;
  partner?: {
    company_name: string;
    city: string;
    country: string;
    country_code: string;
    office_type: string;
    email: string | null;
    phone: string | null;
    website: string | null;
    networks: { name: string; expires?: string }[];
    contacts: { title: string; name?: string; email?: string; phone?: string; mobile?: string }[];
  };
  contactsFound?: number;
  totalContacts?: number;
  htmlSnippet?: string;
  error?: string;
}

export function WcaBrowser({ isDark }: { isDark: boolean }) {
  const [wcaId, setWcaId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [showHtml, setShowHtml] = useState(false);

  const handlePreview = async () => {
    const id = parseInt(wcaId);
    if (!id || id < 1) {
      toast({ title: "Errore", description: "Inserisci un WCA ID valido", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    setShowHtml(false);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-wca-partners", {
        body: { wcaId: id, preview: true },
      });
      if (error) throw error;
      setResult(data as PreviewResult);
    } catch (err) {
      setResult({
        success: false,
        wcaId: id,
        authStatus: "login_failed",
        error: err instanceof Error ? err.message : "Errore sconosciuto",
      });
    } finally {
      setLoading(false);
    }
  };

  const authIcon = (status: string) => {
    switch (status) {
      case "authenticated": return <ShieldCheck className="w-5 h-5 text-emerald-500" />;
      case "members_only": return <ShieldAlert className="w-5 h-5 text-amber-500" />;
      default: return <ShieldX className="w-5 h-5 text-red-500" />;
    }
  };

  const authLabel = (status: string) => {
    switch (status) {
      case "authenticated": return "Autenticato";
      case "members_only": return "Members Only";
      case "no_credentials": return "Credenziali mancanti";
      case "login_failed": return "Login fallito";
      default: return status;
    }
  };

  const authColor = (status: string) => {
    switch (status) {
      case "authenticated": return isDark ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "members_only": return isDark ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-amber-50 text-amber-700 border-amber-200";
      default: return isDark ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-red-50 text-red-700 border-red-200";
    }
  };

  const panel = isDark ? "bg-white/[0.06] backdrop-blur-xl border-white/[0.1]" : "bg-white/70 backdrop-blur-xl shadow-xl shadow-slate-200/30 border-white/80";
  const h2 = isDark ? "text-slate-100" : "text-slate-800";
  const sub = isDark ? "text-slate-400" : "text-slate-500";
  const body = isDark ? "text-slate-300" : "text-slate-600";
  const input = isDark ? "bg-slate-800/50 border-slate-700 text-slate-200" : "bg-white border-slate-300 text-slate-800";
  const cardBg = isDark ? "bg-slate-800/40 border-slate-700/50" : "bg-white border-slate-200 shadow-sm";

  return (
    <div className={`${panel} border rounded-2xl p-6 space-y-5`}>
      <div className="flex items-center gap-3">
        <Globe className={`w-5 h-5 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
        <div>
          <h2 className={`text-lg font-semibold ${h2}`}>WCA Browser</h2>
          <p className={`text-sm ${sub}`}>Testa lo scraping diretto su un singolo profilo</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Input
          type="number"
          placeholder="WCA ID (es. 66873)"
          value={wcaId}
          onChange={(e) => setWcaId(e.target.value)}
          className={`flex-1 ${input}`}
          onKeyDown={(e) => e.key === "Enter" && handlePreview()}
          disabled={loading}
        />
        <Button
          onClick={handlePreview}
          disabled={loading || !wcaId}
          className={isDark ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span className="ml-2">{loading ? "Analisi..." : "Anteprima"}</span>
        </Button>
      </div>

      {result && (
        <div className="space-y-4">
          {/* Auth Status */}
          <div className={`flex items-center gap-3 p-3 rounded-xl border ${cardBg}`}>
            {authIcon(result.authStatus)}
            <div className="flex-1">
              <Badge variant="outline" className={authColor(result.authStatus)}>
                {authLabel(result.authStatus)}
              </Badge>
              {result.authDetails && (
                <p className={`text-xs mt-1 ${sub}`}>{result.authDetails}</p>
              )}
            </div>
          </div>

          {/* Error */}
          {result.error && (
            <div className={`flex items-start gap-2 p-3 rounded-xl border ${isDark ? "border-red-500/30 bg-red-500/10" : "border-red-200 bg-red-50"}`}>
              <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className={`text-sm ${isDark ? "text-red-300" : "text-red-700"}`}>{result.error}</p>
            </div>
          )}

          {/* Partner Found */}
          {result.found && result.partner && (
            <>
              {/* Company Info */}
              <div className={`p-4 rounded-xl border space-y-2 ${cardBg}`}>
                <div className="flex items-center gap-2">
                  <Building2 className={`w-4 h-4 ${isDark ? "text-amber-400" : "text-sky-600"}`} />
                  <span className={`font-semibold ${h2}`}>{result.partner.company_name}</span>
                </div>
                <div className={`text-sm ${body} space-y-1`}>
                  <p>📍 {result.partner.city}, {result.partner.country} ({result.partner.country_code})</p>
                  {result.partner.email && <p>📧 {result.partner.email}</p>}
                  {result.partner.phone && <p>📞 {result.partner.phone}</p>}
                  {result.partner.website && <p>🌐 {result.partner.website}</p>}
                </div>
                {result.partner.networks.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {result.partner.networks.map((n, i) => (
                      <Badge key={i} variant="outline" className={`text-xs ${isDark ? "border-amber-500/30 text-amber-400" : "border-sky-200 text-sky-700"}`}>
                        {n.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Contacts */}
              <div className={`p-4 rounded-xl border space-y-3 ${cardBg}`}>
                <div className="flex items-center justify-between">
                  <span className={`font-medium text-sm ${h2}`}>
                    Contatti ({result.totalContacts || 0})
                  </span>
                  {result.contactsFound !== undefined && (
                    <Badge
                      variant="outline"
                      className={result.contactsFound > 0
                        ? (isDark ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border-emerald-200")
                        : (isDark ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-red-50 text-red-700 border-red-200")
                      }
                    >
                      {result.contactsFound > 0
                        ? <><CheckCircle className="w-3 h-3 mr-1" /> {result.contactsFound} con dati</>
                        : <><AlertCircle className="w-3 h-3 mr-1" /> Nessun dato contatto</>
                      }
                    </Badge>
                  )}
                </div>

                {result.partner.contacts.map((c, i) => (
                  <div key={i} className={`p-3 rounded-lg border text-sm space-y-1 ${isDark ? "bg-slate-900/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                    <div className="flex items-center gap-2">
                      <User className={`w-3.5 h-3.5 ${sub}`} />
                      <span className={`font-medium ${h2}`}>{c.name || c.title}</span>
                      {c.name && c.name !== c.title && (
                        <span className={`text-xs ${sub}`}>({c.title})</span>
                      )}
                    </div>
                    {c.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-emerald-500" />
                        <span className={body}>{c.email}</span>
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-blue-500" />
                        <span className={body}>{c.phone}</span>
                      </div>
                    )}
                    {c.mobile && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-purple-500" />
                        <span className={body}>{c.mobile} (mobile)</span>
                      </div>
                    )}
                    {!c.email && !c.phone && !c.mobile && (
                      <span className={`text-xs italic ${sub}`}>Nessun dato di contatto estratto</span>
                    )}
                  </div>
                ))}

                {result.partner.contacts.length === 0 && (
                  <p className={`text-sm italic ${sub}`}>Nessun contatto trovato nella pagina</p>
                )}
              </div>
            </>
          )}

          {/* Not found */}
          {result.success && !result.found && (
            <div className={`flex items-center gap-2 p-3 rounded-xl border ${isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"}`}>
              <AlertCircle className={`w-4 h-4 ${sub}`} />
              <span className={`text-sm ${body}`}>Nessun membro trovato per ID {result.wcaId}</span>
            </div>
          )}

          {/* Raw HTML toggle */}
          {result.htmlSnippet && (
            <div>
              <button
                onClick={() => setShowHtml(!showHtml)}
                className={`flex items-center gap-2 text-sm ${sub} hover:underline`}
              >
                {showHtml ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                HTML Raw ({result.htmlSnippet.length} caratteri)
              </button>
              {showHtml && (
                <ScrollArea className={`mt-2 h-60 rounded-lg border p-3 ${isDark ? "bg-slate-900 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  <pre className={`text-xs whitespace-pre-wrap font-mono ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {result.htmlSnippet}
                  </pre>
                </ScrollArea>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
