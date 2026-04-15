import { useState, useEffect } from "react";
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
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) navigate("/v2", { replace: true });
    });
  }, [navigate]);

  const run = async (mode: "signin" | "signup") => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      toast.error("Email e password obbligatorie");
      return;
    }
    if (password.length < 6) {
      toast.error("Password minimo 6 caratteri");
      return;
    }
    setLoading(true);
    try {
      let allowed = false;
      try {
        allowed = await rpcIsEmailAuthorized(normalizedEmail);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : (e as Record<string, unknown>)?.message ?? JSON.stringify(e);
        toast.error(`Errore rete: ${msg}`);
        setLoading(false);
        return;
      }
      if (!allowed) {
        toast.error("Email non autorizzata");
        setLoading(false);
        return;
      }

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email: normalizedEmail, password });
        if (error) { toast.error(error.message); setLoading(false); return; }
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (signInErr) { toast.error(signInErr.message); setLoading(false); return; }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) { toast.error(error.message); setLoading(false); return; }
      }

      try { await rpcRecordUserLogin(normalizedEmail); } catch { /* non-blocking */ }
      navigate("/v2", { replace: true });
    } finally {
      setLoading(false);
    }
  };

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
          <div className="space-y-3">
            <div>
              <Label htmlFor="auth-email" className="text-xs">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="auth-email" type="email" autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@esempio.com" className="pl-10" disabled={loading}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="auth-pw" className="text-xs">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="auth-pw" type={showPw ? "text" : "password"} autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimo 6 caratteri" className="pl-10 pr-10" disabled={loading}
                />
                <button
                  type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={showPw ? "Nascondi" : "Mostra"}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="button" className="flex-1" onClick={() => run("signin")} disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Entra
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => run("signup")} disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Registrati
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
