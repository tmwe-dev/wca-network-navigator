/**
 * daily-briefing — Proxy to ai-utility (action: briefing)
 * Original logic preserved in ai-utility macro-function.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { proxyToMacro } from "../_shared/proxyUtils.ts";

serve((req) => proxyToMacro(req, "ai-utility", { action: "briefing" }));
