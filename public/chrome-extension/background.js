// ══════════════════════════════════════════════════
// WCA Chrome Extension — Background Service Worker
// V4: Extract-only. Strict error codes. Login detection.
// ══════════════════════════════════════════════════

// ── Profile extraction function (injected into WCA tab) ──
function extractFullProfileFromPage() {
  try {
    const result = {
      wcaId: null, companyName: null, contacts: [], profileHtml: null,
      profile: {
        address: null, phone: null, fax: null, mobile: null,
        emergencyPhone: null, email: null, website: null,
        memberSince: null, membershipExpires: null, officeType: null,
        description: null, networks: [], services: [], certifications: [], branchCities: []
      }
    };

    const urlMatch = window.location.href.match(/\/directory\/members\/(\d+)/i);
    if (urlMatch) result.wcaId = parseInt(urlMatch[1]);

    const h1 = document.querySelector("h1");
    if (h1) result.companyName = h1.textContent.trim();

    result.profileHtml = document.body.innerHTML;

    const allLabels = document.querySelectorAll("[class*='profile_label']");
    for (let li = 0; li < allLabels.length; li++) {
      const label = allLabels[li];
      let inContact = false;
      let parent = label.parentElement;
      while (parent) {
        if (parent.className && typeof parent.className === "string" && parent.className.indexOf("contactperson_row") >= 0) { inContact = true; break; }
        parent = parent.parentElement;
      }
      if (inContact) continue;

      const labelText = label.textContent.trim().replace(/:$/, "");
      let valEl = label.nextElementSibling;
      if (!valEl || (valEl.className && typeof valEl.className === "string" && valEl.className.indexOf("profile_val") < 0)) {
        const par = label.parentElement;
        if (par) { const next = par.nextElementSibling; if (next) valEl = next.querySelector("[class*='profile_val']") || next; }
      }
      let value = valEl ? valEl.textContent.trim() : "";
      if (/Members\s*only/i.test(value) || /please.*Login/i.test(value)) value = "";
      if (!value) continue;

      if (/^Address$/i.test(labelText)) result.profile.address = value;
      else if (/^Phone$/i.test(labelText)) result.profile.phone = value;
      else if (/^Fax$/i.test(labelText)) result.profile.fax = value;
      else if (/^Mobile$/i.test(labelText)) result.profile.mobile = value;
      else if (/^Emergency\s*Phone$/i.test(labelText)) result.profile.emergencyPhone = value;
      else if (/^Email$/i.test(labelText)) {
        const emailLink = valEl ? valEl.querySelector("a[href^='mailto:']") : null;
        result.profile.email = emailLink ? emailLink.href.replace("mailto:", "").trim() : (value.indexOf("@") >= 0 ? value : null);
      }
      else if (/^Web\s*site$/i.test(labelText) || /^Website$/i.test(labelText) || /^URL$/i.test(labelText)) {
        const link = valEl ? valEl.querySelector("a[href]") : null;
        result.profile.website = link ? link.href : value;
      }
      else if (/^Member\s*Since$/i.test(labelText)) result.profile.memberSince = value;
      else if (/^Membership\s*Expires$/i.test(labelText) || /^Expiry$/i.test(labelText) || /^Expires$/i.test(labelText)) result.profile.membershipExpires = value;
      else if (/^Office\s*Type$/i.test(labelText)) result.profile.officeType = value;
    }

    const descCandidates = document.querySelectorAll("[class*='profile_description'], [class*='company_description'], [class*='member_description']");
    for (let di = 0; di < descCandidates.length; di++) {
      const txt = descCandidates[di].textContent.trim();
      if (txt.length > 30) { result.profile.description = txt; break; }
    }
    if (!result.profile.description) {
      const allVals = document.querySelectorAll("[class*='profile_val']");
      for (let vi = 0; vi < allVals.length; vi++) { const vt = allVals[vi].textContent.trim(); if (vt.length > 200) { result.profile.description = vt; break; } }
    }

    const networkEls = document.querySelectorAll("[class*='network'], [class*='membership']");
    for (let ni = 0; ni < networkEls.length; ni++) {
      const rows = networkEls[ni].querySelectorAll("tr, [class*='row']");
      for (let nri = 0; nri < rows.length; nri++) {
        const cells = rows[nri].querySelectorAll("td, [class*='col'], [class*='val']");
        if (cells.length >= 1) {
          const netName = cells[0].textContent.trim();
          const netExpires = cells.length >= 2 ? cells[1].textContent.trim() : "";
          if (netName && netName.length > 2 && !/^Network$/i.test(netName) && !/^Name$/i.test(netName))
            result.profile.networks.push({ name: netName, expires: netExpires || null });
        }
      }
    }

    const serviceEls = document.querySelectorAll("[class*='service'], [class*='specialit'], [class*='capability']");
    for (let si = 0; si < serviceEls.length; si++) {
      const badges = serviceEls[si].querySelectorAll("span, li, a, div");
      for (let bi = 0; bi < badges.length; bi++) {
        const svc = badges[bi].textContent.trim();
        if (svc && svc.length > 2 && svc.length < 80 && result.profile.services.indexOf(svc) < 0) result.profile.services.push(svc);
      }
    }

    const certEls = document.querySelectorAll("[class*='certif'], [class*='accredit']");
    for (let ci = 0; ci < certEls.length; ci++) {
      const cBadges = certEls[ci].querySelectorAll("span, li, a, img, div");
      for (let cbi = 0; cbi < cBadges.length; cbi++) {
        const cert = (cBadges[cbi].alt || cBadges[cbi].title || cBadges[cbi].textContent || "").trim();
        if (cert && cert.length > 1 && cert.length < 50 && result.profile.certifications.indexOf(cert) < 0) result.profile.certifications.push(cert);
      }
    }

    const branchEls = document.querySelectorAll("[class*='branch'], [class*='office_list']");
    for (let bri = 0; bri < branchEls.length; bri++) {
      const items = branchEls[bri].querySelectorAll("li, a, span, div");
      for (let bii = 0; bii < items.length; bii++) {
        const bc = items[bii].textContent.trim();
        if (bc && bc.length > 1 && bc.length < 60 && result.profile.branchCities.indexOf(bc) < 0) result.profile.branchCities.push(bc);
      }
    }

    let allRows = document.querySelectorAll("[class*='contactperson_row']");
    if (allRows.length === 0) {
      const allEls = document.querySelectorAll("*");
      const contactRows = [];
      for (let i = 0; i < allEls.length; i++) {
        if (allEls[i].className && typeof allEls[i].className === "string" && allEls[i].className.indexOf("contactperson_row") >= 0) contactRows.push(allEls[i]);
      }
      allRows = contactRows;
    }

    for (let r = 0; r < allRows.length; r++) {
      const row = allRows[r];
      const contact = {};
      const labels2 = row.querySelectorAll("[class*='profile_label']");
      for (let l = 0; l < labels2.length; l++) {
        const cLabelText = labels2[l].textContent.trim().replace(/:$/, "");
        let cValEl = labels2[l].nextElementSibling;
        if (!cValEl || (cValEl.className && cValEl.className.indexOf("profile_val") < 0)) {
          const cParent = labels2[l].parentElement;
          if (cParent) { const cNext = cParent.nextElementSibling; if (cNext) cValEl = cNext.querySelector("[class*='profile_val']") || cNext; }
        }
        let cValue = cValEl ? cValEl.textContent.trim() : "";
        if (/Members\s*only/i.test(cValue) || /please.*Login/i.test(cValue)) cValue = "";

        if (/^Title$/i.test(cLabelText)) contact.title = cValue;
        else if (/^Name$/i.test(cLabelText)) contact.name = cValue;
        else if (/^Email$/i.test(cLabelText)) {
          const cEmailLink = cValEl ? cValEl.querySelector("a[href^='mailto:']") : null;
          if (cEmailLink) contact.email = cEmailLink.href.replace("mailto:", "").trim();
          else if (cValue && cValue.indexOf("@") >= 0) contact.email = cValue;
        }
        else if (/^Direct\s*Line$/i.test(cLabelText) || /^Phone$/i.test(cLabelText)) contact.phone = cValue;
        else if (/^Mobile$/i.test(cLabelText)) contact.mobile = cValue;
      }
      if (contact.title || contact.name) {
        if (!contact.name && contact.title) contact.name = contact.title;
        result.contacts.push(contact);
      }
    }

    return result;
  } catch (e) {
    return { error: e.message, contacts: [], profile: {} };
  }
}

// ── Page inspection (injected into WCA tab) ──
function inspectPage() {
  try {
    const len = (document.body && document.body.innerHTML) ? document.body.innerHTML.length : 0;
    const h1 = document.querySelector("h1");
    const h1Text = h1 ? h1.textContent.trim() : "";
    const url = window.location.href;
    const title = document.title || "";

    // Login detection
    const hasLoginForm = !!document.querySelector("input[type='password']");
    const isLoginUrl = /\/login|\/signin|\/account\/log/i.test(url);
    const loginDetected = hasLoginForm || isLoginUrl;

    // Member not found
    const memberNotFound = /member not found|not found/i.test(h1Text);

    // Profile container
    const hasProfileContainer = !!document.querySelector("[class*='profile_label']") || !!document.querySelector("[class*='contactperson_row']");

    const h1Valid = h1Text.length > 3 && !/error|login|not found|sign in/i.test(h1Text);
    const loaded = (len > 2000 || (h1Valid && len > 500)) && !loginDetected;

    return {
      length: len, loaded: loaded, h1Text: h1Text, memberNotFound: memberNotFound,
      url: url, title: title, loginDetected: loginDetected,
      hasProfileContainer: hasProfileContainer, hasNotFoundMarker: memberNotFound
    };
  } catch (e) {
    return { length: 0, loaded: false, h1Text: "", memberNotFound: false, url: "", title: "", loginDetected: false, hasProfileContainer: false, hasNotFoundMarker: false };
  }
}

// ── Tab management with retry ──
async function safeCreateTab(url, retries) {
  retries = retries || 3;
  for (let attempt = 0; attempt < retries; attempt++) {
    try { return await chrome.tabs.create({ url: url, active: false }); }
    catch (e) {
      if (attempt < retries - 1 && e.message && e.message.indexOf("cannot be edited") >= 0)
        await new Promise(function(r) { setTimeout(r, 500 + attempt * 500); });
      else throw e;
    }
  }
}

async function safeRemoveTab(tabId) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { await chrome.tabs.remove(tabId); return; }
    catch (e) {
      if (attempt < 2 && e.message && e.message.indexOf("cannot be edited") >= 0)
        await new Promise(function(r) { setTimeout(r, 300 + attempt * 300); });
      else return;
    }
  }
}

function waitForTabLoad(tabId, ms) {
  ms = ms || 20000;
  return new Promise(function (resolve) {
    const timeout = setTimeout(function () { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, ms);
    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timeout); chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 1500);
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ── Build standardized response ──
function buildResponse(wcaId, state, errorCode, extra) {
  extra = extra || {};
  return {
    success: state === "ok",
    wcaId: wcaId,
    state: state,
    errorCode: errorCode || null,
    companyName: extra.companyName || null,
    contacts: extra.contacts || [],
    profile: extra.profile || {},
    profileHtml: extra.profileHtml || null,
    htmlLength: extra.htmlLength || 0,
    error: extra.error || null,
    debug: extra.debug || {}
  };
}

// ── Core extraction ──
async function extractContactsForId(wcaId) {
  let tab = null;
  try {
    tab = await safeCreateTab("https://www.wcaworld.com/directory/members/" + wcaId);
    await waitForTabLoad(tab.id, 20000);

    // Inspect page
    const inspectResult = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: inspectPage });
    const page = inspectResult[0] && inspectResult[0].result;
    const debug = {
      url: page ? page.url : "", title: page ? page.title : "",
      pageLoaded: page ? page.loaded : false, loginDetected: page ? page.loginDetected : false,
      domSignals: { hasProfileContainer: page ? page.hasProfileContainer : false, hasNotFoundMarker: page ? page.hasNotFoundMarker : false }
    };

    if (!page) {
      return buildResponse(wcaId, "bridge_error", "EXT_BRIDGE_ERROR", { error: "Page inspection failed", debug: debug });
    }

    if (page.loginDetected) {
      return buildResponse(wcaId, "login_required", "WCA_LOGIN_REQUIRED", { error: "Login page detected", debug: debug, htmlLength: page.length });
    }

    if (page.memberNotFound) {
      return buildResponse(wcaId, "member_not_found", "WCA_PROFILE_NOT_FOUND", { companyName: page.h1Text, debug: debug, htmlLength: page.length });
    }

    if (!page.loaded) {
      return buildResponse(wcaId, "not_loaded", "WCA_PAGE_NOT_READY", { error: "Page not loaded", debug: debug, htmlLength: page.length });
    }

    // Extract profile
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractFullProfileFromPage });
    const pageData = results[0] && results[0].result;

    if (!pageData || pageData.error) {
      return buildResponse(wcaId, "extraction_error", "WCA_DOM_PARSE_FAILED", {
        error: pageData ? pageData.error : "No data returned", debug: debug
      });
    }

    const cn = (pageData.companyName || "").toLowerCase();
    if (cn.indexOf("member not found") >= 0 || cn.indexOf("not found") >= 0) {
      return buildResponse(wcaId, "member_not_found", "WCA_PROFILE_NOT_FOUND", {
        companyName: pageData.companyName, profileHtml: pageData.profileHtml,
        htmlLength: pageData.profileHtml ? pageData.profileHtml.length : 0, debug: debug
      });
    }

    return buildResponse(wcaId, "ok", null, {
      companyName: pageData.companyName,
      contacts: pageData.contacts || [],
      profile: pageData.profile || {},
      profileHtml: pageData.profileHtml || null,
      htmlLength: pageData.profileHtml ? pageData.profileHtml.length : 0,
      debug: debug
    });
  } catch (err) {
    return buildResponse(wcaId, "bridge_error", "EXT_BRIDGE_ERROR", { error: err.message });
  } finally {
    if (tab) safeRemoveTab(tab.id);
  }
}

// ── Message listener ──
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.source !== "wca-content-bridge") return false;

  if (message.action === "ping") {
    sendResponse({ success: true, version: "8.0" });
    return false;
  }

  if (message.action === "extractContacts") {
    const wcaId = message.wcaId;
    if (!wcaId) { sendResponse(buildResponse(0, "bridge_error", "EXT_BRIDGE_ERROR", { error: "wcaId required" })); return false; }
    (async function () {
      try { sendResponse(await extractContactsForId(wcaId)); }
      catch (err) { sendResponse(buildResponse(wcaId, "bridge_error", "EXT_BRIDGE_ERROR", { error: err.message })); }
    })();
    return true;
  }

  if (message.action === "verifySession") {
    (async function () {
      try {
        const aspxAuth = await chrome.cookies.get({ url: "https://www.wcaworld.com/", name: ".ASPXAUTH" });
        if (aspxAuth && aspxAuth.value && (!aspxAuth.expirationDate || aspxAuth.expirationDate * 1000 > Date.now())) {
          sendResponse({ success: true, authenticated: true, reason: "aspxauth_present" });
          return;
        }
        const wcaCookie = await chrome.cookies.get({ url: "https://www.wcaworld.com/", name: "wca" });
        if (wcaCookie && wcaCookie.value && (!wcaCookie.expirationDate || wcaCookie.expirationDate * 1000 > Date.now())) {
          sendResponse({ success: true, authenticated: true, reason: "wca_cookie_present" });
          return;
        }
        sendResponse({ success: true, authenticated: false, reason: "no_auth_cookies" });
      } catch (err) {
        sendResponse({ success: false, authenticated: false, error: err.message });
      }
    })();
    return true;
  }

  // ── Preflight test: open a known profile and check accessibility ──
  if (message.action === "preflightTest") {
    (async function () {
      try {
        const testResult = await extractContactsForId(1); // WCA ID 1 as test
        if (testResult.state === "ok" || testResult.state === "member_not_found") {
          sendResponse({ success: true, state: "ok", message: "WCA accessible" });
        } else {
          sendResponse({ success: false, state: testResult.state, errorCode: testResult.errorCode, message: testResult.error || testResult.state });
        }
      } catch (err) {
        sendResponse({ success: false, state: "bridge_error", errorCode: "EXT_BRIDGE_ERROR", message: err.message });
      }
    })();
    return true;
  }

  return false;
});

// ── On install ──
chrome.runtime.onInstalled.addListener(async function () {
  const SUPABASE_URL = "https://zrbditqddhjkutzjycgi.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYmRpdHFkZGhqa3V0emp5Y2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NDk5NjcsImV4cCI6MjA4NTUyNTk2N30.RvWUoMZf1fkqeEIe5sjXMyocxdFcb7yU1enEVoPdWb4";
  const extensionId = chrome.runtime.id;
  try {
    const res = await fetch(SUPABASE_URL + "/rest/v1/app_settings?key=eq.chrome_extension_id", {
      method: "GET", headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY }
    });
    const existing = await res.json();
    if (existing && existing.length > 0) {
      await fetch(SUPABASE_URL + "/rest/v1/app_settings?key=eq.chrome_extension_id", {
        method: "PATCH", headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY, "Prefer": "return=minimal" },
        body: JSON.stringify({ value: extensionId })
      });
    } else {
      await fetch(SUPABASE_URL + "/rest/v1/app_settings", {
        method: "POST", headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY, "Prefer": "return=minimal" },
        body: JSON.stringify({ key: "chrome_extension_id", value: extensionId })
      });
    }
  } catch (err) { console.error("[WCA Extension] Failed to save ID:", err); }
});
