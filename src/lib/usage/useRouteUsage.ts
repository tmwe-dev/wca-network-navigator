/**
 * useRouteUsage — Lente 2 (traffico reale) sulle rotte frontend.
 *
 * Montato una sola volta in AuthenticatedLayout: ad ogni cambio di
 * pathname registra un evento `route` su usage_events. La deduplica
 * è delegata a trackUsage (finestra 60s per stessa rotta).
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackUsage } from "./trackUsage";

export function useRouteUsage(): void {
  const location = useLocation();
  useEffect(() => {
    trackUsage(location.pathname, "route");
  }, [location.pathname]);
}
