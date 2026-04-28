import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { requireExtensionAuth, isExtensionAuthError } from "../_shared/extensionAuth.ts";

const PROXYCURL_API_KEY = Deno.env.get("PROXYCURL_API_KEY");

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    // P1.5 — Auth required: Proxycurl is paid + per-request billed.
    // Accept real JWT, or anon-key from a CORS-whitelisted origin (extension).
    const auth = await requireExtensionAuth(req, dynCors);
    if (isExtensionAuthError(auth)) return auth;

    const { linkedin_url } = await req.json();

    if (!linkedin_url) {
      return new Response(JSON.stringify({ error: "linkedin_url is required" }), {
        status: 400,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // If no API key configured, return a clear message
    if (!PROXYCURL_API_KEY) {
      return new Response(JSON.stringify({
        success: false,
        error: "PROXYCURL_API_KEY not configured. Profile data will be extracted via extension fallback.",
        fallback: true,
      }), {
        status: 200,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // Call Proxycurl Person Profile API
    const apiUrl = `https://nubela.co/proxycurl/api/v2/linkedin?url=${encodeURIComponent(linkedin_url)}&use_cache=if-present`;

    const response = await fetch(apiUrl, {
      headers: {
        "Authorization": `Bearer ${PROXYCURL_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Proxycurl error:", response.status, errText);

      if (response.status === 404) {
        return new Response(JSON.stringify({ success: false, error: "Profile not found", fallback: true }), {
          status: 200,
          headers: { ...dynCors, "Content-Type": "application/json" },
        });
      }

      if (response.status === 429) {
        return new Response(JSON.stringify({ success: false, error: "Rate limited", fallback: true }), {
          status: 200,
          headers: { ...dynCors, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: false, error: `API error: ${response.status}`, fallback: true }), {
        status: 200,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    // Map to our standard profile format
    const profile = {
      name: [data.first_name, data.last_name].filter(Boolean).join(" ") || data.full_name || null,
      headline: data.headline || data.occupation || null,
      location: [data.city, data.state, data.country_full_name].filter(Boolean).join(", ") || null,
      about: data.summary || null,
      photoUrl: data.profile_pic_url || null,
      profileUrl: linkedin_url,
      company: data.experiences?.[0]?.company || null,
      connectionStatus: "unknown",
      // Extra data from API
      industry: data.industry || null,
      connections: data.connections || null,
      experiences: (data.experiences || []).slice(0, 5).map((exp: Record<string, unknown>) => ({
        company: exp.company,
        title: exp.title,
        starts_at: exp.starts_at,
        ends_at: exp.ends_at,
      })),
      education: (data.education || []).slice(0, 3).map((edu: Record<string, unknown>) => ({
        school: edu.school,
        degree: edu.degree_name,
        field: edu.field_of_study,
      })),
    };

    return new Response(JSON.stringify({ success: true, profile, source: "api" }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("linkedin-profile-api error:", err);
    return new Response(JSON.stringify({ error: err.message, fallback: true }), {
      status: 500,
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }
});
