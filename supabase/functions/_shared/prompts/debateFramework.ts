/**
 * DEBATE_FRAMEWORK — SSOT per dibattito multi-agente.
 *
 * Estratto e adattato da RadioChat (src/lib/prompts.ts → DEBATE_FRAMEWORK).
 * Riferimento doctrine: mem://standards/multi-agent-debate-pattern.md
 *
 * USO TIPICO: il Director (Luca) compone una sessione multi-voce con
 * Sherlock + Architect + Refiner. Si inietta il framework UNA SOLA volta
 * nel system prompt della sessione, non per turno.
 *
 * Vincoli rispettati:
 *  - Editorial review (`journalistReview`) resta obbligatorio sull'output finale.
 *  - Hard guards rimangono attivi sui tool.
 *  - Ogni invocazione passa da `invokeAi()` con scope registrato.
 */

export type DebateLanguage = "it" | "en" | "es" | "fr" | "de" | "pt";

export interface DebateFramework {
  intro: string;
  rules: string;
  consultation: string;
  buildOn: string;
  disagree: string;
  conclude: string;
}

const FRAMEWORKS: Record<DebateLanguage, DebateFramework> = {
  it: {
    intro:
      "Sei una voce in una conversazione multi-agente. Altre voci con personalità e ruoli distinti contribuiscono in parallelo. Il tuo compito è aggiungere VALORE NUOVO, non duplicare.",
    rules:
      "REGOLE: 1) Leggi prima i contributi precedenti. 2) Aggiungi solo valore nuovo. 3) Costruisci sopra le idee migliori o dissenti con argomenti. 4) Tono collaborativo, mai competitivo. 5) Obiettivo finale: CONVERGERE su una raccomandazione utile all'utente.",
    consultation:
      "COORDINAMENTO: se un'altra voce ha già coperto un punto, non ripeterlo. Se serve completarlo, dichiaralo esplicitamente ('aggiungo a quanto detto da X...').",
    buildOn:
      "COSTRUISCI: quando un contributo precedente è valido, estendilo con dati, esempi o implicazioni che gli altri non hanno visto.",
    disagree:
      "DISSENTI: se non sei d'accordo, dillo chiaramente seguendo la tua debateRule. Mai criticare senza proporre un'alternativa testabile.",
    conclude:
      "CHIUSURA: termina il tuo turno con un contributo chiaro e azionabile, non con una sintesi del dibattito.",
  },
  en: {
    intro:
      "You are one voice in a multi-agent conversation. Other voices with distinct roles and personalities contribute in parallel. Your job is to add NEW VALUE, not duplicate.",
    rules:
      "RULES: 1) Read previous contributions first. 2) Add only new value. 3) Build on the best ideas or disagree with arguments. 4) Collaborative tone, never competitive. 5) Final goal: CONVERGE on a recommendation useful to the user.",
    consultation:
      "COORDINATION: if another voice already covered a point, don't repeat it. If you need to complete it, declare it explicitly ('adding to what X said...').",
    buildOn:
      "BUILD ON: when a previous contribution is valid, extend it with data, examples or implications others didn't see.",
    disagree:
      "DISAGREE: if you disagree, say it clearly following your debateRule. Never criticize without proposing a testable alternative.",
    conclude:
      "CLOSING: end your turn with a clear actionable contribution, not with a summary of the debate.",
  },
  es: {
    intro:
      "Eres una voz en una conversación multi-agente. Otras voces con personalidades y roles distintos contribuyen en paralelo. Tu tarea es añadir VALOR NUEVO, no duplicar.",
    rules:
      "REGLAS: 1) Lee primero las contribuciones previas. 2) Añade solo valor nuevo. 3) Construye sobre las mejores ideas o disiente con argumentos. 4) Tono colaborativo, nunca competitivo. 5) Objetivo final: CONVERGER en una recomendación útil para el usuario.",
    consultation:
      "COORDINACIÓN: si otra voz ya cubrió un punto, no lo repitas. Si necesitas completarlo, decláralo explícitamente ('añado a lo dicho por X...').",
    buildOn:
      "CONSTRUYE: cuando una contribución previa sea válida, extiéndela con datos, ejemplos o implicaciones que los otros no vieron.",
    disagree:
      "DISIENTE: si no estás de acuerdo, dilo claramente siguiendo tu debateRule. Nunca critiques sin proponer una alternativa comprobable.",
    conclude:
      "CIERRE: termina tu turno con una contribución clara y accionable, no con un resumen del debate.",
  },
  fr: {
    intro:
      "Tu es une voix dans une conversation multi-agent. D'autres voix avec personnalités et rôles distincts contribuent en parallèle. Ta tâche est d'ajouter de la VALEUR NOUVELLE, pas de dupliquer.",
    rules:
      "RÈGLES : 1) Lis d'abord les contributions précédentes. 2) Ajoute uniquement de la valeur nouvelle. 3) Construis sur les meilleures idées ou désapprouve avec des arguments. 4) Ton collaboratif, jamais compétitif. 5) Objectif final : CONVERGER vers une recommandation utile à l'utilisateur.",
    consultation:
      "COORDINATION : si une autre voix a déjà couvert un point, ne le répète pas. Si tu dois le compléter, déclare-le explicitement ('j'ajoute à ce que X a dit...').",
    buildOn:
      "CONSTRUIS : quand une contribution précédente est valide, étends-la avec des données, exemples ou implications que les autres n'ont pas vues.",
    disagree:
      "DÉSAPPROUVE : si tu n'es pas d'accord, dis-le clairement en suivant ta debateRule. Ne critique jamais sans proposer une alternative testable.",
    conclude:
      "CLÔTURE : termine ton tour avec une contribution claire et actionnable, pas avec un résumé du débat.",
  },
  de: {
    intro:
      "Du bist eine Stimme in einer Multi-Agenten-Konversation. Andere Stimmen mit unterschiedlichen Rollen und Persönlichkeiten tragen parallel bei. Deine Aufgabe ist es, NEUEN WERT hinzuzufügen, nicht zu duplizieren.",
    rules:
      "REGELN: 1) Lies zuerst die vorherigen Beiträge. 2) Füge nur neuen Wert hinzu. 3) Baue auf den besten Ideen auf oder widersprich mit Argumenten. 4) Kollaborativer Ton, nie kompetitiv. 5) Endziel: zu einer für den Nutzer nützlichen Empfehlung KONVERGIEREN.",
    consultation:
      "KOORDINATION: Wenn eine andere Stimme einen Punkt bereits abgedeckt hat, wiederhole ihn nicht. Wenn du ihn ergänzen musst, erkläre es explizit ('ich ergänze, was X gesagt hat...').",
    buildOn:
      "BAUE AUF: Wenn ein früherer Beitrag gültig ist, erweitere ihn mit Daten, Beispielen oder Implikationen, die andere nicht gesehen haben.",
    disagree:
      "WIDERSPRICH: Wenn du nicht einverstanden bist, sage es klar nach deiner debateRule. Kritisiere nie ohne eine testbare Alternative vorzuschlagen.",
    conclude:
      "ABSCHLUSS: Beende deinen Beitrag mit einem klaren, umsetzbaren Beitrag, nicht mit einer Zusammenfassung der Debatte.",
  },
  pt: {
    intro:
      "Você é uma voz numa conversa multi-agente. Outras vozes com personalidades e papéis distintos contribuem em paralelo. Sua tarefa é acrescentar VALOR NOVO, não duplicar.",
    rules:
      "REGRAS: 1) Leia primeiro as contribuições anteriores. 2) Acrescente apenas valor novo. 3) Construa sobre as melhores ideias ou discorde com argumentos. 4) Tom colaborativo, nunca competitivo. 5) Objetivo final: CONVERGIR para uma recomendação útil ao usuário.",
    consultation:
      "COORDENAÇÃO: se outra voz já cobriu um ponto, não repita. Se precisar completá-lo, declare explicitamente ('acrescento ao que X disse...').",
    buildOn:
      "CONSTRUA: quando uma contribuição anterior for válida, estenda-a com dados, exemplos ou implicações que os outros não viram.",
    disagree:
      "DISCORDE: se não concorda, diga claramente seguindo sua debateRule. Nunca critique sem propor uma alternativa testável.",
    conclude:
      "FECHAMENTO: termine seu turno com uma contribuição clara e acionável, não com um resumo do debate.",
  },
};

/**
 * Restituisce il framework completo nella lingua richiesta (fallback IT).
 */
export function getDebateFramework(lang: string | null | undefined): DebateFramework {
  const key = (lang ?? "it").slice(0, 2).toLowerCase() as DebateLanguage;
  return FRAMEWORKS[key] ?? FRAMEWORKS.it;
}

/**
 * Compone il blocco testuale da iniettare nel system prompt di una sessione multi-agente.
 * Una sola volta per sessione, non per turno.
 */
export function buildDebateFrameworkBlock(lang: string | null | undefined): string {
  const f = getDebateFramework(lang);
  return [
    `## DEBATE FRAMEWORK`,
    f.intro,
    "",
    f.rules,
    "",
    f.consultation,
    "",
    f.buildOn,
    "",
    f.disagree,
    "",
    f.conclude,
  ].join("\n");
}

export const SUPPORTED_DEBATE_LANGUAGES: DebateLanguage[] = ["it", "en", "es", "fr", "de", "pt"];
