import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, Upload, Image, Link2, Eye } from "lucide-react";
import { useAgents, type Agent } from "@/hooks/useAgents";
import { supabase } from "@/integrations/supabase/client";
import { resolveAgentAvatar } from "@/data/agentAvatars";
import { ROBIN_VOICE_CALL_URL } from "@/data/agentTemplates";
import { toast } from "sonner";

interface Props {
  agent: Agent;
}

export function AgentSignatureConfig({ agent }: Props) {
  const [signatureHtml, setSignatureHtml] = useState(agent.signature_html || "");
  const [signatureImageUrl, setSignatureImageUrl] = useState(agent.signature_image_url || "");
  const [voiceCallUrl, setVoiceCallUrl] = useState(agent.voice_call_url || "");
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { updateAgent } = useAgents();

  useEffect(() => {
    setSignatureHtml(agent.signature_html || "");
    setSignatureImageUrl(agent.signature_image_url || "");
    setVoiceCallUrl(agent.voice_call_url || "");
  }, [agent.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `agent-signatures/${agent.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("templates").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("templates").getPublicUrl(path);
      setSignatureImageUrl(urlData.publicUrl);
      toast.success("Immagine caricata");
    } catch {
      toast.error("Errore upload immagine");
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    updateAgent.mutate(
      {
        id: agent.id,
        signature_html: signatureHtml || null,
        signature_image_url: signatureImageUrl || null,
        voice_call_url: voiceCallUrl || null,
      } as any,
      { onSuccess: () => toast.success("Firma agente salvata") }
    );
  };

  const generateDefaultSignature = () => {
    // Use avatar image from resolveAgentAvatar
    const avatarSrc = resolveAgentAvatar(agent.name, agent.avatar_emoji);
    const avatarHtml = signatureImageUrl
      ? `<img src="${signatureImageUrl}" alt="${agent.name}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;" />`
      : avatarSrc
        ? `<img src="${avatarSrc}" alt="${agent.name}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;" />`
        : `<span style="font-size:36px;">${agent.avatar_emoji}</span>`;

    const callUrl = voiceCallUrl || ROBIN_VOICE_CALL_URL;

    const html = `<table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px;color:#333;">
  <tr>
    <td style="padding-right:12px;vertical-align:top;">
      ${avatarHtml}
    </td>
    <td style="vertical-align:top;">
      <strong style="font-size:14px;">${agent.name}</strong><br/>
      <span style="color:#666;font-size:12px;">Agente Digitale TMWI — ${agent.role}</span><br/>
      <a href="${callUrl}" style="color:#2563eb;font-size:12px;text-decoration:none;">📞 Chiamami</a>
    </td>
  </tr>
</table>`;
    setSignatureHtml(html);
    if (!voiceCallUrl) setVoiceCallUrl(ROBIN_VOICE_CALL_URL);
    toast.success("Firma generata con branding TMWI e link chiamata Robin");
  };

  const previewHtml = signatureHtml || `<p style="color:#999;font-size:13px;">Nessuna firma configurata</p>`;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Image className="w-4 h-4" /> Firma Email Agente
      </h3>

      {/* Avatar/Image upload */}
      <div>
        <Label className="text-xs">Immagine Firma (avatar agente)</Label>
        <div className="flex items-center gap-3 mt-1">
          {signatureImageUrl ? (
            <img src={signatureImageUrl} alt="Firma" className="w-12 h-12 rounded-full object-cover border border-border/50" />
          ) : (() => {
            const avatarSrc = resolveAgentAvatar(agent.name, agent.avatar_emoji);
            return avatarSrc ? (
              <img src={avatarSrc} alt={agent.name} className="w-12 h-12 rounded-full object-cover border border-border/50" />
            ) : (
              <span className="text-3xl">{agent.avatar_emoji}</span>
            );
          })()}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="w-3.5 h-3.5 mr-1" />
            {uploading ? "Caricamento..." : "Carica foto"}
          </Button>
        </div>
      </div>

      {/* Voice call URL */}
      <div>
        <Label className="text-xs flex items-center gap-1">
          <Link2 className="w-3 h-3" /> Link Chiamata Vocale (Robin — agente telefonico)
        </Label>
        <Input
          value={voiceCallUrl}
          onChange={(e) => setVoiceCallUrl(e.target.value)}
          placeholder={ROBIN_VOICE_CALL_URL}
          className="text-sm mt-1"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Robin è l'agente telefonico designato. Il link apparirà nella firma email.
        </p>
      </div>

      {/* Signature HTML */}
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">HTML Firma</Label>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={generateDefaultSignature}>
              Genera automatica
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setShowPreview(!showPreview)}>
              <Eye className="w-3 h-3 mr-1" /> {showPreview ? "Nascondi" : "Anteprima"}
            </Button>
          </div>
        </div>
        <Textarea
          value={signatureHtml}
          onChange={(e) => setSignatureHtml(e.target.value)}
          placeholder="<table>...</table>"
          className="text-xs font-mono mt-1 min-h-[100px]"
        />
      </div>

      {/* Preview */}
      {showPreview && (
        <div className="border border-border/50 rounded-lg p-4 bg-white">
          <p className="text-[10px] text-muted-foreground mb-2">Anteprima firma:</p>
          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml) }} />
        </div>
      )}

      <Button size="sm" onClick={save}>
        <Save className="w-3.5 h-3.5 mr-1" /> Salva Firma
      </Button>
    </div>
  );
}
