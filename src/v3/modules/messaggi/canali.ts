/**
 * Etichette dei canali e formattazioni condivise dalle maschere del Modulo 3.
 */
import { V3_CANALI } from "@/data/v3/messaggi";

export { V3_CANALI };

export const ETICHETTE_CANALE: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
};

export function etichettaCanale(canale: string | null): string {
  if (!canale) return "—";
  return ETICHETTE_CANALE[canale] ?? canale;
}

export function mittente(nome: string | null, indirizzo: string | null): string {
  return nome?.trim() || indirizzo?.trim() || "Mittente sconosciuto";
}

/** Data compatta: oggi mostra l'ora, altrimenti giorno e mese. */
export function dataMessaggio(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const oggi = new Date();
  const stessoGiorno =
    date.getDate() === oggi.getDate() &&
    date.getMonth() === oggi.getMonth() &&
    date.getFullYear() === oggi.getFullYear();
  return stessoGiorno
    ? date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "2-digit" });
}

export function dataEstesa(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
