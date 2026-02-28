/**
 * Centralized React Query key factory.
 * Use these helpers everywhere to guarantee cache consistency.
 */
export const queryKeys = {
  partners: {
    all: ["partners"] as const,
    filtered: (filters?: Record<string, unknown>) => ["partners", filters] as const,
  },
  countryStats: ["country-stats"] as const,
  partnerStats: ["partner-stats"] as const,
  directoryCache: (countryCodes: string[], networkKeys: string[]) =>
    ["directory-cache", countryCodes, networkKeys] as const,
  dbPartnersForCountries: (countryCodes: string[]) =>
    ["db-partners-for-countries", countryCodes] as const,
  noProfileWcaIds: (countryCodes: string[]) =>
    ["no-profile-wca-ids", countryCodes] as const,
} as const;
