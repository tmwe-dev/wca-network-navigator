/**
 * CompanyAvatar — Logo azienda da favicon dominio email.
 * Fallback: iniziale colorata derivata in modo deterministico dal nome.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CompanyAvatarProps {
  readonly companyName?: string | null;
  readonly email?: string | null;
  readonly size?: "sm" | "md";
  readonly className?: string;
}

const COLOR_CLASSES = [
  "bg-primary/15 text-primary",
  "bg-emerald-500/15 text-emerald-500",
  "bg-blue-500/15 text-blue-400",
  "bg-amber-500/15 text-amber-500",
  "bg-purple-500/15 text-purple-400",
  "bg-rose-500/15 text-rose-400",
  "bg-cyan-500/15 text-cyan-400",
];

function pickColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLOR_CLASSES[h % COLOR_CLASSES.length];
}

function getDomain(email?: string | null): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at < 0) return null;
  const dom = email.slice(at + 1).toLowerCase();
  // skip free providers — favicon di gmail.com non rappresenta l'azienda
  if (/^(gmail|yahoo|hotmail|outlook|icloud|live|me|msn|aol|gmx|protonmail|proton)\./.test(dom + ".")) return null;
  if (["gmail.com","yahoo.com","hotmail.com","outlook.com","icloud.com","live.com","me.com","msn.com","aol.com"].includes(dom)) return null;
  return dom;
}

export function CompanyAvatar({ companyName, email, size = "md", className }: CompanyAvatarProps) {
  const [errored, setErrored] = useState(false);
  const domain = getDomain(email);
  const initial = (companyName || email || "?").trim().charAt(0).toUpperCase();
  const sizeCls = size === "sm" ? "w-7 h-7 text-[11px]" : "w-9 h-9 text-sm";
  const color = pickColor(companyName || email || "x");

  if (domain && !errored) {
    return (
      <div className={cn("rounded-md overflow-hidden bg-muted/30 flex items-center justify-center shrink-0", sizeCls, className)}>
        <img
          src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
          alt=""
          loading="lazy"
          onError={() => setErrored(true)}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className={cn("rounded-md flex items-center justify-center shrink-0 font-bold", sizeCls, color, className)}>
      {initial}
    </div>
  );
}
