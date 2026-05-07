/**
 * PublicLayout template — STEP 4
 * Layout per pagine non autenticate (login, reset password).
 */

import * as React from "react";
import { Outlet } from "react-router-dom";

export function PublicLayout(): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">WCA Network Navigator</h1>
          <p className="text-sm text-muted-foreground mt-1">v2.0</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
