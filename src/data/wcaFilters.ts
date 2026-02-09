export const WCA_NETWORKS = [
  "WCA Inter Global",
  "WCA China Global",
  "WCA First",
  "WCA Advanced Professionals",
  "WCA Projects",
  "WCA Dangerous Goods",
  "WCA Perishables",
  "WCA Time Critical",
  "WCA Pharma",
] as const;

export const WCA_REGIONS = [
  "Africa",
  "Asia Pacific",
  "Europe",
  "Middle East",
  "North America",
  "Central America & Caribbean",
  "South America",
  "Oceania",
] as const;

export const WCA_SERVICES = [
  "Air Freight",
  "Ocean Freight",
  "Road Freight",
  "Rail Freight",
  "Courier Services",
  "Logistics / 4PL",
  "Supply Chain Management",
  "Heavy Lift / Breakbulk",
  "Dangerous Goods",
  "Perishables",
  "Pharma",
] as const;

export type WCANetwork = typeof WCA_NETWORKS[number];
export type WCARegion = typeof WCA_REGIONS[number];
export type WCAService = typeof WCA_SERVICES[number];
