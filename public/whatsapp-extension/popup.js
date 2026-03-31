const dot = document.getElementById("dot");
const statusText = document.getElementById("statusText");
const checkBtn = document.getElementById("checkBtn");

function setStatus(ok, text) {
  dot.className = "dot " + (ok ? "green" : "red");
  statusText.textContent = text;
}

checkBtn.addEventListener("click", () => {
  setStatus(false, "Verifico...");
  chrome.runtime.sendMessage(
    { source: "wa-content-bridge", action: "verifySession" },
    (res) => {
      if (chrome.runtime.lastError) {
        setStatus(false, "Errore: " + chrome.runtime.lastError.message);
        return;
      }
      if (res?.authenticated) {
        setStatus(true, "WhatsApp Web connesso ✓");
      } else {
        setStatus(false, res?.reason === "qr_required" ? "QR code richiesto" : "Non connesso");
      }
    }
  );
});

setStatus(false, "Clicca per verificare");
