import { useSocialLinks } from "@/hooks/useSocialLinks";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const platformIcons: Record<string, string> = {
  linkedin: "🔗",
  facebook: "📘",
  instagram: "📸",
  twitter: "🐦",
  whatsapp: "💬",
};

interface SocialLinksProps {
  partnerId: string;
  contactId?: string;
  compact?: boolean;
}

export function SocialLinks({ partnerId, contactId, compact }: SocialLinksProps) {
  const { data: links = [] } = useSocialLinks(partnerId);
  const filtered = contactId
    ? links.filter((l) => l.contact_id === contactId)
    : links.filter((l) => !l.contact_id);

  if (filtered.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", compact && "gap-1")}>
      {filtered.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center gap-1 rounded-lg border bg-secondary/50 hover:bg-secondary transition-colors",
            compact ? "px-1.5 py-0.5 text-xs" : "px-2.5 py-1.5 text-sm"
          )}
        >
          <span>{platformIcons[link.platform] || "🌐"}</span>
          {!compact && <span className="capitalize">{link.platform}</span>}
          <ExternalLink className={cn(compact ? "w-2.5 h-2.5" : "w-3 h-3", "text-muted-foreground")} />
        </a>
      ))}
    </div>
  );
}
