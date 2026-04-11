/**
 * generate-email — Proxy to generate-content (action: email)
 * Original logic preserved in generate-content macro-function.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { proxyToMacro } from "../_shared/proxyUtils.ts";

serve((req) => proxyToMacro(req, "generate-content", { action: "email" }));
