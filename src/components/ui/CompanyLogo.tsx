import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

/** Extract domain from an email address string (handles "Name <email>" format) */
export function extractDomainFromEmail(from: string): string | null {
  if (!from) return null;
  const emailMatch = from.match(/@([a-zA-Z0-9.-]+)/);
  return emailMatch ? emailMatch[1].toLowerCase() : null;
}

/** Known personal email providers — no company logo available */
const PERSONAL_PROVIDERS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "protonmail.com",
  "fastmail.com", "zoho.com", "mail.com", "yandex.com", "gmx.com",
  "libero.it", "virgilio.it", "alice.it", "tin.it", "tiscali.it",
  "yahoo.it", "hotmail.it", "outlook.it", "pec.it",
]);

export function isPersonalEmail(domain: string): boolean {
  return PERSONAL_PROVIDERS.has(domain);
}

/** Country TLD → flag emoji mapping */
const TLD_TO_FLAG: Record<string, string> = {
  ae: "🇦🇪", ar: "🇦🇷", at: "🇦🇹", au: "🇦🇺", be: "🇧🇪", bg: "🇧🇬", br: "🇧🇷",
  ca: "🇨🇦", ch: "🇨🇭", cl: "🇨🇱", cn: "🇨🇳", co: "🇨🇴", cz: "🇨🇿", de: "🇩🇪",
  dk: "🇩🇰", ee: "🇪🇪", eg: "🇪🇬", es: "🇪🇸", fi: "🇫🇮", fr: "🇫🇷", gb: "🇬🇧",
  gr: "🇬🇷", hk: "🇭🇰", hr: "🇭🇷", hu: "🇭🇺", id: "🇮🇩", ie: "🇮🇪", il: "🇮🇱",
  in: "🇮🇳", is: "🇮🇸", it: "🇮🇹", jp: "🇯🇵", ke: "🇰🇪", kr: "🇰🇷", kw: "🇰🇼",
  lt: "🇱🇹", lu: "🇱🇺", lv: "🇱🇻", ma: "🇲🇦", mx: "🇲🇽", my: "🇲🇾", ng: "🇳🇬",
  nl: "🇳🇱", no: "🇳🇴", nz: "🇳🇿", om: "🇴🇲", pe: "🇵🇪", ph: "🇵🇭", pk: "🇵🇰",
  pl: "🇵🇱", pt: "🇵🇹", qa: "🇶🇦", ro: "🇷🇴", rs: "🇷🇸", ru: "🇷🇺", sa: "🇸🇦",
  se: "🇸🇪", sg: "🇸🇬", si: "🇸🇮", sk: "🇸🇰", th: "🇹🇭", tn: "🇹🇳", tr: "🇹🇷",
  tw: "🇹🇼", ua: "🇺🇦", uk: "🇬🇧", us: "🇺🇸", uy: "🇺🇾", vn: "🇻🇳", za: "🇿🇦",
};

export function getFlagFromDomain(domain: string): string | null {
  if (!domain) return null;
  const parts = domain.split(".");
  const tld = parts[parts.length - 1];
  return TLD_TO_FLAG[tld] || null;
}

const logoCache = new Map<string, "clearbit" | "none">();

interface CompanyLogoProps {
  domain?: string | null;
  email?: string | null;
  name?: string;
  size?: number;
  className?: string;
  showFlag?: boolean;
}

/**
 * Displays a company logo from Clearbit with Google Favicon fallback.
 * Shows nothing (empty space) when no logo is found — never a white box.
 * Optionally shows a country flag based on the email TLD.
 */
export function CompanyLogo({ domain: domainProp, email, name, size = 32, className, showFlag = false }: CompanyLogoProps) {
  const domain = domainProp || (email ? extractDomainFromEmail(email) : null);

  const cached = domain ? logoCache.get(domain) : undefined;
  const [src, setSrc] = useState<"clearbit" | "none">(cached || "clearbit");

  useEffect(() => {
    if (domain) {
      const c = logoCache.get(domain);
      if (c) setSrc(c);
      else setSrc("clearbit");
    }
  }, [domain]);

  const flag = showFlag && domain ? getFlagFromDomain(domain) : null;

  if (!domain || isPersonalEmail(domain)) {
    return (
      <div className={cn("relative flex-shrink-0", className)} style={{ width: size, height: size }}>
        <InitialsAvatar name={name || domain || "?"} size={size} />
        {flag && <FlagBadge flag={flag} size={size} />}
      </div>
    );
  }

  const clearbitUrl = `https://logo.clearbit.com/${domain}`;
  const googleUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=${Math.min(size * 2, 256)}`;

  if (src === "none") {
    // No logo found — show empty space, no white box
    return (
      <div className={cn("relative flex-shrink-0", className)} style={{ width: size, height: size }}>
        <div
          className="rounded flex items-center justify-center"
          style={{ width: size, height: size }}
        />
        {flag && <FlagBadge flag={flag} size={size} />}
      </div>
    );
  }

  const handleError = () => {
    if (src === "clearbit") {
      setSrc("google");
    } else {
      setSrc("none");
      logoCache.set(domain, "none");
    }
  };

  const handleLoad = () => {
    logoCache.set(domain, src);
  };

  return (
    <div className={cn("relative flex-shrink-0", className)} style={{ width: size, height: size }}>
      <img
        src={src === "clearbit" ? clearbitUrl : googleUrl}
        alt={domain}
        width={size}
        height={size}
        className="rounded object-contain"
        onError={handleError}
        onLoad={handleLoad}
        loading="lazy"
        style={{ maxWidth: size, maxHeight: size }}
      />
      {flag && <FlagBadge flag={flag} size={size} />}
    </div>
  );
}

function FlagBadge({ flag, size }: { flag: string; size: number }) {
  const flagSize = Math.max(10, Math.round(size * 0.4));
  return (
    <span
      className="absolute -bottom-0.5 -left-0.5 leading-none"
      style={{ fontSize: flagSize }}
    >
      {flag}
    </span>
  );
}

function InitialsAvatar({ name, size, className }: { name: string; size: number; className?: string }) {
  const initials = name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || "")
    .join("");

  return (
    <div
      className={cn(
        "rounded bg-muted flex items-center justify-center text-muted-foreground font-semibold",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials || "?"}
    </div>
  );
}
