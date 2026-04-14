/**
 * LoginPage — V2 Auth page
 * Login email/password, registrazione, Google OAuth, password dimenticata.
 */

import * as React from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "../atoms/ErrorMessage";
import { Loader2, Globe2, Mail, Lock } from "lucide-react";

export function LoginPage(): React.ReactElement {
  const {
    signInWithEmail,
    signUp,
    resetPassword,
    isLoading,
    isAuthenticated,
    error,
    clearError,
  } = useAuthV2();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/v2", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    await signInWithEmail(email, password);
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    await signUp(email, password, displayName);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) return;
    await resetPassword(email);
    setResetSent(true);
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
          {error ? <ErrorMessage message={error} onDismiss={clearError} /> : null}


          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Accedi</TabsTrigger>
              <TabsTrigger value="signup">Registrati</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-3 mt-3">
                <div>
                  <Label htmlFor="v2-login-email" className="text-xs">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="v2-login-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@esempio.com" className="pl-10" required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="v2-login-pw" className="text-xs">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="v2-login-pw" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="pl-10" required />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="link" className="h-auto px-0 text-xs" onClick={handleForgotPassword} disabled={isLoading}>
                    Password dimenticata?
                  </Button>
                </div>
                {resetSent && <p className="text-xs text-muted-foreground">Link inviato! Controlla la tua email.</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Accedi
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-3 mt-3">
                <div>
                  <Label htmlFor="v2-signup-name" className="text-xs">Nome</Label>
                  <Input id="v2-signup-name" autoComplete="name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Il tuo nome" required />
                </div>
                <div>
                  <Label htmlFor="v2-signup-email" className="text-xs">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="v2-signup-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@esempio.com" className="pl-10" required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="v2-signup-pw" className="text-xs">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="v2-signup-pw" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimo 6 caratteri" className="pl-10" minLength={6} required />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Registrati
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
