let dynCors: Record<string, string> = {};

export function setDynCors(cors: Record<string, string>): void {
  dynCors = cors;
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...dynCors, "Content-Type": "application/json" },
  });
}
