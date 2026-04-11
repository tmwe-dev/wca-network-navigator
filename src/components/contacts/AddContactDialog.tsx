import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";

const log = createLogger("AddContactDialog");
import { supabase } from "@/integrations/supabase/client";
import { useFireScrapeExtensionBridge } from "@/hooks/useFireScrapeExtensionBridge";
import { useDeepSearch } from "@/hooks/useDeepSearchRunner";
import { useLinkedInLookup } from "@/hooks/useLinkedInLookup";
import {
  Building2, User, Search, Globe, Linkedin, Image, Radar,
  Loader2, MapPin, Briefcase, Save, ExternalLink,
} from "lucide-react";
import { getCountryFlag } from "@/lib/countries";
import { unwrapGoogleResultUrl } from "@/lib/linkedinSearch";

const COUNTRY_OPTIONS = [
  "AF","AL","DZ","AD","AO","AR","AM","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BT","BO",
  "BA","BW","BR","BN","BG","BF","BI","KH","CM","CA","CV","CF","TD","CL","CN","CO","KM","CG","CD","CR",
  "CI","HR","CU","CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","SZ","ET","FJ","FI","FR",
  "GA","GM","GE","DE","GH","GR","GD","GT","GN","GW","GY","HT","HN","HK","HU","IS","IN","ID","IR","IQ",
  "IE","IL","IT","JM","JP","JO","KZ","KE","KI","KP","KR","KW","KG","LA","LV","LB","LS","LR","LY","LI",
  "LT","LU","MO","MG","MW","MY","MV","ML","MT","MH","MR","MU","MX","FM","MD","MC","MN","ME","MA","MZ",
  "MM","NA","NR","NP","NL","NZ","NI","NE","NG","MK","NO","OM","PK","PW","PA","PG","PY","PE","PH","PL",
  "PT","QA","RO","RU","RW","KN","LC","VC","WS","SM","ST","SA","SN","RS","SC","SL","SG","SK","SI","SB",
  "SO","ZA","SS","ES","LK","SD","SR","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TO","TT","TN","TR",
  "TM","TV","UG","UA","AE","GB","US","UY","UZ","VU","VE","VN","YE","ZM","ZW",
];

const SKIP_SEARCH_DOMAINS = [
  "linkedin.com",
  "facebook.com",
  "google.com",
  "yelp.com",
  "twitter.com",
  "instagram.com",
  "youtube.com",
  "wikipedia.org",
];

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "libero.it",
  "alice.it",
  "tin.it",
  "virgilio.it",
  "tiscali.it",
]);

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch (e) {
    log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
    return "";
  }
}

function extractDomainFromEmail(email: string): string {
  const domain = email.split("@")[1]?.trim().toLowerCase() || "";
  if (!domain || PERSONAL_EMAIL_DOMAINS.has(domain)) return "";
  return domain.replace(/^www\./, "");
}

function isUsefulCompanyUrl(url?: string | null): boolean {
  const domain = extractDomain(url || "");
  return Boolean(domain) && !SKIP_SEARCH_DOMAINS.some((item) => domain.includes(item));
}

function getSearchResultDescription(result: any): string {
  return result?.description?.trim?.() || result?.snippet?.trim?.() || "";
}

function buildGoogleFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

export function AddContactDialog({ open, onOpenChange }: AddContactDialogProps) {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");

  const [companyAlias, setCompanyAlias] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [website, setWebsite] = useState("");

  const [contactAlias, setContactAlias] = useState("");
  const [position, setPosition] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMobile, setContactMobile] = useState("");

  const [logoUrl, setLogoUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  const [origin, setOrigin] = useState("");
  const [note, setNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesResults, setPlacesResults] = useState<any[]>([]);
  const [logoLoading, setLogoLoading] = useState(false);
  const [linkedinLoading, setLinkedinLoading] = useState(false);

  const fsBridge = useFireScrapeExtensionBridge();
  const deepSearch = useDeepSearch();
  const linkedinLookup = useLinkedInLookup();

  const resetForm = () => {
    setCompanyName("");
    setCompanyAlias("");
    setCountry("");
    setCity("");
    setAddress("");
    setZipCode("");
    setCompanyPhone("");
    setCompanyEmail("");
    setWebsite("");
    setContactName("");
    setContactAlias("");
    setPosition("");
    setContactEmail("");
    setContactPhone("");
    setContactMobile("");
    setOrigin("");
    setNote("");
    setPlacesResults([]);
    setLogoUrl("");
    setLinkedinUrl("");
    setSavedId(null);
  };

  const ensurePartnerConnectReady = useCallback(async () => {
    if (fsBridge.isAvailable) return true;
    try {
      const ping = await fsBridge.sendMessage("ping", {}, 4000);
      if (ping?.success) return true;
      toast.error("Estensione Partner Connect non disponibile");
      return false;
    } catch (e) {
      log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
      toast.error("Estensione Partner Connect non disponibile");
      return false;
    }
  }, [fsBridge]);

  const persistSavedContact = useCallback(async (
    fields: Record<string, any> = {},
    enrichmentPatch: Record<string, any> = {},
  ) => {
    if (!savedId) return;

    const payload: Record<string, any> = { ...fields };

    if (Object.keys(enrichmentPatch).length > 0) {
      const { data } = await supabase
        .from("imported_contacts")
        .select("enrichment_data")
        .eq("id", savedId)
        .maybeSingle();

      const existing = (data?.enrichment_data as Record<string, any>) || {};
      payload.enrichment_data = structuredClone({ ...existing, ...enrichmentPatch });
    }

    if (Object.keys(payload).length === 0) return;

    const { error } = await (supabase.from("imported_contacts").update(payload) as any).eq("id", savedId);
    if (error) log.warn("persist update failed", { message: error.message, code: error.code });
  }, [savedId]);

  const applyPlacesResult = (result: any) => {
    const persistedFields: Record<string, any> = {};
    const enrichmentPatch: Record<string, any> = {};

    if (result.title) {
      const parts = result.title.split(" - ");
      const resolvedCompanyName = parts[0]?.trim();
      if (resolvedCompanyName && !companyName) {
        setCompanyName(resolvedCompanyName);
        persistedFields.company_name = resolvedCompanyName;
      }
    }

    const unwrappedUrl = unwrapGoogleResultUrl(result.url) || result.url || "";
    if (unwrappedUrl && !website && isUsefulCompanyUrl(unwrappedUrl)) {
      const domain = extractDomain(unwrappedUrl);
      setWebsite(unwrappedUrl);
      setLogoUrl(buildGoogleFaviconUrl(domain));
      enrichmentPatch.website = unwrappedUrl;
      enrichmentPatch.logo_url = buildGoogleFaviconUrl(domain);
    }

    const description = getSearchResultDescription(result);
    if (description) {
      const phoneMatch = description.match(/(\+?\d[\d\s\-().]{7,})/);
      if (phoneMatch && !companyPhone) {
        const resolvedPhone = phoneMatch[1].trim();
        setCompanyPhone(resolvedPhone);
        persistedFields.phone = resolvedPhone;
      }

      const emailMatch = description.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
      if (emailMatch && !companyEmail) {
        const resolvedEmail = emailMatch[0];
        setCompanyEmail(resolvedEmail);
        if (!contactEmail) persistedFields.email = resolvedEmail;
      }

      const nextNote = note ? `${note}\n${description}` : description;
      setNote(nextNote);
      persistedFields.note = nextNote;
    }

    setPlacesResults([]);
    void persistSavedContact(persistedFields, enrichmentPatch);
    toast.success("Dati applicati dal risultato");
  };

  const handlePlacesSearch = useCallback(async () => {
    if (!companyName.trim()) {
      toast.error("Inserisci il nome dell'azienda");
      return;
    }
    if (!(await ensurePartnerConnectReady())) return;

    setPlacesLoading(true);
    try {
      const query = [companyName.trim(), contactName.trim(), "company", "address", "phone", "email", "website"]
        .filter(Boolean)
        .join(" ");
      const res = await fsBridge.googleSearch(query, 8, true);
      const normalizedResults = Array.isArray(res.data)
        ? res.data.map((item: any) => ({
            ...item,
            url: unwrapGoogleResultUrl(item.url) || item.url || "",
            description: getSearchResultDescription(item),
          }))
        : [];

      if (res.success && normalizedResults.length > 0) {
        setPlacesResults(normalizedResults);
      } else {
        toast.info("Nessun risultato trovato");
      }
    } catch (e: any) {
      toast.error("Errore ricerca: " + (e.message || "sconosciuto"));
    } finally {
      setPlacesLoading(false);
    }
  }, [companyName, contactName, ensurePartnerConnectReady, fsBridge]);

  const handleLogoSearch = useCallback(async () => {
    const derivedDomain = extractDomain(website) || extractDomainFromEmail(contactEmail || companyEmail);

    if (derivedDomain) {
      const nextLogoUrl = buildGoogleFaviconUrl(derivedDomain);
      setLogoUrl(nextLogoUrl);
      if (!website) setWebsite(`https://${derivedDomain}`);
      void persistSavedContact({}, {
        logo_url: nextLogoUrl,
        ...(website ? {} : { website: `https://${derivedDomain}` }),
      });
      toast.success("Logo recuperato dal dominio aziendale");
      return;
    }

    if (!companyName.trim()) {
      toast.error("Inserisci il nome dell'azienda o il sito web");
      return;
    }
    if (!(await ensurePartnerConnectReady())) return;

    setLogoLoading(true);
    try {
      const res = await fsBridge.googleSearch(`${companyName.trim()} official website`, 3, true);
      const normalizedResults = Array.isArray(res.data)
        ? res.data.map((item: any) => ({ ...item, url: unwrapGoogleResultUrl(item.url) || item.url || "" }))
        : [];

      const siteResult = normalizedResults.find((item: any) => isUsefulCompanyUrl(item.url));
      if (res.success && siteResult?.url) {
        const domain = extractDomain(siteResult.url);
        const nextLogoUrl = buildGoogleFaviconUrl(domain);
        setLogoUrl(nextLogoUrl);
        setWebsite(siteResult.url);
        void persistSavedContact({}, { logo_url: nextLogoUrl, website: siteResult.url });
        toast.success("Logo trovato dal sito aziendale");
      } else {
        toast.info("Nessun sito web trovato per il logo");
      }
    } catch (e: any) {
      toast.error("Errore ricerca logo: " + (e.message || "sconosciuto"));
    } finally {
      setLogoLoading(false);
    }
  }, [companyEmail, companyName, contactEmail, ensurePartnerConnectReady, fsBridge, persistSavedContact, website]);

  const handleLinkedInSearch = useCallback(async () => {
    if (!contactName.trim() && !companyName.trim()) {
      toast.error("Inserisci almeno nome contatto o azienda");
      return;
    }
    if (!(await ensurePartnerConnectReady())) return;

    setLinkedinLoading(true);
    try {
      if (contactName.trim()) {
        const result = await linkedinLookup.searchSingle({
          name: contactName.trim(),
          company: companyName.trim() || null,
          email: contactEmail.trim() || companyEmail.trim() || null,
          role: position.trim() || null,
          country: country || null,
          sourceType: savedId ? "contact" : undefined,
          sourceId: savedId || undefined,
        });

        if (result.url) {
          setLinkedinUrl(result.url);
          void persistSavedContact({}, {
            linkedin_url: result.url,
            linkedin_profile_url: result.url,
            linkedin_resolved_method: result.resolvedMethod,
          });
          toast.success("Profilo LinkedIn trovato");
          return;
        }
      }

      const companyResult = await fsBridge.googleSearch(`"${companyName.trim()}" site:linkedin.com/company`, 3, true);
      const normalizedCompanyResults = Array.isArray(companyResult.data)
        ? companyResult.data.map((item: any) => ({ ...item, url: unwrapGoogleResultUrl(item.url) || item.url || "" }))
        : [];
      const companyMatch = normalizedCompanyResults.find((item: any) => item.url?.includes("linkedin.com/company/"));

      if (companyResult.success && companyMatch?.url) {
        setLinkedinUrl(companyMatch.url);
        void persistSavedContact({}, {
          linkedin_url: companyMatch.url,
          linkedin_company_url: companyMatch.url,
        });
        toast.success("Pagina LinkedIn aziendale trovata");
      } else {
        toast.info("Nessun profilo LinkedIn trovato");
      }
    } catch (e: any) {
      toast.error("Errore ricerca LinkedIn: " + (e.message || "sconosciuto"));
    } finally {
      setLinkedinLoading(false);
    }
  }, [
    companyEmail,
    companyName,
    contactEmail,
    contactName,
    country,
    ensurePartnerConnectReady,
    fsBridge,
    linkedinLookup,
    persistSavedContact,
    position,
    savedId,
  ]);

  const handleDeepSearch = useCallback(async () => {
    if (!savedId) {
      toast.error("Salva prima il contatto, poi avvia la Deep Search");
      return;
    }
    if (!(await ensurePartnerConnectReady())) return;
    deepSearch.start([savedId], true, "contact");
    toast.success("Deep Search avviata dal sistema");
  }, [deepSearch, ensurePartnerConnectReady, savedId]);

  const handleSave = async () => {
    if (!companyName.trim()) {
      toast.error("Il nome azienda è obbligatorio");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Non autenticato");
        return;
      }

      let importLogId: string;
      const { data: existingLog } = await supabase
        .from("import_logs")
        .select("id")
        .eq("user_id", user.id)
        .eq("file_name", "__manual_entry__")
        .limit(1)
        .maybeSingle();

      if (existingLog) {
        importLogId = existingLog.id;
      } else {
        const { data: newLog, error: logErr } = await supabase
          .from("import_logs")
          .insert({
            user_id: user.id,
            file_name: "__manual_entry__",
            total_rows: 0,
            status: "completed",
            group_name: "Inserimento Manuale",
          })
          .select("id")
          .single();
        if (logErr || !newLog) {
          toast.error("Errore creazione registro");
          return;
        }
        importLogId = newLog.id;
      }

      const enrichmentData: Record<string, any> = {};
      if (linkedinUrl) enrichmentData.linkedin_url = linkedinUrl;
      if (logoUrl) enrichmentData.logo_url = logoUrl;
      if (website) enrichmentData.website = website;

      const { data: inserted, error } = await supabase.from("imported_contacts").insert({
        user_id: user.id,
        import_log_id: importLogId,
        company_name: companyName.trim(),
        company_alias: companyAlias.trim() || null,
        name: contactName.trim() || null,
        contact_alias: contactAlias.trim() || null,
        email: contactEmail.trim() || companyEmail.trim() || null,
        phone: contactPhone.trim() || companyPhone.trim() || null,
        mobile: contactMobile.trim() || null,
        position: position.trim() || null,
        country: country || null,
        city: city.trim() || null,
        address: address.trim() || null,
        zip_code: zipCode.trim() || null,
        origin: origin.trim() || "manual",
        note: note.trim() || null,
        lead_status: "new",
        row_number: 0,
        enrichment_data: Object.keys(enrichmentData).length > 0 ? enrichmentData : null,
      }).select("id").single();

      if (error) {
        toast.error("Errore salvataggio: " + error.message);
      } else if (inserted) {
        setSavedId(inserted.id);
        toast.success("Contatto salvato! Ora i tool scrivono direttamente sul record.");
      }
    } catch (e: any) {
      toast.error("Errore: " + (e.message || "sconosciuto"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndClose = async () => {
    if (savedId) {
      resetForm();
      onOpenChange(false);
      return;
    }
    await handleSave();
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Nuovo Contatto / Azienda
          </DialogTitle>
          <DialogDescription className="sr-only">
            Maschera di inserimento manuale con ricerca Google, logo, LinkedIn e Deep Search collegati al record salvato.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="search" className="w-full">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="search" className="text-xs gap-1">
              <Search className="w-3.5 h-3.5" /> Ricerca
            </TabsTrigger>
            <TabsTrigger value="company" className="text-xs gap-1">
              <Building2 className="w-3.5 h-3.5" /> Azienda
            </TabsTrigger>
            <TabsTrigger value="contact" className="text-xs gap-1">
              <User className="w-3.5 h-3.5" /> Contatto
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-xs gap-1">
              <Briefcase className="w-3.5 h-3.5" /> Note
            </TabsTrigger>
          </TabsList>

          {/* TAB: Ricerca (FIRST) */}
          <TabsContent value="search" className="space-y-3 mt-3">
            {/* Shared name fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome Azienda *</Label>
                <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Es. Acme Logistics Srl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nome Contatto</Label>
                <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Mario Rossi" />
              </div>
            </div>

            {/* Google Search */}
            <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <MapPin className="w-4 h-4 text-red-400" /> Cerca su Google
                </div>
                <Button size="sm" onClick={handlePlacesSearch} disabled={placesLoading || !companyName.trim()}>
                  {placesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span className="ml-1">Cerca</span>
                </Button>
              </div>
              {placesResults.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {placesResults.map((r, i) => (
                    <button
                      key={i}
                      className="w-full text-left text-xs p-2 rounded hover:bg-accent/50 transition-colors border border-transparent hover:border-border"
                      onClick={() => applyPlacesResult(r)}
                    >
                      <div className="flex items-start gap-2">
                        <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <span className="font-medium">{r.title}</span>
                          {r.url && (
                            <p className="text-[10px] text-muted-foreground truncate">{r.url}</p>
                          )}
                          {r.description && (
                            <p className="text-muted-foreground line-clamp-2">{r.description}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Logo + LinkedIn side by side */}
            <div className="grid grid-cols-2 gap-3">
              {/* Logo */}
              <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <Image className="w-4 h-4 text-green-500" /> Logo
                  </div>
                  <Button size="sm" variant="outline" onClick={handleLogoSearch} disabled={logoLoading} className="h-7 text-xs">
                    {logoLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Cerca"}
                  </Button>
                </div>
                {logoUrl && (
                  <div className="flex items-center gap-2">
                    <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded border" onError={() => setLogoUrl("")} />
                    <span className="text-[10px] text-muted-foreground truncate">{extractDomain(website || logoUrl)}</span>
                  </div>
                )}
              </div>

              {/* LinkedIn */}
              <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <Linkedin className="w-4 h-4 text-blue-500" /> LinkedIn
                  </div>
                  <Button size="sm" variant="outline" onClick={handleLinkedInSearch} disabled={linkedinLoading} className="h-7 text-xs">
                    {linkedinLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Cerca"}
                  </Button>
                </div>
                {linkedinUrl && (
                  <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:underline truncate block">
                    {linkedinUrl.replace("https://www.", "").replace("https://", "")}
                  </a>
                )}
              </div>
            </div>

            {/* Deep Search */}
            <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Radar className="w-4 h-4 text-purple-500" /> Deep Search
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDeepSearch}
                  disabled={!savedId || deepSearch.running}
                  className="h-7 text-xs"
                >
                  {deepSearch.running ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  {savedId ? "Avvia" : "Salva prima"}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {savedId
                  ? "Avvia il Deep Search completo del sistema sul contatto salvato"
                  : "Salva il contatto, poi potrai avviare la Deep Search completa"}
              </p>
            </div>

            {!fsBridge.isAvailable && (
              <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30">
                ⚠ Estensione Partner Connect non rilevata — ricerche limitate
              </Badge>
            )}

            {/* Website field (auto-filled from search) */}
            {website && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Globe className="w-3 h-3" />
                <span className="truncate">{website}</span>
              </div>
            )}
          </TabsContent>

          {/* TAB: Azienda */}
          <TabsContent value="company" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome Azienda *</Label>
                <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Es. Acme Logistics Srl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Alias</Label>
                <Input value={companyAlias} onChange={e => setCompanyAlias(e.target.value)} placeholder="Nome abbreviato" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Paese</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger><SelectValue placeholder="Seleziona paese" /></SelectTrigger>
                  <SelectContent className="max-h-56">
                    {COUNTRY_OPTIONS.map(code => (
                      <SelectItem key={code} value={code}>
                        {getCountryFlag(code)} {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Città</Label>
                <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Milano" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Indirizzo</Label>
                <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Via Roma 1" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CAP</Label>
                <Input value={zipCode} onChange={e => setZipCode(e.target.value)} placeholder="20100" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Telefono</Label>
                <Input value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} placeholder="+39 02..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} placeholder="info@azienda.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sito Web</Label>
                <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
              </div>
            </div>
          </TabsContent>

          {/* TAB: Contatto */}
          <TabsContent value="contact" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome e Cognome</Label>
                <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Mario Rossi" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Alias</Label>
                <Input value={contactAlias} onChange={e => setContactAlias(e.target.value)} placeholder="Soprannome" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Posizione / Ruolo</Label>
              <Input value={position} onChange={e => setPosition(e.target.value)} placeholder="Sales Manager" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="mario@azienda.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefono</Label>
                <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+39 02..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mobile</Label>
                <Input value={contactMobile} onChange={e => setContactMobile(e.target.value)} placeholder="+39 333..." />
              </div>
            </div>
            {linkedinUrl && (
              <div className="flex items-center gap-2 text-xs">
                <Linkedin className="w-3.5 h-3.5 text-blue-500" />
                <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate">
                  {linkedinUrl.replace("https://www.", "").replace("https://", "")}
                </a>
              </div>
            )}
          </TabsContent>

          {/* TAB: Note */}
          <TabsContent value="notes" className="space-y-3 mt-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Origine / Fonte</Label>
              <Input value={origin} onChange={e => setOrigin(e.target.value)} placeholder="Es. Fiera Milano 2026, Referral, Cold call..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Note</Label>
              <Textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Appunti, dettagli, osservazioni..."
                rows={6}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border mt-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {logoUrl && <img src={logoUrl} alt="" className="w-4 h-4 rounded" />}
            {companyName && <Badge variant="secondary" className="text-[10px]">{companyName}</Badge>}
            {contactName && <Badge variant="outline" className="text-[10px]">{contactName}</Badge>}
            {savedId && <Badge className="text-[10px] bg-green-600/20 text-green-400 border-green-600/30">Salvato ✓</Badge>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleClose}>
              {savedId ? "Chiudi" : "Annulla"}
            </Button>
            {!savedId ? (
              <Button size="sm" onClick={handleSave} disabled={saving || !companyName.trim()}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Salva
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => { resetForm(); }} className="text-xs">
                + Nuovo
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
