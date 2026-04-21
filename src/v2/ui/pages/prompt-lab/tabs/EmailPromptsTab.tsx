/**
 * EmailPromptsTab — sub-tabs: Tipi (app_settings + defaults), Global prompts, Address rules.
 */
import { useCallback, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SplitBlockEditor } from "../SplitBlockEditor";
import { usePromptLabBlocks } from "../hooks/usePromptLabBlocks";
import { useLabAgent } from "../hooks/useLabAgent";
import type { Block } from "../types";
import { useAuth } from "@/providers/AuthProvider";
import { getAppSetting, upsertAppSetting } from "@/data/appSettings";
import { findEmailPromptsByScope, updateEmailPrompt } from "@/data/emailPrompts";
import { findEmailAddressRules, updateEmailAddressRule } from "@/data/emailAddressRules";
import { logSupervisorAudit } from "@/data/supervisorAuditLog";
import { DEFAULT_EMAIL_TYPES } from "@/data/defaultEmailTypes";
import { toast } from "sonner";

const TYPES_KEY = "email_oracle_types";

function EmailTypesSection() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [saving, setSaving] = useState<string | null>(null);
  const lab = useLabAgent();

  const state = usePromptLabBlocks(async (): Promise<Block[]> => {
    if (!userId) return [];
    const raw = await getAppSetting(TYPES_KEY, userId);
    let stored: Array<{ id: string; name?: string; prompt?: string }> = [];
    if (raw) {
      try { stored = JSON.parse(raw); } catch { stored = []; }
    }
    const merged = DEFAULT_EMAIL_TYPES.map((t) => {
      const hit = stored.find((s) => s.id === t.id);
      return { id: t.id, name: hit?.name ?? t.name, prompt: hit?.prompt ?? t.prompt };
    });
    return merged.map<Block>((t) => ({
      id: t.id,
      label: t.name,
      content: t.prompt,
      source: { kind: "app_setting", key: TYPES_KEY },
      dirty: false,
    }));
  }, [userId]);

  const saveAll = useCallback(async () => {
    if (!userId) return;
    setSaving("__all__");
    try {
      const payload = state.blocks.map((b) => ({ id: b.id, name: b.label, prompt: b.content }));
      await upsertAppSetting(userId, TYPES_KEY, JSON.stringify(payload));
      await logSupervisorAudit({ action: "prompt_lab_save", target_table: "app_settings", target_id: TYPES_KEY });
      state.blocks.forEach((b) => state.markClean(b.id));
      toast.success("Email types salvati");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(null);
    }
  }, [state, userId]);

  const onImprove = useCallback(async (id: string) => {
    const b = state.blocks.find((x) => x.id === id);
    if (!b) return;
    setSaving(id);
    try {
      const improved = await lab.improveBlock({ block: b, tabLabel: "Email Types" });
      state.setImproved(id, improved);
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(null); }
  }, [lab, state]);

  if (state.loading) return <div className="p-4 text-sm text-muted-foreground">Caricamento...</div>;
  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      <div className="flex justify-end flex-shrink-0">
        <Button size="sm" onClick={saveAll} disabled={saving === "__all__"}>
          {saving === "__all__" ? "Salvo..." : "Salva tutti i tipi"}
        </Button>
      </div>
      <div className="flex-1 min-h-0">
        <SplitBlockEditor
          blocks={state.blocks}
          onChange={state.updateContent}
          onAccept={state.acceptImproved}
          onDiscard={state.discardImproved}
          onImprove={onImprove}
          saving={saving}
        />
      </div>
    </div>
  );
}

function GlobalPromptsSection() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [saving, setSaving] = useState<string | null>(null);
  const lab = useLabAgent();

  const state = usePromptLabBlocks(async (): Promise<Block[]> => {
    if (!userId) return [];
    const list = await findEmailPromptsByScope(userId, "global");
    return list.map<Block>((p) => ({
      id: p.id,
      label: p.title,
      content: p.instructions ?? "",
      source: { kind: "email_prompt", id: p.id, field: "instructions" },
      dirty: false,
    }));
  }, [userId]);

  const onSave = useCallback(async (id: string) => {
    const b = state.blocks.find((x) => x.id === id);
    if (!b || b.source.kind !== "email_prompt") return;
    setSaving(id);
    try {
      await updateEmailPrompt(b.source.id, { instructions: b.content });
      await logSupervisorAudit({ action: "prompt_lab_save", target_table: "email_prompts", target_id: b.source.id });
      state.markClean(id);
      toast.success("Global prompt salvato");
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(null); }
  }, [state]);

  const onImprove = useCallback(async (id: string) => {
    const b = state.blocks.find((x) => x.id === id);
    if (!b) return;
    setSaving(id);
    try {
      const improved = await lab.improveBlock({ block: b, tabLabel: "Email Global" });
      state.setImproved(id, improved);
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(null); }
  }, [lab, state]);

  if (state.loading) return <div className="p-4 text-sm text-muted-foreground">Caricamento...</div>;
  if (state.blocks.length === 0)
    return <div className="p-4 text-sm text-muted-foreground">Nessun prompt globale configurato.</div>;
  return (
    <div className="h-full min-h-0">
      <SplitBlockEditor
        blocks={state.blocks}
        onChange={state.updateContent}
        onAccept={state.acceptImproved}
        onDiscard={state.discardImproved}
        onImprove={onImprove}
        onSave={onSave}
        saving={saving}
      />
    </div>
  );
}

function AddressRulesSection() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [saving, setSaving] = useState<string | null>(null);
  const lab = useLabAgent();

  const state = usePromptLabBlocks(async (): Promise<Block[]> => {
    if (!userId) return [];
    const list = await findEmailAddressRules(userId);
    return list.flatMap<Block>((r) => [
      {
        id: `${r.id}::custom_prompt`,
        label: `${r.email_address} — Prompt`,
        content: r.custom_prompt ?? "",
        source: { kind: "email_address_rule", id: r.id, field: "custom_prompt" },
        dirty: false,
      },
      {
        id: `${r.id}::notes`,
        label: `${r.email_address} — Note`,
        content: r.notes ?? "",
        source: { kind: "email_address_rule", id: r.id, field: "notes" },
        dirty: false,
      },
    ]);
  }, [userId]);

  const onSave = useCallback(async (id: string) => {
    const b = state.blocks.find((x) => x.id === id);
    if (!b || b.source.kind !== "email_address_rule") return;
    setSaving(id);
    try {
      await updateEmailAddressRule(b.source.id, { [b.source.field]: b.content });
      await logSupervisorAudit({ action: "prompt_lab_save", target_table: "email_address_rules", target_id: b.source.id });
      state.markClean(id);
      toast.success("Regola salvata");
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(null); }
  }, [state]);

  const onImprove = useCallback(async (id: string) => {
    const b = state.blocks.find((x) => x.id === id);
    if (!b) return;
    setSaving(id);
    try {
      const improved = await lab.improveBlock({ block: b, tabLabel: "Address Rules" });
      state.setImproved(id, improved);
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(null); }
  }, [lab, state]);

  if (state.loading) return <div className="p-4 text-sm text-muted-foreground">Caricamento...</div>;
  if (state.blocks.length === 0)
    return <div className="p-4 text-sm text-muted-foreground">Nessuna regola indirizzo configurata.</div>;
  return (
    <div className="h-full min-h-0">
      <SplitBlockEditor
        blocks={state.blocks}
        onChange={state.updateContent}
        onAccept={state.acceptImproved}
        onDiscard={state.discardImproved}
        onImprove={onImprove}
        onSave={onSave}
        saving={saving}
      />
    </div>
  );
}

export function EmailPromptsTab() {
  return (
    <Tabs defaultValue="types" className="w-full flex flex-col h-full min-h-0">
      <TabsList className="flex-shrink-0 self-start">
        <TabsTrigger value="types">Tipi</TabsTrigger>
        <TabsTrigger value="global">Global Prompts</TabsTrigger>
        <TabsTrigger value="rules">Address Rules</TabsTrigger>
      </TabsList>
      <TabsContent value="types" className="mt-2 flex-1 min-h-0 data-[state=active]:flex"><EmailTypesSection /></TabsContent>
      <TabsContent value="global" className="mt-2 flex-1 min-h-0 data-[state=active]:flex"><GlobalPromptsSection /></TabsContent>
      <TabsContent value="rules" className="mt-2 flex-1 min-h-0 data-[state=active]:flex"><AddressRulesSection /></TabsContent>
    </Tabs>
  );
}