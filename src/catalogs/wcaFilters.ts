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

const WCA_REGIONS_INTERNAL = [
  "Africa",
  "Asia Pacific",
  "Europe",
  "Middle East",
  "North America",
  "Central America & Caribbean",
  "South America",
  "Oceania",
] as const;

const WCA_SERVICES_INTERNAL = [
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

type WCARegion = typeof WCA_REGIONS_INTERNAL[number];
type WCAService = typeof WCA_SERVICES_INTERNAL[number];
