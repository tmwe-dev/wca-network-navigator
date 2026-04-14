import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { session, event, status } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [canReset, setCanReset] = useState(false);

  const checking = status === "loading";
  const hasRecoveryHash = typeof window !== "undefined" && window.location.hash.includes("type=recovery");

  // Derive canReset from auth provider state
  useEffect(() => {
    if (event === "PASSWORD_RECOVERY") {
      setCanReset(true);
    } else if (event === "INITIAL_SESSION" && hasRecoveryHash && !!session) {
      setCanReset(true);
    } else if (!checking && (hasRecoveryHash || !!session)) {
      setCanReset(true);
    }
  }, [event, session, checking, hasRecoveryHash]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("La password deve avere almeno 6 caratteri.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Le password non coincidono.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("Password aggiornata. Accesso ripristinato.");
    navigate("/", { replace: true });
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Reimposta password</CardTitle>
          <CardDescription>
            {canReset
              ? "Imposta una nuova password per rientrare subito nel sistema."
              : "Il link di recupero non è valido o è scaduto. Richiedine uno nuovo dalla pagina di accesso."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {canReset ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="new-password" className="text-xs">Nuova password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimo 6 caratteri"
                    className="pl-10 pr-10"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirm-password" className="text-xs">Conferma password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ripeti la password"
                    className="pl-10 pr-10"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirmPassword ? "Nascondi password" : "Mostra password"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salva nuova password
              </Button>
            </form>
          ) : (
            <Button className="w-full" onClick={() => navigate("/auth", { replace: true })}>
              Torna al login
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
