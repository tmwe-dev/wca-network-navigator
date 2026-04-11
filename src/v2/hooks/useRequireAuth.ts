/**
 * useRequireAuth — STEP 3
 *
 * Redirect a /v2/login se l'utente non è autenticato.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthV2 } from "./useAuthV2";

export function useRequireAuth(): void {
  const { isAuthenticated, isLoading } = useAuthV2();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/v2/login", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);
}
