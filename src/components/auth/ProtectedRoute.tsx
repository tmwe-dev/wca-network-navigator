import { Outlet } from "react-router-dom";

// DEV MODE: auth e onboarding bypassati — accesso diretto
export function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  return children ? <>{children}</> : <Outlet />;
}
