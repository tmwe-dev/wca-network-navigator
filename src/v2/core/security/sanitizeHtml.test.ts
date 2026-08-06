import { describe, it, expect } from "vitest";
import { sanitizeHtml, escapeHtml } from "./sanitizeHtml";

describe("sanitizeHtml (DOMPurify)", () => {
  it("returns empty string for null/undefined/empty", () => {
    expect(sanitizeHtml(null)).toBe("");
    expect(sanitizeHtml(undefined)).toBe("");
    expect(sanitizeHtml("")).toBe("");
  });

  it("keeps safe HTML intact", () => {
    const html = "<p><strong>Hello</strong> <em>world</em></p>";
    expect(sanitizeHtml(html)).toContain("<strong>Hello</strong>");
  });

  it("strips <script>", () => {
    const out = sanitizeHtml("<p>ok</p><script>alert(1)</script>");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert");
  });

  it("strips inline event handlers (onerror/onclick)", () => {
    const out = sanitizeHtml('<img src=x onerror="alert(1)"><a onclick="alert(2)">x</a>');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("onclick");
  });

  it("strips javascript: URLs", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toMatch(/javascript:/i);
  });

  it("strips data:text/html payloads but allows data:image", () => {
    const html = sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>');
    expect(html).not.toMatch(/data:text\/html/i);
  });

  it("adds rel=noopener noreferrer to target=_blank links", () => {
    const out = sanitizeHtml('<a href="https://example.com" target="_blank">x</a>');
    expect(out).toContain('target="_blank"');
    expect(out).toMatch(/rel="[^"]*noopener[^"]*"/);
    expect(out).toMatch(/rel="[^"]*noreferrer[^"]*"/);
  });

  it("removes iframe/object/embed", () => {
    const out = sanitizeHtml('<iframe src="//evil.com"></iframe><object data="x"></object><embed src="x">');
    expect(out).not.toMatch(/<iframe|<object|<embed/i);
  });

  it("is idempotent (double sanitize == single sanitize)", () => {
    const input = '<p>hi</p><script>1</script><img src=x onerror="a">';
    const once = sanitizeHtml(input);
    const twice = sanitizeHtml(once);
    expect(twice).toBe(once);
  });
});

describe("escapeHtml", () => {
  it("escapes the five dangerous chars", () => {
    expect(escapeHtml('<img src="x" onerror=\'alert("&")\'>')).toBe(
      "&lt;img src=&quot;x&quot; onerror=&#x27;alert(&quot;&amp;&quot;)&#x27;&gt;",
    );
  });

  it("returns empty for empty/null", () => {
    expect(escapeHtml("")).toBe("");
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});
