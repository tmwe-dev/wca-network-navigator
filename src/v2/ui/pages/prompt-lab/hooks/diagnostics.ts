/**
 * diagnostics — parser e tipi per la diagnostica strutturata del Lab Agent.
 *
 * V2: Output JSON strutturato con impact_score, problem_class,
 * phantom variable detection, entropy detection.
 *
 * Il Lab Agent in modalità Architect emette un array JSON con questa struttura:
 * {
 *   block_id, block_type, problem_class, severity, impact_score,
 *   destination, current_issue, proposed_text, required_variables,
 *   missing_contracts, tests_required, test_urgency, affected_surfaces,
 *   apply_recommended
 * }
 *
 * Parser tollerante: se il modello non emette JSON valido,
 * tenta il parsing legacy (formato testuale V1) come fallback.
 */

export type DiagnosticSeverity = "low" | "medium" | "high" | "critical";

export type ProblemClass =
  | "duplication"
  | "entropy"
  | "ghost_variable"
  | "misplaced_logic"
  | "inconsistency"
  | "hardcoded"
  | "missing_contract"
  | "format_violation"
  | "obsolete";

export type DiagnosticDestination =
  | "keep-here"
  | "prompt_core"
  | "kb_doctrine"
  | "kb_procedure"
  | "contract_backend"
  | "policy_hard"
  | "voice"
  | "editor"
  | "delete"
  | { kind: "merge-with"; targetBlockId: string };

export type TestUrgency = "bassa" | "media" | "alta" | "critica";

// ─── V2: Formato JSON strutturato ───

export interface ArchitectDiagnosticV2 {
  blockId: string;
  blockType: string;
  problemClass: ProblemClass;
  severity: DiagnosticSeverity;
  /** 1-10: quanto pesa questo refactor sul sistema intero */
  impactScore: number;
  destination: DiagnosticDestination;
  currentIssue: string;
  proposedText?: string;
  requiredVariables: string[];
  missingContracts: string[];
  testsRequired: string[];
  testUrgency: TestUrgency;
  affectedSurfaces: string[];
  applyRecommended: boolean;
  /** Testo originale grezzo (debug/fallback). */
  raw: string;
}

// ─── Legacy V1 (retrocompatibilità) ───

export interface ArchitectDiagnostic {
  blockId?: string;
  severity: DiagnosticSeverity;
  why: string;
  destination: DiagnosticDestination;
  proposal?: string;
  test?: string;
  raw: string;
}

// ─── Pesi e scoring ───

export function severityWeight(s: DiagnosticSeverity): number {
  switch (s) {
    case "critical": return 3;
    case "high": return 2;
    case "medium": return 1;
    case "low": return 0;
  }
}

export function impactToTestUrgency(score: number): TestUrgency {
  if (score >= 9) return "critica";
  if (score >= 7) return "alta";
  if (score >= 4) return "media";
  return "bassa";
}

// ─── Parser V2 (JSON) ───

const VALID_PROBLEM_CLASSES = new Set<ProblemClass>([
  "duplication", "entropy", "ghost_variable", "misplaced_logic",
  "inconsistency", "hardcoded", "missing_contract", "format_violation", "obsolete",
]);

const VALID_SEVERITIES = new Set<DiagnosticSeverity>(["low", "medium", "high", "critical"]);

function parseDestinationV2(raw: string): DiagnosticDestination {
  const t = (raw ?? "").trim().toLowerCase();
  const simple: DiagnosticDestination[] = [
    "keep-here", "prompt_core", "kb_doctrine", "kb_procedure",
    "contract_backend", "policy_hard", "voice", "editor", "delete",
  ];
  for (const d of simple) {
    if (typeof d === "string" && t === d) return d;
  }
  // Legacy compatibility
  if (t === "move-to-doctrine") return "kb_doctrine";
  if (t === "move-to-procedure") return "kb_procedure";
  if (t === "move-to-contract") return "contract_backend";
  const merge = /^merge[_-]with[:\s]+(.+)$/i.exec(t);
  if (merge) return { kind: "merge-with", targetBlockId: merge[1].trim() };
  return "keep-here";
}

function coerceV2(obj: Record<string, unknown>, rawText: string): ArchitectDiagnosticV2 {
  const severity = VALID_SEVERITIES.has(obj.severity as DiagnosticSeverity)
    ? (obj.severity as DiagnosticSeverity) : "low";
  const impact = typeof obj.impact_score === "number"
    ? Math.max(1, Math.min(10, Math.round(obj.impact_score))) : 5;
  const problemClass = VALID_PROBLEM_CLASSES.has(obj.problem_class as ProblemClass)
    ? (obj.problem_class as ProblemClass) : "inconsistency";

  return {
    blockId: String(obj.block_id ?? ""),
    blockType: String(obj.block_type ?? "unknown"),
    problemClass,
    severity,
    impactScore: impact,
    destination: parseDestinationV2(String(obj.destination ?? "keep-here")),
    currentIssue: String(obj.current_issue ?? "(nessuna spiegazione)"),
    proposedText: obj.proposed_text ? String(obj.proposed_text) : undefined,
    requiredVariables: Array.isArray(obj.required_variables)
      ? obj.required_variables.map(String) : [],
    missingContracts: Array.isArray(obj.missing_contracts)
      ? obj.missing_contracts.map(String) : [],
    testsRequired: Array.isArray(obj.tests_required)
      ? obj.tests_required.map(String) : [],
    testUrgency: impactToTestUrgency(impact),
    affectedSurfaces: Array.isArray(obj.affected_surfaces)
      ? obj.affected_surfaces.map(String) : [],
    applyRecommended: obj.apply_recommended !== false,
    raw: rawText,
  };
}

/**
 * Tenta di estrarre JSON dalla risposta del modello.
 * Tollerante: cerca [ ] o { } anche se circondati da testo/markdown.
 */
function extractJson(text: string): unknown | null {
  // Rimuovi eventuale markdown code fence
  const stripped = text.replace(/^```(?:json)?\s*/im, "").replace(/\s*```\s*$/im, "").trim();

  // Prova array
  const arrMatch = stripped.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch { /* noop */ }
  }
  // Prova singolo oggetto
  const objMatch = stripped.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch { /* noop */ }
  }
  return null;
}

/**
 * Parser principale V2: tenta JSON, fallback a legacy V1.
 */
export function parseArchitectDiagnostics(text: string): ArchitectDiagnosticV2[] {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return [];

  // Tentativo 1: JSON strutturato (V2)
  const json = extractJson(trimmed);
  if (json) {
    const items = Array.isArray(json) ? json : [json];
    const parsed = items
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => coerceV2(item, trimmed));
    if (parsed.length > 0) return parsed;
  }

  // Tentativo 2: formato testuale legacy V1 → converti a V2
  if (/^(SEVERITY|BLOCK):/im.test(trimmed)) {
    return parseLegacySegments(trimmed).map(legacyToV2);
  }

  // Fallback: output non strutturato
  return [{
    blockId: "",
    blockType: "unknown",
    problemClass: "inconsistency",
    severity: "low",
    impactScore: 3,
    destination: "keep-here",
    currentIssue: "Output non strutturato — il modello non ha rispettato il formato Architect.",
    requiredVariables: [],
    missingContracts: [],
    testsRequired: [],
    testUrgency: "bassa",
    affectedSurfaces: [],
    applyRecommended: false,
    raw: trimmed,
  }];
}

// ─── Parser Legacy V1 (fallback) ───

const SEV_RE = /^SEVERITY:\s*(low|medium|high|critical)\s*$/im;
const WHY_RE = /^WHY:\s*(.+)$/im;
const DEST_RE = /^DESTINATION:\s*(.+)$/im;
const PROP_RE = /^PROPOSAL:\s*([\s\S]+?)(?=^\s*(?:TEST:|BLOCK:|SEVERITY:)|\Z)/im;
const TEST_RE = /^TEST:\s*([\s\S]+?)(?=^\s*(?:BLOCK:|SEVERITY:)|\Z)/im;
const BLOCK_RE = /^BLOCK:\s*([^\s]+)\s*$/im;

function parseLegacySegments(text: string): ArchitectDiagnostic[] {
  const lines = text.split(/\r?\n/);
  const segments: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (/^\s*(BLOCK:|SEVERITY:)/i.test(line) && current.length > 0 && current.some((l) => /^(SEVERITY:|WHY:|DESTINATION:)/i.test(l.trim()))) {
      segments.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) segments.push(current);
  return segments.map((s) => s.join("\n").trim()).filter((s) => s.length > 0).map(parseLegacySegment);
}

function parseLegacyDestination(raw: string): DiagnosticDestination {
  const t = raw.trim().toLowerCase();
  if (t === "keep-here") return "keep-here";
  if (t === "move-to-doctrine") return "kb_doctrine";
  if (t === "move-to-procedure") return "kb_procedure";
  if (t === "move-to-contract") return "contract_backend";
  if (t === "delete") return "delete";
  const merge = /^merge-with:\s*(.+)$/i.exec(raw.trim());
  if (merge) return { kind: "merge-with", targetBlockId: merge[1].trim() };
  return "keep-here";
}

function parseLegacySegment(segment: string): ArchitectDiagnostic {
  return {
    blockId: BLOCK_RE.exec(segment)?.[1]?.trim(),
    severity: (SEV_RE.exec(segment)?.[1]?.toLowerCase() as DiagnosticSeverity) ?? "low",
    why: WHY_RE.exec(segment)?.[1]?.trim() ?? "(nessuna spiegazione fornita)",
    destination: parseLegacyDestination(DEST_RE.exec(segment)?.[1] ?? "keep-here"),
    proposal: PROP_RE.exec(segment)?.[1]?.trim() || undefined,
    test: TEST_RE.exec(segment)?.[1]?.trim() || undefined,
    raw: segment,
  };
}

function legacyToV2(d: ArchitectDiagnostic): ArchitectDiagnosticV2 {
  const impact = severityWeight(d.severity) * 3 + 1; // rough: low=1, med=4, high=7, critical=10
  return {
    blockId: d.blockId ?? "",
    blockType: "unknown",
    problemClass: "inconsistency",
    severity: d.severity,
    impactScore: Math.min(10, impact),
    destination: d.destination,
    currentIssue: d.why,
    proposedText: d.proposal,
    requiredVariables: [],
    missingContracts: [],
    testsRequired: d.test ? [d.test] : [],
    testUrgency: impactToTestUrgency(impact),
    affectedSurfaces: [],
    applyRecommended: d.severity !== "low",
    raw: d.raw,
  };
}
