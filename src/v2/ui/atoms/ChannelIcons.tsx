/**
 * ChannelIcons — riga compatta con icone canali disponibili.
 *
 * Stesso pattern visivo usato in `ContactSubCard` (BCA) per dare un
 * feedback immediato sui canali di contatto disponibili (mail / WA /
 * LinkedIn / phone / website).
 */
import * as React from "react";
import { Mail, MessageCircle, Linkedin, Phone, Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChannelIconsProps {
  email?: boolean;
  whatsapp?: boolean;
  linkedin?: boolean;
  phone?: boolean;
  website?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export function ChannelIcons({
  email,
  whatsapp,
  linkedin,
  phone,
  website,
  className,
  size = "sm",
}: ChannelIconsProps): React.ReactElement | null {
  const sz = size === "md" ? "w-3.5 h-3.5" : "w-3 h-3";
  const items = [
    email && <Mail key="mail" className={cn(sz, "text-primary/70")} aria-label="Email" />,
    whatsapp && (
      <MessageCircle key="wa" className={cn(sz, "text-emerald-500/80")} aria-label="WhatsApp" />
    ),
    linkedin && (
      <Linkedin key="li" className={cn(sz, "text-sky-500/80")} aria-label="LinkedIn" />
    ),
    phone && !email && !whatsapp && (
      <Phone key="phone" className={cn(sz, "text-muted-foreground/70")} aria-label="Telefono" />
    ),
    website && (
      <Globe2 key="web" className={cn(sz, "text-emerald-400/80")} aria-label="Website" />
    ),
  ].filter(Boolean);

  if (items.length === 0) return null;
  return (
    <div className={cn("flex items-center justify-start flex-wrap gap-1", className)}>{items}</div>
  );
}

export default ChannelIcons;