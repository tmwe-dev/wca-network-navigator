import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * manage-email-folders — IMAP folder operations (move, archive, spam, list)
 * POST body: { action: "move"|"archive"|"spam"|"list_folders"|"create_folder", uids?: string[], target_folder?: string }
 * 
 * IMPORTANT: This does NOT touch email download (check-inbox). It only manages folder operations
 * after emails have been downloaded and categorized.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "INVALID_TOKEN" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { action, uids, target_folder } = body;

    const IMAP_HOST = Deno.env.get("IMAP_HOST");
    const IMAP_USER = Deno.env.get("IMAP_USER");
    const IMAP_PASSWORD = Deno.env.get("IMAP_PASSWORD");

    if (!IMAP_HOST || !IMAP_USER || !IMAP_PASSWORD) {
      return new Response(JSON.stringify({ error: "IMAP not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Connect to IMAP
    const conn = await Deno.connectTls({ hostname: IMAP_HOST, port: 993 });
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let tagCounter = 0;

    const sendCommand = async (cmd: string): Promise<string> => {
      const tag = `A${++tagCounter}`;
      const fullCmd = `${tag} ${cmd}\r\n`;
      await conn.write(encoder.encode(fullCmd));

      let response = "";
      const buf = new Uint8Array(8192);
      while (true) {
        const n = await conn.read(buf);
        if (n === null) break;
        response += decoder.decode(buf.subarray(0, n));
        if (response.includes(`${tag} OK`) || response.includes(`${tag} NO`) || response.includes(`${tag} BAD`)) break;
      }
      return response;
    };

    // Read greeting
    const greetBuf = new Uint8Array(4096);
    await conn.read(greetBuf);

    // Login
    const loginResp = await sendCommand(`LOGIN "${IMAP_USER}" "${IMAP_PASSWORD}"`);
    if (!loginResp.includes("OK")) {
      conn.close();
      return new Response(JSON.stringify({ error: "IMAP login failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let result: any = {};

    switch (action) {
      case "list_folders": {
        const listResp = await sendCommand('LIST "" "*"');
        const folders: Array<{ name: string; flags: string }> = [];
        const lines = listResp.split("\n");
        for (const line of lines) {
          const match = line.match(/\* LIST \(([^)]*)\) "[^"]*" "?([^"\r\n]+)"?/);
          if (match) {
            folders.push({ name: match[2].trim(), flags: match[1] });
          }
        }
        result = { folders };
        break;
      }

      case "create_folder": {
        if (!target_folder) { result = { error: "target_folder required" }; break; }
        const createResp = await sendCommand(`CREATE "${target_folder}"`);
        result = { success: createResp.includes("OK") || createResp.includes("ALREADYEXISTS") };
        break;
      }

      case "archive":
      case "spam":
      case "move": {
        if (!uids || uids.length === 0) { result = { error: "uids required" }; break; }

        // Select INBOX
        await sendCommand("SELECT INBOX");

        let folder = target_folder;
        if (action === "archive") {
          // Try common archive folder names
          const listResp = await sendCommand('LIST "" "*"');
          if (listResp.includes("Archive")) folder = "Archive";
          else if (listResp.includes("[Gmail]/All Mail")) folder = "[Gmail]/All Mail";
          else if (listResp.includes("INBOX.Archive")) folder = "INBOX.Archive";
          else {
            // Create Archive folder
            await sendCommand('CREATE "Archive"');
            folder = "Archive";
          }
        } else if (action === "spam") {
          const listResp = await sendCommand('LIST "" "*"');
          if (listResp.includes("Junk")) folder = "Junk";
          else if (listResp.includes("Spam")) folder = "Spam";
          else if (listResp.includes("[Gmail]/Spam")) folder = "[Gmail]/Spam";
          else {
            await sendCommand('CREATE "Junk"');
            folder = "Junk";
          }
        }

        if (!folder) { result = { error: "No target folder" }; break; }

        let moved = 0;
        for (const uid of uids) {
          // Try MOVE first (RFC 6851)
          const moveResp = await sendCommand(`UID MOVE ${uid} "${folder}"`);
          if (moveResp.includes("OK")) {
            moved++;
          } else {
            // Fallback: COPY + DELETE
            const copyResp = await sendCommand(`UID COPY ${uid} "${folder}"`);
            if (copyResp.includes("OK")) {
              await sendCommand(`UID STORE ${uid} +FLAGS (\\Deleted)`);
              moved++;
            }
          }
        }

        // Expunge deleted
        if (moved > 0) await sendCommand("EXPUNGE");

        // Update metadata in channel_messages
        const supabaseService = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        for (const uid of uids) {
          const metaUpdate: Record<string, any> = {};
          if (action === "archive") { metaUpdate.archived = true; metaUpdate.archived_at = new Date().toISOString(); }
          if (action === "spam") { metaUpdate.spam = true; }
          if (action === "move") { metaUpdate.moved_to = folder; }

          await supabaseService
            .from("channel_messages")
            .update({ category: action === "spam" ? "spam" : action === "archive" ? "archived" : "moved" })
            .eq("imap_uid", parseInt(uid))
            .eq("user_id", user.id);
        }

        result = { moved, folder };
        break;
      }

      default:
        result = { error: `Unknown action: ${action}` };
    }

    // Logout
    await sendCommand("LOGOUT");
    conn.close();

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("manage-email-folders error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
