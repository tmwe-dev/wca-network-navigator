import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type RecordSourceType =
  | "partner"
  | "contact"
  | "prospect"
  | "bca"
  | "business_card"
  | "voice_session"
  | "campaign"
  | "task";

export interface DrawerTarget {
  sourceType: RecordSourceType;
  sourceId: string;
  /** Optional title for breadcrumb display */
  title?: string;
}

interface ContactDrawerContextValue {
  isOpen: boolean;
  target: DrawerTarget | null;
  list: DrawerTarget[];
  currentIndex: number;
  open: (target: DrawerTarget, list?: DrawerTarget[]) => void;
  close: () => void;
  goNext: () => void;
  goPrev: () => void;
}

const ContactDrawerContext = createContext<ContactDrawerContextValue | null>(null);

export function ContactDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [target, setTarget] = useState<DrawerTarget | null>(null);
  const [list, setList] = useState<DrawerTarget[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const open = useCallback((t: DrawerTarget, navList?: DrawerTarget[]) => {
    setTarget(t);
    setIsOpen(true);
    if (navList && navList.length > 0) {
      setList(navList);
      const idx = navList.findIndex(item => item.sourceId === t.sourceId && item.sourceType === t.sourceType);
      setCurrentIndex(idx >= 0 ? idx : 0);
    } else {
      setList([t]);
      setCurrentIndex(0);
    }
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setTarget(null);
  }, []);

  const goNext = useCallback(() => {
    if (currentIndex < list.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setTarget(list[nextIdx]);
    }
  }, [currentIndex, list]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      setTarget(list[prevIdx]);
    }
  }, [currentIndex, list]);

  return (
    <ContactDrawerContext.Provider value={{ isOpen, target, list, currentIndex, open, close, goNext, goPrev }}>
      {children}
    </ContactDrawerContext.Provider>
  );
}

export function useContactDrawer() {
  const ctx = useContext(ContactDrawerContext);
  if (!ctx) throw new Error("useContactDrawer must be used within ContactDrawerProvider");
  return ctx;
}

/**
 * Unified entity drawer alias. Same backing context as useContactDrawer
 * but exposes a friendlier API for any entity type:
 *   const { openEntity, close, target } = useEntityDrawer();
 *   openEntity('partner', partnerId, partnerName);
 */
export function useEntityDrawer() {
  const ctx = useContactDrawer();
  return {
    ...ctx,
    openEntity: (sourceType: RecordSourceType, sourceId: string, title?: string) =>
      ctx.open({ sourceType, sourceId, title }),
  };
}