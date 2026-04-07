import { useState } from "react";

export function useAcquisitionFilters(initialDelay: number) {
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [delaySeconds, setDelaySeconds] = useState(initialDelay);
  const [includeEnrich, setIncludeEnrich] = useState(false);
  const [includeDeepSearch, setIncludeDeepSearch] = useState(false);

  return {
    selectedCountries, setSelectedCountries,
    selectedNetworks, setSelectedNetworks,
    delaySeconds, setDelaySeconds,
    includeEnrich, setIncludeEnrich,
    includeDeepSearch, setIncludeDeepSearch,
  };
}
