import { useState, useCallback, useEffect } from "react";
import { createLogger } from "@/lib/log";

const log = createLogger("useOutreachMock");

const STORAGE_KEY = "demo-data-enabled";

// Migration: read old key if new one isn't set
function getInitialState(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v !== null) return v === "true";
    // fallback to old key
    const old = localStorage.getItem("outreach-mock-enabled");
    if (old === "true") {
      localStorage.setItem(STORAGE_KEY, "true");
      return true;
    }
    return false;
  } catch (e) {
    log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

export function useOutreachMock() {
  const [mockEnabled, setMockEnabled] = useState(getInitialState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(mockEnabled));
    } catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); /* noop */ }
  }, [mockEnabled]);

  const toggleMock = useCallback(() => setMockEnabled(prev => !prev), []);

  return { mockEnabled, toggleMock };
}
