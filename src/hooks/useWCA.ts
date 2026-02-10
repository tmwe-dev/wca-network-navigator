import { useState, useEffect, useCallback, useRef } from "react";

const PROXY_BASE = "http://localhost:8001";

interface SessionInfo {
  authenticated: boolean;
  username?: string;
  loginTime?: string;
}

interface WCAState {
  isAuthenticated: boolean;
  isProxyOnline: boolean;
  loading: boolean;
  error: string | null;
  sessionInfo: SessionInfo | null;
  cookieValue: string | null;
}

function getSavedCredentials(): { username: string; password: string } | null {
  try {
    const raw = localStorage.getItem("wca_credentials");
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function useWCA() {
  const [state, setState] = useState<WCAState>({
    isAuthenticated: false,
    isProxyOnline: false,
    loading: false,
    error: null,
    sessionInfo: null,
    cookieValue: null,
  });

  const credentialsRef = useRef(getSavedCredentials());

  const setPartial = (partial: Partial<WCAState>) =>
    setState((prev) => ({ ...prev, ...partial }));

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`${PROXY_BASE}/api/status`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error("Proxy non raggiungibile");
      const data = await res.json();
      setPartial({
        isProxyOnline: true,
        isAuthenticated: !!data.authenticated,
        sessionInfo: data,
        error: null,
      });
      return data;
    } catch {
      setPartial({ isProxyOnline: false, isAuthenticated: false, error: null });
      return null;
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setPartial({ loading: true, error: null });
    try {
      const res = await fetch(`${PROXY_BASE}/api/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login fallito");
      credentialsRef.current = { username, password };
      setPartial({ loading: false, isAuthenticated: true, sessionInfo: data });
      return data;
    } catch (e: any) {
      setPartial({ loading: false, error: e.message });
      throw e;
    }
  }, []);

  const setManualCookie = useCallback(async (cookie: string) => {
    setPartial({ loading: true, error: null });
    try {
      const res = await fetch(`${PROXY_BASE}/api/set-cookie`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore nel set cookie");
      setPartial({ loading: false, isAuthenticated: true });
      await checkStatus();
      return data;
    } catch (e: any) {
      setPartial({ loading: false, error: e.message });
      throw e;
    }
  }, [checkStatus]);

  const getCookie = useCallback(async () => {
    try {
      const res = await fetch(`${PROXY_BASE}/api/cookie`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore");
      setPartial({ cookieValue: data.cookie || data.value || null });
      return data.cookie || data.value || null;
    } catch (e: any) {
      setPartial({ error: e.message });
      return null;
    }
  }, []);

  const proxyGet = useCallback(async (url: string): Promise<string> => {
    setPartial({ loading: true, error: null });
    try {
      const res = await fetch(`${PROXY_BASE}/api/proxy?url=${encodeURIComponent(url)}`);
      if (res.status === 401) {
        // Try re-auth
        const creds = credentialsRef.current || getSavedCredentials();
        if (creds) {
          await login(creds.username, creds.password);
          const retry = await fetch(`${PROXY_BASE}/api/proxy?url=${encodeURIComponent(url)}`);
          const text = await retry.text();
          setPartial({ loading: false });
          return text;
        }
        throw new Error("Sessione scaduta, effettua il login");
      }
      const text = await res.text();
      setPartial({ loading: false });
      return text;
    } catch (e: any) {
      setPartial({ loading: false, error: e.message });
      throw e;
    }
  }, [login]);

  const proxyPost = useCallback(async (url: string, body: any): Promise<string> => {
    setPartial({ loading: true, error: null });
    try {
      const res = await fetch(`${PROXY_BASE}/api/proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, body, method: "POST" }),
      });
      const text = await res.text();
      setPartial({ loading: false });
      return text;
    } catch (e: any) {
      setPartial({ loading: false, error: e.message });
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${PROXY_BASE}/api/logout`, { method: "POST" });
      setPartial({ isAuthenticated: false, sessionInfo: null, cookieValue: null });
    } catch (e: any) {
      setPartial({ error: e.message });
    }
  }, []);

  const autoAuth = useCallback(async (username: string, password: string) => {
    const status = await checkStatus();
    if (status?.authenticated) return status;
    return login(username, password);
  }, [checkStatus, login]);

  // Polling
  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  return {
    ...state,
    checkStatus,
    login,
    setManualCookie,
    getCookie,
    proxyGet,
    proxyPost,
    logout,
    autoAuth,
  };
}
