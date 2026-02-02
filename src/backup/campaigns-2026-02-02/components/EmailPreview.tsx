import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Send, Users, Globe, Copy, Check } from "lucide-react";
import { getCountryFlag } from "@/lib/countries";
import { toast } from "sonner";

interface Partner {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  country_name: string;
  email: string | null;
}

interface EmailPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: Partner[];
}

export function EmailPreview({ open, onOpenChange, recipients }: EmailPreviewProps) {
  const [subject, setSubject] = useState("WCA Network Update - February 2026");
  const [body, setBody] = useState(`Dear Partner,

We hope this message finds you well. We are reaching out to share important updates from the WCA Network.

[Your message here]

Best regards,
WCA Partners CRM Team`);
  const [copied, setCopied] = useState(false);

  const recipientsWithEmail = recipients.filter(r => r.email);
  const uniqueCountries = new Set(recipientsWithEmail.map(r => r.country_name)).size;

  const handleCopyEmails = () => {
    const emails = recipientsWithEmail.map(r => r.email).join("; ");
    navigator.clipboard.writeText(emails);
    setCopied(true);
    toast.success("Indirizzi email copiati negli appunti");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = () => {
    // In a real app, this would send via an email service
    toast.success(`Campagna email avviata per ${recipientsWithEmail.length} destinatari`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Anteprima Email
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
          {/* Left: Email Composer */}
          <div className="space-y-4 overflow-auto pr-2">
            <div>
              <Label htmlFor="subject">Oggetto</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div className="flex-1">
              <Label htmlFor="body">Corpo del messaggio</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="mt-1.5 min-h-[300px] font-mono text-sm"
              />
            </div>

            {/* Quick templates */}
            <div>
              <Label className="text-muted-foreground">Template rapidi</Label>
              <div className="flex gap-2 mt-1.5 flex-wrap">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setBody(`Dear Partner,

We are pleased to announce our new rate updates for Q1 2026. Please find attached our updated pricing schedule.

If you have any questions, please don't hesitate to contact us.

Best regards,
WCA Partners CRM Team`)}
                >
                  Rate Update
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setBody(`Dear Partner,

We are excited to invite you to our upcoming WCA Network Annual Conference.

Date: [Date]
Location: [Location]

Please RSVP by [deadline].

Best regards,
WCA Partners CRM Team`)}
                >
                  Event Invitation
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setBody(`Dear Partner,

This is a friendly reminder that your WCA Network membership is due for renewal.

Please contact us to discuss renewal options.

Best regards,
WCA Partners CRM Team`)}
                >
                  Renewal Reminder
                </Button>
              </div>
            </div>
          </div>

          {/* Right: Recipients */}
          <div className="border rounded-lg flex flex-col overflow-hidden">
            <div className="p-4 border-b bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Destinatari</h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleCopyEmails}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      Copiato!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copia email
                    </>
                  )}
                </Button>
              </div>
              
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    <strong>{recipientsWithEmail.length}</strong> destinatari
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    <strong>{uniqueCountries}</strong> paesi
                  </span>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2">
                {recipientsWithEmail.map((recipient) => (
                  <div 
                    key={recipient.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50"
                  >
                    <span className="text-lg">{getCountryFlag(recipient.country_code)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{recipient.company_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{recipient.email}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {recipient.city}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <Separator />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleSend}>
            <Send className="w-4 h-4 mr-2" />
            Invia Campagna ({recipientsWithEmail.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
