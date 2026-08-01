/**
 * repetitionDetection.ts
 * Detects when users repeat requests and adjusts system prompt to be more direct.
 */

export function detectRepetitions(
  messages: Array<{ role?: string; content?: string }>
): string | null {
  const userMessages = messages
    .filter(
      (m) =>
        m.role === "user" && typeof m.content === "string"
    )
    .map((m) => (m.content as string).toLowerCase().trim());

  if (userMessages.length < 2) return null;

  const last = userMessages[userMessages.length - 1];
  const previous = userMessages.slice(0, -1);
  const lastWords = new Set(
    last.split(/\s+/).filter((w) => w.length > 3)
  );

  // Check for similar previous messages
  for (
    let i = previous.length - 1;
    i >= Math.max(0, previous.length - 4);
    i--
  ) {
    const prevWords = new Set(
      previous[i].split(/\s+/).filter((w) => w.length > 3)
    );
    const overlap = [...lastWords].filter((w) => prevWords.has(w)).length;
    const similarity =
      overlap / Math.max(lastWords.size, prevWords.size, 1);
    if (similarity > 0.6) {
      return `⚠️ ATTENZIONE: L'utente sta ripetendo una richiesta simile. La risposta precedente probabilmente non era soddisfacente. Rispondi in modo PIÙ CONCRETO e DIRETTO. Se prima hai chiesto chiarimenti, ORA agisci con la migliore interpretazione. Non ripetere la stessa struttura di risposta.`;
    }
  }

  // Check for frustration patterns
  const frustrationPatterns = [
    /no,?\s*(intendo|volevo|dico)/i,
    /ti ho (già |)detto/i,
    /come (ti )?ho (già )?detto/i,
    /ripeto/i,
    /non (hai |)(capito|capisci)/i,
    /ancora una volta/i,
    /di nuovo/i,
  ];
  for (const pattern of frustrationPatterns) {
    if (pattern.test(last)) {
      return `⚠️ L'utente mostra frustrazione — la risposta precedente non ha centrato il punto. Rispondi in modo diretto e concreto, senza chiedere chiarimenti.`;
    }
  }

  return null;
}
