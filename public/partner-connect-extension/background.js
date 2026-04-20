// FireScrape v3.2 — Background Service Worker
// Integra: Stealth + RateLimiter + Cache + Agent + Brain + CryptoUtils
//          + TaskRunner + FileManager + Connectors + Pipeline
// Fix: MV3 alarms + POST relay + state persistence + ReDoS protection + max iterations

importScripts(
  'crypto-utils.js', 'stealth.js', 'rate-limiter.js', 'cache.js',
  'agent.js', 'hydra-client.js', 'brain.js',
  'task-runner.js', 'file-manager.js', 'connectors.js', 'pipeline.js',
  'elevenlabs.js'
);

// ============================================================
// CUSTOM ERROR TYPES
// ============================================================
class FireScrapeError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'FireScrapeError';
    this.code = code;
    this.details = details;
  }
}

// ============================================================
// BACKGROUND TAB SINGLETON — riusa 1 solo tab nascosto
// per le navigate Deep Search (no tab visibili, no proliferazione).
// ============================================================
const BackgroundTab = {
  tabId: null,
  windowId: null,
  busy: false,

  async _ensure() {
    // Se già esiste e vivo, riusa
    if (this.tabId !== null) {
      try {
        const t = await chrome.tabs.get(this.tabId);
        if (t && t.id) return this.tabId;
      } catch { /* tab chiuso, ricreiamo */ }
    }
    // Crea finestra minimizzata fuori schermo (no focus stealing)
    try {
      const win = await chrome.windows.create({
        url: 'about:blank',
        focused: false,
        state: 'minimized',
        type: 'normal',
        width: 1024,
        height: 768,
        left: -2000,
        top: -2000,
      });
      this.windowId = win.id;
      this.tabId = win.tabs && win.tabs[0] ? win.tabs[0].id : null;
    } catch (err) {
      // Fallback: tab inattivo nella finestra corrente
      const tab = await chrome.tabs.create({ url: 'about:blank', active: false });
      this.tabId = tab.id;
      this.windowId = tab.windowId;
    }
    return this.tabId;
  },

  async navigate(url) {
    const tabId = await this._ensure();
    await chrome.tabs.update(tabId, { url, active: false });
    await waitForTabLoad(tabId);
    await sleep(800);
    return tabId;
  },

  async close() {
    if (this.tabId !== null) {
      try { await chrome.tabs.remove(this.tabId); } catch {}
    }
    this.tabId = null;
    this.windowId = null;
  },
};

// ============================================================
// RELAY CONFIG (Claude Bridge)
// ============================================================
const RELAY = {
  api: "https://wca-app.vercel.app/api/claude-bridge",
  polling: false,
  pollTimer: false,      // boolean: true if alarm active
  tabsTimer: false,      // boolean: true if alarm active
  lastPollTs: 0,
  commandsExecuted: 0,
  lastCommand: null,
  log: [],
  // Circuit breaker
  consecutiveFailures: 0,
  maxFailures: 5,
  circuitOpen: false,
  circuitResetTimer: null,
  hmacSecret: '',  // Configurabile dall'utente
};

// ============================================================
// MESSAGING — handler unificati
// ============================================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // ── WhatsApp Relay: webapp → background → WhatsApp tab ──
  if (msg.type === 'wa-relay') {
    handleWaRelay(msg).then(sendResponse).catch(err =>
      sendResponse({ success: false, error: err.message })
    );
    return true;
  }

  // ── WhatsApp sidebar changed: WA tab → background → all webapp tabs ──
  if (msg.type === 'wa-sidebar-changed') {
    // Forward to all non-WhatsApp tabs (our webapp)
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id && tab.url && !tab.url.includes('web.whatsapp.com')) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'wa-push-event',
            event: 'sidebar-changed',
            timestamp: msg.timestamp,
          }).catch(() => {});
        }
      }
    });
    sendResponse({ success: true });
    return false;
  }

  // ── LinkedIn Relay: webapp → background → LinkedIn tab ──
  if (msg.type === 'li-relay') {
    handleLiRelay(msg).then(sendResponse).catch(err =>
      sendResponse({ success: false, error: err.message })
    );
    return true;
  }

  const handlers = {
    // Scraping
    'scrape':         handleScrape,
    'crawl-start':    handleCrawlStart,
    'crawl-stop':     handleCrawlStop,
    'crawl-status':   handleCrawlStatus,
    'map':            handleMap,
    'batch':          handleBatch,
    'screenshot':     handleScreenshot,
    'extract':        handleExtract,
    // Agent
    'agent-action':   handleAgentAction,
    'agent-sequence': handleAgentSequence,
    'agent-snapshot': handleAgentSnapshot,
    // Relay
    'relay-start':    handleRelayStart,
    'relay-stop':     handleRelayStop,
    'relay-status':   handleRelayStatus,
    'relay-send-tabs': handleRelaySendTabs,
    // Brain
    'brain-analyze':    handleBrainAnalyze,
    'brain-think':      handleBrainThink,
    'brain-stats':      handleBrainStats,
    'brain-config':     handleBrainConfig,
    'brain-get-config': handleBrainGetConfig,
    // Library
    'library-search': handleLibrarySearch,
    'library-export': handleLibraryExport,
    'library-clear':  handleLibraryClear,
    // Stats
    'cache-stats':    handleCacheStats,
    'rate-stats':     handleRateStats,
    'cache-clear':    handleCacheClear,
    'cache-cleanup':  handleCacheCleanup,
    // TaskRunner
    'task-create':    handleTaskCreate,
    'task-start':     handleTaskStart,
    'task-pause':     handleTaskPause,
    'task-cancel':    handleTaskCancel,
    'task-retry':     handleTaskRetry,
    'task-status':    handleTaskStatus,
    'task-list':      handleTaskList,
    'task-stats':     handleTaskStats,
    // FileManager
    'file-download':  handleFileDownload,
    'file-list':      handleFileList,
    'file-search':    handleFileSearch,
    'file-redownload': handleFileRedownload,
    'file-stats':     handleFileStats,
    // Connectors
    'connector-list':      handleConnectorList,
    'connector-configure': handleConnectorConfigure,
    'connector-execute':   handleConnectorExecute,
    'connector-test':      handleConnectorTest,
    // Pipeline
    'pipeline-save':       handlePipelineSave,
    'pipeline-load':       handlePipelineLoad,
    'pipeline-list':       handlePipelineList,
    'pipeline-execute':    handlePipelineExecute,
    'pipeline-delete':     handlePipelineDelete,
    'pipeline-templates':  handlePipelineTemplates,
    'pipeline-stats':      handlePipelineStats,
    // ElevenLabs
    'el-config-get':       handleElConfigGet,
    'el-config-set':       handleElConfigSet,
    'el-voices':           handleElVoices,
    'el-voice-search':     handleElVoiceSearch,
    'el-voices-by-lang':   handleElVoicesByLang,
    'el-voice-preview':    handleElVoicePreview,
    'el-models':           handleElModels,
    'el-speak':            handleElSpeak,
    'el-speak-page':       handleElSpeakPage,
    'el-transcribe':       handleElTranscribe,
    'el-agents-list':      handleElAgentsList,
    'el-agent-create':     handleElAgentCreate,
    'el-agent-update':     handleElAgentUpdate,
    'el-agent-delete':     handleElAgentDelete,
    'el-agent-local-list': handleElAgentLocalList,
    'el-agent-local-save': handleElAgentLocalSave,
    'el-agent-local-remove': handleElAgentLocalRemove,
    'el-stats':            handleElStats,
    'el-history':          handleElHistory,
    'el-languages':        handleElLanguages,
    // Google Search
    'google-search':       handleGoogleSearch,
  };
  const handler = handlers[msg.action];
  if (handler) {
    handler(msg, sender)
      .then(sendResponse)
      .catch(err => sendResponse({
        error: err.message,
        code: err.code || 'UNKNOWN',
      }));
    return true;
  } else {
    sendResponse({
      error: 'Unknown action: ' + msg.action,
      code: 'UNKNOWN_ACTION',
    });
    return false;
  }
});

// ============================================================
// WHATSAPP TAB RELAY
// ============================================================
async function handleWaRelay(msg) {
  const tabs = await chrome.tabs.query({ url: '*://web.whatsapp.com/*' });
  if (!tabs.length) {
    return { success: false, error: 'WhatsApp Web non è aperto. Apri web.whatsapp.com in un tab.' };
  }
  const waTab = tabs[0];
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ success: false, error: 'WhatsApp tab timeout (60s)' });
    }, 60000);
    chrome.tabs.sendMessage(waTab.id, {
      type: 'wa-command',
      action: msg.waAction,
      requestId: msg.requestId,
      payload: msg.payload || {},
    }, (response) => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { success: false, error: 'No response from WA tab' });
    });
  });
}

// ============================================================
// LINKEDIN TAB RELAY
// ============================================================
async function handleLiRelay(msg) {
  const tabs = await chrome.tabs.query({ url: '*://www.linkedin.com/*' });
  if (!tabs.length) {
    return { success: false, error: 'LinkedIn non è aperto.' };
  }
  const liTab = tabs[0];
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ success: false, error: 'LinkedIn tab timeout' });
    }, 60000);
    chrome.tabs.sendMessage(liTab.id, {
      type: 'li-command',
      action: msg.liAction,
      requestId: msg.requestId,
      payload: msg.payload || {},
    }, (response) => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { success: false, error: 'No response from LI tab' });
    });
  });
}

// ============================================================
// SERVICE WORKER LIFECYCLE — MV3 Compatible
// ============================================================
// Note: chrome.runtime.onSuspend doesn't exist in MV3.
// State persistence is handled via chrome.runtime.onStartup and storage.

chrome.runtime.onInstalled.addListener(async (details) => {
  // Initialize storage on install/update
  const { relayPolling } = await chrome.storage.local.get(['relayPolling']);
  if (relayPolling && !RELAY.pollTimer) {
    await startRelayAlarms();
  }
  console.log('[FireScrape] Extension installed/updated');
});

chrome.runtime.onStartup.addListener(async () => {
  // Restore state on browser restart
  const { relayPolling } = await chrome.storage.local.get(['relayPolling']);
  if (relayPolling && !RELAY.pollTimer) {
    await startRelayAlarms();
    console.log('[FireScrape] Relay restored on startup');
  }
});

// Handle alarms (MV3 required)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'relay-poll') {
    await relayPoll();
  } else if (alarm.name === 'relay-tabs') {
    await relaySendTabs();
  } else if (alarm.name === 'cache-cleanup') {
    await Cache.cleanup();
    try { await TaskRunner.cleanup(); } catch {}
  } else if (alarm.name === 'task-runner-tick') {
    try { await TaskRunner.restore(); } catch {}
  }
});

// ============================================================
// NATIVE MESSAGING — Bridge per software esterno
// ============================================================
// Il bridge locale (bridge/server.js) comunica via Native Messaging.
// Riceve comandi HTTP da qualsiasi software → li inoltra qui → restituisce risultati.

let nativePort = null;

function connectNativeBridge() {
  try {
    nativePort = chrome.runtime.connectNative('com.firescrape.bridge');

    nativePort.onMessage.addListener(async (msg) => {
      const bridgeId = msg._bridgeId;
      delete msg._bridgeId;

      // Usa lo stesso handler map del messaging interno
      const handlers = {
        'scrape': handleScrape, 'crawl-start': handleCrawlStart,
        'crawl-stop': handleCrawlStop, 'crawl-status': handleCrawlStatus,
        'map': handleMap, 'batch': handleBatch,
        'screenshot': handleScreenshot, 'extract': handleExtract,
        'agent-action': handleAgentAction, 'agent-sequence': handleAgentSequence,
        'agent-snapshot': handleAgentSnapshot,
        'relay-start': handleRelayStart, 'relay-stop': handleRelayStop,
        'relay-status': handleRelayStatus, 'relay-send-tabs': handleRelaySendTabs,
        'brain-analyze': handleBrainAnalyze, 'brain-think': handleBrainThink,
        'brain-stats': handleBrainStats, 'brain-config': handleBrainConfig,
        'brain-get-config': handleBrainGetConfig,
        'library-search': handleLibrarySearch, 'library-export': handleLibraryExport,
        'library-clear': handleLibraryClear,
        'cache-stats': handleCacheStats, 'rate-stats': handleRateStats,
        'cache-clear': handleCacheClear, 'cache-cleanup': handleCacheCleanup,
        // TaskRunner
        'task-create': handleTaskCreate, 'task-start': handleTaskStart,
        'task-pause': handleTaskPause, 'task-cancel': handleTaskCancel,
        'task-retry': handleTaskRetry, 'task-status': handleTaskStatus,
        'task-list': handleTaskList, 'task-stats': handleTaskStats,
        // FileManager
        'file-download': handleFileDownload, 'file-list': handleFileList,
        'file-search': handleFileSearch, 'file-redownload': handleFileRedownload,
        'file-stats': handleFileStats,
        // Connectors
        'connector-list': handleConnectorList, 'connector-configure': handleConnectorConfigure,
        'connector-execute': handleConnectorExecute, 'connector-test': handleConnectorTest,
        // Pipeline
        'pipeline-save': handlePipelineSave, 'pipeline-load': handlePipelineLoad,
        'pipeline-list': handlePipelineList, 'pipeline-execute': handlePipelineExecute,
        'pipeline-delete': handlePipelineDelete, 'pipeline-templates': handlePipelineTemplates,
        'pipeline-stats': handlePipelineStats,
      };

      const handler = handlers[msg.action];
      let response;
      try {
        if (handler) {
          response = await handler(msg);
        } else {
          response = { error: 'Unknown action: ' + msg.action, code: 'UNKNOWN_ACTION' };
        }
      } catch (err) {
        response = { error: err.message, code: err.code || 'UNKNOWN' };
      }

      // Rispondi con lo stesso bridgeId per matching request/response
      if (nativePort) {
        try {
          nativePort.postMessage({ ...response, _bridgeId: bridgeId });
        } catch {}
      }
    });

    nativePort.onDisconnect.addListener(() => {
      const err = chrome.runtime.lastError;
      console.log('[FireScrape] Native bridge disconnected', err?.message || '');
      nativePort = null;
      // Auto-reconnect dopo 5 secondi
      setTimeout(connectNativeBridge, 5000);
    });

    console.log('[FireScrape] Native bridge connected');
  } catch (err) {
    console.log('[FireScrape] Native bridge not available:', err.message);
    nativePort = null;
  }
}

// Connetti al bridge all'avvio (se disponibile)
connectNativeBridge();

// ============================================================
// UTILITIES
// ============================================================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 15000);
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 500);
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Helper: esegui operazione su tab con try-finally cleanup
async function withTab(url, fn) {
  let tab = null;
  try {
    tab = await chrome.tabs.create({ url, active: false });
    await waitForTabLoad(tab.id);
    return await fn(tab);
  } finally {
    if (tab?.id) {
      try { await chrome.tabs.remove(tab.id); } catch {}
    }
  }
}

// URL validation
function isValidHttpUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function scrapeTab(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
  if (!results?.[0]?.result) throw new FireScrapeError('Nessun contenuto estratto', 'SCRAPE_EMPTY');
  return results[0].result;
}

async function extractLinks(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => [...document.querySelectorAll('a[href]')].map(a => a.href).filter(h => h.startsWith('http'))
  });
  return results?.[0]?.result || [];
}

function relayLog(entry) {
  RELAY.log.unshift({ ...entry, ts: Date.now() });
  if (RELAY.log.length > 50) RELAY.log.pop();
}

// ============================================================
// SCRAPE PROTETTO (con cache + stealth)
// ============================================================
async function protectedScrape(url, options = {}) {
  const { cacheType = 'domain', skipCache = false } = options;
  if (!skipCache) {
    const cached = await Cache.get(cacheType, url);
    if (cached) return { ...cached, _fromCache: true };
  }
  const check = RateLimiter.canRequest(url);
  if (!check.allowed) {
    const wait = Math.min(check.retryAfter, 120000); // max 2 min wait
    await sleep(wait);
  }

  return await withTab(url, async (tab) => {
    await Stealth.browseNaturally(tab.id, { scroll: true, readTime: 'read' });
    await Stealth.domainAwareDelay(url);
    const result = await scrapeTab(tab.id);
    RateLimiter.recordRequest(url);
    if (!skipCache) await Cache.set(cacheType, url, result);
    return result;
  });
}

// ============================================================
// 0. GOOGLE SEARCH (background tab)
// ============================================================
async function handleGoogleSearch(msg) {
  if (!msg.query) throw new FireScrapeError('Query mancante', 'NO_QUERY');
  const limit = msg.limit || 5;
  const searchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(msg.query) + '&num=' + limit;

  // Check cache first
  const cacheKey = 'gsearch:v2:' + msg.query;
  if (!msg.skipCache) {
    const cached = await Cache.get('search', cacheKey);
    if (cached) return { ...cached, _fromCache: true };
  }

  let tab = null;
  try {
    // Stealth delays
    await Stealth.noiseDelay();
    tab = await chrome.tabs.create({ url: searchUrl, active: false });
    await waitForTabLoad(tab.id);
    await sleep(1500 + Math.random() * 1000);

    // Extract search results
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function (maxResults) {
        const items = [];
        const unwrapGoogleUrl = function (href) {
          try {
            const parsed = new URL(href);
            const host = parsed.hostname.toLowerCase();
            const isGoogleHost = host === 'google.com' || host.startsWith('google.') || host.startsWith('www.google.') || host.endsWith('.google.com');
            if (isGoogleHost && (parsed.pathname === '/url' || parsed.pathname === '/imgres')) {
              return parsed.searchParams.get('url') || parsed.searchParams.get('q') || parsed.searchParams.get('imgurl') || href;
            }
            return parsed.href;
          } catch (e) {
            return href;
          }
        };

        const els = document.querySelectorAll('div.g, div[data-sokoban-container]');
        for (let i = 0; i < els.length && items.length < maxResults; i++) {
          const linkEl = els[i].querySelector('a[href]');
          if (!linkEl) continue;
          const url = unwrapGoogleUrl(linkEl.href);
          if (!url) continue;
          if (/google\.com\/(search|maps|imgres|sorry)/.test(url)) continue;
          const titleEl = els[i].querySelector('h3');
          const title = titleEl ? titleEl.textContent.trim() : '';
          const snippetEl = els[i].querySelector('[data-sncf], .VwiC3b, .IsZvec, span.st');
          const description = snippetEl ? snippetEl.textContent.trim() : '';
          items.push({ url: url, title: title, description: description });
        }
        return items;
      },
      args: [limit]
    });

    const data = (results[0] && results[0].result) || [];
    RateLimiter.recordRequest(searchUrl);
    const response = { success: true, data: data, query: msg.query, count: data.length };
    await Cache.set('search', cacheKey, response);
    return response;
  } catch (err) {
    throw new FireScrapeError('Google search failed: ' + err.message, 'SEARCH_ERROR');
  } finally {
    if (tab) try { chrome.tabs.remove(tab.id); } catch (e) {}
  }
}

// ============================================================
// 1. SCRAPE
// ============================================================
async function handleScrape(msg) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new FireScrapeError('Nessun tab attivo', 'NO_TAB');
  const url = tab.url;
  if (!msg.skipCache) {
    const cached = await Cache.get('domain', url);
    if (cached) return { ...cached, _fromCache: true };
  }
  const result = await scrapeTab(tab.id);
  RateLimiter.recordRequest(url);
  await Cache.set('domain', url, result);
  return result;
}

// ============================================================
// 2. CRAWL (con stato persistente)
// ============================================================
const crawlState = {
  queue: [], visited: new Set(), results: [], running: false,
  config: { maxPages: 50, delay: 800, sameDomain: true, maxDepth: 3 },
};

async function handleCrawlStart(msg) {
  if (crawlState.running) throw new FireScrapeError('Crawl già in corso', 'CRAWL_RUNNING');
  if (!msg.url || !isValidHttpUrl(msg.url)) throw new FireScrapeError('URL non valido', 'INVALID_URL');

  const config = { ...crawlState.config, ...msg.config };
  crawlState.config = config;
  crawlState.running = true;
  crawlState.visited = new Set();
  crawlState.results = [];
  crawlState.queue = [{ url: msg.url, depth: 0 }];
  const startDomain = new URL(msg.url).hostname;

  (async () => {
    while (crawlState.queue.length > 0 && crawlState.running) {
      if (crawlState.results.length >= config.maxPages) break;
      const { url, depth } = crawlState.queue.shift();
      if (crawlState.visited.has(url) || depth > config.maxDepth) continue;
      crawlState.visited.add(url);

      let tab = null;
      try {
        const cached = await Cache.get('domain', url);
        if (cached) {
          crawlState.results.push({ url, depth, ...cached, _fromCache: true });
          broadcastProgress();
          continue;
        }
        const check = RateLimiter.canRequest(url);
        if (!check.allowed) await sleep(Math.min(check.retryAfter, 30000));
        await sleep(Stealth.gaussianRandom(config.delay, config.delay * 0.4));
        if (Stealth.shouldInsertNoise()) await Stealth.noiseDelay();
        const session = await Stealth.checkSession();
        if (session.shouldPause) await sleep(session.pauseMs);

        tab = await chrome.tabs.create({ url, active: false });
        await waitForTabLoad(tab.id);
        await Stealth.scrollTab(tab.id);
        await sleep(500 + Math.random() * 1000);
        const result = await scrapeTab(tab.id);
        const links = await extractLinks(tab.id);
        await chrome.tabs.remove(tab.id);
        tab = null; // Segnala che il tab è stato chiuso

        RateLimiter.recordRequest(url);
        await Cache.set('domain', url, result);
        crawlState.results.push({ url, depth, ...result });

        const newLinks = [];
        for (const link of links) {
          try {
            const lu = new URL(link);
            if (config.sameDomain && lu.hostname !== startDomain) continue;
            lu.hash = '';
            const clean = lu.href;
            if (crawlState.visited.has(clean) || /\.(pdf|jpg|png|gif|zip|mp4|mp3|exe|css|js)$/i.test(lu.pathname)) continue;
            newLinks.push({ url: clean, depth: depth + 1 });
          } catch {}
        }
        crawlState.queue.push(...Stealth.shuffleUrls(newLinks));
        broadcastProgress();
      } catch (err) {
        crawlState.results.push({ url, depth, error: err.message });
      } finally {
        // Cleanup: chiudi tab se ancora aperto
        if (tab?.id) {
          try { await chrome.tabs.remove(tab.id); } catch {}
        }
      }
    }
    crawlState.running = false;
    broadcastProgress();
  })();
  return { status: 'started', config };
}

async function handleCrawlStop() {
  crawlState.running = false;
  return { status: 'stopped', pages: crawlState.results.length };
}

async function handleCrawlStatus() {
  return {
    running: crawlState.running,
    visited: crawlState.visited.size,
    queued: crawlState.queue.length,
    results: crawlState.results.length,
    pages: crawlState.results,
  };
}

function broadcastProgress() {
  chrome.runtime.sendMessage({
    action: 'crawl-progress',
    visited: crawlState.visited.size,
    queued: crawlState.queue.length,
    results: crawlState.results.length,
    running: crawlState.running,
  }).catch(() => {});
}

// ============================================================
// 3. MAP (con try-finally)
// ============================================================
async function handleMap(msg) {
  if (!msg.url || !isValidHttpUrl(msg.url)) throw new FireScrapeError('URL non valido', 'INVALID_URL');
  const startUrl = msg.url;
  const maxUrls = Math.min(msg.maxUrls || 200, 500);
  const startDomain = new URL(startUrl).hostname;
  const visited = new Set();
  const queue = [startUrl];
  const urlMap = [];

  while (queue.length > 0 && urlMap.length < maxUrls) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    const cacheKey = 'map:' + url;
    const cached = await Cache.get('search', cacheKey);
    if (cached) {
      urlMap.push(cached);
      if (cached.links) cached.links.forEach(l => { if (!visited.has(l)) queue.push(l); });
      continue;
    }

    const check = RateLimiter.canRequest(url);
    if (!check.allowed) await sleep(Math.min(check.retryAfter, 15000));

    let tab = null;
    try {
      tab = await chrome.tabs.create({ url, active: false });
      await waitForTabLoad(tab.id);
      await sleep(Stealth.gaussianRandom(1500, 500));

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({
          title: document.title,
          links: [...document.querySelectorAll('a[href]')].map(a => a.href).filter(h => h.startsWith('http')),
          meta: {
            description: document.querySelector('meta[name="description"]')?.content || '',
            type: document.querySelector('meta[property="og:type"]')?.content || 'page',
          }
        })
      });

      RateLimiter.recordRequest(url);
      const data = results?.[0]?.result;
      if (data) {
        const entry = { url, title: data.title, ...data.meta, linksCount: data.links.length, links: data.links };
        urlMap.push(entry);
        await Cache.set('search', cacheKey, entry);
        for (const link of data.links) {
          try {
            const u = new URL(link);
            if (u.hostname === startDomain && !visited.has(u.origin + u.pathname)) {
              queue.push(u.origin + u.pathname);
            }
          } catch {}
        }
      }
    } catch {} finally {
      if (tab?.id) { try { await chrome.tabs.remove(tab.id); } catch {} }
    }
  }
  return { urls: urlMap.map(({ links, ...rest }) => rest), total: urlMap.length };
}

// ============================================================
// 4. BATCH (con try-finally per ogni tab)
// ============================================================
async function handleBatch(msg) {
  const urls = (msg.urls || []).filter(u => isValidHttpUrl(u));
  if (urls.length === 0) throw new FireScrapeError('Nessun URL valido', 'NO_URLS');
  const concurrency = Math.min(msg.concurrency || 3, 5);
  const results = [];
  const shuffled = Stealth.shuffleUrls(urls);

  for (let i = 0; i < shuffled.length; i += concurrency) {
    const batch = shuffled.slice(i, i + concurrency);
    const promises = batch.map(async (url) => {
      try {
        const cached = await Cache.get('domain', url);
        if (cached) return { url, ...cached, _fromCache: true };
        const check = RateLimiter.canRequest(url);
        if (!check.allowed) await sleep(Math.min(check.retryAfter, 15000));

        return await withTab(url, async (tab) => {
          await Stealth.browseNaturally(tab.id, { scroll: true, readTime: 'quick' });
          const result = await scrapeTab(tab.id);
          RateLimiter.recordRequest(url);
          await Cache.set('domain', url, result);
          return { url, ...result };
        });
      } catch (err) { return { url, error: err.message }; }
    });
    results.push(...await Promise.all(promises));
    if (i + concurrency < shuffled.length) await sleep(Stealth.gaussianRandom(3000, 1000));
  }
  return { results, total: results.length };
}

// ============================================================
// 5. SCREENSHOT
// ============================================================
async function handleScreenshot(msg) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new FireScrapeError('Nessun tab attivo', 'NO_TAB');
  const format = msg.format || 'png';
  const quality = msg.quality || 90;
  if (msg.fullPage) return await captureFullPage(tab.id, format, quality);
  const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: format === 'jpg' ? 'jpeg' : 'png', quality });
  return { screenshot: dataUrl, format, url: tab.url, title: tab.title };
}

async function captureFullPage(tabId, format, quality) {
  const dims = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({ scrollHeight: document.documentElement.scrollHeight, clientHeight: document.documentElement.clientHeight })
  });
  const { scrollHeight, clientHeight } = dims[0].result;
  const screenshots = [];
  let scrollY = 0;
  let iterations = 0;
  const maxIterations = 50;  // Prevent infinite loop

  while (scrollY < scrollHeight && iterations < maxIterations) {
    iterations++;
    await chrome.scripting.executeScript({ target: { tabId }, func: (y) => window.scrollTo(0, y), args: [scrollY] });
    await sleep(200);
    screenshots.push({
      dataUrl: await chrome.tabs.captureVisibleTab(null, { format: format === 'jpg' ? 'jpeg' : 'png', quality }),
      scrollY,
    });
    scrollY += clientHeight;
  }
  await chrome.scripting.executeScript({ target: { tabId }, func: () => window.scrollTo(0, 0) });
  return { screenshots, format, totalHeight: scrollHeight, viewportHeight: clientHeight };
}

// ============================================================
// 6. EXTRACT (con validazione schema + ReDoS protection)
// ============================================================
async function handleExtract(msg) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new FireScrapeError('Nessun tab attivo', 'NO_TAB');
  if (!msg.schema || typeof msg.schema !== 'object') {
    throw new FireScrapeError('Schema non valido', 'INVALID_SCHEMA');
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (schema) => {
      const extracted = {};
      for (const [key, selector] of Object.entries(schema)) {
        // Validazione: key alfanumerico
        if (!/^[\w\-]+$/.test(key)) continue;
        // ReDoS protection: limit selector length
        if (selector.length > 200) continue;
        try {
          if (selector.startsWith('//')) {
            const r = document.evaluate(selector, document, null, XPathResult.STRING_TYPE, null);
            extracted[key] = r.stringValue.trim();
          } else if (selector.startsWith('regex:')) {
            const m = document.body.textContent.match(new RegExp(selector.replace('regex:', ''), 'i'));
            extracted[key] = m ? m[1] || m[0] : null;
          } else {
            const els = document.querySelectorAll(selector);
            extracted[key] = els.length === 0 ? null : els.length === 1 ? els[0].textContent.trim() : [...els].map(e => e.textContent.trim());
          }
        } catch {
          extracted[key] = null;
        }
      }
      return extracted;
    },
    args: [msg.schema]
  });
  return { data: results?.[0]?.result, url: tab.url };
}

// ============================================================
// 7. AGENT — Azioni singole + sequenze
// ============================================================
async function handleAgentAction(msg) {
  const step = msg.step || {};
  // Fast path: navigate in background (riusa singleton tab nascosto)
  if (step.action === 'navigate' && (step.background === true || step.reuseTab === true)) {
    if (!step.url) throw new FireScrapeError('URL mancante', 'NO_URL');
    const tabId = await BackgroundTab.navigate(step.url);
    const result = { ok: true, action: 'navigate', url: step.url, tabId, background: true };
    relayLog({ type: 'agent-action', step, result });
    return result;
  }
  // Default: usa tab attivo
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new FireScrapeError('Nessun tab attivo', 'NO_TAB');
  const result = await Agent.executeAction(tab.id, step);
  relayLog({ type: 'agent-action', step, result });
  return result;
}

async function handleAgentSequence(msg) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new FireScrapeError('Nessun tab attivo', 'NO_TAB');
  if (!Array.isArray(msg.steps) || msg.steps.length > 50) {
    throw new FireScrapeError('Steps non valido (max 50)', 'INVALID_STEPS');
  }
  const result = await Agent.executeSequence(tab.id, msg.steps);
  relayLog({ type: 'agent-sequence', stepsCount: msg.steps.length, result: { ok: result.ok, totalSteps: result.totalSteps } });
  return result;
}

async function handleAgentSnapshot() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new FireScrapeError('Nessun tab attivo', 'NO_TAB');
  const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: Agent.snapshotScript() });
  return results?.[0]?.result || { ok: false, error: 'Nessun risultato' };
}

// ============================================================
// 8. RELAY — Con circuit breaker + validazione comandi + MV3 alarms
// ============================================================

// Start relay with alarms (MV3 compatible)
async function startRelayAlarms() {
  RELAY.consecutiveFailures = 0;
  RELAY.circuitOpen = false;

  // Create alarms (if not already created)
  await chrome.alarms.create('relay-poll', { periodInMinutes: 0.05 });  // ~3 seconds
  await chrome.alarms.create('relay-tabs', { periodInMinutes: 0.2 });   // ~12 seconds

  RELAY.pollTimer = true;
  RELAY.tabsTimer = true;

  // Persist state
  await chrome.storage.local.set({ relayPolling: true });

  // Send tabs immediately
  await relaySendTabs();
  relayLog({ type: 'relay', event: 'started' });
}

async function handleRelayStart() {
  if (RELAY.pollTimer) return { status: 'already_running' };
  await startRelayAlarms();
  return { status: 'started' };
}

async function handleRelayStop() {
  await chrome.alarms.clear('relay-poll');
  await chrome.alarms.clear('relay-tabs');

  RELAY.pollTimer = false;
  RELAY.tabsTimer = false;

  if (RELAY.circuitResetTimer) { clearTimeout(RELAY.circuitResetTimer); RELAY.circuitResetTimer = null; }
  RELAY.circuitOpen = false;

  // Persist state
  await chrome.storage.local.set({ relayPolling: false });

  relayLog({ type: 'relay', event: 'stopped' });
  return { status: 'stopped' };
}

async function handleRelayStatus() {
  return {
    connected: !!RELAY.pollTimer,
    lastPollTs: RELAY.lastPollTs,
    commandsExecuted: RELAY.commandsExecuted,
    lastCommand: RELAY.lastCommand,
    log: RELAY.log.slice(0, 20),
    api: RELAY.api,
    circuitOpen: RELAY.circuitOpen,
    consecutiveFailures: RELAY.consecutiveFailures,
  };
}

async function handleRelaySendTabs() {
  await relaySendTabs();
  return { ok: true };
}

// Circuit breaker: apri/chiudi
function relayCircuitTrip() {
  RELAY.circuitOpen = true;
  relayLog({ type: 'circuit-breaker', event: 'OPEN', failures: RELAY.consecutiveFailures });
  // Reset automatico dopo 30 secondi
  RELAY.circuitResetTimer = setTimeout(() => {
    RELAY.circuitOpen = false;
    RELAY.consecutiveFailures = 0;
    relayLog({ type: 'circuit-breaker', event: 'HALF-OPEN' });
  }, 30000);
}

async function relayPoll() {
  if (RELAY.polling || RELAY.circuitOpen) return;
  RELAY.polling = true;
  try {
    const resp = await fetch(`${RELAY.api}?action=poll`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    RELAY.lastPollTs = Date.now();
    RELAY.consecutiveFailures = 0; // Reset on success

    if (data.ok && data.command) {
      // VALIDAZIONE COMANDO
      const validation = CryptoUtils.validateCommand(data.command);
      if (!validation.valid) {
        relayLog({ type: 'command-rejected', reason: validation.reason, command: data.command?.type });
        RELAY.polling = false;
        return;
      }

      // HMAC verification (se configurato)
      if (RELAY.hmacSecret && data.signature) {
        const payload = JSON.stringify(data.command);
        const valid = await CryptoUtils.verify(payload, data.signature, RELAY.hmacSecret);
        if (!valid) {
          relayLog({ type: 'command-rejected', reason: 'Firma HMAC non valida' });
          RELAY.polling = false;
          return;
        }
      } else if (RELAY.hmacSecret && !data.signature) {
        // HMAC required but not provided
        relayLog({ type: 'command-rejected', reason: 'Firma HMAC mancante' });
        RELAY.polling = false;
        return;
      }

      RELAY.lastCommand = data.command;
      RELAY.commandsExecuted++;
      relayLog({ type: 'command-in', command: data.command });

      const result = await relayExecuteCommand(data.command);
      relayLog({ type: 'command-out', result: { ok: result.ok || !result.error } });

      // Send result via POST body instead of GET query param
      try {
        await fetch(RELAY.api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'done', result })
        });
      } catch (e) {
        relayLog({ type: 'error', message: 'Failed to send result: ' + e.message });
      }
    }
  } catch (e) {
    RELAY.consecutiveFailures++;
    relayLog({ type: 'error', message: e.message, failures: RELAY.consecutiveFailures });
    if (RELAY.consecutiveFailures >= RELAY.maxFailures) {
      relayCircuitTrip();
    }
  }
  RELAY.polling = false;
}

// Esegui comando validato (SENZA eval — solo comandi approvati)
async function relayExecuteCommand(cmd) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = cmd.tabId || tab?.id;
    if (!tabId) return { error: 'Nessun tab attivo' };

    switch (cmd.type) {
      case 'nav':
        if (!isValidHttpUrl(cmd.url)) return { error: 'URL non valido' };
        await chrome.tabs.update(tabId, { url: cmd.url, active: true });
        await waitForTabLoad(tabId);
        return { ok: true, tabId, url: cmd.url };

      case 'click':
        return await Agent.executeAction(tabId, { action: 'click', selector: cmd.selector, options: cmd.options });
      case 'type':
        return await Agent.executeAction(tabId, { action: 'type', selector: cmd.selector, text: cmd.text });
      case 'read':
        return await Agent.executeAction(tabId, { action: 'read', selector: cmd.selector, options: cmd.options });
      case 'wait':
        return await Agent.executeAction(tabId, { action: 'wait', selector: cmd.selector, timeout: cmd.timeout });
      case 'scroll':
        return await Agent.executeAction(tabId, { action: 'scroll', target: cmd.target || cmd.selector });
      case 'select':
        return await Agent.executeAction(tabId, { action: 'select', selector: cmd.selector, value: cmd.value });
      case 'formFill':
        return await Agent.executeAction(tabId, { action: 'formFill', fields: cmd.fields });
      case 'snapshot':
        const snap = await chrome.scripting.executeScript({ target: { tabId }, func: Agent.snapshotScript() });
        return snap?.[0]?.result || { ok: false };
      case 'sequence':
        return await Agent.executeSequence(tabId, cmd.steps);
      case 'scrape':
        return await scrapeTab(tabId);
      case 'screenshot':
        return { screenshot: await chrome.tabs.captureVisibleTab(null, { format: 'png' }), tabId };
      default:
        return { error: `Comando non permesso: ${cmd.type}` };
    }
  } catch (e) {
    return { error: e.message };
  }
}

async function relaySendTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    // Filter sensitive URLs: send only hostname + pathname
    const simple = tabs.map(t => {
      try {
        const url = new URL(t.url);
        return {
          id: t.id,
          url: url.hostname + url.pathname,
          title: t.title,
          active: t.active
        };
      } catch {
        // Fallback for non-http URLs
        return {
          id: t.id,
          url: t.url,
          title: t.title,
          active: t.active
        };
      }
    });

    // Send via POST body
    await fetch(RELAY.api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'tabs', result: simple })
    });
  } catch {}
}

// ============================================================
// 9. BRAIN — Agente AI integrato
// ============================================================
async function handleBrainAnalyze() {
  await Brain.init();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new FireScrapeError('Nessun tab attivo', 'NO_TAB');

  let scrapeData = null, snapshotData = null;
  try { scrapeData = await scrapeTab(tab.id); } catch {}
  try {
    const snapResult = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: Agent.snapshotScript() });
    snapshotData = snapResult?.[0]?.result;
  } catch {}

  const result = await Brain.analyzePage(scrapeData, snapshotData);

  if (scrapeData && !result._fromLibrary) {
    let domain = 'unknown';
    try { domain = new URL(tab.url).hostname; } catch {}
    await Library.add({
      domain,
      url: tab.url,
      category: result.category || 'analysis',
      tags: [...(result.tags || []), 'auto-scrape'],
      data: { analysis: result, scrape_summary: scrapeData?.metadata },
      confidence: result.confidence || 50,
    });
  }

  return result;
}

async function handleBrainThink(msg) {
  await Brain.init();
  if (!msg.prompt || typeof msg.prompt !== 'string') {
    throw new FireScrapeError('Prompt mancante', 'INVALID_PROMPT');
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const context = { url: tab?.url };
  try { context.domain = new URL(tab.url).hostname; } catch {}
  return await Brain.think(msg.prompt, context);
}

async function handleBrainStats() {
  await Brain.init();
  return await Brain.getStats();
}

async function handleBrainConfig(msg) {
  await Brain.init();
  if (!msg.config || typeof msg.config !== 'object') {
    throw new FireScrapeError('Config non valida', 'INVALID_CONFIG');
  }
  await Brain.updateConfig(msg.config);
  return { ok: true };
}

async function handleBrainGetConfig() {
  await Brain.init();
  // Return safe config — no sensitive keys exposed
  const safe = { ...Brain.config };
  if (safe.supabaseKey) safe.supabaseKey = safe.supabaseKey.slice(0, 10) + '...' + safe.supabaseKey.slice(-4);
  // Remove any legacy Claude fields
  delete safe.claudeApiKey;
  delete safe.claudeModel;
  return safe;
}

// ============================================================
// 10. LIBRARY
// ============================================================
async function handleLibrarySearch(msg) {
  const q = (msg.query || '').trim();
  if (!q) return await Library.search({ limit: 20 });
  if (q.includes('.')) {
    return await Library.search({ domain: q, limit: 20 });
  }
  const byTag = await Library.search({ tag: q, limit: 20 });
  if (byTag.length > 0) return byTag;
  return await Library.search({ text: q, limit: 20 });
}

async function handleLibraryExport() { return await Library.exportAll(); }
async function handleLibraryClear() { return await Library.clear(); }

// ============================================================
// 11. STATS & MANAGEMENT
// ============================================================
async function handleCacheStats() { return await Cache.getStats(); }
async function handleRateStats() { return RateLimiter.getStats(); }
async function handleCacheClear() { return await Cache.clear(); }
async function handleCacheCleanup() { return await Cache.cleanup(); }

// ============================================================
// 12. TASK RUNNER
// ============================================================
async function handleTaskCreate(msg) {
  if (!msg.task || typeof msg.task !== 'object') throw new FireScrapeError('Task definition mancante', 'INVALID_TASK');
  return await TaskRunner.create(msg.task);
}
async function handleTaskStart(msg) {
  if (!msg.taskId) throw new FireScrapeError('taskId mancante', 'MISSING_ID');
  return await TaskRunner.start(msg.taskId);
}
async function handleTaskPause(msg) {
  if (!msg.taskId) throw new FireScrapeError('taskId mancante', 'MISSING_ID');
  return await TaskRunner.pause(msg.taskId);
}
async function handleTaskCancel(msg) {
  if (!msg.taskId) throw new FireScrapeError('taskId mancante', 'MISSING_ID');
  return await TaskRunner.cancel(msg.taskId);
}
async function handleTaskRetry(msg) {
  if (!msg.taskId) throw new FireScrapeError('taskId mancante', 'MISSING_ID');
  return await TaskRunner.retry(msg.taskId);
}
async function handleTaskStatus(msg) {
  if (!msg.taskId) throw new FireScrapeError('taskId mancante', 'MISSING_ID');
  return await TaskRunner.getStatus(msg.taskId);
}
async function handleTaskList(msg) {
  return await TaskRunner.list(msg.filter || {});
}
async function handleTaskStats() {
  return await TaskRunner.getStats();
}

// ============================================================
// 13. FILE MANAGER
// ============================================================
async function handleFileDownload(msg) {
  await FileManager.init();
  if (!msg.data) throw new FireScrapeError('Dati mancanti', 'MISSING_DATA');
  const format = msg.format || 'json';
  const filename = msg.filename || `export-${Date.now()}.${format}`;
  return await FileManager.downloadData(msg.data, filename, format, msg.options || {});
}
async function handleFileList(msg) {
  await FileManager.init();
  return await FileManager.list(msg.filter || {});
}
async function handleFileSearch(msg) {
  await FileManager.init();
  return await FileManager.search(msg.query || '');
}
async function handleFileRedownload(msg) {
  await FileManager.init();
  if (!msg.fileId) throw new FireScrapeError('fileId mancante', 'MISSING_ID');
  return await FileManager.redownload(msg.fileId);
}
async function handleFileStats() {
  await FileManager.init();
  return await FileManager.getStats();
}

// ============================================================
// 14. CONNECTORS
// ============================================================
async function handleConnectorList() {
  await Connectors.init();
  return Connectors.list();
}
async function handleConnectorConfigure(msg) {
  await Connectors.init();
  if (!msg.connectorId || !msg.config) throw new FireScrapeError('connectorId e config richiesti', 'INVALID_PARAMS');
  return await Connectors.configure(msg.connectorId, msg.config);
}
async function handleConnectorExecute(msg) {
  await Connectors.init();
  if (!msg.connectorId || !msg.method) throw new FireScrapeError('connectorId e method richiesti', 'INVALID_PARAMS');
  return await Connectors.execute(msg.connectorId, msg.method, msg.params || {});
}
async function handleConnectorTest(msg) {
  await Connectors.init();
  if (!msg.connectorId) throw new FireScrapeError('connectorId richiesto', 'INVALID_PARAMS');
  return await Connectors.test(msg.connectorId);
}

// ============================================================
// 15. PIPELINE
// ============================================================
async function handlePipelineSave(msg) {
  if (!msg.pipeline) throw new FireScrapeError('Pipeline definition mancante', 'INVALID_PIPELINE');
  return await Pipeline.save(msg.pipeline);
}
async function handlePipelineLoad(msg) {
  if (!msg.pipelineId) throw new FireScrapeError('pipelineId mancante', 'MISSING_ID');
  return await Pipeline.load(msg.pipelineId);
}
async function handlePipelineList() {
  return await Pipeline.list();
}
async function handlePipelineExecute(msg) {
  if (!msg.pipelineId) throw new FireScrapeError('pipelineId mancante', 'MISSING_ID');
  return await Pipeline.execute(msg.pipelineId, msg.variables || {});
}
async function handlePipelineDelete(msg) {
  if (!msg.pipelineId) throw new FireScrapeError('pipelineId mancante', 'MISSING_ID');
  return await Pipeline.remove(msg.pipelineId);
}
async function handlePipelineTemplates() {
  return Pipeline.templates;
}
async function handlePipelineStats() {
  return await Pipeline.getStats();
}

// ============================================================
// 16. ELEVENLABS
// ============================================================
async function handleElConfigGet() {
  await ElevenLabs.init();
  return ElevenLabs.getConfig();
}
async function handleElConfigSet(msg) {
  await ElevenLabs.init();
  return await ElevenLabs.setConfig(msg.config || {});
}
async function handleElVoices(msg) {
  await ElevenLabs.init();
  return { voices: await ElevenLabs.listVoices(!!msg.refresh) };
}
async function handleElVoiceSearch(msg) {
  await ElevenLabs.init();
  return { voices: await ElevenLabs.searchVoices(msg.query || '') };
}
async function handleElVoicesByLang(msg) {
  await ElevenLabs.init();
  return { voices: await ElevenLabs.getVoicesByLanguage(msg.language || 'it') };
}
async function handleElVoicePreview(msg) {
  await ElevenLabs.init();
  if (!msg.voiceId) throw new FireScrapeError('voiceId mancante', 'MISSING_ID');
  return await ElevenLabs.previewVoice(msg.voiceId);
}
async function handleElModels() {
  await ElevenLabs.init();
  return await ElevenLabs.listModels();
}
async function handleElSpeak(msg) {
  await ElevenLabs.init();
  if (!msg.text) throw new FireScrapeError('Testo mancante', 'MISSING_TEXT');
  const result = await ElevenLabs.speak(msg.text, msg.options || {});
  // Converti blob in base64 per transport via messaging
  const reader = new FileReader();
  const base64 = await new Promise((resolve) => {
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(result.blob);
  });
  return { ...result, audioBase64: base64, blob: undefined };
}
async function handleElSpeakPage(msg) {
  await ElevenLabs.init();
  const result = await ElevenLabs.speakPageSummary(msg.options || {});
  const reader = new FileReader();
  const base64 = await new Promise((resolve) => {
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(result.blob);
  });
  return { ...result, audioBase64: base64, blob: undefined };
}
async function handleElTranscribe(msg) {
  await ElevenLabs.init();
  if (!msg.audioBase64) throw new FireScrapeError('Audio data mancante', 'MISSING_AUDIO');
  const resp = await fetch(msg.audioBase64);
  const blob = await resp.blob();
  return await ElevenLabs.transcribe(blob, msg.options || {});
}
async function handleElAgentsList() {
  await ElevenLabs.init();
  return await ElevenLabs.listAgentsAPI();
}
async function handleElAgentCreate(msg) {
  await ElevenLabs.init();
  if (!msg.agent) throw new FireScrapeError('Agent config mancante', 'INVALID_PARAMS');
  return await ElevenLabs.createAgent(msg.agent);
}
async function handleElAgentUpdate(msg) {
  await ElevenLabs.init();
  if (!msg.agentId) throw new FireScrapeError('agentId mancante', 'MISSING_ID');
  return await ElevenLabs.updateAgent(msg.agentId, msg.updates || {});
}
async function handleElAgentDelete(msg) {
  await ElevenLabs.init();
  if (!msg.agentId) throw new FireScrapeError('agentId mancante', 'MISSING_ID');
  return await ElevenLabs.deleteAgent(msg.agentId);
}
async function handleElAgentLocalList() {
  await ElevenLabs.init();
  return { agents: ElevenLabs.getLocalAgents() };
}
async function handleElAgentLocalSave(msg) {
  await ElevenLabs.init();
  if (!msg.agent) throw new FireScrapeError('Agent data mancante', 'INVALID_PARAMS');
  return await ElevenLabs.saveLocalAgent(msg.agent);
}
async function handleElAgentLocalRemove(msg) {
  await ElevenLabs.init();
  if (!msg.agentId) throw new FireScrapeError('agentId mancante', 'MISSING_ID');
  return await ElevenLabs.removeLocalAgent(msg.agentId);
}
async function handleElStats() {
  await ElevenLabs.init();
  return await ElevenLabs.getStats();
}
async function handleElHistory(msg) {
  await ElevenLabs.init();
  return await ElevenLabs.getHistory(msg.pageSize || 100);
}
async function handleElLanguages() {
  await ElevenLabs.init();
  return { languages: ElevenLabs.getSupportedLanguages() };
}

// ============================================================
// INIT NEW MODULES + AUTO-CLEANUP
// ============================================================
(async () => {
  try { await FileManager.init(); } catch (e) { console.warn('[FireScrape] FileManager init error:', e.message); }
  try { await Connectors.init(); } catch (e) { console.warn('[FireScrape] Connectors init error:', e.message); }
  try { await TaskRunner.restore(); } catch (e) { console.warn('[FireScrape] TaskRunner restore error:', e.message); }
  try { await ElevenLabs.init(); } catch (e) { console.warn('[FireScrape] ElevenLabs init error:', e.message); }
})();

chrome.alarms.create('cache-cleanup', { periodInMinutes: 60 });

console.log("[FireScrape v3.2] Service worker avviato — Full stack: Scrape + Agent + Brain + Tasks + Files + Connectors + Pipeline + ElevenLabs");
