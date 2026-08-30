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
  },
} as const;

