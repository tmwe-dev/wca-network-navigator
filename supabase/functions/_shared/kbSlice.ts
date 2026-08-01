/**
 * Shared KB slice utility — extracts sections from KB using <!-- SECTION:N --> markers.
 * Used by generate-outreach, generate-email, improve-email.
 */

export type Quality = "fast" | "standard" | "premium";

const SECTION_MAP: Record<Quality, number[]> = {
  fast: [1, 5],
  standard: [1, 2, 3, 4, 5, 6, 7, 8],
  premium: [],
};

export function getKBSlice(fullKB: string, quality: Quality, maxLength?: number): string {
  if (!fullKB) return "";
  if (quality === "premium") return maxLength ? fullKB.substring(0, maxLength) : fullKB;

  const allowedSections = SECTION_MAP[quality];
  const sectionRegex = /<!-- SECTION:(\d+) -->/g;
  const markers: { index: number; section: number }[] = [];
  let match;
  while ((match = sectionRegex.exec(fullKB)) !== null) {
    markers.push({ index: match.index, section: parseInt(match[1]) });
  }
  if (markers.length === 0) return maxLength ? fullKB.substring(0, maxLength) : fullKB;

  const parts: string[] = [];
  for (let i = 0; i < markers.length; i++) {
    if (allowedSections.includes(markers[i].section)) {
      const start = markers[i].index;
      const end = i + 1 < markers.length ? markers[i + 1].index : fullKB.length;
      parts.push(fullKB.substring(start, end).trim());
    }
  }
  const result = parts.join("\n\n---\n\n");
  return maxLength ? result.substring(0, maxLength) : result;
}
