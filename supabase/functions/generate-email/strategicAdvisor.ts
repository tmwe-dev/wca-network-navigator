/**
 * strategicAdvisor.ts — Strategic advisor context builder for prompt engineering.
 * Guides AI on data points available and tone according to relationship phase.
 */
import type { StrategicAdvisorContext } from "./promptTypes.ts";

export function buildStrategicAdvisor(context: StrategicAdvisorContext): string {
  const phaseContext = context.commercialState
    ? `\n- Fase commerciale: ${context.commercialState} (touch #${context.touchCount || 0})`
    : "";
  const tc = context.touchCount ?? 0;
  const toneGuide = tc === 0
    ? "\n- PRIMO CONTATTO: tono freddo-professionale, breve, CTA basso impegno"
    : tc <= 3
      ? "\n- FOLLOW-UP INIZIALE: tono cordiale, riferirsi a scambi precedenti, aggiungere valore"
      : "\n- RELAZIONE ATTIVA: tono da collega, personalizzazione alta, NON ripetere presentazione";

  // LOVABLE-77: blocco "Data points disponibili" — guida l'AI a scegliere ancore concrete
  const dp = context.dataPoints || {};
  const availableAnchors: string[] = [];
  if (dp.hasProfileDescription) availableAnchors.push("profilo partner (servizi/network/città)");
  if (dp.hasWebsite) availableAnchors.push("sito web (analizzato)");
  if (dp.hasLinkedin) availableAnchors.push("LinkedIn azienda");
  if ((dp.contactProfilesCount ?? 0) > 0) availableAnchors.push(`${dp.contactProfilesCount} decision maker da Deep Search`);
  if (dp.hasSherlock) availableAnchors.push("indagine Sherlock");
  if ((dp.bcaCount ?? 0) > 0) availableAnchors.push(`${dp.bcaCount} incontro/i di persona`);
  if ((dp.historyCount ?? 0) > 0) availableAnchors.push(`${dp.historyCount} touch precedenti`);
  if (dp.hasReputation) availableAnchors.push("reputazione online");

  const totalAnchors = availableAnchors.length;
  const dataPointsBlock = totalAnchors > 0
    ? `
## DATA POINTS DISPONIBILI PER QUESTO PARTNER (${totalAnchors})
${availableAnchors.map((a) => `- ✓ ${a}`).join("\n")}

→ USA ALMENO ${Math.min(2, totalAnchors)} di questi data points come ancore concrete nel messaggio.
→ Cita un servizio specifico letto dal sito, un nome di decision maker da Sherlock, un evento BCA, un servizio di profilo. NON restare generico.
`
    : `
## DATA POINTS DISPONIBILI: NESSUNO
⚠️ Non hai dati specifici su questo partner. Aggiungi tag [GENERIC] nel subject e procedi con presentazione standard onesta.
`;

  return `
# STRATEGIC ADVISOR — Contesto per Decisione Autonoma

Sei un EDITOR GIORNALISTA esperto, non un copywriter generico.
Il tuo lavoro: leggere TUTTO il dossier sul partner (profilo, sito, Sherlock, history, BCA, network),
farti un'idea precisa di chi è l'azienda e di cosa fa, e scrivere un messaggio che dimostri
— senza dirlo esplicitamente — che hai studiato chi hai davanti e che non è un blast generico.

## Contesto:
- Tipo email: ${context.emailCategory || "generico"}
- Storia interazioni disponibile: ${context.hasHistory ? "SÌ" : "NO"}
- Tentativo follow-up: ${context.followUpCount ? `#${context.followUpCount}` : "N/A"}
- Dati enrichment disponibili: ${context.hasEnrichmentData ? "SÌ" : "NO"}${phaseContext}${toneGuide}
${dataPointsBlock}
## Metodo dell'editor:
1. LEGGI: profilo + enrichment + Sherlock + history. Costruisci nella tua testa un ritratto del partner:
   che servizi fa, su che rotte, in che mercato opera, cosa lo distingue, dove può crescere.
2. CONNETTI: collega ciò che il partner fa con ciò che WCA Network offre come vantaggio competitivo
   (vedi sezione "Filosofia WCA" nel system prompt). Trova UNA leva di interesse reale per LUI.
3. SCRIVI: messaggio breve, asciutto, da professionista a professionista. Mai vendita aggressiva,
   mai entusiasmo finto, mai elenchi puntati di feature. Una sola idea forte, ben argomentata.

## Guardrail:
- Se c'è storia interazioni → non ripetere approcci già usati
- Se dati scarsi → resta qualitativo ma vero (NON inventare numeri, %, casi cliente, certificazioni)
- Le tecniche della KB servono a STRUTTURARE (hook, framing, CTA), non a fabbricare prove inesistenti
- Adatta il tono alla fase della relazione (mai forzare familiarità nei primi contatti)
`;
}
