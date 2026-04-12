import { useCallback } from "react";
import { useNavigate, useLocation, type NavigateOptions } from "react-router-dom";

/**
 * Drop-in replacement for useNavigate() that automatically prefixes
 * routes with /v2 when the current location is inside the V2 layout.
 */
export function useAppNavigate() {
  const navigate = useNavigate();
  const location = useLocation();
  const isV2 = location.pathname.startsWith("/v2");

  return useCallback(
    (to: string | number, options?: NavigateOptions) => {
      if (typeof to === "number") return navigate(to);
      if (
        isV2 &&
        to.startsWith("/") &&
        !to.startsWith("/v2") &&
        !to.startsWith("/auth")
      ) {
        return navigate("/v2" + to, options);
      }
      return navigate(to, options);
    },
    [navigate, isV2],
  );
}
