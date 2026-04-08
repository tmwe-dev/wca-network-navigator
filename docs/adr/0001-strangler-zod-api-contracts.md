# ADR 0001 — Strangler zod per i contratti API remoti

**Stato**: accepted
**Data**: 2026-04-08
**Riferimento**: Vol. II §5.1 (Specifica formale), §5.3 (Errori API)

## Contesto

I client del frontend chiamano edge function (Supabase) e API esterne
(`wca-app.vercel.app`) i cui payload sono storicamente tipati a mano con
`interface` TypeScript. Questi tipi sono **bugie del compilatore**: alla
prima divergenza tra schema dichiarato e payload reale, il client tratta
dati malformati come se fossero corretti, generando crash silenziosi
profondi nel render tree.

Vol. II §5.3 richiede che il client non debba mai analizzare stringhe
per capire cosa sia successo: deve poter agire in base al codice di
errore. Per arrivarci serve prima un contratto runtime verificabile.

## Decisione

Adottiamo **zod** come unico schema runtime dei contratti API remoti.
Per ogni modulo `src/lib/api/<name>.ts` esiste un fratello
`src/lib/api/<name>.schemas.ts` che esporta:

1. Gli `*Schema` di input/output (z.object con `.passthrough()` quando
   il backend può aggiungere campi senza versioning).
2. I `safeParse*<Endpoint>(data: unknown): T | null` che applicano la
   strategia **strangler**:
   - se il payload è valido → ritorna l'oggetto tipato
   - se è invalido → log warn strutturato + ritorna `null`, **mai
     throw**.

## Conseguenze

**Positive**

- Gli schemi possono essere introdotti modulo-per-modulo senza rompere
  i call-site esistenti (i chiamanti continuano ad accedere al payload
  raw e ricevono solo il warning aggiuntivo nei log).
- I log warn diventano un pre-allarme strutturato per la divergenza tra
  contratto dichiarato e contratto reale (Vol. II §12.2 error tracking).
- Quando un modulo è abbastanza coperto, il chiamante può iniziare a
  fare `const parsed = safeParseX(json); if (!parsed) return fallback;`
  e migrare progressivamente verso il tipo zod-derived.

**Negative**

- Doppia definizione (interface + schema) finché lo strangler non è
  completato; va accettato come debito temporaneo.
- Lo schema deve restare sincronizzato manualmente con il backend; il
  log warn è il segnale che la sincronizzazione si è rotta.

## Alternative scartate

- **io-ts**: API più verbosa, type-inference meno ergonomica.
- **TypeBox**: ottimo per JSON Schema ma meno diffuso nel ecosistema React.
- **Solo TypeScript**: lascia il problema irrisolto (validazione runtime
  assente).

## Stato di adozione

| Modulo | Schema | safeParse adottato in call-site |
|---|---|---|
| `wcaAppApi` (discover/scrape/checkIds/jobStart) | ✅ | ✅ |
| `checkInbox` | ✅ | ✅ |
| `wcaScraper` | facade su wcaAppApi | indiretto |
