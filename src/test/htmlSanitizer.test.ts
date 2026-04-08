/**
 * Test allowlist HTML sanitizer.
 * Vol. II §6.4 (output encoding).
 */
import { describe, it, expect } from "vitest";
import { sanitizeHtml, escapeHtml } from "@/lib/security/htmlSanitizer";

describe("sanitizeHtml", () => {
  it("strips <script> blocks completely", () => {
    const dirty = `<p>ok</p><script>alert(1)</script><p>after</p>`;
    expect(sanitizeHtml(dirty)).not.toContain("script");
    expect(sanitizeHtml(dirty)).toContain("ok");
    expect(sanitizeHtml(dirty)).toContain("after");
  });

  it("strips inline event handlers (onclick, onerror)", () => {
    const dirty = `<img src="x" onerror="alert(1)" onclick="evil()">`;
    const out = sanitizeHtml(dirty);
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("onclick");
  });

  it("blocks javascript: URLs in href", () => {
    const dirty = `<a href="javascript:alert(1)">click</a>`;
    expect(sanitizeHtml(dirty)).not.toContain("javascript:");
  });

  it("blocks vbscript: and file: URLs", () => {
    expect(sanitizeHtml(`<a href="vbscript:msgbox">x</a>`)).not.toContain("vbscript");
    expect(sanitizeHtml(`<a href="file:///etc/passwd">x</a>`)).not.toContain("file:");
  });

  it("allows http(s) URLs", () => {
    const out = sanitizeHtml(`<a href="https://example.com">link</a>`);
    expect(out).toContain("https://example.com");
  });

  it("forces rel=noopener noreferrer on target=_blank", () => {
    const out = sanitizeHtml(`<a href="https://x.io" target="_blank">x</a>`);
    expect(out).toContain(`target="_blank"`);
    expect(out).toContain(`rel="noopener noreferrer"`);
  });

  it("removes disallowed tags but keeps content", () => {
    const out = sanitizeHtml(`<custom-tag>hello</custom-tag>`);
    expect(out).toContain("hello");
    expect(out).not.toContain("custom-tag");
  });

  it("strips iframe entirely", () => {
    const out = sanitizeHtml(`<iframe src="evil"></iframe>safe`);
    expect(out).not.toContain("iframe");
    expect(out).toContain("safe");
  });

  it("strips style/expression() in CSS", () => {
    const out = sanitizeHtml(`<div style="color:red;background:expression(alert(1))">x</div>`);
    expect(out).toContain("color: red");
    expect(out).not.toContain("expression");
  });

  it("allows data:image URLs", () => {
    const out = sanitizeHtml(`<img src="data:image/png;base64,iVBOR">`);
    expect(out).toContain("data:image/png");
  });

  it("blocks data:text URLs (XSS vector)", () => {
    const out = sanitizeHtml(`<img src="data:text/html,<script>alert(1)</script>">`);
    expect(out).not.toContain("data:text");
  });

  it("returns empty string for null/empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("strips HTML comments", () => {
    expect(sanitizeHtml(`<!-- bad -->ok`)).toBe("ok");
  });
});

describe("escapeHtml", () => {
  it("escapes <, >, &, quotes", () => {
    expect(escapeHtml(`<a href="x">&y</a>`)).toBe(
      `&lt;a href=&quot;x&quot;&gt;&amp;y&lt;/a&gt;`
    );
  });

  it("handles empty input", () => {
    expect(escapeHtml("")).toBe("");
  });
});
