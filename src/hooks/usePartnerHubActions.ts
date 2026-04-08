import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { useCreateActivities } from "@/hooks/useActivities";
import { useDeepSearch } from "@/hooks/useDeepSearchRunner";

interface UsePartnerHubActionsOptions {
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  filteredPartners: any[];
  selectedId: string | null;
}

export function usePartnerHubActions({
  selectedIds,
  setSelectedIds,
  filteredPartners,
  selectedId,
}: UsePartnerHubActionsOptions) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createActivities = useCreateActivities();
  const deepSearch = useDeepSearch();

  const [sendingToWorkspace, setSendingToWorkspace] = useState(false);
  const [sendingToCockpit, setSendingToCockpit] = useState(false);
  const [aliasGenerating, setAliasGenerating] = useState<"company" | "contact" | null>(null);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredPartners.length && filteredPartners.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPartners.map((p: any) => p.id)));
    }
  }, [selectedIds.size, filteredPartners, setSelectedIds]);

  const handleBulkDeepSearch = useCallback(() => {
    const ids = filteredPartners
      .filter((p: any) => selectedIds.has(p.id))
      .map((p: any) => p.id);
    if (ids.length === 0) return;
    deepSearch.start(ids);
  }, [selectedIds, filteredPartners, deepSearch]);

  const handleStopDeepSearch = useCallback(() => {
    deepSearch.stop();
  }, [deepSearch]);

  const handleBulkEmail = useCallback(() => {
    const ids = Array.from(selectedIds);
    navigate("/email-composer", { state: { partnerIds: ids } });
  }, [selectedIds, navigate]);

  const handleSendToWorkspace = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const selected = filteredPartners.filter((p: any) => ids.includes(p.id));
    const withEmail = selected.filter((p: any) => {
      if (p.email) return true;
      return (p.partner_contacts || []).some((c: any) => c.email);
    });
    const withoutEmail = selected.length - withEmail.length;

    if (withEmail.length === 0) {
      toast.error("Nessun partner selezionato ha un indirizzo email disponibile");
      return;
    }
    if (withoutEmail > 0) {
      toast.warning(`${withoutEmail} partner esclusi perché senza email`);
    }

    setSendingToWorkspace(true);
    try {
      await createActivities.mutateAsync(
        withEmail.map((p: any) => ({
          partner_id: p.id,
          activity_type: "send_email" as const,
          title: "Outreach email",
          priority: "medium",
        }))
      );
      toast.success(`${withEmail.length} attività create — apertura Workspace...`);
      setSelectedIds(new Set());
      navigate("/workspace");
    } catch {
      toast.error("Errore nella creazione delle attività");
    } finally {
      setSendingToWorkspace(false);
    }
  }, [selectedIds, filteredPartners, createActivities, navigate, setSelectedIds]);

  const handleSingleDeepSearch = useCallback(async (partnerId: string) => {
    deepSearch.start([partnerId]);
  }, [deepSearch]);

  const handleUnifiedEmail = useCallback(() => {
    if (selectedIds.size > 0) {
      handleBulkEmail();
    } else if (selectedId) {
      navigate("/email-composer", { state: { partnerIds: [selectedId] } });
    }
  }, [selectedIds, selectedId, navigate, handleBulkEmail]);

  const handleUnifiedWorkspace = useCallback(async () => {
    if (selectedIds.size > 0) {
      handleSendToWorkspace();
    } else if (selectedId) {
      const partner = filteredPartners.find((p: any) => p.id === selectedId);
      const hasEmail = partner?.email || (partner?.partner_contacts || []).some((c: any) => c.email);
      if (!hasEmail) {
        toast.error("Questo partner non ha un indirizzo email disponibile");
        return;
      }
      setSendingToWorkspace(true);
      try {
        await createActivities.mutateAsync([{
          partner_id: selectedId,
          activity_type: "send_email" as const,
          title: "Outreach email",
          priority: "medium",
        }]);
        toast.success("Attività creata — apertura Workspace...");
        navigate("/workspace");
      } catch { toast.error("Errore"); }
      finally { setSendingToWorkspace(false); }
    }
  }, [selectedIds, selectedId, filteredPartners, createActivities, navigate, handleSendToWorkspace]);

  const handleUnifiedCockpit = useCallback(async () => {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : (selectedId ? [selectedId] : []);
    if (ids.length === 0) return;
    setSendingToCockpit(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Non autenticato"); return; }
      const partnerList = filteredPartners.filter((p: any) => ids.includes(p.id));
      const items: any[] = [];
      for (const p of partnerList) {
        const contacts = (p.partner_contacts || []) as any[];
        if (contacts.length > 0) {
          for (const c of contacts) {
            items.push({ source_type: "partner_contact", source_id: c.id, partner_id: p.id, user_id: user.id, status: "queued" });
          }
        } else {
          items.push({ source_type: "partner_contact", source_id: p.id, partner_id: p.id, user_id: user.id, status: "queued" });
        }
      }
      if (items.length > 0) {
        const { error } = await supabase.from("cockpit_queue").upsert(items, { onConflict: "user_id,source_type,source_id", ignoreDuplicates: true });
        if (error) throw error;
        const { addCockpitPreselection } = await import("@/lib/cockpitPreselection");
        addCockpitPreselection(items.map(i => i.source_id));
      }
      toast.success(`${partnerList.length} partner inviati a Cockpit`);
      setSelectedIds(new Set());
      navigate("/outreach?tab=cockpit");
    } catch (e: any) {
      toast.error("Errore: " + (e?.message || "sconosciuto"));
    } finally {
      setSendingToCockpit(false);
    }
  }, [selectedIds, selectedId, filteredPartners, navigate, setSelectedIds]);

  const handleGenerateAliases = useCallback(async (countryCode: string, type: "company" | "contact") => {
    setAliasGenerating(type);
    const toastId = toast.loading("Generazione alias in corso...");
    try {
      await invokeEdge("generate-aliases", {
        body: { countryCode, type },
        context: "usePartnerHubActions.generateAliases",
      });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast.success(`Alias ${type === "company" ? "azienda" : "contatti"} generati con successo`, { id: toastId });
    } catch (e: any) {
      toast.error(`Errore generazione alias: ${e.message || "sconosciuto"}`, { id: toastId });
    } finally {
      setAliasGenerating(null);
    }
  }, [queryClient]);

  return {
    sendingToWorkspace,
    sendingToCockpit,
    aliasGenerating,
    deepSearch,
    handleSelectAll,
    handleBulkDeepSearch,
    handleStopDeepSearch,
    handleBulkEmail,
    handleSendToWorkspace,
    handleSingleDeepSearch,
    handleUnifiedEmail,
    handleUnifiedWorkspace,
    handleUnifiedCockpit,
    handleGenerateAliases,
  };
}
