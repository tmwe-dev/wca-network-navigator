/**
 * Resolve Supabase env vars with fallback names and clear error reporting.
 */

export function getSupabaseEnv() {
  const url =
    import.meta.env.VITE_SUPABASE_URL as string | undefined;

  const key =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

  if (!url || !key) {
    const missing: string[] = [];
    if (!url) missing.push("VITE_SUPABASE_URL");
    if (!key) missing.push("VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_ANON_KEY");
    const msg = `[Supabase] Missing env vars: ${missing.join(", ")}. App cannot start.`;
    console.error(msg);
    // Show visible error in DOM for cases where React hasn't mounted yet
    if (typeof document !== "undefined") {
      const el = document.getElementById("root");
      if (el && !el.hasChildNodes()) {
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#ef4444;padding:2rem;text-align:center";
        const inner = document.createElement("div");
        const h2 = document.createElement("h2");
        h2.textContent = "\u26a0\ufe0f Configurazione mancante";
        const p = document.createElement("p");
        p.style.cssText = "margin-top:0.5rem;color:#888";
        p.textContent = msg;
        inner.appendChild(h2);
        inner.appendChild(p);
        wrapper.appendChild(inner);
        el.appendChild(wrapper);
      }
    }
    throw new Error(msg);
  }

  return { url, key };
}
