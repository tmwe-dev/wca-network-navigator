/**
 * Store minimale globale per il dialog "Scrivi su WhatsApp" (invio diretto a un numero,
 * anche senza conversazione pregressa). Nessuna logica di invio qui: solo stato UI.
 */
import { useSyncExternalStore } from "react";

export type WhatsAppQuickTarget = {
  phone: string;
  contactName?: string | null;
  companyName?: string | null;
  contactId?: string | null;
  partnerId?: string | null;
  initialMessage?: string;
};

type State = { open: boolean; target: WhatsAppQuickTarget | null };

let state: State = { open: false, target: null };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function openWhatsAppQuick(target: WhatsAppQuickTarget) {
  state = { open: true, target };
  emit();
}

export function closeWhatsAppQuick() {
  state = { open: false, target: null };
  emit();
}

export function useWhatsAppQuickState(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
