/**
 * useRequireRole — Auth removed, always returns true.
 */
import type { AppRole } from "./useAuthV2";

interface UseRequireRoleOptions {
  readonly role: AppRole;
  readonly redirectTo?: string;
}

export function useRequireRole(_options: UseRequireRoleOptions): boolean {
  return true;
}
