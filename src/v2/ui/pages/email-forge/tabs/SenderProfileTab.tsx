/**
 * SenderProfileTab — edit sender app_settings ai_* + readiness scores.
 */
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { upsertAppSetting } from "@/data/appSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { RegenerateBanner } from "../RegenerateBanner";

const AI_KEYS = [
  { key: "ai_contact_name", label: "Nome contatto", textarea: false },
  { key: "ai_contact_alias", label: "Alias contatto", textarea: false },
  { key: "ai_contact_role", label: "Ruolo / Titolo", textarea: false },
  { key: "ai_company_name", label: "Nome azienda", textarea: false },
  { key: "ai_company_alias", label: "Alias azienda", textarea: false },
  { key: "ai_email_signature", label: "Firma email", textarea: true },
  { key: "ai_knowledge_base", label: "Knowledge Base mittente (chi sei, cosa offri)", textarea: true },
] as const;

interface SettingRow { key: string; value: string | null }

export function SenderProfileTab() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const qc = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["forge-sender-settings", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("key, value").eq("user_id", userId!).like("key", "ai_%");
      const map: Record<string, string> = {};
      (data as SettingRow[] | null ?? []).forEach((r) => { if (r.value != null) map[r.key] = r.value; });
      return map;
    },
  });

  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState(0);
  React.useEffect(() => { if (settingsQuery.data) setDraft({ ...settingsQuery.data }); }, [settingsQuery.data]);

  const handleSave = async (key: string) => {
    if (!userId) return;
    setSaving(key);
    try {
      await upsertAppSetting(userId, key, draft[key] ?? "");
      toast.success("Profilo aggiornato");
      qc.invalidateQueries({ queryKey: ["forge-sender-settings", userId] });
      setSavedAt(Date.now());
    } catch (e) {
      toast.error("Salvataggio fallito", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(null);
    }
  };

  // Readiness scores (porting formula da generate-outreach: presence-based)
  const senderFields = ["ai_contact_name", "ai_company_name", "ai_contact_role", "ai_email_signature"];
  const senderScore = Math.round(
    (senderFields.filter((k) => (draft[k] ?? "").trim().length > 0).length / senderFields.length) * 100
  );
  const kbScore = Math.min(100, Math.round(((draft["ai_knowledge_base"] ?? "").length / 800) * 100));

  if (!userId) return <div className="text-[11px] text-muted-foreground py-4 text-center">Non autenticato</div>;

  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <ScoreBar label="Sender readiness" value={senderScore} />
        <ScoreBar label="KB richness" value={kbScore} />
      </div>

      {settingsQuery.isLoading && (
        <div className="flex items-center justify-center py-4 text-[11px] text-muted-foreground gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Caricamento…
        </div>
      )}

      <div className="space-y-2">
        {AI_KEYS.map(({ key, label, textarea }) => {
          const value = draft[key] ?? "";
          const original = settingsQuery.data?.[key] ?? "";
          const dirty = value !== original;
          return (
            <div key={key} className="rounded border border-border/60 bg-card p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px]">{label}</Label>
                <span className="font-mono text-[11px] text-foreground/70">{key}</span>
              </div>
              {textarea ? (
                <Textarea
                  value={value}
                  onChange={(e) => setDraft((p) => ({ ...p, [key]: e.target.value }))}
                  className="min-h-[80px] text-xs font-mono"
                />
              ) : (
                <Input
                  value={value}
                  onChange={(e) => setDraft((p) => ({ ...p, [key]: e.target.value }))}
                  className="h-7 text-xs"
                />
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground/70">{value.length} char</span>
                {dirty && (
                  <Button size="sm" onClick={() => handleSave(key)} disabled={saving === key} className="h-6 text-[10px]">
                    {saving === key ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                    Salva
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <RegenerateBanner visible={savedAt > 0} message="Mittente aggiornato" onDismiss={() => setSavedAt(0)} />
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-border/60 bg-card p-2">
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value}%</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}
