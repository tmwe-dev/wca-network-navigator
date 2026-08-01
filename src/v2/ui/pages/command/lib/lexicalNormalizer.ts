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
  // STT typos for "partner" (very common voice mistakes)
  { pattern: /\bpane\b/gi, replace: "partner" },
  { pattern: /\bpani\b/gi, replace: "partner" },
  { pattern: /\bpartnera\b/gi, replace: "partner" },
  { pattern: /\bpartener\b/gi, replace: "partner" },
  { pattern: /\bpatner\b/gi, replace: "partner" },
  { pattern: /\bpatners\b/gi, replace: "partner" },
  { pattern: /\bparnter\b/gi, replace: "partner" },
  { pattern: /\bpartnar\b/gi, replace: "partner" },
  { pattern: /\bparlano\b/gi, replace: "partner" },
  { pattern: /\bparlani\b/gi, replace: "partner" },
  { pattern: /\bpartn\b/gi, replace: "partner" },
  { pattern: /\bpartnerr\b/gi, replace: "partner" },
  // STT typos for "contatti"
  { pattern: /\bcontati\b/gi, replace: "contatti" },
  { pattern: /\bcontatt\b/gi, replace: "contatti" },
  // STT typos for "prospect"
  { pattern: /\bprospetto\b/gi, replace: "prospect" },
  { pattern: /\bprospetti\b/gi, replace: "prospect" },
  // STT typos for "agenti"
  { pattern: /\bagent\b/gi, replace: "agente" },
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
