/**
 * Shared grid layout for ContactCard and ContactListPanel header.
 *
 * Layout v2 (BCA-style):
 *  Col1: checkbox+index (52px)
 *  Col2: bandiera grande + codice paese (60px)
 *  Col3: azienda + posizione + nome contatto (flex)
 *  Col4: città + canali (allineati sinistra)
 *  Col5: stato/score + menu
 */
export const CONTACT_GRID_COLS =
  "52px 60px minmax(180px,1.4fr) minmax(160px,1fr) 110px";
export const CONTACT_GRID_CLASS = "grid items-center gap-x-2";

/** Capitalize first letter, rest lowercase */
export function capitalizeLabel(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
