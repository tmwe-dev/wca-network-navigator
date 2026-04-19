/**
 * lexicalNormalizer — Light domain-specific typo/term normalization.
 *
 * Goal: tolerate STT errors and colloquial variants without rigidifying the AI.
 * Applied BEFORE planner & tool-resolution.
 *
 * Rules are conservative: only safe word-boundary replacements, case-insensitive.
 */

interface Rule {
  /** Match as case-insensitive word/phrase */
  readonly pattern: RegExp;
  readonly replace: string;
}

const RULES: readonly Rule[] = [
  // STT typos for "partner"
  { pattern: /\bpane\b/gi, replace: "partner" },
  { pattern: /\bpani\b/gi, replace: "partner" },
  { pattern: /\bpartnera\b/gi, replace: "partner" },
  { pattern: /\bpartener\b/gi, replace: "partner" },
  { pattern: /\bpatner\b/gi, replace: "partner" },
  { pattern: /\bpatners\b/gi, replace: "partner" },
  // STT typos for "contatti"
  { pattern: /\bcontati\b/gi, replace: "contatti" },
  // STT typos for "prospect"
  { pattern: /\bprospetto\b/gi, replace: "prospect" },
  { pattern: /\bprospetti\b/gi, replace: "prospect" },
  // Country name → keep ITALIAN form (planner already maps to ISO-2)
  // We do NOT replace "stati uniti" with "US" here, the planner does that.
  // City normalization (light)
  { pattern: /\bnyc\b/gi, replace: "New York" },
  { pattern: /\bnew york city\b/gi, replace: "New York" },
  { pattern: /\bla\s+city\b/gi, replace: "Los Angeles" },
];

export function normalizePrompt(input: string): string {
  let out = input;
  for (const rule of RULES) {
    out = out.replace(rule.pattern, rule.replace);
  }
  return out;
}
