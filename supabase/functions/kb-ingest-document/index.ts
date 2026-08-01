/**
 * kb-ingest-document — Ingester end-to-end per documenti caricati dall'utente.
 *
 * Pipeline: Upload (base64) → Estrazione testo → Chunking → Embedding → INSERT in kb_entries.
 *
 * Input JSON:
 *   {
 *     fileName: string,
 *     mimeType: string,
 *     contentBase64: string,
 *     category?: string,        // default "imported_documents"
 *     chapter?: string,         // default fileName
 *     priority?: number,        // default 5
 *     tags?: string[],          // merged con ['auto-imported']
 *   }
 *
 * Output:
 *   { success: true, chunks_created, total_chars, kb_ids: string[] }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { embedBatch } from "../_shared/embeddings.ts";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;

interface IngestPayload {
  fileName: string;
  mimeType: string;
  contentBase64: string;
  category?: string;
  chapter?: string;
  priority?: number;
  tags?: string[];
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function extractText(bytes: Uint8Array, mimeType: string, fileName: string): Promise<string> {
  const lowerName = fileName.toLowerCase();
  // Plain text / Markdown
  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".markdown")
  ) {
    return new TextDecoder("utf-8").decode(bytes);
  }
  // PDF
  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
    const pdfParseMod = await import("npm:pdf-parse@1.1.1");
    const pdfParse = (pdfParseMod as { default?: (b: Uint8Array) => Promise<{ text: string }> }).default
      ?? (pdfParseMod as unknown as (b: Uint8Array) => Promise<{ text: string }>);
    const result = await pdfParse(bytes);
    return result.text || "";
  }
  // DOCX
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    const mammothMod = await import("npm:mammoth@1.7.0");
    const mammoth = (mammothMod as { default?: { extractRawText: (o: { buffer: Uint8Array }) => Promise<{ value: string }> } }).default
      ?? (mammothMod as unknown as { extractRawText: (o: { buffer: Uint8Array }) => Promise<{ value: string }> });
    const result = await mammoth.extractRawText({ buffer: bytes });
    return result.value || "";
  }
  throw new Error(`Tipo file non supportato: ${mimeType || fileName}`);
}

function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length <= size) return [cleaned];

  const paragraphs = cleaned.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const p of paragraphs) {
    if ((current + "\n\n" + p).length <= size) {
      current = current ? current + "\n\n" + p : p;
    } else {
      if (current) chunks.push(current);
      // If a single paragraph is bigger than size, hard-split it
      if (p.length > size) {
        for (let i = 0; i < p.length; i += size - overlap) {
          chunks.push(p.slice(i, i + size));
        }
        current = "";
      } else {
        current = p;
      }
    }
  }
  if (current) chunks.push(current);

  // Add overlap between chunks (tail of N joined to head of N+1)
  if (overlap > 0 && chunks.length > 1) {
    for (let i = 1; i < chunks.length; i++) {
      const tail = chunks[i - 1].slice(-overlap);
      chunks[i] = tail + " " + chunks[i];
    }
  }
  return chunks.filter((c) => c.trim().length > 20);
}

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);
  const sec = getSecurityHeaders(cors);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: sec });

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);
    const userId = userData.user.id;

    const payload = (await req.json()) as IngestPayload;
    if (!payload?.fileName || !payload?.contentBase64) {
      return json({ error: "invalid_payload", message: "fileName e contentBase64 obbligatori" }, 400);
    }

    const bytes = decodeBase64ToBytes(payload.contentBase64);
    if (bytes.byteLength > MAX_FILE_BYTES) {
      return json({ error: "file_too_large", message: `Max ${MAX_FILE_BYTES / 1024 / 1024}MB` }, 413);
    }

    // 1. Extract
    const rawText = await extractText(bytes, payload.mimeType || "", payload.fileName);
    if (!rawText || rawText.trim().length < 50) {
      return json({ error: "empty_text", message: "Documento privo di testo estraibile" }, 422);
    }

    // 2. Chunk
    const chunks = chunkText(rawText);
    if (chunks.length === 0) {
      return json({ error: "no_chunks", message: "Impossibile generare chunk" }, 422);
    }

    // 3. Embed (batch by 16)
    const embeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += 16) {
      const slice = chunks.slice(i, i + 16);
      const vecs = await embedBatch(slice);
      embeddings.push(...vecs);
    }

    // 4. INSERT in kb_entries
    const adminClient = createClient(supabaseUrl, serviceKey);
    const category = payload.category?.trim() || "imported_documents";
    const chapter = payload.chapter?.trim() || payload.fileName;
    const priority = Math.max(1, Math.min(10, payload.priority ?? 5));
    const tags = Array.from(new Set([...(payload.tags || []), "auto-imported"]));
    const total = chunks.length;
    const baseTitle = payload.fileName.replace(/\.[^.]+$/, "");

    const rows = chunks.map((content, idx) => ({
      user_id: userId,
      category,
      chapter,
      title: total > 1 ? `${baseTitle} — chunk ${idx + 1}/${total}` : baseTitle,
      content,
      tags,
      priority,
      sort_order: idx,
      is_active: true,
      source_path: `${payload.fileName}#${idx + 1}`,
      embedding: embeddings[idx] as unknown as string,
    }));

    const insertedIds: string[] = [];
    for (let i = 0; i < rows.length; i += 10) {
      const batch = rows.slice(i, i + 10);
      const { data, error } = await adminClient.from("kb_entries").insert(batch).select("id");
      if (error) {
        console.error("kb_entries insert error", error);
        return json({ error: "insert_failed", message: error.message, inserted_so_far: insertedIds.length }, 500);
      }
      insertedIds.push(...(data || []).map((r) => r.id as string));
    }

    return json({
      success: true,
      chunks_created: insertedIds.length,
      total_chars: rawText.length,
      kb_ids: insertedIds,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("kb-ingest-document fatal:", msg);
    return json({ error: "server_error", message: msg }, 500);
  }
});
