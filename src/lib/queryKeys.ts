/**
 * Centralized React Query key factory.
 * Use these helpers everywhere to guarantee cache consistency.
 */
export const queryKeys = {
  partners: {
    all: ["partners"] as const,
    filtered: (filters?: Record<string, unknown>) => ["partners", filters] as const,
  },
  partner: (id: string) => ["partner", id] as const,
  countryStats: ["country-stats"] as const,
  partnerStats: ["partner-stats"] as const,
  directoryCache: (countryCodes: string[], networkKeys: string[]) =>
    ["directory-cache", countryCodes, networkKeys] as const,
  dbPartnersForCountries: (countryCodes: string[]) =>
    ["db-partners-for-countries", countryCodes] as const,
  noProfileWcaIds: (countryCodes: string[]) =>
    ["no-profile-wca-ids", countryCodes] as const,
  downloadJobs: ["download-jobs"] as const,
  userCredits: ["user-credits"] as const,
  sortingJobs: ["sorting-jobs"] as const,
  allActivities: ["all-activities"] as const,
  cacheDataByCountry: ["cache-data-by-country"] as const,
} as const;
