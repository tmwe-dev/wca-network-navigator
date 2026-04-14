/**
 * ResetPasswordPage — STEP 4
 */

import * as React from "react";
import { useState } from "react";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "../molecules/FormField";
import { Button } from "../atoms/Button";
import { ErrorMessage } from "../atoms/ErrorMessage";
import { Eye, EyeOff } from "lucide-react";

export function ResetPasswordPage(): React.ReactElement {
  const { updatePassword, error, clearError } = useAuthV2();
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFieldError(null);

    if (newPassword.length < 8) {
      setFieldError("La password deve essere di almeno 8 caratteri.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFieldError("Le password non coincidono.");
      return;
    }

    await updatePassword(newPassword);
    if (!error) setSuccess(true);
  };

  if (success) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-2">
          <p className="text-lg font-semibold text-foreground">Password aggiornata!</p>
          <p className="text-sm text-muted-foreground">Puoi tornare al login.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">Reset Password</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <ErrorMessage message={error} onDismiss={clearError} /> : null}
        {fieldError ? <ErrorMessage message={fieldError} onDismiss={() => setFieldError(null)} /> : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <FormField
              label="Nuova Password" name="newPassword" type={showNewPassword ? "text" : "password"}
              placeholder="••••••••" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)} required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(v => !v)}
              className="absolute right-2 top-[2.1rem] -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showNewPassword ? "Nascondi password" : "Mostra password"}
            >
              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="relative">
            <FormField
              label="Conferma Password" name="confirmPassword" type={showConfirmPassword ? "text" : "password"}
              placeholder="••••••••" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(v => !v)}
              className="absolute right-2 top-[2.1rem] -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showConfirmPassword ? "Nascondi password" : "Mostra password"}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Button type="submit" className="w-full">Aggiorna Password</Button>
        </form>
      </CardContent>
    </Card>
  );
}
