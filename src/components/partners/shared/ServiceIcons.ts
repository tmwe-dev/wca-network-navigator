import {
  Plane, Ship, Container, Truck, TrainFront, Package, AlertTriangle,
  Snowflake, Pill, ShoppingCart, Home, FileCheck, Warehouse, Anchor, Box,
  Boxes, ThermometerSnowflake, Banknote, Briefcase, Stamp, ShieldAlert,
  Radar, Globe2, Forklift, Boat, Cog, Building2, Wrench, ClipboardList,
  Wine, Fuel, Car, Sprout, Leaf, Hammer, Microscope, BookOpen, MonitorSmartphone,
} from "lucide-react";

export const SERVICE_ICONS: Record<string, any> = {
  air_freight: Plane,
  ocean_fcl: Ship,
  ocean_lcl: Container,
  road_freight: Truck,
  rail_freight: TrainFront,
  project_cargo: Package,
  dangerous_goods: AlertTriangle,
  perishables: Snowflake,
  pharma: Pill,
  ecommerce: ShoppingCart,
  relocations: Home,
  customs_broker: FileCheck,
  warehousing: Warehouse,
  nvocc: Anchor,
  fulfillment: Boxes,
  cold_chain: ThermometerSnowflake,
  finance: Banknote,
  consulting: Briefcase,
  customs_clearance: Stamp,
  dual_use: ShieldAlert,
  tracking: Radar,
  multimodal: Globe2,
  forklift: Forklift,
  port_services: Boat,
  machinery: Cog,
  construction: Hammer,
  contract_logistics: ClipboardList,
  beverages: Wine,
  oil_gas: Fuel,
  automotive: Car,
  agriculture: Sprout,
  bio: Leaf,
  industrial: Wrench,
  research: Microscope,
  documents: BookOpen,
  tech: MonitorSmartphone,
  office: Building2,
};

export const PARTNER_TYPE_ICONS: Record<string, any> = {
  freight_forwarder: Truck,
  customs_broker: FileCheck,
  carrier: Ship,
  nvocc: Anchor,
  "3pl": Warehouse,
  courier: Package,
};

export function getServiceIcon(category: string) {
  return SERVICE_ICONS[category] || Box;
}

/**
 * Smart label → icon resolver.
 * Matches Italian + English keywords to distinctive lucide icons so that two
 * different services (es. "Fulfillment" vs "Catena del freddo") never share the
 * same icon. Returns a generic Box only as last resort.
 */
export function resolveServiceIcon(label: string) {
  const s = label.toLowerCase();
  // Direct registry hit (snake_case keys)
  const direct = SERVICE_ICONS[s.replace(/[\s-]+/g, "_")];
  if (direct) return direct;

  const rules: ReadonlyArray<readonly [RegExp, any]> = [
    [/\b(air|aer|aviation|cargo aere)/, Plane],
    [/\b(sea|ocean|mare|maritt|marit|fcl|lcl|naval)/, Ship],
    [/\b(port|porto|terminal|banchina)/, Boat],
    [/\b(road|truck|camion|strada|gomma|trasporto su)/, Truck],
    [/\b(rail|ferro|treno|intermod\b)/, TrainFront],
    [/\b(multimod|combinato)/, Globe2],
    [/\b(warehouse|magazz|stoccag|deposit)/, Warehouse],
    [/\b(fulfill|picking|packing|e-?fulfil)/, Boxes],
    [/\b(forklift|muletto|carrello)/, Forklift],
    [/\b(cold|freddo|refriger|frigo|reefer|catena del freddo|temperatur)/, ThermometerSnowflake],
    [/\b(perish|deperib|fresh|food)/, Snowflake],
    [/\b(pharma|farmac|medic|gdp)/, Pill],
    [/\b(dangerous|hazmat|adr|imo|pericol)/, AlertTriangle],
    [/\b(dual.?use|critic|export control|duplice)/, ShieldAlert],
    [/\b(custom|dogan|sdogan|brokerage|accredita)/, Stamp],
    [/\b(compliance|fiscal|tax|iva|fea|finanz|banc|payment|pagament)/, Banknote],
    [/\b(consul|advisor|outsourc|strateg)/, Briefcase],
    [/\b(track|monitor|visibil|gps|app\b|tracker)/, Radar],
    [/\b(project|oversize|breakbulk|heavy lift|opera)/, Package],
    [/\b(reloc|relocation|trasloc|moving|household)/, Home],
    [/\b(courier|express|overnight|corrier)/, Package],
    [/\b(ecom|e-?commerce|marketplace|amazon|fba)/, ShoppingCart],
    [/\b(nvocc|consolidat|groupage)/, Anchor],
    [/\b(contract logist|3pl|4pl|outsourcing logist)/, ClipboardList],
    [/\b(machin|macchin|impianti)/, Cog],
    [/\b(construct|cantier|edil)/, Hammer],
    [/\b(beverag|wine|bevand|liquid bulk)/, Wine],
    [/\b(oil|gas|petrol|chemical|chimic)/, Fuel],
    [/\b(auto|car\b|veicol|vehicle)/, Car],
    [/\b(agri|cereal|grain|frutta)/, Sprout],
    [/\b(bio|green|sustain|sosten)/, Leaf],
    [/\b(industrial|industr|mecca)/, Wrench],
    [/\b(research|laborat|scient)/, Microscope],
    [/\b(document|papers|paperwork|dichiar)/, BookOpen],
    [/\b(tech|software|it\b|digital|electron)/, MonitorSmartphone],
    [/\b(office|sede|head office|branch|filial)/, Building2],
  ];

  for (const [re, Icon] of rules) {
    if (re.test(s)) return Icon;
  }
  return Box;
}

export const TRANSPORT_SERVICES = [
  "air_freight", "ocean_fcl", "ocean_lcl", "road_freight", "rail_freight", "project_cargo",
];

export const SPECIALTY_SERVICES = [
  "dangerous_goods", "perishables", "pharma", "ecommerce", "relocations", "customs_broker", "warehousing", "nvocc",
];
