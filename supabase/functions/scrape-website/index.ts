import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startMs = Date.now();

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ error: "url required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Basic URL validation
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return new Response(
        JSON.stringify({ error: "Only http/https URLs supported" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; WCA-Bot/1.0)" },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    const html = await res.text();

    // Extract emails
    const emails = Array.from(
      new Set(
        (html.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}/g) ?? [])
          .filter((e: string) => !e.endsWith(".png") && !e.endsWith(".jpg") && !e.endsWith(".gif")),
      ),
    );

    // Extract phones
    const phones = Array.from(
      new Set(
        (html.match(/(\+?\d[\d\s().-]{7,}\d)/g) ?? []).map((p: string) => p.trim()),
      ),
    );

    // Extract metadata
    const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "").trim();
    const description = (
      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1] ?? ""
    ).trim();
    const ogTitle = (
      html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1] ?? ""
    ).trim();
    const ogDescription = (
      html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1] ?? ""
    ).trim();

    const durationMs = Date.now() - startMs;
    console.log(
      JSON.stringify({
        fn: "scrape-website",
        url,
        emails: emails.length,
        phones: phones.length,
        htmlLen: html.length,
        durationMs,
      }),
    );

    return new Response(
      JSON.stringify({
        url,
        title,
        description,
        ogTitle,
        ogDescription,
        emails,
        phones,
        length: html.length,
        durationMs,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "scrape failed";
    console.error(JSON.stringify({ fn: "scrape-website", error: msg }));
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
