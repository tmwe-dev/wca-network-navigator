// ══════════════════════════════════════════════════════════
// FireScrape – Background Service Worker
// Google Search + Web Scraping in stealth background tabs
// ══════════════════════════════════════════════════════════

// ── Safe tab helpers with retry ──
async function safeCreateTab(url) {
  for (var attempt = 0; attempt < 3; attempt++) {
    try {
      return await chrome.tabs.create({ url: url, active: false });
    } catch (e) {
      if (attempt < 2) await new Promise(function (r) { setTimeout(r, 500 * (attempt + 1)); });
      else throw e;
    }
  }
}

async function safeRemoveTab(tabId) {
  try { await chrome.tabs.remove(tabId); } catch (e) { /* tab already closed */ }
}

function waitForTabLoad(tabId, ms) {
  ms = ms || 20000;
  return new Promise(function (resolve) {
    var timeout = setTimeout(function () {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, ms);
    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 1500);
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ══════════════════════════════════════════
// Google Search — extract results from SERP
// ══════════════════════════════════════════
function extractGoogleResults(limit) {
  try {
    var items = document.querySelectorAll("div.g, div[data-hveid] a[href^='http']");
    var results = [];
    var seen = new Set();

    // Method 1: standard div.g blocks
    document.querySelectorAll("div.g").forEach(function (el) {
      if (results.length >= limit) return;
      var linkEl = el.querySelector("a[href^='http']");
      var titleEl = el.querySelector("h3");
      var snippetEl = el.querySelector("div[data-sncf], div.VwiC3b, span.aCOpRe");
      if (linkEl && linkEl.href && !seen.has(linkEl.href)) {
        seen.add(linkEl.href);
        results.push({
          url: linkEl.href,
          title: titleEl ? titleEl.textContent.trim() : "",
          snippet: snippetEl ? snippetEl.textContent.trim() : "",
        });
      }
    });

    // Method 2: fallback — any anchor with a heading nearby
    if (results.length < 2) {
      document.querySelectorAll("a[href^='http']").forEach(function (a) {
        if (results.length >= limit) return;
        var href = a.href;
        if (seen.has(href)) return;
        if (/google\.com|googleapis|gstatic|schema\.org/.test(href)) return;
        var h3 = a.querySelector("h3");
        if (!h3) return;
        seen.add(href);
        results.push({ url: href, title: h3.textContent.trim(), snippet: "" });
      });
    }

    return { success: true, results: results };
  } catch (e) {
    return { success: false, error: e.message, results: [] };
  }
}

// ══════════════════════════════════════════
// Web Scrape — extract content from any page
// ══════════════════════════════════════════
function extractPageContent() {
  try {
    var result = {
      title: document.title || "",
      description: "",
      logoUrl: null,
      markdown: "",
      url: window.location.href,
    };

    // Meta description
    var metaDesc = document.querySelector('meta[name="description"]') ||
                   document.querySelector('meta[property="og:description"]');
    if (metaDesc) result.description = metaDesc.getAttribute("content") || "";

    // OG image / logo detection
    var ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) result.logoUrl = ogImage.getAttribute("content");

    if (!result.logoUrl) {
      // Try common logo selectors
      var logoSelectors = [
        'img[class*="logo"]', 'img[id*="logo"]', 'img[alt*="logo"]',
        'a[class*="logo"] img', 'header img', '.navbar-brand img',
      ];
      for (var i = 0; i < logoSelectors.length; i++) {
        var logoEl = document.querySelector(logoSelectors[i]);
        if (logoEl && logoEl.src) { result.logoUrl = logoEl.src; break; }
      }
    }

    // Extract text as markdown-ish
    var body = document.body.cloneNode(true);
    // Remove scripts, styles, nav, footer noise
    body.querySelectorAll("script, style, nav, footer, header, iframe, noscript, svg").forEach(function (el) { el.remove(); });
    var text = body.innerText || body.textContent || "";
    // Truncate to ~4000 chars
    result.markdown = text.replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);

    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── Google Search action ──
async function doGoogleSearch(query, limit) {
  limit = limit || 5;
  var searchUrl = "https://www.google.com/search?q=" + encodeURIComponent(query) + "&num=" + limit + "&hl=en";

  var tab = await safeCreateTab(searchUrl);
  try {
    await waitForTabLoad(tab.id, 15000);

    var results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractGoogleResults,
      args: [limit],
    });

    var data = results[0] && results[0].result;
    return data || { success: false, error: "No extraction result", results: [] };
  } catch (err) {
    return { success: false, error: err.message, results: [] };
  } finally {
    await safeRemoveTab(tab.id);
  }
}

// ── Scrape action ──
async function doScrape(url) {
  if (!url) return { success: false, error: "URL mancante" };

  var tab = await safeCreateTab(url);
  try {
    await waitForTabLoad(tab.id, 15000);

    var results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContent,
    });

    var data = results[0] && results[0].result;
    return data || { success: false, error: "No extraction result" };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    await safeRemoveTab(tab.id);
  }
}

// ── Message handler ──
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.source !== "fs-content-bridge") return false;

  if (message.action === "ping") {
    sendResponse({ success: true, version: "1.0", engine: "firescrape" });
    return false;
  }

  if (message.action === "search") {
    (async function () {
      try {
        var result = await doGoogleSearch(message.query, message.limit || 5);
        sendResponse(result);
      } catch (err) {
        sendResponse({ success: false, error: err.message, results: [] });
      }
    })();
    return true; // async
  }

  if (message.action === "scrape") {
    (async function () {
      try {
        var result = await doScrape(message.url);
        sendResponse(result);
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  return false;
});

chrome.runtime.onInstalled.addListener(function () {
  console.log("[FireScrape] Extension installed");
});
