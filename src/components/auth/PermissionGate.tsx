/**
 * PermissionGate Component
 * Guards content based on user permissions
 */
import { useHasPermission } from "@/hooks/useRBAC";
import { AlertCircle, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface PermissionGateProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({ permission, children, fallback }: PermissionGateProps) {
  const { hasPermission, isLoading } = useHasPermission(permission);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasPermission) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Alert variant="destructive" className="my-4">
        <Lock className="h-4 w-4" />
        <AlertDescription>Non hai il permesso per accedere a questa funzione.</AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}

/**
 * Inline permission check component for simple cases
 */
export function RequirePermission({ permission, children }: PermissionGateProps) {
  return <PermissionGate permission={permission}>{children}</PermissionGate>;
}
