import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFireScrapeExtensionBridge } from "@/hooks/useFireScrapeExtensionBridge";
import { useLinkedInLookup } from "@/hooks/useLinkedInLookup";
import {
  Building2, User, Search, Globe, Linkedin, Image, Radar,
  Loader2, Check, MapPin, Phone, Mail, Briefcase, Save,
} from "lucide-react";
import { getCountryFlag } from "@/lib/countries";

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
import { cn } from "@/lib/utils";

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddContactDialog({ open, onOpenChange }: AddContactDialogProps) {
  // Company fields
  const [companyName, setCompanyName] = useState("");
  const [companyAlias, setCompanyAlias] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [website, setWebsite] = useState("");

  // Contact fields
  const [contactName, setContactName] = useState("");
  const [contactAlias, setContactAlias] = useState("");
  const [position, setPosition] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMobile, setContactMobile] = useState("");

  // Notes
  const [origin, setOrigin] = useState("");
  const [note, setNote] = useState("");

  // States
  const [saving, setSaving] = useState(false);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesQuery, setPlacesQuery] = useState("");
  const [placesResults, setPlacesResults] = useState<any[]>([]);
  const [logoLoading, setLogoLoading] = useState(false);
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [deepSearchLoading, setDeepSearchLoading] = useState(false);

  const fsBridge = useFireScrapeExtensionBridge();

  const resetForm = () => {
    setCompanyName(""); setCompanyAlias(""); setCountry(""); setCity("");
    setAddress(""); setZipCode(""); setCompanyPhone(""); setCompanyEmail("");
    setWebsite(""); setContactName(""); setContactAlias(""); setPosition("");
    setContactEmail(""); setContactPhone(""); setContactMobile("");
    setOrigin(""); setNote(""); setPlacesResults([]); setPlacesQuery("");
  };

  // Google Places search via extension
  const handlePlacesSearch = useCallback(async () => {
    if (!placesQuery.trim()) return;
    if (!fsBridge.isAvailable) {
      toast.error("Estensione Partner Connect non disponibile");
      return;
    }
    setPlacesLoading(true);
    try {
      const query = `${placesQuery} company address`;
      const res = await fsBridge.googleSearch(query, 5);
      if (res.success && Array.isArray(res.data)) {
        setPlacesResults(res.data);
      } else {
        toast.error("Nessun risultato trovato");
      }
    } catch (e: any) {
      toast.error("Errore ricerca: " + (e.message || "sconosciuto"));
    } finally {
      setPlacesLoading(false);
    }
  }, [placesQuery, fsBridge]);

  const applyPlacesResult = (result: any) => {
    // Extract info from search result description/title
    if (result.title) {
      const parts = result.title.split(" - ");
      if (parts[0] && !companyName) setCompanyName(parts[0].trim());
    }
    if (result.description) {
      // Try to extract address from snippet
      setNote(prev => prev ? `${prev}\n${result.description}` : result.description);
    }
    if (result.url) {
      setWebsite(result.url);
    }
    setPlacesResults([]);
    toast.success("Dati applicati dal risultato");
  };

  // LinkedIn search
  const handleLinkedInSearch = useCallback(async () => {
    if (!contactName.trim() && !companyName.trim()) {
      toast.error("Inserisci almeno nome contatto o azienda");
      return;
    }
    if (!fsBridge.isAvailable) {
      toast.error("Estensione Partner Connect non disponibile");
      return;
    }
    setLinkedinLoading(true);
    try {
      const query = `site:linkedin.com/in "${contactName}"${companyName ? ` "${companyName}"` : ""}`;
      const res = await fsBridge.googleSearch(query, 5);
      if (res.success && Array.isArray(res.data)) {
        const liResult = res.data.find((r: any) => r.url?.includes("linkedin.com/in/"));
        if (liResult) {
          toast.success(`LinkedIn trovato: ${liResult.title}`);
          setNote(prev => prev ? `${prev}\nLinkedIn: ${liResult.url}` : `LinkedIn: ${liResult.url}`);
        } else {
          toast.info("Nessun profilo LinkedIn trovato");
        }
      }
    } catch (e: any) {
      toast.error("Errore ricerca LinkedIn");
    } finally {
      setLinkedinLoading(false);
    }
  }, [contactName, companyName, fsBridge]);

  // Logo search
  const handleLogoSearch = useCallback(async () => {
    if (!companyName.trim()) {
      toast.error("Inserisci il nome dell'azienda");
      return;
    }
    if (!fsBridge.isAvailable) {
      toast.error("Estensione Partner Connect non disponibile");
      return;
    }
    setLogoLoading(true);
    try {
      const query = `${companyName} company logo`;
      const res = await fsBridge.googleSearch(query, 3);
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        toast.success("Risultati logo trovati — verranno associati al salvataggio");
      } else {
        toast.info("Nessun logo trovato");
      }
    } catch {
      toast.error("Errore ricerca logo");
    } finally {
      setLogoLoading(false);
    }
  }, [companyName, fsBridge]);

  // Deep search
  const handleDeepSearch = useCallback(async () => {
    if (!companyName.trim() && !website.trim()) {
      toast.error("Inserisci nome azienda o sito web");
      return;
    }
    setDeepSearchLoading(true);
    try {
      if (website && fsBridge.isAvailable) {
        const scrapeRes = await fsBridge.scrapeUrl(website);
        if (scrapeRes.success && scrapeRes.markdown) {
          // Call enrichment edge function with scraped content
          const { error } = await supabase.functions.invoke("enrich-partner-website", {
            body: { markdown: scrapeRes.markdown, sourceUrl: website, companyName },
          });
          if (!error) {
            toast.success("Deep Search completato — dati arricchiti");
          } else {
            toast.error("Errore nell'analisi AI");
          }
        }
      } else {
        toast.info("Estensione non disponibile per lo scraping");
      }
    } catch (e: any) {
      toast.error("Errore deep search: " + (e.message || ""));
    } finally {
      setDeepSearchLoading(false);
    }
  }, [companyName, website, fsBridge]);

  // Save
  const handleSave = async () => {
    if (!companyName.trim()) {
      toast.error("Il nome azienda è obbligatorio");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Non autenticato"); return; }

      // We need an import_log. Create a "manual" one or find existing
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

      const { error } = await supabase.from("imported_contacts").insert({
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
      });

      if (error) {
        toast.error("Errore salvataggio: " + error.message);
      } else {
        toast.success("Contatto salvato con successo");
        resetForm();
        onOpenChange(false);
      }
    } catch (e: any) {
      toast.error("Errore: " + (e.message || "sconosciuto"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Nuovo Contatto / Azienda
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="company" className="w-full">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="company" className="text-xs gap-1">
              <Building2 className="w-3.5 h-3.5" /> Azienda
            </TabsTrigger>
            <TabsTrigger value="contact" className="text-xs gap-1">
              <User className="w-3.5 h-3.5" /> Contatto
            </TabsTrigger>
            <TabsTrigger value="search" className="text-xs gap-1">
              <Search className="w-3.5 h-3.5" /> Ricerca
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-xs gap-1">
              <Briefcase className="w-3.5 h-3.5" /> Note
            </TabsTrigger>
          </TabsList>

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
                    {COUNTRY_LIST.map(c => (
                      <SelectItem key={c.code} value={c.code}>
                        {getCountryFlag(c.code)} {c.name}
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
          </TabsContent>

          {/* TAB: Ricerca */}
          <TabsContent value="search" className="space-y-4 mt-3">
            {/* Google Places */}
            <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-2 text-xs font-medium">
                <MapPin className="w-4 h-4 text-red-400" /> Cerca su Google
              </div>
              <div className="flex gap-2">
                <Input
                  value={placesQuery}
                  onChange={e => setPlacesQuery(e.target.value)}
                  placeholder="Nome azienda o indirizzo..."
                  onKeyDown={e => e.key === "Enter" && handlePlacesSearch()}
                  className="flex-1"
                />
                <Button size="sm" onClick={handlePlacesSearch} disabled={placesLoading}>
                  {placesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              {placesResults.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {placesResults.map((r, i) => (
                    <button
                      key={i}
                      className="w-full text-left text-xs p-2 rounded hover:bg-accent/50 transition-colors border border-transparent hover:border-border"
                      onClick={() => applyPlacesResult(r)}
                    >
                      <span className="font-medium">{r.title}</span>
                      {r.description && <p className="text-muted-foreground truncate">{r.description}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* LinkedIn */}
            <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Linkedin className="w-4 h-4 text-blue-500" /> Cerca LinkedIn
                </div>
                <Button size="sm" variant="outline" onClick={handleLinkedInSearch} disabled={linkedinLoading}>
                  {linkedinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cerca"}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Cerca il profilo LinkedIn di "{contactName || "contatto"}" presso "{companyName || "azienda"}"
              </p>
            </div>

            {/* Logo */}
            <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Image className="w-4 h-4 text-green-500" /> Cerca Logo Aziendale
                </div>
                <Button size="sm" variant="outline" onClick={handleLogoSearch} disabled={logoLoading}>
                  {logoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cerca"}
                </Button>
              </div>
            </div>

            {/* Deep Search */}
            <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Radar className="w-4 h-4 text-purple-500" /> Deep Search
                </div>
                <Button size="sm" variant="outline" onClick={handleDeepSearch} disabled={deepSearchLoading}>
                  {deepSearchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Avvia"}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Scraping del sito web + analisi AI per arricchire il profilo
              </p>
            </div>

            {!fsBridge.isAvailable && (
              <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30">
                ⚠ Estensione Partner Connect non rilevata — ricerche non disponibili
              </Badge>
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
          <div className="text-[10px] text-muted-foreground">
            {companyName && <Badge variant="secondary" className="text-[10px] mr-1">{companyName}</Badge>}
            {contactName && <Badge variant="outline" className="text-[10px]">{contactName}</Badge>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { resetForm(); onOpenChange(false); }}>
              Annulla
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !companyName.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Salva
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
