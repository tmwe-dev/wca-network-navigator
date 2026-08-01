/**
 * qualityRules.ts — Scoring rules, weights, thresholds, and constants for partner quality
 * LOVABLE-93: Partner Quality Score engine constants and rule definitions
 */

export const QUALITY_WEIGHTS = {
  profilePresence: 0.25,
  businessSolidity: 0.3,
  servicesCapacity: 0.25,
  deepIntelligence: 0.2,
};

export const STAR_THRESHOLDS = {
  oneStar: 20,
  twoStars: 40,
  threeStars: 60,
  fourStars: 80,
  fiveStars: 100,
};

export const WCA_MODIFIER_BOUNDS = {
  min: -20,
  max: 30,
};

export const HIGH_RISK_COUNTRIES = [
  "IN",
  "BD",
  "PK",
  "NG",
  "GH",
  "KE",
  "TZ",
  "UG",
  "ET",
  "CM",
  "CI",
  "SN",
  "ML",
  "BF",
  "NE",
  "TD",
  "CD",
  "CG",
  "AO",
  "MZ",
  "MG",
  "ZW",
  "ZM",
  "MW",
];

export const DOCTRINE_CATEGORIES = [
  "system_doctrine",
  "system_core",
  "memory_protocol",
  "learning_protocol",
  "workflow_gate",
  "doctrine",
  "sales_doctrine",
];

export const PROFILE_PRESENCE_SCORES = {
  profile: { complete: 20, moderate: 10, minimal: 5, none: 0 },
  quality: { analyzed: 10, notAnalyzed: 0 },
  website: { present: 10, absent: 0 },
  linkedin: { present: 10, absent: 0 },
  logo: { present: 5, absent: 0 },
  contact: { emailAndPhone: 15, emailOnly: 10, nameOnly: 5, none: 0 },
};

export const BUSINESS_SOLIDITY_SCORES = {
  membership: {
    tenPlus: 25,
    fivePlus: 20,
    threeToFour: 15,
    oneToTwo: 10,
    lessThanOne: 5,
    none: 0,
  },
  networks: { threePlus: 20, two: 15, one: 10, none: 0 },
  certifications: {
    threePlus: 20,
    two: 15,
    one: 10,
    none: 0,
  },
};

export const SERVICES_CAPACITY_SCORES = {
  services: {
    fivePlus: 25,
    threeToFour: 20,
    oneToTwo: 15,
    none: 0,
  },
  diversity: {
    fourPlus: 15,
    twoToThree: 10,
    one: 5,
    none: 0,
  },
};

export const WCA_BONUS_POINTS = {
  courierExpress: 8,
  ownFleet: 6,
  ownWarehouses: 5,
  bondedWarehouse: 5,
  internalCustoms: 6,
  airFreightIATA: 4,
  strategicRoutes: 6,
  strategicBranches: 4,
};

export const WCA_PENALTY_POINTS = {
  fclOnly: -10,
  youngHighRisk: -8,
  noCertsYoung: -5,
};

export const CAPABILITY_KEYWORDS = {
  fleet: [
    "own fleet",
    "own trucks",
    "propri mezzi",
    "furgoni",
    "camion di proprietà",
    "own vehicles",
    "proprietary fleet",
  ],
  warehouse: [
    "own warehouse",
    "magazzino proprio",
    "magazzino diretto",
    "direct warehouse",
    "storage facility",
    "proprio deposito",
  ],
  bonded: [
    "bonded warehouse",
    "deposito doganale",
    "magazzino in regime doganale",
    "bonded facility",
  ],
  customs: [
    "customs clearance",
    "sdoganamento",
    "operazioni doganali",
    "dogana interna",
    "in-house customs",
  ],
};
