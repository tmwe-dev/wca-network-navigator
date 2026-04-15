/**
 * Auth page — single form, two buttons (Entra / Registrati).
 * No OAuth, no tabs, no forgot password, no reset.
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

export default function Auth() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const normalize = (e: string) => e.trim().toLowerCase();

  const validate = (): string | null => {
    if (!email.trim()) return "Inserisci l'email.";
    if (password.length < 6) return "La password deve avere almeno 6 caratteri.";
    return null;
  };

  // ── Entra ──────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { toast.error(err); return; }
    setLoading(true);
    const normalizedEmail = normalize(email);

    try {
      const allowed = await rpcIsEmailAuthorized(normalizedEmail);
      if (!allowed) { toast.error("Email non autorizzata."); setLoading(false); return; }
    } catch (ex) {
      toast.error(ex instanceof Error ? ex.message : "Errore verifica accesso.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Background: record login
    try { await rpcRecordUserLogin(normalizedEmail); } catch { /* non-blocking */ }

    navigate("/v2", { replace: true });
  };

  // ── Registrati ─────────────────────────────────────────────────────
  const handleSignup = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setLoading(true);
    const normalizedEmail = normalize(email);

    try {
      const allowed = await rpcIsEmailAuthorized(normalizedEmail);
      if (!allowed) { toast.error("Email non autorizzata."); setLoading(false); return; }
    } catch (ex) {
      toast.error(ex instanceof Error ? ex.message : "Errore verifica accesso.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      // Auto-confirmed → go straight in
      try { await rpcRecordUserLogin(normalizedEmail); } catch { /* non-blocking */ }
      navigate("/v2", { replace: true });
    } else {
      toast.success("Account creato. Ora clicca Entra.");
      setLoading(false);
    }
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
          <CardDescription>Accedi per gestire i tuoi partner e network</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <Label htmlFor="auth-email" className="text-xs">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="auth-email" type="email" autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@esempio.com" className="pl-10" required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="auth-pw" className="text-xs">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="auth-pw" type={showPassword ? "text" : "password"} autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimo 6 caratteri" className="pl-10 pr-10" required
                />
                <button
                  type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Entra
              </Button>
              <Button type="button" variant="outline" className="flex-1" disabled={loading} onClick={handleSignup}>
                Registrati
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
