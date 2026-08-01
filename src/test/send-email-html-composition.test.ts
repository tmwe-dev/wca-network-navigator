import { describe, it, expect } from "vitest";

/**
 * [C03] Send Email HTML Composition
 * Scope: Verify HTML sanitization, signature injection, and email body composition.
 * Tables: none (pure logic).
 */

describe("Send Email HTML Composition [C03]", () => {
  // Simulate the HTML composition logic from send-email
  function composeEmailHtml(body: string, signature?: string): string {
    let html = body;
    if (signature) {
      html += `<br/><br/>--<br/>${signature}`;
    }
    return html;
  }

  function stripDangerousTags(html: string): string {
    // Remove script, iframe, object, embed tags
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<iframe\b[^>]*>.*?<\/iframe>/gi, "")
      .replace(/<object\b[^>]*>.*?<\/object>/gi, "")
      .replace(/<embed\b[^>]*\/?>/gi, "");
  }

  it("composes body with signature", () => {
    const result = composeEmailHtml("<p>Hello</p>", "<p>Best regards</p>");
    expect(result).toContain("<p>Hello</p>");
    expect(result).toContain("<p>Best regards</p>");
    expect(result).toContain("--");
  });

  it("composes body without signature", () => {
    const result = composeEmailHtml("<p>Hello</p>");
    expect(result).toBe("<p>Hello</p>");
    expect(result).not.toContain("--");
  });

  it("strips script tags from email body", () => {
    const dirty = '<p>Hello</p><script>alert("xss")</script>';
    const clean = stripDangerousTags(dirty);
    expect(clean).not.toContain("<script>");
    expect(clean).toContain("<p>Hello</p>");
  });

  it("strips iframe tags", () => {
    const dirty = '<p>Content</p><iframe src="evil.com"></iframe>';
    const clean = stripDangerousTags(dirty);
    expect(clean).not.toContain("<iframe");
  });

  it("preserves safe HTML tags", () => {
    const safe = '<p>Text</p><a href="https://example.com">Link</a><img src="logo.png"/>';
    const clean = stripDangerousTags(safe);
    expect(clean).toBe(safe);
  });

  it("handles empty body gracefully", () => {
    const result = composeEmailHtml("");
    expect(result).toBe("");
  });
});
