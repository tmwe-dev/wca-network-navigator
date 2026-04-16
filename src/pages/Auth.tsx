import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { rpcIsEmailAuthorized, rpcRecordUserLogin } from "@/data/rpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Globe2, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";
import { useAuth } from "@/providers/AuthProvider";

const log = createLogger("Auth");

/**
 * Whitelist check with proper error handling:
 * - Returns true/false for actual whitelist result
 * - Throws on network/RPC errors so caller can distinguish
 */
async function checkWhitelist(email: string): Promise<boolean> {
  // Let errors propagate — caller decides how to handle
  return await rpcIsEmailAuthorized(email);
}

async function recordLogin(email: string) {
  try {
    await rpcRecordUserLogin(email);
  } catch (e) {
    log.warn("record login failed", { error: e instanceof Error ? e.message : String(e) });
  }
}

interface AuthLocationState {
  readonly from?: {
    readonly pathname?: string;
    readonly search?: string;
    readonly hash?: string;
  };
}

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, event } = useAuth();
  const [loading, setLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const isBusy = loading || resettingPassword;
  const redirectTo = useMemo(() => {
    const state = location.state as AuthLocationState | null;
    const from = state?.from;

    if (!from?.pathname || from.pathname === "/auth" || from.pathname === "/v2/login") {
      return "/v2";
    }

    return `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`;
  }, [location.state]);

  // If a valid session already exists, never re-check whitelist here.
  // Whitelist is enforced only before sign-in/sign-up.
  useEffect(() => {
    const sessionEmail = session?.user?.email;
    if (!sessionEmail) return;

    if (event === "SIGNED_IN") {
      void recordLogin(sessionEmail);
    }

    navigate(redirectTo, { replace: true });
  }, [session, event, navigate, redirectTo]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const allowed = await checkWhitelist(normalizedEmail);
      if (!allowed) {
        toast.error("Email non autorizzata. Contatta l'amministratore.");
        setLoading(false);
        return;
      }
    } catch (err) {
      log.error("whitelist RPC error", { error: err instanceof Error ? err.message : String(err) });
      toast.error("Errore di connessione al server. Riprova tra qualche istante.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "Credenziali non valide. Se non ricordi la password, usa \u201cPassword dimenticata?\u201d."
          : error.message,
      );
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      toast.error("Inserisci prima la tua email.");
      return;
    }

    setResettingPassword(true);

    try {
      const allowed = await checkWhitelist(normalizedEmail);
      if (!allowed) {
        toast.error("Email non autorizzata. Contatta l'amministratore.");
        setResettingPassword(false);
        return;
      }
    } catch (err) {
      log.error("whitelist RPC error", { error: err instanceof Error ? err.message : String(err) });
      toast.error("Errore di connessione al server. Riprova tra qualche istante.");
      setResettingPassword(false);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Ti ho inviato il link per reimpostare la password.");
    }

    setResettingPassword(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const allowed = await checkWhitelist(normalizedEmail);
      if (!allowed) {
        toast.error("Email non autorizzata. Solo gli utenti invitati possono registrarsi.");
        setLoading(false);
        return;
      }
    } catch (err) {
      log.error("whitelist RPC error", { error: err instanceof Error ? err.message : String(err) });
      toast.error("Errore di connessione al server. Riprova tra qualche istante.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: { full_name: displayName },
      },
    });

    if (error) {
      toast.error(error.message);
    } else if (!data.session && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      toast.info("Account già presente. Usa Accedi o \u201cPassword dimenticata?\u201d.");
    } else {
      toast.success("Controlla la tua email per confermare la registrazione");
    }

    setLoading(false);
  };

  const PasswordToggle = (
    <button
      type="button"
      tabIndex={-1}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      onClick={() => setShowPassword((v) => !v)}
      aria-label={showPassword ? "Nascondi password" : "Mostra password"}
    >
      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

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
        <CardContent className="space-y-4">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Accedi</TabsTrigger>
              <TabsTrigger value="signup">Registrati</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-3 mt-3">
                <div>
                  <Label htmlFor="login-email" className="text-xs">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="login-email" name="email" autoComplete="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@esempio.com" className="pl-10" required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="login-pw" className="text-xs">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="login-pw" name="password" autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="pl-10 pr-10" required />
                    {PasswordToggle}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="link" className="h-auto px-0 text-xs" onClick={handleForgotPassword} disabled={isBusy}>
                    {resettingPassword && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                    Password dimenticata?
                  </Button>
                </div>
                <Button type="submit" className="w-full" disabled={isBusy}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Accedi
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-3 mt-3">
                <div>
                  <Label htmlFor="signup-name" className="text-xs">Nome</Label>
                  <Input id="signup-name" name="name" autoComplete="name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Il tuo nome" required />
                </div>
                <div>
                  <Label htmlFor="signup-email" className="text-xs">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="signup-email" name="email" autoComplete="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@esempio.com" className="pl-10" required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="signup-pw" className="text-xs">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="signup-pw" name="new-password" autoComplete="new-password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimo 6 caratteri" className="pl-10 pr-10" minLength={6} required />
                    {PasswordToggle}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isBusy}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Registrati
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
