import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Download, Linkedin, ShieldAlert, Wifi } from "lucide-react";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "sonner";
import { useWcaSession } from "@/hooks/useWcaSession";
import BlacklistManager from "@/components/settings/BlacklistManager";
import { ChannelsTab } from "./ChannelsTab";
import { ExtensionsTab } from "./ExtensionsTab";
import { WcaTab } from "./WcaTab";
import { LinkedInTab } from "./LinkedInTab";
import { createLogger } from "@/lib/log";

const log = createLogger("ConnectionsSettings");

interface ConnectionsSettingsProps {
  settings: Record<string, string> | undefined;
  updateSetting: unknown;
}

export function ConnectionsSettings({ settings, updateSetting }: ConnectionsSettingsProps) {
  const { isSessionActive, ensureSession } = useWcaSession();
  const liExt = useLinkedInExtensionBridge();
  const waExt = useWhatsAppExtensionBridge();
  const isWcaOk = isSessionActive === true;

  const [verifying, setVerifying] = useState(false);
  const [cookieInput, setCookieInput] = useState("");
  const [savingCookie, setSavingCookie] = useState(false);
  const [liEmail, setLiEmail] = useState("");
  const [liPass, setLiPass] = useState("");
  const [liAtCookie, setLiAtCookie] = useState("");
  const [connectingAll, setConnectingAll] = useState(false);
  const [liSessionOk, setLiSessionOk] = useState(false);

  const liHasCreds = !!(liEmail && liPass) || !!(settings?.["linkedin_li_at"]);
  const waConnected = waExt.isAvailable;

  useEffect(() => {
    if (settings) {
      setLiAtCookie(settings["linkedin_li_at"] || "");
      setLiEmail(settings["linkedin_email"] || "");
      setLiPass(settings["linkedin_password"] || "");
    }
  }, [settings]);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const ok = await ensureSession();
      toast.success(ok ? "Sessione attiva!" : "Sessione non attiva");
    } catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); toast.error("Errore durante la verifica"); }
    finally { setVerifying(false); }
  };

  const handleSaveCookie = async () => {
    const cookie = cookieInput.trim();
    if (!cookie) return;
    setSavingCookie(true);
    try {
      const data = await invokeEdge<Record<string, unknown>>("save-wca-cookie", { body: { cookie }, context: "ConnectionsSettings.save_wca_cookie" });
      if (data?.authenticated) { toast.success("Cookie salvato e verificato!"); setCookieInput(""); }
      else toast.warning("Cookie salvato ma la verifica è fallita.");
      ensureSession();
    } catch (err: unknown) { toast.error("Errore: " + (err.message || "Sconosciuto")); }
    finally { setSavingCookie(false); }
  };

  const handleConnectAll = async () => {
    setConnectingAll(true);
    const results: string[] = [];
    if (liExt.isAvailable) {
      const res = await liExt.verifySession();
      const reallyOk = res.success === true && res.authenticated === true;
      setLiSessionOk(reallyOk);
      results.push(reallyOk ? "✅ LinkedIn (sessione attiva)" : "⚠️ LinkedIn (sessione non autenticata)");
    } else if (liHasCreds) {
      setLiSessionOk(false);
      results.push("⚠️ LinkedIn (credenziali salvate ma estensione non attiva)");
    } else {
      setLiSessionOk(false);
      results.push("❌ LinkedIn (configura credenziali)");
    }
    if (waExt.isAvailable) {
      const res = await waExt.verifySession();
      results.push(res.success ? "✅ WhatsApp" : "⚠️ WhatsApp (sessione scaduta)");
    } else { results.push("❌ WhatsApp (estensione non rilevata)"); }
    results.push("✅ AI Agent");
    try {
      await updateSetting.mutateAsync({ key: "linkedin_connected", value: String(liSessionOk) });
      await updateSetting.mutateAsync({ key: "whatsapp_connected", value: String(waConnected) });
    } catch (e) { log.debug("best-effort operation failed", { error: e instanceof Error ? e.message : String(e) }); /* intentionally ignored: best-effort cleanup */ }
    toast.success(results.join(" · "));
    setConnectingAll(false);
  };

  return (
    <Tabs defaultValue="canali" className="space-y-4">
      <TabsList className="w-full justify-start flex-wrap">
        <TabsTrigger value="canali" className="gap-1.5 text-xs"><Wifi className="w-3.5 h-3.5" /> Canali</TabsTrigger>
        <TabsTrigger value="estensioni" className="gap-1.5 text-xs"><Download className="w-3.5 h-3.5" /> Estensioni</TabsTrigger>
        <TabsTrigger value="wca" className="gap-1.5 text-xs"><Globe className="w-3.5 h-3.5" /> WCA</TabsTrigger>
        <TabsTrigger value="linkedin" className="gap-1.5 text-xs"><Linkedin className="w-3.5 h-3.5" /> LinkedIn</TabsTrigger>
        <TabsTrigger value="blacklist" className="gap-1.5 text-xs"><ShieldAlert className="w-3.5 h-3.5" /> Blacklist</TabsTrigger>
      </TabsList>

      <TabsContent value="canali" className="m-0">
        <ChannelsTab waConnected={waConnected} liConnected={liSessionOk} liHasCreds={liHasCreds}
          liExtAvailable={liExt.isAvailable} waExt={waExt} liExt={liExt}
          connectingAll={connectingAll} onConnectAll={handleConnectAll} />
      </TabsContent>
      <TabsContent value="estensioni" className="m-0"><ExtensionsTab /></TabsContent>
      <TabsContent value="wca" className="m-0">
        <WcaTab isWcaOk={isWcaOk} verifying={verifying} onVerify={handleVerify}
          cookieInput={cookieInput} setCookieInput={setCookieInput}
          savingCookie={savingCookie} onSaveCookie={handleSaveCookie} />
      </TabsContent>
      <TabsContent value="linkedin" className="m-0">
        <LinkedInTab liHasCreds={liHasCreds} liEmail={liEmail} setLiEmail={setLiEmail}
          liPass={liPass} setLiPass={setLiPass} liAtCookie={liAtCookie}
          setLiAtCookie={setLiAtCookie} updateSetting={updateSetting} />
      </TabsContent>
      <TabsContent value="blacklist" className="m-0"><BlacklistManager /></TabsContent>
    </Tabs>
  );
}
