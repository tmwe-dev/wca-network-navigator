const SUPABASE_URL = "https://zrbditqddhjkutzjycgi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYmRpdHFkZGhqa3V0emp5Y2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NDk5NjcsImV4cCI6MjA4NTUyNTk2N30.RvWUoMZf1fkqeEIe5sjXMyocxdFcb7yU1enEVoPdWb4";

const statusEl = document.getElementById("status");
const syncBtn = document.getElementById("syncBtn");

syncBtn.addEventListener("click", async () => {
  syncBtn.disabled = true;
  statusEl.className = "status idle";
  statusEl.textContent = "⏳ Lettura cookie...";

  try {
    // Read ALL cookies for wcaworld.com (including HttpOnly!)
    const cookies = await chrome.cookies.getAll({ domain: "www.wcaworld.com" });
    
    if (!cookies || cookies.length === 0) {
      statusEl.className = "status error";
      statusEl.textContent = "❌ Nessun cookie trovato. Sei loggato su wcaworld.com?";
      syncBtn.disabled = false;
      return;
    }

    // Build cookie header string
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    statusEl.textContent = "⏳ Invio al server...";

    // Send to edge function
    const res = await fetch(`${SUPABASE_URL}/functions/v1/save-wca-cookie`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ cookie: cookieStr }),
    });

    const data = await res.json();

    if (data.authenticated) {
      statusEl.className = "status ok";
      statusEl.textContent = "✅ Cookie sincronizzato! Sessione attiva.";
    } else {
      statusEl.className = "status error";
      statusEl.textContent = "⚠️ Cookie inviato ma sessione non valida. Rilogga su wcaworld.com.";
    }
  } catch (err) {
    statusEl.className = "status error";
    statusEl.textContent = "❌ Errore: " + err.message;
  } finally {
    syncBtn.disabled = false;
  }
});
