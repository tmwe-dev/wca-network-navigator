/**
 * RulesConfigurationDialog — wrapper modale per RulesConfiguration.
 * Carica le regole IMAP correnti per gli email selezionati da
 * email_address_rules, mostra il form RulesConfiguration e salva
 * (bulk update) auto_action + auto_action_params per tutti i mittenti.
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { bulkUpdateAutoAction } from "@/data/emailAddressRules";
import {
  RulesConfiguration,
  type RulesConfigValue,
  type ImapAction,
} from "./RulesConfiguration";

interface RulesConfigurationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  senderEmails: string[];
  contextLabel: string;
  onSaved?: () => void;
}

const EMPTY_VALUE: RulesConfigValue = {
  auto_action: "none",
  auto_action_params: {},
};

export function RulesConfigurationDialog({
  open,
  onOpenChange,
  senderEmails,
  contextLabel,
  onSaved,
}: RulesConfigurationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState<RulesConfigValue>(EMPTY_VALUE);
  const [mixed, setMixed] = useState(false);

  // Carica la regola corrente quando si apre.
  useEffect(() => {
    if (!open || senderEmails.length === 0) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Non autenticato");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any;
        const { data, error } = await sb
          .from("email_address_rules")
          .select("auto_action, auto_action_params")
          .eq("user_id", user.id)
          .in("email_address", senderEmails);
        if (error) throw error;

        if (cancelled) return;

        const rows = (data ?? []) as Array<{
          auto_action: string | null;
          auto_action_params: Record<string, unknown> | null;
        }>;

        if (rows.length === 0) {
          setValue(EMPTY_VALUE);
          setMixed(false);
        } else {
          const first = rows[0];
          const action = (first.auto_action ?? "none") as ImapAction;
          const params = (first.auto_action_params ?? {}) as RulesConfigValue["auto_action_params"];
          const allSame = rows.every(
            (r) => (r.auto_action ?? "none") === action,
          );
          setMixed(!allSame);
          setValue({ auto_action: action, auto_action_params: params });
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Errore caricamento regole");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, senderEmails]);

  const handleSave = async (next: RulesConfigValue) => {
    if (senderEmails.length === 0) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");
      await bulkUpdateAutoAction(
        user.id,
        senderEmails,
        next.auto_action,
        next.auto_action_params as Record<string, unknown>,
      );
      toast.success(
        senderEmails.length === 1
          ? "Regola salvata"
          : `Regola salvata per ${senderEmails.length} mittenti`,
      );
      setValue(next);
      setMixed(false);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Regole email</DialogTitle>
          <DialogDescription className="text-xs">
            {senderEmails.length === 1
              ? <>Configura l'azione automatica per <strong>{contextLabel}</strong>.</>
              : <>Configura l'azione automatica per <strong>{senderEmails.length} mittenti</strong>.</>}
            {mixed && (
              <span className="block mt-1 text-warning">
                ⚠️ I mittenti selezionati hanno regole diverse. Salvando le sovrascriverai tutte.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <RulesConfiguration value={value} onChange={handleSave} isSaving={saving} />
        )}
      </DialogContent>
    </Dialog>
  );
}

export default RulesConfigurationDialog;