/**
 * LoginPage — V2 redirect to unified /auth page
 */
import * as React from "react";
import { Navigate } from "react-router-dom";

export function LoginPage(): React.ReactElement {
  return <Navigate to="/auth" replace />;
}
