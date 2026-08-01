import { useState, useCallback } from "react";

export function useLiveAnnounce() {
  const [message, setMessage] = useState("");

  const announce = useCallback((text: string) => {
    setMessage("");
    requestAnimationFrame(() => setMessage(text));
  }, []);

  return { message, announce };
}
