/**
 * Derive a human-friendly display name from an email address.
 *
 * Business domains  → domain name (capitalized), optionally prefixed by person name
 * Personal domains  → local part formatted as a name
 */

const PERSONAL_DOMAINS = new Set([
  'gmail', 'googlemail', 'yahoo', 'hotmail', 'outlook', 'live',
  'icloud', 'me', 'mac', 'aol', 'protonmail', 'proton', 'mail',
  'yandex', 'zoho', 'gmx', 'fastmail', 'tutanota', 'pm',
  'msn', 'libero', 'virgilio', 'alice', 'tin', 'tiscali',
]);

const ROLE_KEYWORDS = new Set([
  'info', 'support', 'help', 'admin', 'contact', 'sales', 'marketing',
  'noreply', 'no-reply', 'no_reply', 'notifications', 'newsletter',
  'newsletters', 'billing', 'invoice', 'team', 'hello', 'office',
  'service', 'postmaster', 'webmaster', 'abuse', 'security',
  'hr', 'jobs', 'careers', 'press', 'media', 'feedback',
  'reply', 'bounce', 'mailer-daemon', 'daemon', 'system',
  'broadcast', 'alerts', 'updates', 'news', 'events',
  'noreply-linkedin', 'newsletters-noreply',
]);

/** Well-known brand overrides (lowercase domain base → display) */
const BRAND_MAP: Record<string, string> = {
  linkedin: 'LinkedIn',
  tmwe: 'TMWE',
  tmwi: 'TMWI',
  github: 'GitHub',
  youtube: 'YouTube',
  wordpress: 'WordPress',
  stackoverflow: 'StackOverflow',
  icloud: 'iCloud',
  mailchimp: 'Mailchimp',
  hubspot: 'HubSpot',
  salesforce: 'Salesforce',
  trello: 'Trello',
  atlassian: 'Atlassian',
  bitbucket: 'Bitbucket',
  dropbox: 'Dropbox',
  figma: 'Figma',
  stripe: 'Stripe',
  paypal: 'PayPal',
  openai: 'OpenAI',
  vercel: 'Vercel',
  netlify: 'Netlify',
  cloudflare: 'Cloudflare',
  godaddy: 'GoDaddy',
  squarespace: 'Squarespace',
  wix: 'Wix',
  shopify: 'Shopify',
  twilio: 'Twilio',
  sendgrid: 'SendGrid',
  intercom: 'Intercom',
  slack: 'Slack',
  notion: 'Notion',
  asana: 'Asana',
  monday: 'Monday',
  jira: 'Jira',
  zoom: 'Zoom',
  calendly: 'Calendly',
  typeform: 'Typeform',
  airtable: 'Airtable',
  zapier: 'Zapier',
  wca: 'WCA',
  wcaworld: 'WCA World',
};

function capitalize(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Split camelCase or concatenated words: "wcabroadcast" → "wca broadcast" */
function splitCompound(str: string): string {
  // Split on camelCase boundaries
  let result = str.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Split on transitions from uppercase run to lowercase: "WCABroadcast" → "WCA Broadcast"
  result = result.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  // Split on hyphens and underscores
  result = result.replace(/[-_]+/g, ' ');
  return result.trim();
}

function formatLocalPartAsName(localPart: string): string {
  return localPart
    .replace(/[._-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(capitalize)
    .join(' ');
}

function getDomainBase(domain: string): string {
  // Remove TLD(s): "vercel.com" → "vercel", "co.uk" → handled
  const parts = domain.split('.');
  if (parts.length <= 1) return parts[0] || domain;
  // For domains like foo.co.uk, foo.com.br — take first part
  return parts[0];
}

function isPersonalDomain(domainBase: string): boolean {
  return PERSONAL_DOMAINS.has(domainBase.toLowerCase());
}

function looksLikePersonName(localPart: string): boolean {
  // Must contain a separator (. or _ or -) between two alpha segments
  const segments = localPart.split(/[._-]+/).filter(s => s.length > 0);
  if (segments.length < 2) return false;
  // Each segment should be alphabetic and reasonable length (2-20 chars)
  const allAlpha = segments.every(s => /^[a-zA-Z]{2,20}$/.test(s));
  if (!allAlpha) return false;
  // The full local part should not be a role keyword
  const normalized = localPart.replace(/[._-]+/g, '-').toLowerCase();
  if (ROLE_KEYWORDS.has(normalized)) return false;
  // Individual segments shouldn't be role keywords
  return !segments.some(s => ROLE_KEYWORDS.has(s.toLowerCase()));
}

function formatDomainAsCompany(domainBase: string): string {
  const lower = domainBase.toLowerCase();
  if (BRAND_MAP[lower]) return BRAND_MAP[lower];

  const split = splitCompound(domainBase);
  return split
    .split(/\s+/)
    .filter(Boolean)
    .map(w => {
      const wLower = w.toLowerCase();
      if (BRAND_MAP[wLower]) return BRAND_MAP[wLower];
      // Short acronyms (2-3 chars all alpha) → uppercase
      if (/^[a-zA-Z]{2,3}$/.test(w)) return w.toUpperCase();
      return capitalize(w);
    })
    .join(' ');
}

export function deriveSenderDisplayName(email: string): string {
  if (!email || !email.includes('@')) return email || '';

  const [localPart, ...domainParts] = email.split('@');
  const domain = domainParts.join('@').toLowerCase();
  const domainBase = getDomainBase(domain);

  // Personal domain → format local part as person name
  if (isPersonalDomain(domainBase)) {
    return formatLocalPartAsName(localPart);
  }

  // Business domain
  const companyName = formatDomainAsCompany(domainBase);

  // If local part looks like a person name, show "Person · Company"
  if (looksLikePersonName(localPart)) {
    const personName = formatLocalPartAsName(localPart);
    return `${personName} · ${companyName}`;
  }

  return companyName;
}
