export const v3Keys = {
  v3: {
    operatori: ["v3", "operatori"] as const,
    contatti: (filtri?: unknown) => ["v3", "contatti", filtri] as const,
    contattiPaesi: ["v3", "contatti-paesi"] as const,
    contatto: (id?: string | null) => ["v3", "contatto", id ?? null] as const,
    contattoInterazioni: (id?: string | null) => ["v3", "contatto-interazioni", id ?? null] as const,
  },
} as const;
