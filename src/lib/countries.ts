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

// Service category colors
export function getServiceColor(category: string): string {
  const colors: Record<string, string> = {
    air_freight: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    ocean_fcl: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    ocean_lcl: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    road_freight: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    rail_freight: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    project_cargo: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    dangerous_goods: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    perishables: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    pharma: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    ecommerce: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
    relocations: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
    customs_broker: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
    warehousing: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
    nvocc: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  };
  return colors[category] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
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
