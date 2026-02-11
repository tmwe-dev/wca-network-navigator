const SUPABASE_URL = "https://zrbditqddhjkutzjycgi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYmRpdHFkZGhqa3V0emp5Y2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NDk5NjcsImV4cCI6MjA4NTUyNTk2N30.RvWUoMZf1fkqeEIe5sjXMyocxdFcb7yU1enEVoPdWb4";

const statusEl = document.getElementById("status");
const diagEl = document.getElementById("diagnostics");
const syncBtn = document.getElementById("syncBtn");

syncBtn.addEventListener("click", async () => {
  syncBtn.disabled = true;
  statusEl.className = "status idle";
  statusEl.textContent = "⏳ Lettura cookie...";
  diagEl.textContent = "";

  try {
    // Read ALL cookies for wcaworld.com (including HttpOnly!)
    const cookies = await chrome.cookies.getAll({ domain: "www.wcaworld.com" });
    
    if (!cookies || cookies.length === 0) {
      statusEl.className = "status error";
      statusEl.textContent = "❌ Nessun cookie trovato. Sei loggato su wcaworld.com?";
      syncBtn.disabled = false;
      return;
    }

    // Check for .ASPXAUTH
    const hasAspxAuth = cookies.some(c => c.name === '.ASPXAUTH' || c.name === '.AspNet.ApplicationCookie');
    const cookieNames = cookies.map(c => c.name);
    
    // Show diagnostics
    diagEl.innerHTML = `<strong>Cookie trovati:</strong> ${cookies.length}<br>` +
      `<strong>.ASPXAUTH:</strong> ${hasAspxAuth ? '✅ Presente' : '❌ MANCANTE'}<br>` +
      `<small>${cookieNames.join(', ')}</small>`;

    if (!hasAspxAuth) {
      statusEl.className = "status error";
      statusEl.textContent = "⚠️ .ASPXAUTH mancante! Rilogga su wcaworld.com prima di sincronizzare.";
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
      statusEl.textContent = "✅ Cookie sincronizzato! Contatti personali visibili.";
    } else {
      statusEl.className = "status error";
      statusEl.textContent = data.message || "⚠️ Cookie inviato ma contatti privati non visibili.";
    }
    
    // Show server diagnostics
    if (data.diagnostics) {
      const d = data.diagnostics;
      diagEl.innerHTML += `<br><strong>Verifica server:</strong><br>` +
        `Contatti totali: ${d.contactsTotal || 0}<br>` +
        `Nomi reali visibili: ${d.contactsWithRealName || 0}<br>` +
        `Email visibili: ${d.contactsWithEmail || 0}<br>` +
        `"Members only": ${d.membersOnlyCount || 0}x`;
    }
  } catch (err) {
    statusEl.className = "status error";
    statusEl.textContent = "❌ Errore: " + err.message;
  } finally {
    syncBtn.disabled = false;
  }
});
