/**
 * ProtectedRoute — Auth removed, pass-through.
 */
import { Outlet } from "react-router-dom";

export function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  return children ? <>{children}</> : <Outlet />;
}
