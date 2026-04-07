/** Shared grid layout for ContactCard and ContactListPanel header */
export const CONTACT_GRID_COLS = "42px 36px minmax(160px,1fr) minmax(120px,1fr) 90px 90px";
export const CONTACT_GRID_CLASS = "grid items-center gap-x-1.5";

/** Capitalize first letter, rest lowercase */
export function capitalizeLabel(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
