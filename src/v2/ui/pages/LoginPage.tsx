/**
 * LoginPage — STEP 4
 * Form login email/password + Google OAuth.
 */

import * as React from "react";
import { useState } from "react";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "../molecules/FormField";
import { Button } from "../atoms/Button";
import { ErrorMessage } from "../atoms/ErrorMessage";
import { Separator } from "@/components/ui/separator";

export function LoginPage(): React.ReactElement {
  const { signInWithEmail, signInWithGoogle, isLoading, error, clearError } = useAuthV2();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await signInWithEmail(email, password);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">Accedi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <ErrorMessage message={error} onDismiss={clearError} /> : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label="Email" name="email" type="email"
            placeholder="nome@azienda.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
            required
          />
          <FormField
            label="Password" name="password" type="password"
            placeholder="••••••••"
            value={password} onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" className="w-full" isLoading={isLoading}>
            Accedi
          </Button>
        </form>

        <Separator />

        <Button variant="outline" className="w-full" onClick={signInWithGoogle}>
          Accedi con Google
        </Button>
      </CardContent>
    </Card>
  );
}
