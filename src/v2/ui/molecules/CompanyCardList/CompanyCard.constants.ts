/**
 * CompanyCard.constants — Solo classi Tailwind e mapping visivi.
 * Estratti dal componente per snellirlo. Nessuna logica.
 */
import type { CompanySource } from "./types";

export const CARD_BORDER: Record<CompanySource, string> = {
  wca: "border-primary/30 hover:border-primary/55",
  crm: "border-chart-2/30 hover:border-chart-2/55",
  bca: "border-success/30 hover:border-success/55",
};

export const CARD_STRIPE: Record<CompanySource, string> = {
  wca: "from-primary/85 to-primary/25",
  crm: "from-chart-2/85 to-chart-2/25",
  bca: "from-success/85 to-success/25",
};

export const BADGE_BASE =
  "inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[10px] font-semibold leading-none";

export const CHIP_BASE =
  "inline-flex h-6 min-w-0 items-center gap-1 rounded-md border px-2 text-[11px] font-medium leading-none";