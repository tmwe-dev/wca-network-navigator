import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "outreach-mock-enabled";

export function useOutreachMock() {
  const [mockEnabled, setMockEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(mockEnabled));
    } catch { /* noop */ }
  }, [mockEnabled]);

  const toggleMock = useCallback(() => setMockEnabled(prev => !prev), []);

  return { mockEnabled, toggleMock };
}
