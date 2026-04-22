/**
 * Markdown content extraction and parsing utilities.
 */

export function extractMarkdown(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  if (typeof d.markdown === "string") return d.markdown;
  if (typeof d.content === "string") return d.content;
  if (d.result && typeof d.result === "object") {
    const r = d.result as Record<string, unknown>;
    if (typeof r.markdown === "string") return r.markdown;
  }
  return "";
}
