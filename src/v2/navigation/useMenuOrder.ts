/**
 * useMenuOrder — ordine persistente dell'unico menu di sistema.
 * L'utente sposta le voci su/giù; l'ordine è memorizzato in localStorage.
 * Le voci nuove (aggiunte al codice dopo il salvataggio) finiscono in coda.
 */
import * as React from "react";
import { MENU_ITEMS, MENU_ITEM_BY_PATH, type MenuItemDef } from "./menuItems";

const STORAGE_KEY = "v2.menu.order.v1";

function leggiOrdine(): readonly string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

function componi(ordine: readonly string[]): readonly MenuItemDef[] {
  const visti = new Set<string>();
  const out: MenuItemDef[] = [];
  for (const path of ordine) {
    const item = MENU_ITEM_BY_PATH.get(path);
    if (item && !visti.has(path)) {
      visti.add(path);
      out.push(item);
    }
  }
  for (const item of MENU_ITEMS) if (!visti.has(item.path)) out.push(item);
  return out;
}

export interface MenuOrderApi {
  readonly items: readonly MenuItemDef[];
  readonly muovi: (path: string, direzione: -1 | 1) => void;
  readonly reimposta: () => void;
}

export function useMenuOrder(): MenuOrderApi {
  const [ordine, setOrdine] = React.useState<readonly string[]>(() => leggiOrdine());

  const items = React.useMemo(() => componi(ordine), [ordine]);

  const salva = React.useCallback((nuovo: readonly string[]) => {
    setOrdine(nuovo);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nuovo));
    } catch {
      /* storage non disponibile: l'ordine resta valido solo per la sessione */
    }
  }, []);

  const muovi = React.useCallback(
    (path: string, direzione: -1 | 1) => {
      const attuale = items.map((i) => i.path);
      const idx = attuale.indexOf(path);
      const target = idx + direzione;
      if (idx < 0 || target < 0 || target >= attuale.length) return;
      const nuovo = attuale.slice();
      [nuovo[idx], nuovo[target]] = [nuovo[target], nuovo[idx]];
      salva(nuovo);
    },
    [items, salva],
  );

  const reimposta = React.useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    setOrdine([]);
  }, []);

  return { items, muovi, reimposta };
}
