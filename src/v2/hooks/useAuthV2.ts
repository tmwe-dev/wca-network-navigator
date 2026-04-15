/**
 * useAuthV2 — Stubbed: auth removed, always returns authenticated admin.
 */

export type AppRole = "admin" | "moderator" | "user";

export interface UserProfile {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
}

export interface AuthState {
  readonly user: null;
  readonly session: null;
  readonly profile: UserProfile | null;
  readonly roles: readonly AppRole[];
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
  readonly isAdmin: boolean;
  readonly error: string | null;
}

interface AuthActions {
  readonly signInWithEmail: (email: string, password: string) => Promise<void>;
  readonly signUp: (email: string, password: string, displayName: string) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly resetPassword: (email: string) => Promise<void>;
  readonly updatePassword: (newPassword: string) => Promise<void>;
  readonly clearError: () => void;
}

export type UseAuthV2Return = AuthState & AuthActions;

const noop = async () => {};

export function useAuthV2(): UseAuthV2Return {
  return {
    user: null,
    session: null,
    profile: null,
    roles: ["admin"],
    isLoading: false,
    isAuthenticated: true,
    isAdmin: true,
    error: null,
    signInWithEmail: noop,
    signUp: noop,
    signOut: noop,
    resetPassword: noop,
    updatePassword: noop,
    clearError: () => {},
  };
}
