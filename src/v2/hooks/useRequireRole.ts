/**
 * useRequireRole — STEP 3
 *
 * Controlla che l'utente abbia un ruolo specifico.
 * Se non ce l'ha, redirect a /v2 (dashboard).
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthV2, type AppRole } from "./useAuthV2";

interface UseRequireRoleOptions {
  readonly role: AppRole;
  readonly redirectTo?: string;
}

export function useRequireRole(options: UseRequireRoleOptions): boolean {
  const { roles, isLoading, isAuthenticated } = useAuthV2();
  const navigate = useNavigate();
  const hasRole = roles.includes(options.role);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !hasRole) {
      navigate(options.redirectTo ?? "/v2", { replace: true });
    }
  }, [hasRole, isLoading, isAuthenticated, navigate, options.redirectTo]);

  return hasRole;
}
