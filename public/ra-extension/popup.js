const statusBox = document.getElementById("statusBox");
const logEl = document.getElementById("log");

function setStatus(text, type) {
  statusBox.textContent = text;
  statusBox.className = "status " + type;
}

function log(msg) {
  logEl.textContent += new Date().toLocaleTimeString() + " " + msg + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}

document.getElementById("btnLogin").addEventListener("click", async () => {
  setStatus("Login in corso...", "info");
  log("Avvio auto-login...");
  chrome.runtime.sendMessage(
    { source: "ra-content-bridge", action: "autoLogin" },
    (res) => {
      if (res && res.success) {
        setStatus("Login avviato! Completa nel browser.", "ok");
        log("Login avviato. Dopo il login, clicca 'Sincronizza Cookie'.");
      } else {
        setStatus("Errore: " + (res?.error || "Sconosciuto"), "error");
        log("Errore login: " + (res?.error || "Sconosciuto"));
      }
    }
  );
});

document.getElementById("btnSync").addEventListener("click", async () => {
  setStatus("Sincronizzazione...", "info");
  log("Sync cookie in corso...");
  chrome.runtime.sendMessage(
    { source: "ra-content-bridge", action: "syncCookies" },
    (res) => {
      if (res && res.success) {
        setStatus("✅ Cookie sincronizzato!", "ok");
        log("Cookie salvato con successo.");
      } else {
        setStatus("Errore: " + (res?.error || "Sconosciuto"), "error");
        log("Errore sync: " + (res?.error || "Sconosciuto"));
      }
    }
  );
});
