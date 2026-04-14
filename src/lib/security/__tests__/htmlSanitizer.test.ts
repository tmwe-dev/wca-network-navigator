import { describe, it, expect } from "vitest";
import { sanitizeHtml, escapeHtml } from "@/lib/security/htmlSanitizer";

describe("sanitizeHtml", () => {
  it("preserves safe HTML tags", () => {
    const input = "<p>Hello <strong>world</strong></p>";
    expect(sanitizeHtml(input)).toContain("<p>");
    expect(sanitizeHtml(input)).toContain("<strong>");
  });

  it("strips script tags and content", () => {
    const input = '<p>Hi</p><script>alert("xss")</script><p>Bye</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("script");
    expect(result).not.toContain("alert");
    expect(result).toContain("<p>Hi</p>");
    expect(result).toContain("<p>Bye</p>");
  });

  it("strips iframe/object/embed tags", () => {
    const input = '<iframe src="evil.com"></iframe><object data="x"></object>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("iframe");
    expect(result).not.toContain("object");
  });

  it("strips event handler attributes", () => {
    const input = '<div onclick="alert(1)" onload="steal()">content</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("onload");
    expect(result).toContain("content");
  });

  it("strips javascript: URLs from href", () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("javascript:");
  });

  it("preserves safe href URLs", () => {
    const input = '<a href="https://example.com">link</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('href="https://example.com"');
  });

  it("adds rel=noopener noreferrer for target=_blank", () => {
    const input = '<a href="https://x.com" target="_blank">link</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it("strips disallowed tags but keeps text", () => {
    const input = "<form><input type='text'/><button>Submit</button></form>";
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<form");
    expect(result).not.toContain("<input");
    expect(result).not.toContain("<button");
  });

  it("returns empty string for empty/null input", () => {
    expect(sanitizeHtml("")).toBe("");
    expect(sanitizeHtml(null as unknown as string)).toBe("");
    expect(sanitizeHtml(undefined as unknown as string)).toBe("");
  });

  it("strips HTML comments", () => {
    const input = "<!-- comment -->Hello";
    expect(sanitizeHtml(input)).toBe("Hello");
  });

  it("allows data:image URLs in img src", () => {
    const input = '<img src="data:image/png;base64,abc123" alt="photo">';
    const result = sanitizeHtml(input);
    expect(result).toContain("data:image/png");
  });

  it("strips data:text URLs in img src", () => {
    const input = '<img src="data:text/html,<script>alert(1)</script>">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("data:text");
  });

  it("sanitizes style attributes removing expression()", () => {
    const input = '<div style="background: expression(alert(1))">x</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("expression");
  });
});

describe("escapeHtml", () => {
  it("escapes < > & \" '", () => {
    expect(escapeHtml('<script>"test" & \'x\'')).toBe(
      "&lt;script&gt;&quot;test&quot; &amp; &#x27;x&#x27;"
    );
  });

  it("returns empty for empty/null", () => {
    expect(escapeHtml("")).toBe("");
    expect(escapeHtml(null as unknown as string)).toBe("");
  });

  it("preserves normal text", () => {
    expect(escapeHtml("Hello World 123")).toBe("Hello World 123");
  });

  it("handles unicode characters", () => {
    expect(escapeHtml("日本語 🎉")).toBe("日本語 🎉");
  });
});
