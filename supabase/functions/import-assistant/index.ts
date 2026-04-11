/**
 * import-assistant — Proxy to unified-assistant (scope: import)
 * Original logic preserved in unified-assistant macro-function.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { proxyToMacro } from "../_shared/proxyUtils.ts";

serve((req) => proxyToMacro(req, "unified-assistant", { scope: "import" }));
