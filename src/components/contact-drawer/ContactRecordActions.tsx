import { lazy, Suspense, useState, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Mail, MessageCircle, Linkedin, Phone, Send } from "lucide-react";
import type { UnifiedRecord } from "@/hooks/useContactRecord";
import { toast } from "@/hooks/use-toast";
import { useDirectContactActions } from "@/hooks/useDirectContactActions";

const LinkedInDMDialog = lazy(() => import("@/components/workspace/LinkedInDMDialog"));

interface Props {
  record: UnifiedRecord;
}

export function ContactRecordActions({ record }: Props): ReactElement {
  const [liDmOpen, setLiDmOpen] = useState(false);
  const { handleSendEmail, handleSendWhatsApp, waSending, waAvailable } = useDirectContactActions();

  const handleEmail = () => {
    if (record.email) {
      handleSendEmail({
        email: record.email,
        name: record.contactName || undefined,
        company: record.companyName || undefined,
        partnerId: record.partnerId || undefined,
      });
    } else {
      toast({ title: "Email non disponibile", variant: "destructive" });
    }
  };

  const handleWhatsApp = () => {
    const phone = record.mobile || record.phone;
    if (phone) {
      handleSendWhatsApp({
        phone,
        contactName: record.contactName || undefined,
        companyName: record.companyName || undefined,
        sourceType: record.sourceType as any || "partner",
        sourceId: record.sourceId || undefined,
        partnerId: record.partnerId || undefined,
      });
    } else {
      toast({ title: "Numero non disponibile", variant: "destructive" });
    }
  };

  const handleCall = () => {
    const phone = record.phone || record.mobile;
    if (phone) {
      window.open(`tel:${phone.replace(/[^0-9+]/g, "")}`, "_blank");
    } else {
      toast({ title: "Numero non disponibile", variant: "destructive" });
    }
  };

  const handleLinkedIn = () => {
    if (record.linkedinUrl) {
      setLiDmOpen(true);
    } else {
      toast({ title: "LinkedIn non disponibile", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Send className="w-3.5 h-3.5 text-primary" />
        Azioni Comunicazione
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-xs gap-2 justify-start"
          onClick={handleEmail}
          disabled={!record.email}
        >
          <Mail className="w-4 h-4 text-primary" />
          <div className="text-left min-w-0">
            <div className="font-medium">Email</div>
            <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">{record.email || "—"}</div>
          </div>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-9 text-xs gap-2 justify-start"
          onClick={handleWhatsApp}
          disabled={!record.mobile && !record.phone}
        >
          <MessageCircle className="w-4 h-4 text-emerald-500" />
          <div className="text-left min-w-0">
            <div className="font-medium">WhatsApp</div>
            <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">{record.mobile || record.phone || "—"}</div>
          </div>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-9 text-xs gap-2 justify-start"
          onClick={handleLinkedIn}
          disabled={!record.linkedinUrl}
        >
          <Linkedin className="w-4 h-4 text-[hsl(210,80%,55%)]" />
          <div className="text-left min-w-0">
            <div className="font-medium">LinkedIn DM</div>
            <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">{record.linkedinUrl ? "Apri" : "—"}</div>
          </div>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-9 text-xs gap-2 justify-start"
          onClick={handleCall}
          disabled={!record.phone && !record.mobile}
        >
          <Phone className="w-4 h-4 text-chart-3" />
          <div className="text-left min-w-0">
            <div className="font-medium">Chiamata</div>
            <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">{record.phone || record.mobile || "—"}</div>
          </div>
        </Button>
      </div>

      {liDmOpen && record.linkedinUrl && (
        <Suspense fallback={null}>
          <LinkedInDMDialog
            open={liDmOpen}
            onOpenChange={setLiDmOpen}
            profileUrl={record.linkedinUrl}
            contactName={record.contactName}
            companyName={record.companyName}
          />
        </Suspense>
      )}
    </div>
  );
}