import type { AtecoRank } from "./types";

export const ATECO_RANKING_3: Record<string, AtecoRank> = {
  // ═══════════════════════════════════════
  // I - ALLOGGIO/RISTORAZIONE
  // ═══════════════════════════════════════
  "55":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Alloggio — servizi, no merci" },
  "55.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Alberghi" },
  "55.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Campeggi" },
  "55.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Affittacamere" },
  "55.4": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Soggiorni brevi" },
  "56":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Ristorazione — locale" },
  "56.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Ristoranti" },
  "56.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Catering" },
  "56.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Bar" },

  // ═══════════════════════════════════════
  // J - INFORMAZIONE/COMUNICAZIONE (CORRETTO: quasi tutto 1/1)
  // ═══════════════════════════════════════
  "58":   { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Editoria — libri export, poco volume" },
  "58.1": { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Libri, riviste — qualche export" },
  "58.2": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Altre editoriali — digitale" },
  "59":   { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Cinema/musica — digitale ormai" },
  "59.1": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Produzione video — digitale" },
  "59.2": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Musica — digitale" },
  "60":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Radio/TV — no merci" },
  "60.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Radio" },
  "60.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "TV" },
  "61":   { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Telecom — servizio, non merce" },
  "61.1": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Telecom cavo — servizio" },
  "61.2": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Telecom satellite — servizio" },
  "61.3": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Altre telecom — servizio" },
  "62":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Software/IT — zero merci fisiche" },
  "62.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Software — digitale" },
  "62.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Consulenza IT — servizio" },
  "62.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Gestione IT — servizio" },
  "62.9": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Servizi IT — digitale" },
  "63":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Servizi informazione — digitale" },
  "63.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Hosting — digitale" },
  "63.9": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Altre informazione — digitale" },

  // ═══════════════════════════════════════
  // K - FINANZA/ASSICURAZIONI
  // ═══════════════════════════════════════
  "64":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Finanza — no merci" },
  "64.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Banche" },
  "64.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Gestione patrimoniale" },
  "64.9": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Altre finanziarie" },
  "65":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Assicurazioni — no merci" },
  "65.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Assicurazioni" },
  "65.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Riassicurazioni" },
  "65.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Fondi pensione" },
  "66":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Servizi finanziari — no merci" },
  "66.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Mercati finanziari" },
  "66.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Intermediazione" },
  "66.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Gestione fondi" },
  "66.4": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Ausiliarie assicurazioni" },

  // ═══════════════════════════════════════
  // L - IMMOBILIARE
  // ═══════════════════════════════════════
  "68":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Immobiliare — no merci" },
  "68.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Compravendita immobili" },
  "68.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Affitto immobili" },
  "68.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Agenzie immobiliari" },

  // ═══════════════════════════════════════
  // M - PROFESSIONALI (CORRETTO: quasi tutto 1/1)
  // ═══════════════════════════════════════
  "69":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Legale/contabilità — no merci" },
  "69.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Avvocati — documenti digitali" },
  "69.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Commercialisti — digitale" },
  "70":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Consulenza — no merci" },
  "70.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Direzione aziendale — servizio" },
  "71":   { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Ingegneria — qualche campione/strumento" },
  "71.1": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Architettura — servizio" },
  "71.2": { volume: 1, valore: 2, intl: "BASSO",        paga: "IMPROBABILE",            note: "Collaudi analisi — qualche campione" },
  "72":   { volume: 3, valore: 4, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Ricerca — campioni, strumenti scientifici, express" },
  "72.1": { volume: 3, valore: 4, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "R&D scienze naturali — campioni, reagenti express" },
  "72.2": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "R&D scienze sociali — no merci" },
  "73":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Pubblicità — digitale" },
  "73.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Pubblicità — digitale" },
  "73.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Ricerche mercato — digitale" },
  "74":   { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Design — prototipi, campionari" },
  "74.1": { volume: 2, valore: 3, intl: "ALTO",         paga: "SI - MEDIA PROBABILITÀ", note: "Design industriale — prototipi, campioni" },
  "74.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Fotografia — no merci fisiche" },
  "74.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Traduzione — servizio digitale" },
  "74.8": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Altre professionali — misto" },
  "74.9": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Varie professionali" },
  "75":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Veterinari — locale" },
  "75.0": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Veterinari — locale" },

  // ═══════════════════════════════════════
  // N - SUPPORTO IMPRESE (non presente in ATECO_TREE livello 2/3)
  // ═══════════════════════════════════════

  // ═══════════════════════════════════════
  // O - PUBBLICA AMMINISTRAZIONE
  // ═══════════════════════════════════════
  "84":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "PA — non cliente privato" },
  "84.0": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Amministrazione pubblica" },

  // ═══════════════════════════════════════
  // P - ISTRUZIONE
  // ═══════════════════════════════════════
  "85":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Istruzione — non spedisce" },
  "85.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Pre-primaria" },
  "85.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Primaria" },
  "85.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Secondaria" },
  "85.4": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Post-secondaria" },
  "85.5": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Università" },
  "85.6": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Altre istruzione" },

  // ═══════════════════════════════════════
  // Q - SANITA
  // ═══════════════════════════════════════
  "86":   { volume: 2, valore: 4, intl: "MEDIO",        paga: "POSSIBILE",              note: "Sanità — dispositivi medici, campioni" },
  "86.1": { volume: 2, valore: 4, intl: "MEDIO",        paga: "POSSIBILE",              note: "Ospedali — dispositivi medici" },
  "86.2": { volume: 2, valore: 4, intl: "MEDIO",        paga: "POSSIBILE",              note: "Specialistiche — strumenti" },
  "86.9": { volume: 2, valore: 3, intl: "BASSO",        paga: "IMPROBABILE",            note: "Altre sanitarie — locale" },
  "87":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Assistenza residenziale — locale" },
  "87.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "RSA anziani" },
  "87.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Assistenza disabili" },
  "87.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Assistenza anziani" },
  "87.9": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Altre residenziali" },
  "88":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Assistenza non residenziale" },
  "88.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Assistenza anziani/disabili" },
  "88.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Altre assistenza" },

  // ═══════════════════════════════════════
  // R - ARTE/INTRATTENIMENTO (CORRETTO: quasi tutto 1/1)
  // ═══════════════════════════════════════
  "90":   { volume: 1, valore: 2, intl: "BASSO",        paga: "IMPROBABILE",            note: "Attività artistiche — nicchia" },
  "90.1": { volume: 1, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Arte — opere, trasporto specializzato" },
  "90.2": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Supporto spettacolo — locale" },
  "90.3": { volume: 1, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Musei — prestiti opere d'arte internazionali" },
  "90.4": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Giardinaggio — locale, zero export" },
  "91":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Giochi azzardo — no merci" },
  "91.0": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Scommesse" },
  "92":   { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Sport — attrezzature" },
  "92.1": { volume: 2, valore: 2, intl: "MEDIO",        paga: "POSSIBILE",              note: "Attività sportive — attrezzature" },
  "92.2": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Supporto sport — locale" },
  "93":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Intrattenimento — locale" },
  "93.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Parchi tematici" },
  "93.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Intrattenimento vario" },

  // ═══════════════════════════════════════
  // S - ALTRI SERVIZI
  // ═══════════════════════════════════════
  "94":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Associazioni — no merci" },
  "94.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Organizzazioni professionali" },
  "94.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Organizzazioni religiose" },
  "94.9": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Altre organizzazioni" },
  "95":   { volume: 1, valore: 2, intl: "BASSO",        paga: "IMPROBABILE",            note: "Riparazione computer — locale" },
  "95.1": { volume: 1, valore: 2, intl: "BASSO",        paga: "IMPROBABILE",            note: "Riparazione computer — locale" },
  "95.2": { volume: 1, valore: 1, intl: "BASSO",        paga: "IMPROBABILE",            note: "Riparazione beni personali — locale" },
  "96":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Servizi personali — locale" },
  "96.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Lavanderie" },
  "96.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Parrucchieri" },
  "96.3": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Pompe funebri" },
  "96.9": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Altri servizi personali" },

  // ═══════════════════════════════════════
  // T/U
  // ═══════════════════════════════════════
  "97":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Famiglie datori lavoro" },
  "97.0": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Famiglie — non impresa" },
  "98":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Produzione propria famiglie" },
  "98.1": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Beni propri famiglie" },
  "98.2": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Servizi propri famiglie" },
  "99":   { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Organismi extraterritoriali" },
  "99.0": { volume: 1, valore: 1, intl: "MOLTO DIFFICILE", paga: "IMPROBABILE",         note: "Extraterritoriali" },
};

/** Get ranking for a code. Falls back to parent division if not found. */
export function getAtecoRank(code: string): AtecoRank | null {
  if (ATECO_RANKING[code]) return ATECO_RANKING[code];
  // Try parent (e.g. "10.1" → "10")
  const parent = code.split(".")[0];
  if (parent !== code && ATECO_RANKING[parent]) return ATECO_RANKING[parent];
  return null;
}

/** Star string for a 1-5 value */
export function starsString(n: number): string {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

/** Color class for score */
export function scoreColor(score: number, isDark: boolean): string {
  if (score >= 16) return isDark ? "text-emerald-400" : "text-emerald-600";
  if (score >= 12) return isDark ? "text-sky-400" : "text-sky-600";
  if (score >= 8) return isDark ? "text-amber-400" : "text-amber-600";
  if (score >= 4) return isDark ? "text-orange-400" : "text-orange-500";
  return isDark ? "text-slate-600" : "text-slate-400";
}

/** Bg class for inline badge */
export function scoreBg(score: number, isDark: boolean): string {
  if (score >= 16) return isDark ? "bg-emerald-500/15 border-emerald-500/25" : "bg-emerald-50 border-emerald-200";
  if (score >= 12) return isDark ? "bg-sky-500/15 border-sky-500/25" : "bg-sky-50 border-sky-200";
  if (score >= 8) return isDark ? "bg-amber-500/15 border-amber-500/25" : "bg-amber-50 border-amber-200";
  if (score >= 4) return isDark ? "bg-orange-500/15 border-orange-500/25" : "bg-orange-50 border-orange-200";
  return isDark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200";
}
};
