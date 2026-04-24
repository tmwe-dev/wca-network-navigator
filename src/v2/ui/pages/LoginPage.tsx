/**
 * LoginPage — Real login form using useAuthV2
 *
 * AUDIT FIX AUTH-1: Replaces the stub that caused an infinite redirect loop
 * (/auth → /v2/login → /auth). Now renders email+password form with
 * whitelist check, signup toggle, and reset-password link.
 */
import * as React from "react";
import { useState, useCallback } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { Loader2, LogIn, UserPlus, Mail, Lock, User } from "lucide-react";

export function LoginPage(): React.ReactElement {
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/v2";

  const {
    isAuthenticated, isLoading: authLoading, error, clearError,
    signInWithEmail, signUp, resetPassword,
  } = useAuthV2();

  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    await signInWithEmail(email, password);
    setSubmitting(false);
  }, [email, password, signInWithEmail]);

  const handleSignup = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName) return;
    setSubmitting(true);
    await signUp(email, password, displayName);
    setSubmitting(false);
  }, [email, password, displayName, signUp]);

  const handleForgot = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    await resetPassword(email);
    setResetSent(true);
    setSubmitting(false);
  }, [email, resetPassword]);

  // If already authenticated, redirect to intended destination.
  // MUST stay AFTER all hooks to keep hook order stable across renders.
  if (isAuthenticated && !authLoading) {
    return <Navigate to={from} replace />;
  }

  const switchMode = (next: "login" | "signup" | "forgot") => {
    clearError();
    setResetSent(false);
    setMode(next);
  };

  const isDisabled = submitting || authLoading;

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-6">
      {/* ── Login form ─────────────────────────────────────────── */}
      {mode === "login" && (
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="nome@azienda.com"
              autoComplete="email"
              required
              disabled={isDisabled}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              disabled={isDisabled}
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isDisabled || !email || !password}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Accedi
          </button>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <button type="button" onClick={() => switchMode("forgot")} className="hover:text-foreground transition-colors">
              Password dimenticata?
            </button>
            <button type="button" onClick={() => switchMode("signup")} className="hover:text-foreground transition-colors">
              Crea account
            </button>
          </div>
        </form>
      )}

      {/* ── Signup form ────────────────────────────────────────── */}
      {mode === "signup" && (
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="signup-name" className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Nome
            </label>
            <input
              id="signup-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Mario Rossi"
              autoComplete="name"
              required
              disabled={isDisabled}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="signup-email" className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Email
            </label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="nome@azienda.com"
              autoComplete="email"
              required
              disabled={isDisabled}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="signup-password" className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Password
            </label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Minimo 6 caratteri"
              autoComplete="new-password"
              required
              minLength={6}
              disabled={isDisabled}
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isDisabled || !email || !password || !displayName}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Crea account
          </button>

          <div className="text-center text-xs text-muted-foreground">
            <button type="button" onClick={() => switchMode("login")} className="hover:text-foreground transition-colors">
              Hai già un account? Accedi
            </button>
          </div>
        </form>
      )}

      {/* ── Forgot password form ───────────────────────────────── */}
      {mode === "forgot" && (
        <form onSubmit={handleForgot} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Inserisci la tua email e riceverai un link per reimpostare la password.
          </p>
          <div className="space-y-2">
            <label htmlFor="forgot-email" className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Email
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="nome@azienda.com"
              autoComplete="email"
              required
              disabled={isDisabled}
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {resetSent && (
            <div className="rounded-md bg-green-500/10 border border-green-500/30 px-3 py-2 text-sm text-green-700 dark:text-green-400">
              Email inviata! Controlla la tua casella di posta.
            </div>
          )}

          <button
            type="submit"
            disabled={isDisabled || !email || resetSent}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Invia link di reset
          </button>

          <div className="text-center text-xs text-muted-foreground">
            <button type="button" onClick={() => switchMode("login")} className="hover:text-foreground transition-colors">
              Torna al login
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
