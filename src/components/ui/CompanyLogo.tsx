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

/**
 * Global in-memory logo cache.
 * Maps domain -> resolved source ("clearbit" | "google" | "none").
 * Survives across re-renders and component instances within a session.
 */
const logoCache = new Map<string, "clearbit" | "google" | "none">();

interface CompanyLogoProps {
  domain?: string | null;
  email?: string | null;
  name?: string;
  size?: number;
  className?: string;
}

/**
 * Displays a company logo from Clearbit with Google Favicon fallback.
 * Shows initials as final fallback.
 * Results are cached globally so each domain is resolved only once per session.
 */
export function CompanyLogo({ domain: domainProp, email, name, size = 32, className }: CompanyLogoProps) {
  const domain = domainProp || (email ? extractDomainFromEmail(email) : null);

  // Start from cache if available, otherwise try clearbit first
  const cached = domain ? logoCache.get(domain) : undefined;
  const [src, setSrc] = useState<"clearbit" | "google" | "none">(cached || "clearbit");

  // Sync with cache when domain changes
  useEffect(() => {
    if (domain) {
      const c = logoCache.get(domain);
      if (c) setSrc(c);
      else setSrc("clearbit");
    }
  }, [domain]);

  if (!domain || isPersonalEmail(domain)) {
    return <InitialsAvatar name={name || domain || "?"} size={size} className={className} />;
  }

  const clearbitUrl = `https://logo.clearbit.com/${domain}`;
  const googleUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=${Math.min(size * 2, 256)}`;

  if (src === "none") {
    return <InitialsAvatar name={name || domain} size={size} className={className} />;
  }

  const handleError = () => {
    if (src === "clearbit") {
      setSrc("google");
      // Don't cache yet — google might also fail
    } else {
      setSrc("none");
      logoCache.set(domain, "none");
    }
  };

  const handleLoad = () => {
    // Cache the successful source so we never retry this domain
    logoCache.set(domain, src);
  };

  return (
    <img
      src={src === "clearbit" ? clearbitUrl : googleUrl}
      alt={domain}
      width={size}
      height={size}
      className={cn("rounded object-contain bg-white", className)}
      onError={handleError}
      onLoad={handleLoad}
      loading="lazy"
    />
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
