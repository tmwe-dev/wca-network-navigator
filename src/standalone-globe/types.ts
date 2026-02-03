// Globe Partner interface
export interface GlobePartner {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  country_name: string;
  email: string | null;
  partner_type: string | null;
  lat: number;
  lng: number;
}

// Country with partner count
export interface CountryWithPartners {
  code: string;
  name: string;
  count: number;
  lat: number;
  lng: number;
  region: 'europe' | 'asia' | 'americas' | 'africa' | 'oceania' | 'middle_east';
}

// WCA Country base interface
export interface WCACountry {
  code: string;
  name: string;
  lat: number;
  lng: number;
  region: 'europe' | 'asia' | 'americas' | 'africa' | 'oceania' | 'middle_east';
}

// Props for the main globe component
export interface StandaloneGlobeProps {
  selectedCountry: string | null;
  onCountrySelect: (countryCode: string | null) => void;
  countries?: CountryWithPartners[];
  countryPartners?: GlobePartner[];
}
