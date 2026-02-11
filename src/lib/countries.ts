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
