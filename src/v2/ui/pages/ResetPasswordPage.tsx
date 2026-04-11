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

export function ResetPasswordPage(): React.ReactElement {
  const { updatePassword, error, clearError } = useAuthV2();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
          <FormField
            label="Nuova Password" name="newPassword" type="password"
            placeholder="••••••••" value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)} required
          />
          <FormField
            label="Conferma Password" name="confirmPassword" type="password"
            placeholder="••••••••" value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)} required
          />
          <Button type="submit" className="w-full">Aggiorna Password</Button>
        </form>
      </CardContent>
    </Card>
  );
}
