import { useEffect } from "react";

const CHUNK_RELOAD_KEY = "__vite_chunk_reload_at__";
const CHUNK_RELOAD_COOLDOWN_MS = 15000;
const DYNAMIC_IMPORT_ERROR_RE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

type VitePreloadErrorEvent = Event & {
  payload?: unknown;
};

function getReasonMessage(reason: unknown): string {
  if (reason instanceof Error) return `${reason.name}: ${reason.message}`;
  if (typeof reason === "string") return reason;
  if (
    reason &&
    typeof reason === "object" &&
    "message" in reason &&
    typeof (reason as { message?: unknown }).message === "string"
  ) {
    return String((reason as { message: string }).message);
  }
  return "";
}

function reloadOncePerCooldown(source: string, detail?: unknown) {
  try {
    const lastReloadAt = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || "0");
    const now = Date.now();

    if (now - lastReloadAt < CHUNK_RELOAD_COOLDOWN_MS) {
      console.warn("[ViteChunkRecovery] reload skipped (cooldown active)", { source, detail });
      return;
    }

    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
    console.warn("[ViteChunkRecovery] reloading after chunk load failure", { source, detail });
    window.location.reload();
  } catch (error) {
    console.warn("[ViteChunkRecovery] fallback reload", { source, detail, error });
    window.location.reload();
  }
}

export function ViteChunkRecovery() {
  useEffect(() => {
    const handleVitePreloadError = (event: VitePreloadErrorEvent) => {
      event.preventDefault();
      reloadOncePerCooldown("vite:preloadError", event.payload);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = getReasonMessage(event.reason);
      if (!DYNAMIC_IMPORT_ERROR_RE.test(message)) return;

      event.preventDefault();
      reloadOncePerCooldown("unhandledrejection", message);
    };

    const handleWindowError = (event: ErrorEvent) => {
      const message = event.message || getReasonMessage(event.error);
      if (!DYNAMIC_IMPORT_ERROR_RE.test(message)) return;

      event.preventDefault();
      reloadOncePerCooldown("window:error", message);
    };

    window.addEventListener("vite:preloadError", handleVitePreloadError as EventListener);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleWindowError);

    return () => {
      window.removeEventListener("vite:preloadError", handleVitePreloadError as EventListener);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleWindowError);
    };
  }, []);

  return null;
}
