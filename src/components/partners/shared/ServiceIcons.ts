import {
  Plane, Ship, Container, Truck, TrainFront, Package, AlertTriangle,
  Snowflake, Pill, ShoppingCart, Home, FileCheck, Warehouse, Anchor, Box,
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

export const TRANSPORT_SERVICES = [
  "air_freight", "ocean_fcl", "ocean_lcl", "road_freight", "rail_freight", "project_cargo",
];

export const SPECIALTY_SERVICES = [
  "dangerous_goods", "perishables", "pharma", "ecommerce", "relocations", "customs_broker", "warehousing", "nvocc",
];
