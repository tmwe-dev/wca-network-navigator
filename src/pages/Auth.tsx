import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Globe2, Mail, Lock } from "lucide-react";
import { toast } from "sonner";

async function checkWhitelist(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_email_authorized", { p_email: email });
  if (error) {
    console.error("Whitelist check error:", error);
    return false;
  }
  return data === true;
}

async function recordLogin(email: string) {
  try {
    await supabase.rpc("record_user_login" as any, { p_email: email });
  } catch {}
}

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user?.email && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        const allowed = await checkWhitelist(session.user.email);
        if (!allowed) {
          toast.error("Accesso non autorizzato. Contatta l'amministratore.");
          await supabase.auth.signOut();
          return;
        }
        await recordLogin(session.user.email);
        navigate("/", { replace: true });
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.email) {
        const allowed = await checkWhitelist(session.user.email);
        if (!allowed) {
          await supabase.auth.signOut();
          return;
        }
        navigate("/", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Pre-check whitelist before attempting login
    const allowed = await checkWhitelist(email);
    if (!allowed) {
      toast.error("Email non autorizzata. Contatta l'amministratore.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error(error.message);
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Pre-check whitelist
    const allowed = await checkWhitelist(email);
    if (!allowed) {
      toast.error("Email non autorizzata. Solo gli utenti invitati possono registrarsi.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: displayName },
      },
    });
    if (error) toast.error(error.message);
    else toast.success("Controlla la tua email per confermare la registrazione");
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast.error("Errore con Google Sign-In");
      setLoading(false);
    }
    // Whitelist check happens in onAuthStateChange after Google redirect
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
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continua con Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">oppure</span>
            </div>
          </div>

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
                    <Input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@esempio.com" className="pl-10" required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="login-pw" className="text-xs">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="login-pw" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="pl-10" required />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Accedi
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-3 mt-3">
                <div>
                  <Label htmlFor="signup-name" className="text-xs">Nome</Label>
                  <Input id="signup-name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Il tuo nome" required />
                </div>
                <div>
                  <Label htmlFor="signup-email" className="text-xs">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@esempio.com" className="pl-10" required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="signup-pw" className="text-xs">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="signup-pw" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimo 6 caratteri" className="pl-10" minLength={6} required />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
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
