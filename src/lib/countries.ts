// Country flag emoji from country code
export function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  
  return String.fromCodePoint(...codePoints);
}

// Format years of membership
export function getYearsMember(memberSince: string | null): number {
  if (!memberSince) return 0;
  const start = new Date(memberSince);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365));
}

// Format partner type for display
export function formatPartnerType(type: string | null): string {
  if (!type) return "Partner";
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Format service category for display
export function formatServiceCategory(category: string): string {
  return category
    .split("_")
    .map((word) => word.toUpperCase())
    .join(" ");
}

// Service category colors - unified muted palette
export function getServiceColor(_category: string): string {
  return "bg-muted text-foreground border border-border";
}

// Service category icon names for lucide-react
export function getServiceIconName(category: string): string {
  const icons: Record<string, string> = {
    air_freight: "Plane",
    ocean_fcl: "Ship",
    ocean_lcl: "Ship",
    road_freight: "Truck",
    rail_freight: "TrainFront",
    project_cargo: "Package",
    dangerous_goods: "AlertTriangle",
    perishables: "Snowflake",
    pharma: "Pill",
    ecommerce: "ShoppingCart",
    relocations: "Home",
    customs_broker: "FileCheck",
    warehousing: "Warehouse",
    nvocc: "Anchor",
  };
  return icons[category] || "Box";
}

// Service icon color mapping (Tailwind classes)
export function getServiceIconColor(category: string): string {
  const colors: Record<string, string> = {
    air_freight: "text-sky-500",
    ocean_fcl: "text-blue-500",
    ocean_lcl: "text-blue-400",
    road_freight: "text-amber-500",
    rail_freight: "text-slate-500",
    project_cargo: "text-orange-500",
    dangerous_goods: "text-red-500",
    perishables: "text-cyan-400",
    pharma: "text-purple-500",
    ecommerce: "text-green-500",
    relocations: "text-teal-500",
    customs_broker: "text-indigo-500",
    warehousing: "text-stone-500",
    nvocc: "text-slate-600",
  };
  return colors[category] || "text-muted-foreground";
}

// Partner type icon name mapping
export function getPartnerTypeIconName(type: string | null): string {
  const icons: Record<string, string> = {
    freight_forwarder: "Truck",
    customs_broker: "FileCheck",
    carrier: "Ship",
    nvocc: "Anchor",
    "3pl": "Warehouse",
    courier: "Package",
  };
  return icons[type || ""] || "Box";
}

// Priority colors
export function getPriorityColor(priority: string | null): string {
  switch (priority) {
    case "high":
      return "bg-destructive text-destructive-foreground";
    case "medium":
      return "bg-warning text-warning-foreground";
    case "low":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}
