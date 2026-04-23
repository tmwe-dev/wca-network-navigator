/**
 * diagnostics — parser e tipi per la diagnostica strutturata del Lab Agent (Fase 3).
 *
 * Quando il Lab Agent gira in modalità Architect (mode='architect'), il prompt
 * gli chiede di NON riscrivere il blocco ma di emettere un report con campi:
 *
 *   SEVERITY: low | medium | high | critical
 *   WHY: <una frase>
 *   DESTINATION: keep-here | move-to-doctrine | move-to-procedure | move-to-contract | merge-with:<block_id> | delete
 *   PROPOSAL: <testo proposto, opzionale>
 *   TEST: <scenario di verifica, opzionale>
 *
 * Possono comparire più blocchi DIAGNOSTIC nel medesimo output (uno per blocco
 * vicino analizzato). Il parser è tollerante: se il modello risponde in formato
 * libero restituiamo un singolo diagnostic con severity='low' e raw text.
 */

export type DiagnosticSeverity = "low" | "medium" | "high" | "critical";

export type DiagnosticDestination =
  | "keep-here"
  | "move-to-doctrine"
  | "move-to-procedure"
  | "move-to-contract"
  | "delete"
  | { kind: "merge-with"; targetBlockId: string };

export interface ArchitectDiagnostic {
  /** Block id analizzato (se identificabile dal report). */
  blockId?: string;
  severity: DiagnosticSeverity;
  why: string;
  destination: DiagnosticDestination;
  proposal?: string;
  test?: string;
  /** Testo originale grezzo del report (utile per debug e fallback UI). */
  raw: string;
}

const SEV_RE = /^SEVERITY:\s*(low|medium|high|critical)\s*$/im;
const WHY_RE = /^WHY:\s*(.+)$/im;
const DEST_RE = /^DESTINATION:\s*(.+)$/im;
const PROP_RE = /^PROPOSAL:\s*([\s\S]+?)(?=^\s*(?:TEST:|BLOCK:|SEVERITY:)|\Z)/im;
const TEST_RE = /^TEST:\s*([\s\S]+?)(?=^\s*(?:BLOCK:|SEVERITY:)|\Z)/im;
const BLOCK_RE = /^BLOCK:\s*([^\s]+)\s*$/im;

function parseDestination(raw: string): DiagnosticDestination {
  const t = raw.trim().toLowerCase();
  if (t === "keep-here") return "keep-here";
  if (t === "move-to-doctrine") return "move-to-doctrine";
  if (t === "move-to-procedure") return "move-to-procedure";
  if (t === "move-to-contract") return "move-to-contract";
  if (t === "delete") return "delete";
  const merge = /^merge-with:\s*(.+)$/i.exec(raw.trim());
  if (merge) return { kind: "merge-with", targetBlockId: merge[1].trim() };
  return "keep-here";
}

/**
 * Splitta l'output in segmenti per blocco analizzato.
 * Un nuovo segmento inizia ogni volta che vediamo "BLOCK:" o "SEVERITY:" all'inizio riga.
 */
function splitSegments(text: string): string[] {
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
  return segments.map((s) => s.join("\n").trim()).filter((s) => s.length > 0);
}

function parseSegment(segment: string): ArchitectDiagnostic {
  const sev = SEV_RE.exec(segment);
  const why = WHY_RE.exec(segment);
  const dest = DEST_RE.exec(segment);
  const prop = PROP_RE.exec(segment);
  const test = TEST_RE.exec(segment);
  const block = BLOCK_RE.exec(segment);
  return {
    blockId: block?.[1]?.trim(),
    severity: (sev?.[1]?.toLowerCase() as DiagnosticSeverity) ?? "low",
    why: why?.[1]?.trim() ?? "(nessuna spiegazione fornita)",
    destination: parseDestination(dest?.[1] ?? "keep-here"),
    proposal: prop?.[1]?.trim() || undefined,
    test: test?.[1]?.trim() || undefined,
    raw: segment,
  };
}

export function parseArchitectDiagnostics(text: string): ArchitectDiagnostic[] {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return [];
  // Se non c'è nessun marker strutturato, ritorna un singolo diagnostic raw.
  if (!/^(SEVERITY|BLOCK):/im.test(trimmed)) {
    return [
      {
        severity: "low",
        why: "Output non strutturato — il modello non ha rispettato il formato Architect.",
        destination: "keep-here",
        raw: trimmed,
      },
    ];
  }
  return splitSegments(trimmed).map(parseSegment);
}

export function severityWeight(s: DiagnosticSeverity): number {
  switch (s) {
    case "critical": return 3;
    case "high": return 2;
    case "medium": return 1;
    case "low": return 0;
  }
}
