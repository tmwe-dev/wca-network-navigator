import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Mail, MessageCircle, Linkedin, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createActivities } from "@/data/activities";

const EMAIL_GOALS = [
  { value: "first_contact", label: "Primo contatto" },
  { value: "follow_up", label: "Follow-up" },
  { value: "service_proposal", label: "Proposta servizi" },
  { value: "partnership", label: "Partnership" },
  { value: "info_request", label: "Richiesta info" },
  { value: "reactivation", label: "Riattivazione" },
];

interface AgendaBulkBarProps {
  selectedCount: number;
  selectedActivities: Array<{
    id: string;
    partner_id: string | null;
    source_id: string;
    source_type: string;
    selected_contact_id: string | null;
    partners?: { company_name: string; email: string | null } | null;
    selected_contact?: { email: string | null; name: string } | null;
  }>;
  onClear: () => void;
}

export default function AgendaBulkBar({ selectedCount, selectedActivities, onClear }: AgendaBulkBarProps) {
  const [goal, setGoal] = useState("follow_up");
  const [customGoal, setCustomGoal] = useState("");
  const [sending, setSending] = useState(false);

  if (selectedCount === 0) return null;

  const handleBulkAction = async (channel: "email" | "whatsapp" | "linkedin") => {
    const finalGoal = goal === "custom" ? customGoal : EMAIL_GOALS.find(g => g.value === goal)?.label || goal;

    if (!finalGoal.trim()) {
      toast.error("Seleziona un obiettivo");
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      // All bulk operations (2+) go to outreach_queue for confirmation
      const jobs = selectedActivities
        .filter(a => a.partner_id)
        .map((a, idx) => ({
          user_id: user.id,
          partner_id: a.partner_id!,
          channel,
          status: "pending" as const,
          goal: finalGoal,
          source_activity_id: a.id,
          position: idx,
          message_body: null,
          created_at: new Date().toISOString(),
        }));

      if (jobs.length === 0) {
        toast.error("Nessun partner valido nella selezione");
        return;
      }

      // Insert into activities as pending for the bulk action
      const activityInserts = jobs.map(j => ({
        user_id: user.id,
        partner_id: j.partner_id,
        source_id: j.partner_id,
        source_type: "partner",
        activity_type: channel === "email" ? "send_email" as const : "follow_up" as const,
        title: `[Bulk] ${finalGoal} via ${channel}`,
        status: "pending" as const,
        priority: "medium",
      }));

      await createActivities(activityInserts as any);

      toast.success(`${jobs.length} attività create → verifica in "In Uscita"`);
      onClear();
    } catch (err: any) {
      toast.error(err.message || "Errore durante la creazione");
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/20 mb-2"
      >
        <span className="text-xs font-bold text-primary">{selectedCount} selezionati</span>

        <Select value={goal} onValueChange={setGoal}>
          <SelectTrigger className="h-7 w-[140px] text-[10px] bg-background/50 border-border/30">
            <SelectValue placeholder="Obiettivo..." />
          </SelectTrigger>
          <SelectContent>
            {EMAIL_GOALS.map(g => (
              <SelectItem key={g.value} value={g.value} className="text-xs">{g.label}</SelectItem>
            ))}
            <SelectItem value="custom" className="text-xs">Personalizzato...</SelectItem>
          </SelectContent>
        </Select>

        {goal === "custom" && (
          <Input
            value={customGoal}
            onChange={e => setCustomGoal(e.target.value)}
            placeholder="Obiettivo..."
            className="h-7 w-32 text-[10px]"
          />
        )}

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px] gap-1"
          onClick={() => handleBulkAction("email")}
          disabled={sending}
        >
          <Mail className="w-3 h-3" /> Email
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px] gap-1"
          onClick={() => handleBulkAction("whatsapp")}
          disabled={sending}
        >
          <MessageCircle className="w-3 h-3" /> WhatsApp
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px] gap-1"
          onClick={() => handleBulkAction("linkedin")}
          disabled={sending}
        >
          <Linkedin className="w-3 h-3" /> LinkedIn
        </Button>

        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear}>
          <X className="w-3 h-3" />
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}
