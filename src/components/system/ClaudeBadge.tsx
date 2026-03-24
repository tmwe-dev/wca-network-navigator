/**
 * ClaudeBadge — Indicatore visivo "Claude al comando"
 * 🤖 Claude Engine V8 · Diario di bordo #5
 */

import { useState } from "react";

export function ClaudeBadge() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="fixed bottom-6 left-6 z-50 flex items-center gap-2 cursor-pointer select-none"
      onClick={() => setExpanded((e) => !e)}
      title="Moduli Claude attivi"
    >
      {/* Logo Claude — cerchio con simbolo */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110"
        style={{
          background: "linear-gradient(135deg, #D97706, #F59E0B)",
          boxShadow: "0 0 12px rgba(217,119,6,0.4)",
        }}
      >
        <span className="text-white text-xs font-bold">C</span>
      </div>

      {/* Pannello espanso */}
      {expanded && (
        <div
          className="bg-background/95 backdrop-blur-md border border-border rounded-lg p-3 shadow-xl text-xs max-w-[240px] animate-in fade-in slide-in-from-left-2 duration-200"
        >
          <div className="font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
            <span style={{ color: "#D97706" }}>●</span> Claude Engine V8
          </div>
          <div className="text-muted-foreground space-y-0.5">
            <div>✅ Login Automatico (server-side)</div>
            <div>✅ WCA Download Bridge</div>
            <div>✅ WCA Scraper Bridge</div>
            <div>✅ Directory Locale (localStorage)</div>
            <div>✅ Circuit Breaker + Delay Pattern</div>
            <div>✅ Job Resume System</div>
            <div>✅ AI Agent Integration</div>
          </div>
          <div className="mt-2 pt-1.5 border-t border-border text-muted-foreground/60">
            wca-app.vercel.app · v8
          </div>
        </div>
      )}
    </div>
  );
}
