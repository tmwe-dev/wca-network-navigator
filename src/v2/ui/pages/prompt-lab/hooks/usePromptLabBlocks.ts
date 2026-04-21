/**
 * usePromptLabBlocks — state manager generico per blocchi di un tab.
 */
import { useCallback, useEffect, useState } from "react";
import type { Block } from "../types";

export function usePromptLabBlocks(initialLoader: () => Promise<Block[]>, deps: ReadonlyArray<unknown> = []) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    initialLoader()
      .then((b) => {
        if (!cancelled) setBlocks(b);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Errore caricamento");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const updateContent = useCallback((id: string, content: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, content, dirty: true } : b)));
  }, []);

  const setImproved = useCallback((id: string, improved: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, improved } : b)));
  }, []);

  const acceptImproved = useCallback((id: string) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id && b.improved ? { ...b, content: b.improved, improved: undefined, dirty: true } : b,
      ),
    );
  }, []);

  const discardImproved = useCallback((id: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, improved: undefined } : b)));
  }, []);

  const acceptAll = useCallback(() => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.improved ? { ...b, content: b.improved, improved: undefined, dirty: true } : b,
      ),
    );
  }, []);

  const markClean = useCallback((id: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, dirty: false } : b)));
  }, []);

  const addBlock = useCallback((block: Block) => {
    setBlocks((prev) => [...prev, block]);
  }, []);

  return {
    blocks,
    loading,
    error,
    updateContent,
    setImproved,
    acceptImproved,
    discardImproved,
    acceptAll,
    markClean,
    addBlock,
    setBlocks,
  };
}