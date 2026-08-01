import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertSafePublicUrl, safePublicUrlOrNull } from "./inputValidator.ts";

Deno.test("assertSafePublicUrl: blocks invalid URL", () => {
  assertThrows(() => assertSafePublicUrl("not-a-url"), Error, "ssrf_blocked");
});

Deno.test("assertSafePublicUrl: blocks file:// scheme", () => {
  assertThrows(() => assertSafePublicUrl("file:///etc/passwd"), Error, "protocol_file");
});

Deno.test("assertSafePublicUrl: blocks gopher://", () => {
  assertThrows(() => assertSafePublicUrl("gopher://example.com"), Error, "protocol_gopher");
});

Deno.test("assertSafePublicUrl: blocks localhost", () => {
  assertThrows(() => assertSafePublicUrl("http://localhost/admin"), Error, "hostname");
});

Deno.test("assertSafePublicUrl: blocks 127.0.0.1", () => {
  assertThrows(() => assertSafePublicUrl("http://127.0.0.1/"), Error, "private_ip");
});

Deno.test("assertSafePublicUrl: blocks 10.x", () => {
  assertThrows(() => assertSafePublicUrl("http://10.0.0.5/"), Error, "private_ip");
});

Deno.test("assertSafePublicUrl: blocks 192.168.x", () => {
  assertThrows(() => assertSafePublicUrl("http://192.168.1.1/"), Error, "private_ip");
});

Deno.test("assertSafePublicUrl: blocks AWS metadata 169.254.169.254", () => {
  assertThrows(() => assertSafePublicUrl("http://169.254.169.254/latest/meta-data/"), Error, "private_ip");
});

Deno.test("assertSafePublicUrl: blocks credentials in URL", () => {
  assertThrows(() => assertSafePublicUrl("http://user:pass@example.com/"), Error, "credentials_in_url");
});

Deno.test("assertSafePublicUrl: blocks .internal TLD", () => {
  assertThrows(() => assertSafePublicUrl("http://service.internal/"), Error, "internal_tld");
});

Deno.test("assertSafePublicUrl: blocks IPv6 loopback ::1", () => {
  assertThrows(() => assertSafePublicUrl("http://[::1]/"), Error, "private_ip");
});

Deno.test("assertSafePublicUrl: allows public https URL", () => {
  const u = assertSafePublicUrl("https://example.com/path?q=1");
  assertEquals(u.hostname, "example.com");
});

Deno.test("assertSafePublicUrl: enforces hostname allowlist", () => {
  assertThrows(
    () => assertSafePublicUrl("https://evil.com/", { allowHostSuffixes: ["wcaworld.com"] }),
    Error,
    "host_not_in_allowlist",
  );
  const ok = assertSafePublicUrl("https://api.wcaworld.com/", { allowHostSuffixes: ["wcaworld.com"] });
  assertEquals(ok.hostname, "api.wcaworld.com");
});

Deno.test("safePublicUrlOrNull: returns null instead of throwing", () => {
  assertEquals(safePublicUrlOrNull("http://127.0.0.1"), null);
  const u = safePublicUrlOrNull("https://example.com");
  assertEquals(u?.hostname, "example.com");
});