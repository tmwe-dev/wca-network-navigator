export const v3Keys = {
  v3: {
    operatori: ["v3", "operatori"] as const,
    contatti: (filtri?: unknown) => ["v3", "contatti", filtri] as const,
    contattiPaesi: ["v3", "contatti-paesi"] as const,
    contatto: (id?: string | null) => ["v3", "contatto", id ?? null] as const,
    contattoInterazioni: (id?: string | null) => ["v3", "contatto-interazioni", id ?? null] as const,
    messaggi: (filtri?: unknown) => ["v3", "messaggi", filtri] as const,
    messaggio: (id?: string | null) => ["v3", "messaggio", id ?? null] as const,
    messaggioThread: (threadId?: string | null) => ["v3", "messaggio-thread", threadId ?? null] as const,
    caselle: ["v3", "caselle"] as const,
    regole: (filtri?: unknown) => ["v3", "regole", filtri] as const,
    gruppiMittenti: ["v3", "gruppi-mittenti"] as const,
    classificazioni: (filtri?: unknown) => ["v3", "classificazioni", filtri] as const,
    qualitaClassificazione: (giorni?: number) => ["v3", "qualita-classificazione", giorni ?? null] as const,
    approvazioni: (filtri?: unknown) => ["v3", "approvazioni", filtri] as const,
    sintesiApprovazioni: (stato?: string) => ["v3", "sintesi-approvazioni", stato ?? null] as const,
    modelli: (filtri?: unknown) => ["v3", "modelli", filtri] as const,
    agenda: (filtri?: unknown) => ["v3", "agenda", filtri] as const,
    campagne: (giorni?: number) => ["v3", "campagne", giorni ?? null] as const,
    coda: (filtri?: unknown) => ["v3", "coda", filtri] as const,
  },
} as const;

