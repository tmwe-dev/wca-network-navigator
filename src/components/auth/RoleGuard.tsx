/**
 * RoleGuard — Frontend route protection by role.
 * Checks user roles from useAuthV2 hook.
 */
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

type RequiredRole = "admin" | "operator" | "viewer";

interface RoleGuardProps {
  readonly requiredRole: RequiredRole;
  readonly children: React.ReactNode;
  readonly fallback?: React.ReactNode;
}

const ROLE_HIERARCHY: Record<RequiredRole, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
};

function getUserLevel(roles: readonly string[], isAdmin: boolean): number {
  if (isAdmin) return 2;
  if (roles.includes("admin")) return 2;
  if (roles.includes("moderator")) return 1;
  if (roles.includes("user")) return 0;
  return -1;
}

function DefaultFallback() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
      <Shield className="w-12 h-12 text-muted-foreground" />
      <h2 className="text-lg font-semibold">Accesso non autorizzato</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Non hai i permessi necessari per accedere a questa sezione.
        Contatta l'amministratore per richiedere l'accesso.
      </p>
      <Button variant="outline" onClick={() => navigate("/v2")}>
        Torna alla Dashboard
      </Button>
    </div>
  );
}

export function RoleGuard({ requiredRole, children, fallback }: RoleGuardProps) {
  const { roles, isAdmin, isLoading, isAuthenticated } = useAuthV2();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const userLevel = getUserLevel(roles, isAdmin);
  const requiredLevel = ROLE_HIERARCHY[requiredRole];

  if (userLevel < requiredLevel) {
    return <>{fallback ?? <DefaultFallback />}</>;
  }

  return <>{children}</>;
}
