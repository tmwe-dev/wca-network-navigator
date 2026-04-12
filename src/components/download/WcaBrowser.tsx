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
import { previewWcaProfile, type PreviewResult } from "@/lib/api/wcaScraper";
import { toast } from "@/hooks/use-toast";

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
      // 🤖 Claude Engine V8: usa wca-app bridge invece di Edge Function
      const data = await previewWcaProfile(id);
      setResult(data);
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

  const panel = "bg-card/80 backdrop-blur-xl border-border";
  const h2 = "text-foreground";
  const sub = "text-muted-foreground";
  const body = "text-foreground/80";
  const input = "bg-muted border-border text-foreground";
  const cardBg = "bg-card border-border";

  return (
      <div className={`${panel} rounded-2xl p-6 space-y-5`}>
      <div className="flex items-center gap-3">
        <Globe className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">WCA Browser</h2>
          <p className="text-sm text-muted-foreground">Testa lo scraping diretto su un singolo profilo</p>
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
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
            <div className="flex items-start gap-2 p-3 rounded-xl border border-destructive/30 bg-destructive/10">
              <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">{result.error}</p>
            </div>
          )}

          {/* Partner Found */}
          {result.found && result.partner && (
            <>
              {/* Company Info */}
              <div className={`p-4 rounded-xl border space-y-2 ${cardBg}`}>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
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
                      <Badge key={i} variant="outline" className="text-xs border-primary/30 text-primary">
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
                  <div key={i} className="p-3 rounded-lg border text-sm space-y-1 bg-muted/30 border-border">
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
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className={body}>{c.phone}</span>
                      </div>
                    )}
                    {c.mobile && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-primary" />
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
            <div className="flex items-center gap-2 p-3 rounded-xl border border-border bg-muted/30">
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
              <ScrollArea className="mt-2 h-60 rounded-lg border p-3 bg-muted/30 border-border">
                  <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground">
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
