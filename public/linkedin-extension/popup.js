
const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");
const mainBtn = document.getElementById("mainBtn");

function setStatus(text, cls) {
  statusEl.className = "status " + cls;
  statusEl.textContent = text;
}

function log(text, cls) {
  cls = cls || "";
  const line = document.createElement("div");
  line.className = cls;
  line.textContent = text;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function sendToBackground(action) {
  return new Promise(function (resolve, reject) {
    chrome.runtime.sendMessage({ source: "li-popup", action: action }, function (response) {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response || { success: false, error: "No response from extension" });
    });
  });
}

function renderResult(result) {
  if (result && result.success) {
    if (result.reason === "already_logged_in") {
      log("✓ Sessione LinkedIn già attiva.", "done");
    } else if (result.reason === "google_auth_completed") {
      log("✓ Autenticazione Google completata e rientro su LinkedIn riuscito.", "done");
    } else if (result.reason === "challenge_resolved_manually") {
      log("✓ Verifica LinkedIn completata manualmente.", "done");
    } else {
      log("✓ Login completato dalla pagina ufficiale di LinkedIn.", "done");
    }

    if (result.cookieSynced) {
      log("✓ Cookie li_at sincronizzato.", "done");
    }
    if (result.currentUrl) {
      log("URL finale: " + result.currentUrl, "done");
    }

    setStatus("✅ LinkedIn connesso", "ok");
    return;
  }

  const reason = result && result.reason ? result.reason : "generic_error";
  const message = result && (result.message || result.error) ? (result.message || result.error) : "Login non completato.";

  if (reason === "google_auth_timeout") {
    setStatus("⚠️ Completa Google nel tab aperto", "error");
    log("⚠️ LinkedIn ha aperto il redirect di autenticazione Google.", "wait");
    log(message, "wait");
  } else if (reason === "challenge_timeout") {
    setStatus("⚠️ Completa la verifica LinkedIn", "error");
    log("⚠️ LinkedIn richiede una verifica manuale.", "wait");
    log(message, "wait");
  } else if (reason === "login_error") {
    setStatus("❌ Errore login LinkedIn", "error");
    log("Errore LinkedIn: " + message, "fail");
  } else if (reason === "login_form_not_found" || reason === "login_fill_failed" || reason === "login_prepare_failed") {
    setStatus("❌ Form di login non gestito", "error");
    log(message, "fail");
  } else if (reason === "tab_closed") {
    setStatus("❌ Tab chiuso", "error");
    log(message, "fail");
  } else {
    setStatus("❌ Connessione fallita", "error");
    log(message, "fail");
  }

  if (result && result.currentUrl) {
    log("URL finale: " + result.currentUrl, "wait");
  }
}

mainBtn.addEventListener("click", async function () {
  mainBtn.disabled = true;
  logEl.innerHTML = "";

  setStatus("⏳ Apro LinkedIn ufficiale...", "working");
  log("① Apro la pagina ufficiale di LinkedIn...", "wait");
  log("② Se compare Google o una verifica, completala nel tab aperto.", "wait");
  log("③ Aspetto il ritorno su LinkedIn e il cookie li_at...", "wait");

  try {
    const result = await sendToBackground("autoLogin");
    renderResult(result);
  } catch (err) {
    setStatus("❌ " + err.message, "error");
    log("Errore: " + err.message, "fail");
  }

  mainBtn.disabled = false;
});
