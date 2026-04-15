/**
 * Auth page — dead simple login/signup/forgot-password.
 * No OAuth, no complex state, no AuthProvider dependency.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { rpcIsEmailAuthorized, rpcRecordUserLogin } from "@/data/rpc";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Globe2, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

type View = "login" | "signup" | "forgot";

export default function Auth() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Login ──────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const allowed = await rpcIsEmailAuthorized(normalizedEmail);
      if (!allowed) {
        toast.error("Email non autorizzata. Contatta l'amministratore.");
        setLoading(false);
        return;
      }
    } catch {
      toast.error("Impossibile verificare l'autorizzazione. Riprova.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "Credenziali non valide. Se non ricordi la password, usa «Password dimenticata?»."
          : error.message,
      );
      setLoading(false);
      return;
    }

    // Login succeeded — record and redirect
    try {
      await rpcRecordUserLogin(normalizedEmail);
    } catch {
      // non-blocking
    }

    navigate("/", { replace: true });
  };

  // ── Signup ─────────────────────────────────────────────────────────
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const allowed = await rpcIsEmailAuthorized(normalizedEmail);
      if (!allowed) {
        toast.error("Email non autorizzata. Chiedi all'admin di aggiungerti.");
        setLoading(false);
        return;
      }
    } catch {
      toast.error("Impossibile verificare l'autorizzazione. Riprova.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: { full_name: displayName || normalizedEmail },
      },
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Controlla la tua email per confermare la registrazione.");
    }

    setLoading(false);
  };

  // ── Forgot password ────────────────────────────────────────────────
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/reset-password` },
    );

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Se l'email esiste, riceverai il link per reimpostare la password.");
    }
    setLoading(false);
  };

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Globe2 className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">WCA Network Navigator</CardTitle>
          <CardDescription>
            {view === "login" && "Accedi per gestire i tuoi partner e network"}
            {view === "signup" && "Crea il tuo account"}
            {view === "forgot" && "Recupera la tua password"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* ── Login form ── */}
          {view === "login" && (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <Label htmlFor="login-email" className="text-xs">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@esempio.com" className="pl-10" required />
                </div>
              </div>
              <div>
                <Label htmlFor="login-pw" className="text-xs">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="login-pw" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-10 pr-10" required />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showPassword ? "Nascondi password" : "Mostra password"}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Entra
              </Button>
              <div className="flex justify-between text-xs">
                <button type="button" className="text-primary hover:underline" onClick={() => setView("forgot")}>Password dimenticata?</button>
                <button type="button" className="text-primary hover:underline" onClick={() => setView("signup")}>Non hai un account? Registrati</button>
              </div>
            </form>
          )}

          {/* ── Signup form ── */}
          {view === "signup" && (
            <form onSubmit={handleSignup} className="space-y-3">
              <div>
                <Label htmlFor="signup-name" className="text-xs">Nome</Label>
                <Input id="signup-name" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Il tuo nome" required />
              </div>
              <div>
                <Label htmlFor="signup-email" className="text-xs">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="signup-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@esempio.com" className="pl-10" required />
                </div>
              </div>
              <div>
                <Label htmlFor="signup-pw" className="text-xs">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="signup-pw" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimo 6 caratteri" className="pl-10 pr-10" minLength={6} required />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showPassword ? "Nascondi password" : "Mostra password"}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Registrati
              </Button>
              <div className="text-center text-xs">
                <button type="button" className="text-primary hover:underline" onClick={() => setView("login")}>Hai già un account? Accedi</button>
              </div>
            </form>
          )}

          {/* ── Forgot password form ── */}
          {view === "forgot" && (
            <form onSubmit={handleForgot} className="space-y-3">
              <div>
                <Label htmlFor="forgot-email" className="text-xs">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="forgot-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@esempio.com" className="pl-10" required />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Invia link di recupero
              </Button>
              <div className="text-center text-xs">
                <button type="button" className="text-primary hover:underline" onClick={() => setView("login")}>Torna al login</button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
