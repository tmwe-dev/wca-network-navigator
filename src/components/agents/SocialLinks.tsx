import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSocialLinks, useUpsertSocialLink, useDeleteSocialLink, SocialLink } from "@/hooks/useSocialLinks";
import { Linkedin, Facebook, Instagram, Twitter, MessageCircle, Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const PLATFORMS = [
  { value: "linkedin", label: "LinkedIn", icon: Linkedin, color: "text-blue-600" },
  { value: "facebook", label: "Facebook", icon: Facebook, color: "text-blue-500" },
  { value: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-500" },
  { value: "twitter", label: "Twitter/X", icon: Twitter, color: "text-foreground" },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-green-500" },
];

function getPlatformInfo(platform: string) {
  return PLATFORMS.find((p) => p.value === platform) || PLATFORMS[0];
}

interface SocialLinksProps {
  partnerId: string;
  contactId?: string | null;
  compact?: boolean;
}

export function SocialLinks({ partnerId, contactId, compact }: SocialLinksProps) {
  const { data: links = [] } = useSocialLinks(partnerId);
  const upsert = useUpsertSocialLink();
  const deleteMutation = useDeleteSocialLink();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [platform, setPlatform] = useState<"linkedin" | "facebook" | "instagram" | "twitter" | "whatsapp">("linkedin");
  const [url, setUrl] = useState("");

  const filtered = contactId !== undefined
    ? links.filter((l) => l.contact_id === contactId)
    : links.filter((l) => !l.contact_id);

  const handleAdd = async () => {
    if (!url.trim()) return;
    try {
      await upsert.mutateAsync({
        partner_id: partnerId,
        contact_id: contactId || null,
        platform,
        url: url.trim(),
      });
      toast.success("Link social aggiunto");
      setDialogOpen(false);
      setUrl("");
    } catch {
      toast.error("Errore nell'aggiunta del link");
    }
  };

  const handleDelete = async (link: SocialLink) => {
    try {
      await deleteMutation.mutateAsync({ id: link.id, partnerId });
      toast.success("Link rimosso");
    } catch {
      toast.error("Errore nella rimozione");
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {filtered.map((link) => {
          const info = getPlatformInfo(link.platform);
          const Icon = info.icon;
          return (
            <a key={link.id} href={link.url} target="_blank" rel="noopener" title={info.label}>
              <Icon className={`w-4 h-4 ${info.color}`} />
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {filtered.map((link) => {
          const info = getPlatformInfo(link.platform);
          const Icon = info.icon;
          return (
            <div key={link.id} className="flex items-center gap-1 group">
              <a
                href={link.url}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-1.5 px-2 py-1 rounded-md border hover:bg-accent transition-colors text-sm"
              >
                <Icon className={`w-4 h-4 ${info.color}`} />
                <span>{info.label}</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </a>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDelete(link)}
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </div>
          );
        })}
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setDialogOpen(true)}>
          <Plus className="w-3 h-3 mr-1" />
          Social
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Aggiungi Link Social</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={platform} onValueChange={(v) => setPlatform(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="flex items-center gap-2">
                      <p.icon className={`w-4 h-4 ${p.color}`} />
                      {p.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} disabled={!url.trim() || upsert.isPending}>
              Aggiungi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
