/**
 * CoPilotContext — registry leggero per le pagine V2 che vogliono esporre
 * "azioni controllabili dal Co-Pilot" (apertura modali, applicazione filtri).
 *
 * Le pagine registrano handler con `useCoPilotRegister(name, handler)`.
 * Il listener globale in AuthenticatedLayout li invoca quando arriva un
 * evento `ai-ui-action` di tipo open_modal/apply_filter.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createLogger } from "@/lib/log";

const log = createLogger("CoPilotContext");

export type CoPilotHandler = (params: Record<string, unknown>) => void | Promise<void>;

interface CoPilotContextValue {
  registerModal: (name: string, handler: CoPilotHandler) => () => void;
  registerFilter: (scope: string, handler: CoPilotHandler) => () => void;
  invokeModal: (name: string, params: Record<string, unknown>) => boolean;
  invokeFilter: (scope: string, params: Record<string, unknown>) => boolean;
  isEnabled: boolean;
  setEnabled: (v: boolean) => void;
}

const Ctx = createContext<CoPilotContextValue | null>(null);

export function CoPilotProvider({ children }: { children: ReactNode }) {
  const modalsRef = useRef<Map<string, CoPilotHandler>>(new Map());
  const filtersRef = useRef<Map<string, CoPilotHandler>>(new Map());
  const [isEnabled, setEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem("copilot.enabled") !== "false";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try { localStorage.setItem("copilot.enabled", isEnabled ? "true" : "false"); } catch { /* noop */ }
  }, [isEnabled]);

  const registerModal = useCallback((name: string, handler: CoPilotHandler) => {
    modalsRef.current.set(name, handler);
    return () => { modalsRef.current.delete(name); };
  }, []);

  const registerFilter = useCallback((scope: string, handler: CoPilotHandler) => {
    filtersRef.current.set(scope, handler);
    return () => { filtersRef.current.delete(scope); };
  }, []);

  const invokeModal = useCallback((name: string, params: Record<string, unknown>) => {
    const h = modalsRef.current.get(name);
    if (!h) {
      log.warn("modal handler not registered", { name });
      return false;
    }
    try { void h(params); } catch (e) { log.warn("modal handler error", { error: String(e) }); }
    return true;
  }, []);

  const invokeFilter = useCallback((scope: string, params: Record<string, unknown>) => {
    const h = filtersRef.current.get(scope);
    if (!h) {
      // fallback: emetto l'evento ai-command già usato dal sistema
      window.dispatchEvent(new CustomEvent("ai-command", { detail: { filters: params } }));
      return false;
    }
    try { void h(params); } catch (e) { log.warn("filter handler error", { error: String(e) }); }
    return true;
  }, []);

  // Bridge: ascolto l'evento `copilot-open-modal` emesso dal listener globale
  // (`ai-ui-action` → `open_modal`) e provo a invocare l'handler della pagina.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { name?: string; params?: Record<string, unknown> } | undefined;
      if (!detail?.name) return;
      const ok = !!modalsRef.current.get(detail.name);
      if (!ok) {
        log.warn("open_modal: nessun handler registrato per la route corrente", { name: detail.name });
        return;
      }
      const h = modalsRef.current.get(detail.name);
      try { void h?.(detail.params || {}); } catch (err) { log.warn("modal handler error", { error: String(err) }); }
    };
    window.addEventListener("copilot-open-modal", handler);
    return () => window.removeEventListener("copilot-open-modal", handler);
  }, []);

  return (
    <Ctx.Provider value={{ registerModal, registerFilter, invokeModal, invokeFilter, isEnabled, setEnabled }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCoPilot(): CoPilotContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Non lancio: il Co-Pilot deve essere opzionale.
    return {
      registerModal: () => () => undefined,
      registerFilter: () => () => undefined,
      invokeModal: () => false,
      invokeFilter: () => false,
      isEnabled: false,
      setEnabled: () => undefined,
    };
  }
  return ctx;
}

/** Helper per le pagine: registra un handler di modale finché il componente è montato. */
export function useCoPilotRegisterModal(name: string, handler: CoPilotHandler): void {
  const { registerModal } = useCoPilot();
  useEffect(() => registerModal(name, handler), [name, handler, registerModal]);
}

/** Helper per le pagine: registra un handler di filtro finché il componente è montato. */
export function useCoPilotRegisterFilter(scope: string, handler: CoPilotHandler): void {
  const { registerFilter } = useCoPilot();
  useEffect(() => registerFilter(scope, handler), [scope, handler, registerFilter]);
}