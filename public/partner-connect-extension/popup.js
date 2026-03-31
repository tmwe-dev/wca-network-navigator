// FireScrape v3 — Popup Logic
// Fix: XSS sanitization, escaped HTML output

// ============================================================
// HELPERS (con sanitizzazione)
// ============================================================
function $(id) {
  const el = document.getElementById(id);
  if (!el && id) console.warn(`Element not found: ${id}`);
  return el;
}
function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }

// HTML escape per prevenire XSS
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setStatus(id, msg, type) {
  const el = $(id);
  if (!el) return;
  el.className = 'status' + (type ? ' ' + type : '');
  el.textContent = msg;
}
function setLoading(btn, loading, text) {
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.innerHTML = '<span class="spinner"></span> ' + esc(text || 'Caricamento...');
  } else {
    btn.innerHTML = btn.dataset.original;
  }
}
function saveOriginal(btn) { if (btn) btn.dataset.original = btn.innerHTML; }

async function getCurrentTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url || '';
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyText(text, btnId) {
  await navigator.clipboard.writeText(text);
  const btn = $(btnId);
  if (!btn) return;
  const orig = btn.innerHTML;
  btn.textContent = '\u2705 Copiato!';
  setTimeout(() => btn.innerHTML = orig, 1200);
}

function sendMsg(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, response => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else if (response?.error) reject(new Error(response.error));
      else resolve(response);
    });
  });
}

// ============================================================
// TAB SWITCHING (CONSOLIDATED)
// ============================================================
let crawlPollActive = false;
let dashInterval = null;
let relayPollInterval = null;

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.getElementById('panel-' + tabName);
    if (panel) panel.classList.add('active');

    // Handle tab-specific logic
    if (tabName === 'brain') refreshBrain();
    if (tabName === 'relay') {
      if (!relayPollInterval) refreshRelay();
    }
    if (tabName === 'dashboard') {
      refreshDashboard();
      if (!dashInterval) dashInterval = setInterval(refreshDashboard, 2000);
    } else {
      if (dashInterval) { clearInterval(dashInterval); dashInterval = null; }
    }
    if (tabName === 'tasks') refreshTasks();
    if (tabName === 'connectors') refreshConnectors();
    if (tabName === 'pipelines') refreshPipelines();
  });
});

// ============================================================
// 1. SCRAPE
// ============================================================
let scrapeData = null;
let scrapeFormat = 'markdown';

saveOriginal($('scrapeBtn'));
$('scrapeBtn')?.addEventListener('click', async () => {
  const btn = $('scrapeBtn');
  if (!btn) return;
  setLoading(btn, true, 'Scraping...');
  hide($('scrapeOutput'));
  setStatus('scrapeStatus', '');
  try {
    scrapeData = await sendMsg({ action: 'scrape' });
    const s = scrapeData.stats;
    const statsEl = $('scrapeStats');
    if (statsEl) {
      statsEl.innerHTML = `<span class="stat"><b>${esc(s.chars.toLocaleString())}</b> caratteri</span><span class="stat"><b>${esc(s.words.toLocaleString())}</b> parole</span><span class="stat">~${esc(s.readingTime)}</span>`;
    }
    updateScrapePreview();
    show($('scrapeOutput'));
    setStatus('scrapeStatus', '\u2705 Scraping completato', 'success');
  } catch (e) {
    setStatus('scrapeStatus', '\u274c ' + e.message, 'error');
  }
  setLoading(btn, false);
});

function getScrapeText() {
  if (!scrapeData) return '';
  if (scrapeFormat === 'markdown') return scrapeData.markdown;
  if (scrapeFormat === 'text') return scrapeData.markdown.replace(/^#+\s*/gm, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/^>\s?/gm, '').replace(/^---$/gm, '');
  return scrapeData.markdown.replace(/^### (.*$)/gm, '<h3>$1</h3>').replace(/^## (.*$)/gm, '<h2>$1</h2>').replace(/^# (.*$)/gm, '<h1>$1</h1>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/\n\n/g, '<br><br>');
}

function updateScrapePreview() {
  const el = $('scrapePreview');
  if (el) el.textContent = getScrapeText();
}

const scrapeFormatEl = $('scrapeFormat');
if (scrapeFormatEl) {
  scrapeFormatEl.addEventListener('click', e => {
    if (e.target.dataset.format) {
      scrapeFormat = e.target.dataset.format;
      const formatEl = $('scrapeFormat');
      if (formatEl) {
        formatEl.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        if (scrapeData) updateScrapePreview();
      }
    }
  });
}

$('scrapeCopy')?.addEventListener('click', () => copyText(getScrapeText(), 'scrapeCopy'));
$('scrapeDownload')?.addEventListener('click', () => {
  const ext = { markdown: 'md', html: 'html', text: 'txt' }[scrapeFormat];
  const title = (scrapeData.metadata.title || 'scrape').replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase().slice(0, 50);
  downloadFile(getScrapeText(), `${title}.${ext}`, 'text/plain');
});

// ============================================================
// 2. CRAWL
// ============================================================
let crawlData = [];

saveOriginal($('crawlStartBtn'));
$('crawlStartBtn')?.addEventListener('click', async () => {
  const btn = $('crawlStartBtn');
  if (!btn) return;
  const url = $('crawlUrl')?.value?.trim() || await getCurrentTabUrl();
  if (!url) return setStatus('crawlStatus', '\u274c Nessun URL', 'error');

  setLoading(btn, true, 'Crawling...');
  show($('crawlStopBtn'));
  hide($('crawlActions'));
  const resultsEl = $('crawlResults');
  if (resultsEl) resultsEl.innerHTML = '';
  crawlData = [];

  try {
    await sendMsg({
      action: 'crawl-start', url,
      config: {
        maxPages: parseInt($('crawlMaxPages')?.value) || 30,
        maxDepth: parseInt($('crawlMaxDepth')?.value) || 3,
        delay: parseInt($('crawlDelay')?.value) || 800,
        sameDomain: true,
      }
    });
    setStatus('crawlStatus', '\ud83d\udd77 Crawl in corso...', '');
    crawlPollActive = true;
    pollCrawl();
  } catch (e) {
    setStatus('crawlStatus', '\u274c ' + e.message, 'error');
    setLoading(btn, false);
    hide($('crawlStopBtn'));
  }
});

$('crawlStopBtn')?.addEventListener('click', async () => {
  const btn = $('crawlStartBtn');
  await sendMsg({ action: 'crawl-stop' });
  crawlPollActive = false;
  setLoading(btn, false);
  hide($('crawlStopBtn'));
  setStatus('crawlStatus', '\u23f9 Crawl fermato', '');
});

async function pollCrawl() {
  if (!crawlPollActive) return;
  try {
    const status = await sendMsg({ action: 'crawl-status' });
    crawlData = status.pages || [];
    const max = parseInt($('crawlMaxPages')?.value) || 30;
    const pct = Math.min(100, (status.results / max) * 100);
    const fillEl = $('crawlProgressFill');
    if (fillEl) fillEl.style.width = pct + '%';
    const statsEl = $('crawlStats');
    if (statsEl) {
      statsEl.innerHTML = `<span class="stat"><b>${esc(status.results)}</b> scrape</span><span class="stat"><b>${esc(status.visited)}</b> visitati</span><span class="stat"><b>${esc(status.queued)}</b> in coda</span>`;
    }

    // Sanitized output
    const resultsEl = $('crawlResults');
    if (resultsEl) {
      resultsEl.innerHTML = crawlData.slice(-20).reverse().map(r =>
        `<div class="result-item"><span class="badge ${r.error ? 'badge-err' : 'badge-ok'}">${r.error ? 'ERR' : 'OK'}</span><span class="url" title="${esc(r.url)}">${esc(r.url)}</span></div>`
      ).join('');
    }

    if (status.running && crawlPollActive) {
      setTimeout(pollCrawl, 1500);
    } else {
      crawlPollActive = false;
      setLoading($('crawlStartBtn'), false);
      hide($('crawlStopBtn'));
      show($('crawlActions'));
      setStatus('crawlStatus', `\u2705 Crawl completato: ${status.results} pagine`, 'success');
    }
  } catch {
    if (crawlPollActive) {
      setTimeout(pollCrawl, 2000);
    }
  }
}

$('crawlCopy')?.addEventListener('click', () => {
  const md = crawlData.filter(r => r.markdown).map(r => r.markdown).join('\n\n---\n\n');
  copyText(md, 'crawlCopy');
});
$('crawlDownload')?.addEventListener('click', () => downloadFile(JSON.stringify(crawlData, null, 2), 'crawl-results.json', 'application/json'));

// ============================================================
// 3. MAP
// ============================================================
let mapData = [];

saveOriginal($('mapBtn'));
$('mapBtn')?.addEventListener('click', async () => {
  const btn = $('mapBtn');
  if (!btn) return;
  const url = $('mapUrl')?.value?.trim() || await getCurrentTabUrl();
  if (!url) return setStatus('mapStatus', '\u274c Nessun URL', 'error');

  setLoading(btn, true, 'Mapping...');
  hide($('mapActions'));
  const resultsEl = $('mapResults');
  if (resultsEl) resultsEl.innerHTML = '';
  setStatus('mapStatus', '\ud83d\uddfa Mapping in corso...', '');

  try {
    const result = await sendMsg({ action: 'map', url, maxUrls: parseInt($('mapMax')?.value) || 100 });
    mapData = result.urls || [];
    const mapResultsEl = $('mapResults');
    if (mapResultsEl) {
      mapResultsEl.innerHTML = mapData.map(r =>
        `<div class="result-item"><span class="url" title="${esc(r.url)}">${esc(r.url)}</span><span class="stat">${r.linksCount || 0} link</span></div>`
      ).join('');
    }
    show($('mapActions'));
    setStatus('mapStatus', `\u2705 ${mapData.length} URL trovati`, 'success');
  } catch (e) {
    setStatus('mapStatus', '\u274c ' + e.message, 'error');
  }
  setLoading(btn, false);
});

$('mapCopy')?.addEventListener('click', () => copyText(mapData.map(r => r.url).join('\n'), 'mapCopy'));
$('mapDownload')?.addEventListener('click', () => downloadFile(JSON.stringify(mapData, null, 2), 'sitemap.json', 'application/json'));

// ============================================================
// 4. EXTRACT
// ============================================================
let extractData = null;

$('addFieldBtn')?.addEventListener('click', () => {
  const row = document.createElement('div');
  row.className = 'schema-row';
  row.innerHTML = '<input class="input" placeholder="campo" style="flex:1"><input class="input" placeholder="selettore" style="flex:2"><button class="remove-field">\u00d7</button>';
  const schemaEl = $('schemaFields');
  if (schemaEl) schemaEl.appendChild(row);
});

$('schemaFields')?.addEventListener('click', e => {
  if (e.target.classList.contains('remove-field')) {
    const schemaEl = $('schemaFields');
    const rows = schemaEl?.querySelectorAll('.schema-row');
    if (rows && rows.length > 1) e.target.parentElement.remove();
  }
});

saveOriginal($('extractBtn'));
$('extractBtn')?.addEventListener('click', async () => {
  const btn = $('extractBtn');
  if (!btn) return;
  const schema = {};
  const schemaEl = $('schemaFields');
  if (schemaEl) {
    schemaEl.querySelectorAll('.schema-row').forEach(row => {
      const inputs = row.querySelectorAll('input');
      const key = inputs[0]?.value?.trim();
      const sel = inputs[1]?.value?.trim();
      if (key && sel) schema[key] = sel;
    });
  }

  if (Object.keys(schema).length === 0) return setStatus('extractStatus', '\u274c Definisci almeno un campo', 'error');

  setLoading(btn, true, 'Estraendo...');
  try {
    const result = await sendMsg({ action: 'extract', schema });
    extractData = result.data;
    const previewEl = $('extractPreview');
    if (previewEl) previewEl.textContent = JSON.stringify(extractData, null, 2);
    show($('extractPreview'));
    show($('extractActions'));
    setStatus('extractStatus', '\u2705 Dati estratti', 'success');
  } catch (e) {
    setStatus('extractStatus', '\u274c ' + e.message, 'error');
  }
  setLoading(btn, false);
});

$('extractCopy')?.addEventListener('click', () => copyText(JSON.stringify(extractData, null, 2), 'extractCopy'));
$('extractDownload')?.addEventListener('click', () => downloadFile(JSON.stringify(extractData, null, 2), 'extracted-data.json', 'application/json'));

// ============================================================
// 5. BATCH
// ============================================================
let batchData = [];

saveOriginal($('batchBtn'));
$('batchBtn')?.addEventListener('click', async () => {
  const btn = $('batchBtn');
  if (!btn) return;
  const urls = ($('batchUrls')?.value || '').trim().split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
  if (urls.length === 0) return setStatus('batchStatus', '\u274c Inserisci almeno un URL', 'error');

  setLoading(btn, true, `Batch: 0/${urls.length}...`);
  hide($('batchActions'));
  const resultsEl = $('batchResults');
  if (resultsEl) resultsEl.innerHTML = '';
  show($('batchProgress'));
  const fillEl = $('batchProgressFill');
  if (fillEl) fillEl.style.width = '0%';

  try {
    const result = await sendMsg({
      action: 'batch', urls,
      concurrency: Math.min(parseInt($('batchConcurrency')?.value) || 3, 5),
    });
    batchData = result.results || [];
    const batchResultsEl = $('batchResults');
    if (batchResultsEl) {
      batchResultsEl.innerHTML = batchData.map(r =>
        `<div class="result-item"><span class="badge ${r.error ? 'badge-err' : 'badge-ok'}">${r.error ? 'ERR' : 'OK'}</span><span class="url" title="${esc(r.url)}">${esc(r.url)}</span></div>`
      ).join('');
    }
    const fillEl2 = $('batchProgressFill');
    if (fillEl2) fillEl2.style.width = '100%';
    show($('batchActions'));
    const ok = batchData.filter(r => !r.error).length;
    setStatus('batchStatus', `\u2705 ${ok}/${batchData.length} pagine estratte`, 'success');
  } catch (e) {
    setStatus('batchStatus', '\u274c ' + e.message, 'error');
  }
  setLoading(btn, false);
});

$('batchCopy')?.addEventListener('click', () => {
  const md = batchData.filter(r => r.markdown).map(r => r.markdown).join('\n\n---\n\n');
  copyText(md, 'batchCopy');
});
$('batchDownload')?.addEventListener('click', () => downloadFile(JSON.stringify(batchData, null, 2), 'batch-results.json', 'application/json'));

// ============================================================
// 6. SCREENSHOT
// ============================================================
let ssData = null;

saveOriginal($('ssBtn'));
$('ssBtn')?.addEventListener('click', async () => {
  const btn = $('ssBtn');
  if (!btn) return;
  setLoading(btn, true, 'Catturando...');
  hide($('ssPreviewArea'));

  try {
    const result = await sendMsg({
      action: 'screenshot',
      format: $('ssFormat')?.value,
      quality: 92,
      fullPage: $('ssType')?.value === 'full',
    });

    ssData = result;
    const previewImg = $('ssPreview');
    if (previewImg) {
      if (result.screenshot) {
        previewImg.src = result.screenshot;
      } else if (result.screenshots?.length > 0) {
        previewImg.src = result.screenshots[0].dataUrl;
      }
    }
    show($('ssPreviewArea'));
    setStatus('ssStatus', '\u2705 Screenshot catturato', 'success');
  } catch (e) {
    setStatus('ssStatus', '\u274c ' + e.message, 'error');
  }
  setLoading(btn, false);
});

$('ssCopy')?.addEventListener('click', async () => {
  try {
    const dataUrl = ssData?.screenshot || ssData?.screenshots?.[0]?.dataUrl;
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    const copyBtn = $('ssCopy');
    if (copyBtn) {
      copyBtn.textContent = '\u2705 Copiato!';
      setTimeout(() => copyBtn.innerHTML = '\ud83d\udccb Copia', 1200);
    }
  } catch {
    setStatus('ssStatus', '\u274c Copia immagine non supportata', 'error');
  }
});

$('ssDownload')?.addEventListener('click', () => {
  const dataUrl = ssData?.screenshot || ssData?.screenshots?.[0]?.dataUrl;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `screenshot.${$('ssFormat')?.value}`;
  a.click();
});

// ============================================================
// 7. BRAIN
// ============================================================
let brainAnalysis = null;

async function refreshBrain() {
  try {
    const stats = await sendMsg({ action: 'brain-stats' });
    const pct = stats.budgetPercent || 100;
    const tokenFillEl = $('brainTokenFill');
    if (tokenFillEl) {
      tokenFillEl.style.width = pct + '%';
      tokenFillEl.className = 'battery-fill ' + getLevelClass(pct);
    }
    const tokenValueEl = $('brainTokenValue');
    if (tokenValueEl) {
      tokenValueEl.textContent = `${(stats.budgetRemaining || 0).toLocaleString()}`;
      tokenValueEl.className = 'battery-value ' + getLevelClass(pct);
    }
    const tokenDetailEl = $('brainTokenDetail');
    if (tokenDetailEl) {
      tokenDetailEl.textContent = `${(stats.tokensUsedToday || 0).toLocaleString()} usati / ${(stats.dailyBudget || 50000).toLocaleString()}`;
    }
    const modelEl = $('brainModelName');
    if (modelEl) modelEl.textContent = stats.model || '\u2014';
    const libTotalEl = $('brainLibTotal');
    if (libTotalEl) libTotalEl.textContent = stats.library?.total || 0;
    const libDomainsEl = $('brainLibDomains');
    if (libDomainsEl) libDomainsEl.textContent = stats.library?.domains || 0;
    const libTagsEl = $('brainLibTags');
    if (libTagsEl) libTagsEl.textContent = stats.library?.tags || 0;
    const supaEl = $('brainSupaStatus');
    if (supaEl) {
      supaEl.textContent = stats.supabaseConnected ? '\ud83d\udfe2' : '\u26aa';
      supaEl.style.color = stats.supabaseConnected ? '#44cc44' : '#666';
    }
  } catch {}
}

saveOriginal($('brainAnalyzeBtn'));
$('brainAnalyzeBtn')?.addEventListener('click', async () => {
  const btn = $('brainAnalyzeBtn');
  if (!btn) return;
  setLoading(btn, true, '\ud83e\udde0 Analizzando...');
  setStatus('brainStatus', '');
  hide($('brainSuggestedActions'));
  try {
    brainAnalysis = await sendMsg({ action: 'brain-analyze' });
    const resultEl = $('brainAnalysisResult');
    if (resultEl) resultEl.textContent = JSON.stringify(brainAnalysis, null, 2);
    show($('brainAnalysisResult'));

    if (brainAnalysis._fromLibrary) {
      setStatus('brainStatus', '\ud83d\udcda Dati dalla libreria (0 token usati)', 'success');
    } else {
      setStatus('brainStatus', `\u2705 Analisi completata (${brainAnalysis._tokensUsed || 0} token)`, 'success');
    }

    if (brainAnalysis.next_actions?.length > 0) {
      show($('brainSuggestedActions'));
      const actionsListEl = $('brainActionsList');
      if (actionsListEl) {
        actionsListEl.innerHTML = brainAnalysis.next_actions.map(a =>
          `<div class="result-item">
            <span class="badge badge-ok">${esc(a.action)}</span>
            <span class="url">${esc(a.selector || a.url || '')}</span>
            <span class="stat">${esc((a.reason || '').slice(0, 30))}</span>
          </div>`
        ).join('');
      }
    }

    refreshBrain();
  } catch (e) { setStatus('brainStatus', '\u274c ' + e.message, 'error'); }
  setLoading(btn, false);
});

$('brainRunActionsBtn')?.addEventListener('click', async () => {
  if (!brainAnalysis?.next_actions?.length) return;
  try {
    const result = await sendMsg({ action: 'agent-sequence', steps: brainAnalysis.next_actions });
    setStatus('brainStatus', result.ok ? `\u2705 ${result.totalSteps} azioni eseguite` : `\u274c Fermato: ${result.reason}`, result.ok ? 'success' : 'error');
  } catch (e) { setStatus('brainStatus', '\u274c ' + e.message, 'error'); }
});

$('brainAskBtn')?.addEventListener('click', async () => {
  const prompt = $('brainPrompt')?.value?.trim();
  if (!prompt) return;
  const btn = $('brainAskBtn');
  if (btn) btn.disabled = true;
  setStatus('brainStatus', '');
  try {
    const result = await sendMsg({ action: 'brain-think', prompt });
    const chatResultEl = $('brainChatResult');
    if (chatResultEl) chatResultEl.textContent = JSON.stringify(result, null, 2);
    show($('brainChatResult'));
    const tokenInfo = result._fromLibrary ? '\ud83d\udcda dalla libreria' : `${result._tokensUsed || 0} token`;
    setStatus('brainStatus', `\u2705 ${tokenInfo}`, 'success');
    refreshBrain();
  } catch (e) { setStatus('brainStatus', '\u274c ' + e.message, 'error'); }
  const btn2 = $('brainAskBtn');
  if (btn2) btn2.disabled = false;
});

$('brainPrompt')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') $('brainAskBtn')?.click();
});

// Libreria
$('libSearchBtn')?.addEventListener('click', async () => {
  const q = $('libSearch')?.value?.trim();
  try {
    const results = await sendMsg({ action: 'library-search', query: q });
    const resultsEl = $('libResults');
    if (resultsEl) {
      resultsEl.innerHTML = (results || []).map(r =>
        `<div class="result-item">
          <span class="badge ${r.confidence > 70 ? 'badge-ok' : 'badge-err'}">${esc(r.confidence)}</span>
          <span class="url">${esc(r.domain || '?')}</span>
          <span class="stat">${esc((r.tags || []).join(', '))}</span>
        </div>`
      ).join('') || '<div style="text-align:center;color:#444;font-size:11px;padding:8px;">Nessun risultato</div>';
    }
  } catch (e) { setStatus('brainStatus', '\u274c ' + e.message, 'error'); }
});

$('libExportBtn')?.addEventListener('click', async () => {
  try {
    const data = await sendMsg({ action: 'library-export' });
    downloadFile(JSON.stringify(data, null, 2), 'firescrape-library.json', 'application/json');
  } catch (e) { setStatus('brainStatus', '\u274c ' + e.message, 'error'); }
});

$('libClearBtn')?.addEventListener('click', async () => {
  if (confirm('Svuotare tutta la libreria?')) {
    await sendMsg({ action: 'library-clear' });
    refreshBrain();
  }
});

// Settings — API key inviate direttamente, non mostrate
$('brainSaveSettings')?.addEventListener('click', async () => {
  try {
    await sendMsg({
      action: 'brain-config',
      config: {
        claudeApiKey: $('brainApiKey')?.value?.trim(),
        claudeModel: $('brainModel')?.value,
        dailyTokenBudget: parseInt($('brainBudget')?.value) || 50000,
        supabaseUrl: $('brainSupaUrl')?.value?.trim(),
        supabaseKey: $('brainSupaKey')?.value?.trim(),
      }
    });
    setStatus('brainSettingsStatus', '\u2705 Salvato (chiavi cifrate)', 'success');
    // Pulisci campi sensibili dopo il salvataggio
    const apiKeyEl = $('brainApiKey');
    if (apiKeyEl) {
      apiKeyEl.value = '';
      apiKeyEl.placeholder = '\u2022\u2022\u2022\u2022 salvata e cifrata';
    }
    const supaKeyEl = $('brainSupaKey');
    if (supaKeyEl) {
      supaKeyEl.value = '';
      supaKeyEl.placeholder = '\u2022\u2022\u2022\u2022 salvata e cifrata';
    }
    refreshBrain();
  } catch (e) { setStatus('brainSettingsStatus', '\u274c ' + e.message, 'error'); }
});

// Load settings al caricamento (solo config non-sensibile)
(async () => {
  try {
    const s = await sendMsg({ action: 'brain-get-config' });
    // Le chiavi API arrivano mascherate dal background
    const apiKeyEl = $('brainApiKey');
    if (apiKeyEl && s.claudeApiKey && s.claudeApiKey.includes('...')) {
      apiKeyEl.placeholder = '\u2022\u2022\u2022\u2022 configurata';
    }
    const modelEl = $('brainModel');
    if (modelEl && s.claudeModel) modelEl.value = s.claudeModel;
    const budgetEl = $('brainBudget');
    if (budgetEl && s.dailyTokenBudget) budgetEl.value = s.dailyTokenBudget;
    const supaUrlEl = $('brainSupaUrl');
    if (supaUrlEl && s.supabaseUrl) supaUrlEl.value = s.supabaseUrl;
    const supaKeyEl = $('brainSupaKey');
    if (supaKeyEl && s.supabaseKey && s.supabaseKey.includes('...')) {
      supaKeyEl.placeholder = '\u2022\u2022\u2022\u2022 configurata';
    }
  } catch {}
  refreshBrain();
})();

// ============================================================
// 8. AGENT
// ============================================================
$('agentActionType')?.addEventListener('change', () => {
  const needsText = ['type'].includes($('agentActionType')?.value);
  if (needsText) show($('agentTextField')); else hide($('agentTextField'));
});

saveOriginal($('agentSnapshotBtn'));
$('agentSnapshotBtn')?.addEventListener('click', async () => {
  const btn = $('agentSnapshotBtn');
  if (!btn) return;
  setLoading(btn, true, 'Analizzando...');
  try {
    const snap = await sendMsg({ action: 'agent-snapshot' });
    const statsEl = $('agentSnapStats');
    if (statsEl) {
      statsEl.innerHTML = `
        <span class="stat"><b>${snap.buttons?.length || 0}</b> bottoni</span>
        <span class="stat"><b>${snap.inputs?.length || 0}</b> input</span>
        <span class="stat"><b>${snap.links?.length || 0}</b> link</span>
        <span class="stat"><b>${snap.headings?.length || 0}</b> headings</span>
      `;
    }
    const previewEl = $('agentSnapPreview');
    if (previewEl) previewEl.textContent = JSON.stringify(snap, null, 2);
    show($('agentSnapshotArea'));
  } catch (e) { setStatus('agentStatus', '\u274c ' + e.message, 'error'); }
  setLoading(btn, false);
});

saveOriginal($('agentRunBtn'));
$('agentRunBtn')?.addEventListener('click', async () => {
  const btn = $('agentRunBtn');
  if (!btn) return;
  const action = $('agentActionType')?.value;
  const selector = $('agentSelector')?.value?.trim();
  if (!selector) return setStatus('agentStatus', '\u274c Inserisci un selettore', 'error');
  const step = { action, selector };
  if (action === 'type') step.text = $('agentText')?.value;
  setLoading(btn, true, 'Eseguendo...');
  try {
    const result = await sendMsg({ action: 'agent-action', step });
    const resultEl = $('agentResult');
    if (resultEl) resultEl.textContent = JSON.stringify(result, null, 2);
    show($('agentResult'));
    setStatus('agentStatus', result.ok ? '\u2705 Azione completata' : '\u274c ' + (result.error || 'Errore'), result.ok ? 'success' : 'error');
  } catch (e) { setStatus('agentStatus', '\u274c ' + e.message, 'error'); }
  setLoading(btn, false);
});

saveOriginal($('agentSeqBtn'));
$('agentSeqBtn')?.addEventListener('click', async () => {
  const btn = $('agentSeqBtn');
  if (!btn) return;
  let steps;
  try { steps = JSON.parse($('agentSequence')?.value); } catch { return setStatus('agentSeqStatus', '\u274c JSON non valido', 'error'); }
  if (!Array.isArray(steps)) return setStatus('agentSeqStatus', '\u274c Deve essere un array', 'error');
  setLoading(btn, true, `Eseguendo ${steps.length} passi...`);
  try {
    const result = await sendMsg({ action: 'agent-sequence', steps });
    const resultEl = $('agentSeqResult');
    if (resultEl) resultEl.textContent = JSON.stringify(result, null, 2);
    show($('agentSeqResult'));
    setStatus('agentSeqStatus', result.ok ? `\u2705 ${result.totalSteps} passi completati` : `\u274c Fermato al passo ${result.stoppedAt}: ${result.reason}`, result.ok ? 'success' : 'error');
  } catch (e) { setStatus('agentSeqStatus', '\u274c ' + e.message, 'error'); }
  setLoading(btn, false);
});

// ============================================================
// 9. RELAY
// ============================================================
saveOriginal($('relayStartBtn'));
$('relayStartBtn')?.addEventListener('click', async () => {
  const btn = $('relayStartBtn');
  if (!btn) return;
  setLoading(btn, true, 'Connettendo...');
  try {
    await sendMsg({ action: 'relay-start' });
    show($('relayStopBtn')); hide($('relayStartBtn'));
    setStatus('relayStatusMsg', '\u2705 Connesso a Claude Bridge', 'success');
    startRelayPoll();
  } catch (e) { setStatus('relayStatusMsg', '\u274c ' + e.message, 'error'); }
  setLoading(btn, false);
});

$('relayStopBtn')?.addEventListener('click', async () => {
  await sendMsg({ action: 'relay-stop' });
  hide($('relayStopBtn')); show($('relayStartBtn'));
  stopRelayPoll();
  setStatus('relayStatusMsg', '\u23f9 Disconnesso', '');
});

$('relaySendTabsBtn')?.addEventListener('click', async () => {
  const btn = $('relaySendTabsBtn');
  if (!btn) return;
  await sendMsg({ action: 'relay-send-tabs' });
  btn.textContent = '\u2705 Inviati!';
  setTimeout(() => btn.innerHTML = '\ud83d\udcd1 Invia lista tab', 1200);
});

function startRelayPoll() {
  if (relayPollInterval) return;
  relayPollInterval = setInterval(refreshRelay, 2000);
  refreshRelay();
}

function stopRelayPoll() {
  if (relayPollInterval) { clearInterval(relayPollInterval); relayPollInterval = null; }
}

async function refreshRelay() {
  try {
    const s = await sendMsg({ action: 'relay-status' });
    const statusDotEl = $('relayStatusDot');
    if (statusDotEl) {
      statusDotEl.style.background = s.connected ? '#44cc44' : '#cc4444';
      statusDotEl.style.boxShadow = s.connected ? '0 0 6px #44cc4488' : '0 0 6px #cc444488';
    }

    let statusText = s.connected ? 'CONNESSO' : 'DISCONNESSO';
    if (s.circuitOpen) statusText = 'CIRCUIT BREAK';
    const statusTextEl = $('relayStatusText');
    if (statusTextEl) {
      statusTextEl.textContent = statusText;
      statusTextEl.style.color = s.connected ? (s.circuitOpen ? '#ccaa22' : '#44cc44') : '#cc4444';
    }

    if (s.connected) { hide($('relayStartBtn')); show($('relayStopBtn')); }
    else { show($('relayStartBtn')); hide($('relayStopBtn')); }

    const statsEl = $('relayStats');
    if (statsEl) {
      statsEl.innerHTML = `
        <span class="stat"><b>${s.commandsExecuted}</b> comandi</span>
        <span class="stat">Ultimo poll: <b>${s.lastPollTs ? new Date(s.lastPollTs).toLocaleTimeString() : 'mai'}</b></span>
        ${s.circuitOpen ? '<span class="stat" style="color:#ff6b35">Circuit breaker attivo</span>' : ''}
      `;
    }

    const logContainer = $('relayLog');
    if (logContainer) {
      if (s.log && s.log.length > 0) {
        hide($('relayLogEmpty'));
        logContainer.innerHTML = s.log.map(entry => {
          const time = new Date(entry.ts).toLocaleTimeString();
          let icon = '\ud83d\udccb';
          let text = '';
          if (entry.type === 'command-in') { icon = '\ud83d\udce5'; text = esc(entry.command?.type || '?'); }
          else if (entry.type === 'command-out') { icon = entry.result?.ok ? '\u2705' : '\u274c'; text = 'risultato'; }
          else if (entry.type === 'command-rejected') { icon = '\ud83d\udeab'; text = esc(entry.reason || '?'); }
          else if (entry.type === 'agent-action') { icon = '\ud83e\udd16'; text = esc(entry.step?.action || '?'); }
          else if (entry.type === 'relay') { icon = '\ud83d\udd0c'; text = esc(entry.event); }
          else if (entry.type === 'circuit-breaker') { icon = '\u26a1'; text = esc(entry.event); }
          else if (entry.type === 'error') { icon = '\u26a0'; text = esc(entry.message?.slice(0, 40)); }
          return `<div class="result-item"><span style="font-size:14px">${icon}</span><span class="url">${text}</span><span class="stat">${time}</span></div>`;
        }).join('');
      } else {
        show($('relayLogEmpty'));
        logContainer.innerHTML = '';
      }
    }
  } catch {}
}

(async () => {
  try {
    const s = await sendMsg({ action: 'relay-status' });
    if (s.connected) startRelayPoll();
  } catch {}
})();

// ============================================================
// 10. DASHBOARD
// ============================================================
async function refreshDashboard() {
  try {
    const [rateStats, cacheStats] = await Promise.all([
      sendMsg({ action: 'rate-stats' }),
      sendMsg({ action: 'cache-stats' }),
    ]);
    const lastUpdateEl = $('dashLastUpdate');
    if (lastUpdateEl) lastUpdateEl.textContent = new Date().toLocaleTimeString();
    renderDomainBatteries(rateStats);
    renderSessionBattery();
    renderQueue(rateStats._queue);
    renderCacheStats(cacheStats);
  } catch {}
}

function renderDomainBatteries(stats) {
  const container = $('domainBatteries');
  const blockedList = $('blockedList');
  if (!container || !blockedList) return;
  container.innerHTML = '';
  blockedList.innerHTML = '';
  let hasBlocked = false;
  let hasDomains = false;

  const knownLimits = {
    'linkedin.com': { perHour: 20, perDay: 80 },
    'google.com': { perHour: 30, perDay: 150 },
  };

  for (const [domain, data] of Object.entries(stats)) {
    if (domain === '_queue') continue;
    hasDomains = true;

    const [hUsed, hMax] = data.hourly.split('/').map(Number);
    const [dUsed, dMax] = data.daily.split('/').map(Number);
    const consecutive = data.consecutive || 0;

    let burstThreshold = 20;
    for (const [key] of Object.entries(knownLimits)) {
      if (domain.includes(key)) burstThreshold = key === 'linkedin.com' ? 10 : 15;
    }

    const hPct = hMax > 0 ? Math.max(0, ((hMax - hUsed) / hMax) * 100) : 100;
    const dPct = dMax > 0 ? Math.max(0, ((dMax - dUsed) / dMax) * 100) : 100;
    const bPct = burstThreshold > 0 ? Math.max(0, ((burstThreshold - consecutive) / burstThreshold) * 100) : 100;

    const isHourlyBlocked = hUsed >= hMax;
    const isDailyBlocked = dUsed >= dMax;
    const isBurstBlocked = consecutive >= burstThreshold;
    const isBlocked = isHourlyBlocked || isDailyBlocked || isBurstBlocked;

    const safeDomain = esc(domain);

    if (isBlocked) {
      hasBlocked = true;
      let reason = '', countdown = '';
      if (isDailyBlocked) { reason = `Limite giornaliero raggiunto (${dMax}/giorno)`; countdown = 'reset a mezzanotte'; }
      else if (isHourlyBlocked) { reason = `Limite orario raggiunto (${hMax}/h)`; countdown = '~attesa 1h'; }
      else { reason = `Cooldown burst (${burstThreshold} consecutive)`; countdown = '~5 min'; }
      blockedList.innerHTML += `
        <div class="blocked-banner">
          <span class="icon">\ud83d\udeab</span>
          <span><b>${safeDomain}</b> \u2014 ${esc(reason)}</span>
          <span class="countdown">${esc(countdown)}</span>
        </div>`;
    }

    container.innerHTML += `
      <div class="battery-card">
        <div class="battery-header">
          <span class="battery-label">${isBlocked ? '\ud83d\udd34' : '\ud83d\udfe2'} ${safeDomain}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-size:10px;color:#666;width:50px;">Orario</span>
          <div class="battery-track" style="flex:1">
            <div class="battery-fill ${getLevelClass(hPct)} ${isHourlyBlocked ? 'pulse' : ''}" style="width:${hPct}%"></div>
          </div>
          <span class="battery-value ${getLevelClass(hPct)}" style="width:55px;text-align:right;">${hMax - hUsed}/${hMax}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-size:10px;color:#666;width:50px;">Giorno</span>
          <div class="battery-track" style="flex:1">
            <div class="battery-fill ${getLevelClass(dPct)} ${isDailyBlocked ? 'pulse' : ''}" style="width:${dPct}%"></div>
          </div>
          <span class="battery-value ${getLevelClass(dPct)}" style="width:55px;text-align:right;">${dMax - dUsed}/${dMax}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:10px;color:#666;width:50px;">Burst</span>
          <div class="battery-track" style="flex:1">
            <div class="battery-fill ${getLevelClass(bPct)} ${isBurstBlocked ? 'pulse' : ''}" style="width:${bPct}%"></div>
          </div>
          <span class="battery-value ${getLevelClass(bPct)}" style="width:55px;text-align:right;">${burstThreshold - consecutive}/${burstThreshold}</span>
        </div>
      </div>`;
  }

  if (hasBlocked) { show($('blockedSection')); } else { hide($('blockedSection')); }
  if (hasDomains) { hide($('noDomainMsg')); } else { show($('noDomainMsg')); }
}

function getLevelClass(pct) {
  if (pct > 60) return 'full';
  if (pct > 30) return 'mid';
  if (pct > 5) return 'low';
  return 'empty';
}

function renderSessionBattery() {
  const maxPages = 15;
  const sessionBatteryEl = $('sessionBattery');
  if (!sessionBatteryEl) return;
  sessionBatteryEl.innerHTML = `
    <div class="battery-card">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:10px;color:#666;width:80px;">Pagine/sessione</span>
        <div class="battery-track" style="flex:1">
          <div class="battery-fill full" style="width:100%"></div>
        </div>
        <span class="battery-value full" style="width:40px;text-align:right;">${maxPages}</span>
      </div>
      <div class="battery-detail">
        <span>Max 15 pagine, poi pausa 5 min</span>
        <span>3 sessioni/ora</span>
      </div>
    </div>`;
}

function renderQueue(queueData) {
  const container = $('queueList');
  if (!container) return;
  if (!queueData || queueData.total === 0) {
    container.innerHTML = '';
    show($('queueEmpty'));
    return;
  }
  hide($('queueEmpty'));
  container.innerHTML = `
    <div style="font-size:11px;color:#888;padding:6px 8px;border-bottom:1px solid #1e1e1e;">
      <b>${queueData.total}</b> operazioni in coda ${queueData.processing ? '\u2014 <span style="color:#ff6b35">elaborando...</span>' : ''}
    </div>`;
}

function renderCacheStats(stats) {
  const cacheTotal = $('cacheTotal');
  if (cacheTotal) cacheTotal.textContent = stats.total || 0;
  const cacheHits = $('cacheHits');
  if (cacheHits) cacheHits.textContent = stats.requestsSaved || 0;
  const cacheExpired = $('cacheExpired');
  if (cacheExpired) cacheExpired.textContent = stats.expired || 0;
  const cacheDomains = $('cacheDomains');
  if (cacheDomains) cacheDomains.textContent = stats.byType?.domain?.count || 0;
}

$('cacheCleanupBtn')?.addEventListener('click', async () => {
  const btn = $('cacheCleanupBtn');
  if (!btn) return;
  await sendMsg({ action: 'cache-cleanup' });
  refreshDashboard();
  btn.textContent = '\u2705 Fatto!';
  setTimeout(() => btn.innerHTML = '\ud83e\uddf9 Pulisci scaduti', 1200);
});

$('cacheClearBtn')?.addEventListener('click', async () => {
  const btn = $('cacheClearBtn');
  if (!btn) return;
  if (confirm('Svuotare tutta la cache?')) {
    await sendMsg({ action: 'cache-clear' });
    refreshDashboard();
    btn.textContent = '\u2705 Svuotata!';
    setTimeout(() => btn.innerHTML = '\ud83d\uddd1 Svuota cache', 1200);
  }
});

// ============================================================
// 11. TASKS
// ============================================================
async function refreshTasks() {
  try {
    const [tasks, stats, files] = await Promise.all([
      sendMsg({ action: 'task-list', filter: { limit: 20 } }),
      sendMsg({ action: 'task-stats' }),
      sendMsg({ action: 'file-list', filter: { limit: 10 } }),
    ]);

    // Stats
    if (stats && $('taskStats')) {
      $('taskStats').innerHTML = `
        <span class="stat"><b>${stats.running || 0}</b> attivi</span>
        <span class="stat"><b>${stats.completed || 0}</b> completati</span>
        <span class="stat"><b>${stats.failed || 0}</b> falliti</span>
      `;
    }

    // Task list
    const taskList = $('taskList');
    const list = Array.isArray(tasks) ? tasks : (tasks?.tasks || []);
    if (taskList) {
      if (list.length > 0) {
        hide($('taskEmpty'));
        taskList.innerHTML = list.map(t => {
          const statusIcon = { running: '🔄', completed: '✅', failed: '❌', paused: '⏸', created: '📝', cancelled: '🚫' }[t.status] || '❓';
          const pct = t.steps ? Math.round((t.completedSteps || 0) / t.steps.length * 100) : 0;
          return `<div class="result-item" style="cursor:pointer" data-task-id="${esc(t.id)}">
            <span style="font-size:14px">${statusIcon}</span>
            <span class="url">${esc(t.name || t.id)}</span>
            <span class="stat">${pct}%</span>
            ${t.status === 'running' ? `<button class="btn btn-secondary btn-sm" style="padding:3px 8px;margin:0" onclick="pauseTask('${esc(t.id)}')">⏸</button>` : ''}
            ${t.status === 'paused' ? `<button class="btn btn-primary btn-sm" style="padding:3px 8px;margin:0" onclick="resumeTask('${esc(t.id)}')">▶</button>` : ''}
            ${t.status === 'failed' ? `<button class="btn btn-secondary btn-sm" style="padding:3px 8px;margin:0" onclick="retryTask('${esc(t.id)}')">🔄</button>` : ''}
          </div>`;
        }).join('');
      } else {
        show($('taskEmpty'));
        taskList.innerHTML = '';
      }
    }

    // Files
    const fileList = $('fileList');
    const fileArr = Array.isArray(files) ? files : (files?.files || []);
    if (fileList) {
      if (fileArr.length > 0) {
        hide($('fileEmpty'));
        fileList.innerHTML = fileArr.map(f => `
          <div class="result-item">
            <span class="badge badge-ok">${esc(f.format || '?')}</span>
            <span class="url">${esc(f.filename || f.id)}</span>
            <span class="stat">${f.status || '?'}</span>
          </div>
        `).join('');
      } else {
        show($('fileEmpty'));
        fileList.innerHTML = '';
      }
    }
  } catch (e) {
    console.warn('refreshTasks error:', e);
  }
}

// Global helpers for task buttons
window.pauseTask = async (id) => { await sendMsg({ action: 'task-pause', taskId: id }); refreshTasks(); };
window.resumeTask = async (id) => { await sendMsg({ action: 'task-start', taskId: id }); refreshTasks(); };
window.retryTask = async (id) => { await sendMsg({ action: 'task-retry', taskId: id }); refreshTasks(); };

$('taskCreateBtn')?.addEventListener('click', async () => {
  const name = $('taskName')?.value?.trim() || 'Task rapido';
  let steps;
  try { steps = JSON.parse($('taskStepsJson')?.value || '[]'); } catch { return setStatus('taskStatus', '❌ JSON non valido', 'error'); }
  if (!Array.isArray(steps) || steps.length === 0) return setStatus('taskStatus', '❌ Inserisci almeno uno step', 'error');

  try {
    const result = await sendMsg({ action: 'task-create', task: { name, steps, config: { onError: 'skip' } } });
    const taskId = result?.id || result?.taskId;
    if (taskId) await sendMsg({ action: 'task-start', taskId });
    setStatus('taskStatus', `✅ Task avviato: ${esc(taskId)}`, 'success');
    refreshTasks();
  } catch (e) { setStatus('taskStatus', '❌ ' + e.message, 'error'); }
});

// ============================================================
// 12. CONNECTORS
// ============================================================
const CONNECTOR_CONFIGS = {
  'email': [
    { key: 'webhookUrl', label: 'Webhook URL', type: 'url', placeholder: 'https://your-email-relay.com/send' },
    { key: 'fromName', label: 'Nome mittente', type: 'text', placeholder: 'FireScrape' },
    { key: 'fromEmail', label: 'Email mittente', type: 'email', placeholder: 'noreply@tuodominio.com' },
  ],
  'webhook': [
    { key: 'url', label: 'URL', type: 'url', placeholder: 'https://hooks.example.com/...' },
    { key: 'method', label: 'Metodo', type: 'text', placeholder: 'POST' },
    { key: 'authType', label: 'Auth (none/bearer/api-key)', type: 'text', placeholder: 'none' },
    { key: 'authValue', label: 'Token / API Key', type: 'password', placeholder: '' },
  ],
  'google-sheets': [
    { key: 'apiKey', label: 'Google API Key (lettura)', type: 'password', placeholder: 'AIza...' },
    { key: 'oauthToken', label: 'OAuth Token (scrittura)', type: 'password', placeholder: 'ya29...' },
    { key: 'spreadsheetId', label: 'Spreadsheet ID', type: 'text', placeholder: '1BxiMVs...' },
  ],
  'supabase': [
    { key: 'url', label: 'Supabase URL', type: 'url', placeholder: 'https://xxxxx.supabase.co' },
    { key: 'apiKey', label: 'Supabase Key', type: 'password', placeholder: 'eyJ...' },
  ],
  'slack': [
    { key: 'webhookUrl', label: 'Webhook URL', type: 'url', placeholder: 'https://hooks.slack.com/services/...' },
  ],
  'custom-rest': [
    { key: 'baseUrl', label: 'Base URL', type: 'url', placeholder: 'https://api.example.com' },
    { key: 'authType', label: 'Auth (none/bearer/basic/api-key)', type: 'text', placeholder: 'bearer' },
    { key: 'authValue', label: 'Token', type: 'password', placeholder: '' },
  ],
};

async function refreshConnectors() {
  try {
    const list = await sendMsg({ action: 'connector-list' });
    const container = $('connectorList');
    if (!container) return;
    const connectors = Array.isArray(list) ? list : (list?.connectors || []);
    container.innerHTML = connectors.map(c => `
      <div class="result-item">
        <span class="badge ${c.configured ? 'badge-ok' : 'badge-err'}">${c.configured ? '✅' : '⚪'}</span>
        <span class="url">${esc(c.name || c.id)}</span>
        <span class="stat">${c.configured ? 'configurato' : 'da configurare'}</span>
      </div>
    `).join('');
  } catch {}
}

$('connectorSelect')?.addEventListener('change', () => {
  const id = $('connectorSelect').value;
  const fields = CONNECTOR_CONFIGS[id] || [];
  const container = $('connectorConfigFields');
  if (!container) return;
  container.innerHTML = fields.map(f =>
    `<input class="input" id="conn-${f.key}" type="${f.type || 'text'}" placeholder="${esc(f.label)}: ${esc(f.placeholder)}" />`
  ).join('');
});

$('connectorSaveBtn')?.addEventListener('click', async () => {
  const id = $('connectorSelect')?.value;
  if (!id) return setStatus('connectorStatus', '❌ Seleziona un connettore', 'error');
  const fields = CONNECTOR_CONFIGS[id] || [];
  const config = {};
  for (const f of fields) {
    const el = $('conn-' + f.key);
    if (el?.value?.trim()) config[f.key] = el.value.trim();
  }
  try {
    await sendMsg({ action: 'connector-configure', connectorId: id, config });
    setStatus('connectorStatus', '✅ Connettore configurato (chiavi cifrate)', 'success');
    refreshConnectors();
    // Clear password fields
    for (const f of fields) {
      if (f.type === 'password') { const el = $('conn-' + f.key); if (el) { el.value = ''; el.placeholder = '•••• salvata'; } }
    }
  } catch (e) { setStatus('connectorStatus', '❌ ' + e.message, 'error'); }
});

$('connectorTestBtn')?.addEventListener('click', async () => {
  const id = $('connectorSelect')?.value;
  if (!id) return setStatus('connectorStatus', '❌ Seleziona un connettore', 'error');
  try {
    const result = await sendMsg({ action: 'connector-test', connectorId: id });
    setStatus('connectorStatus', result?.ok ? '✅ Connessione OK' : '❌ Test fallito', result?.ok ? 'success' : 'error');
  } catch (e) { setStatus('connectorStatus', '❌ ' + e.message, 'error'); }
});

// ============================================================
// 13. PIPELINES
// ============================================================
async function refreshPipelines() {
  try {
    const [list, templates] = await Promise.all([
      sendMsg({ action: 'pipeline-list' }),
      sendMsg({ action: 'pipeline-templates' }),
    ]);

    // Templates
    const tplContainer = $('pipelineTemplates');
    if (tplContainer && templates) {
      const tplArr = Object.entries(templates);
      tplContainer.innerHTML = tplArr.map(([id, t]) => `
        <div class="result-item" style="cursor:pointer" onclick="loadTemplate('${esc(id)}')">
          <span class="badge badge-ok">TPL</span>
          <span class="url">${esc(t.name || id)}</span>
          <span class="stat">${(t.stages || []).length} step</span>
        </div>
      `).join('') || '<div style="text-align:center;color:#444;font-size:11px;padding:8px;">Nessun template</div>';
    }

    // Saved pipelines
    const pipArr = Array.isArray(list) ? list : (list?.pipelines || []);
    const pipelineList = $('pipelineList');
    const pipelineSelect = $('pipelineSelect');

    if (pipelineList) {
      if (pipArr.length > 0) {
        hide($('pipelineEmpty'));
        pipelineList.innerHTML = pipArr.map(p => `
          <div class="result-item">
            <span class="badge badge-ok">🔄</span>
            <span class="url">${esc(p.name || p.id)}</span>
            <span class="stat">${(p.stages || []).length} step</span>
          </div>
        `).join('');
      } else {
        show($('pipelineEmpty'));
        pipelineList.innerHTML = '';
      }
    }

    // Popola select
    if (pipelineSelect) {
      const currentVal = pipelineSelect.value;
      pipelineSelect.innerHTML = '<option value="">Seleziona pipeline...</option>';
      pipArr.forEach(p => {
        pipelineSelect.innerHTML += `<option value="${esc(p.id)}">${esc(p.name || p.id)}</option>`;
      });
      // Add templates too
      if (templates) {
        Object.entries(templates).forEach(([id, t]) => {
          pipelineSelect.innerHTML += `<option value="tpl:${esc(id)}">📋 ${esc(t.name || id)}</option>`;
        });
      }
      pipelineSelect.value = currentVal;
    }
  } catch (e) {
    console.warn('refreshPipelines error:', e);
  }
}

window.loadTemplate = async (tplId) => {
  try {
    const templates = await sendMsg({ action: 'pipeline-templates' });
    const tpl = templates?.[tplId];
    if (tpl) {
      $('pipelineJson').value = JSON.stringify(tpl, null, 2);
      setStatus('pipelineStatus', `📋 Template "${tpl.name}" caricato. Modifica e salva.`, 'success');
    }
  } catch (e) { setStatus('pipelineStatus', '❌ ' + e.message, 'error'); }
};

$('pipelineRunBtn')?.addEventListener('click', async () => {
  const selected = $('pipelineSelect')?.value;
  if (!selected) return setStatus('pipelineStatus', '❌ Seleziona una pipeline', 'error');

  // Collect variables from pipelineVars fields
  const vars = {};
  $('pipelineVars')?.querySelectorAll('input')?.forEach(input => {
    if (input.name && input.value) vars[input.name] = input.value;
  });

  try {
    let result;
    if (selected.startsWith('tpl:')) {
      // Save template first, then execute
      const tplId = selected.replace('tpl:', '');
      const templates = await sendMsg({ action: 'pipeline-templates' });
      const tpl = templates?.[tplId];
      if (!tpl) throw new Error('Template non trovato');
      const saved = await sendMsg({ action: 'pipeline-save', pipeline: tpl });
      result = await sendMsg({ action: 'pipeline-execute', pipelineId: saved?.id || saved?.pipelineId, variables: vars });
    } else {
      result = await sendMsg({ action: 'pipeline-execute', pipelineId: selected, variables: vars });
    }
    setStatus('pipelineStatus', `✅ Pipeline avviata: ${esc(result?.taskId || 'ok')}`, 'success');
    refreshTasks();
  } catch (e) { setStatus('pipelineStatus', '❌ ' + e.message, 'error'); }
});

$('pipelineSaveBtn')?.addEventListener('click', async () => {
  let pipeline;
  try { pipeline = JSON.parse($('pipelineJson')?.value || '{}'); } catch { return setStatus('pipelineStatus', '❌ JSON non valido', 'error'); }
  if (!pipeline.name) return setStatus('pipelineStatus', '❌ La pipeline deve avere un "name"', 'error');

  try {
    const result = await sendMsg({ action: 'pipeline-save', pipeline });
    setStatus('pipelineStatus', `✅ Pipeline salvata: ${esc(result?.id || 'ok')}`, 'success');
    refreshPipelines();
  } catch (e) { setStatus('pipelineStatus', '❌ ' + e.message, 'error'); }
});

// ============================================================
// TAB REFRESH for new panels
// ============================================================
// (Handled by consolidated tab handler at top — just add refresh calls)
const originalTabHandler = document.querySelector('.tab[data-tab="tasks"]');
if (originalTabHandler) {
  // Tab-specific refreshes are handled in the consolidated handler
  // We just need to make sure the refreshes are available
}

// Initial load for visible sections
(async () => {
  // Defer: refresh if user navigates to these tabs
})();

// ============================================================
// 14. CANVAS AI — Visualizzazione libera
// ============================================================
let canvasHtml = '';

async function canvasAsk(prompt) {
  const btn = $('canvasAskBtn');
  const content = $('canvasContent');
  if (!btn || !content) return;

  btn.disabled = true;
  btn.textContent = '...';
  setStatus('canvasStatus', '🧠 Generando...', '');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Raccogli dati disponibili per contesto
    let contextData = '';
    try {
      const snap = await sendMsg({ action: 'agent-snapshot' });
      contextData = `\nPagina attuale: ${snap?.title || tab?.title || '?'}\nURL: ${snap?.url || tab?.url || '?'}\nBottoni: ${snap?.buttons?.length || 0}, Input: ${snap?.inputs?.length || 0}, Link: ${snap?.links?.length || 0}\nTesto principale (primi 500 char): ${(snap?.mainText || '').slice(0, 500)}`;
    } catch {}

    const response = await sendMsg({
      action: 'brain-think',
      prompt: `Genera HTML da visualizzare in un canvas dentro un'estensione Chrome.

RICHIESTA UTENTE: "${prompt}"

CONTESTO:${contextData}

REGOLE:
1. Rispondi SOLO con un JSON: {"html": "<il tuo HTML completo>", "description": "breve descrizione"}
2. L'HTML deve essere completo e autocontenuto (stili inline o <style> tag)
3. Usa colori scuri se possibile (sfondo bianco, testo scuro)
4. Puoi usare: tabelle HTML, SVG per grafici, CSS per layout
5. Per i grafici usa SVG inline o CSS bars, NON librerie esterne
6. Per le tabelle usa <table> con stili professionali
7. Rendi il contenuto responsive (max-width: 100%)
8. Se servono dati dalla pagina, usa quelli nel contesto
9. Se non hai abbastanza dati, genera dati di esempio realistici e indicalo`
    });

    let html = '';
    if (response?.html) {
      html = response.html;
    } else if (response?.raw) {
      const match = response.raw.match(/\{[\s\S]*"html"[\s\S]*\}/);
      if (match) {
        try { html = JSON.parse(match[0]).html; } catch {}
      }
      if (!html) html = `<pre style="padding:12px;font-size:12px;">${esc(response.raw)}</pre>`;
    } else {
      html = `<pre style="padding:12px;font-size:12px;">${esc(JSON.stringify(response, null, 2))}</pre>`;
    }

    canvasHtml = html;
    content.innerHTML = html;

    const desc = response?.description || 'Contenuto generato';
    const tokens = response?._tokensUsed ? ` (${response._tokensUsed} token)` : '';
    setStatus('canvasStatus', `✅ ${desc}${tokens}`, 'success');

  } catch (e) {
    setStatus('canvasStatus', '❌ ' + e.message, 'error');
  }

  btn.disabled = false;
  btn.textContent = '🎨';
}

$('canvasAskBtn')?.addEventListener('click', () => {
  const prompt = $('canvasPrompt')?.value?.trim();
  if (prompt) canvasAsk(prompt);
});

$('canvasPrompt')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') $('canvasAskBtn')?.click();
});

// Quick buttons
$('canvasTableBtn')?.addEventListener('click', async () => {
  try {
    const scrapeData = await sendMsg({ action: 'scrape' });
    canvasAsk(`Crea una tabella HTML professionale con i dati principali estratti da questa pagina. Contenuto: ${(scrapeData?.markdown || '').slice(0, 2000)}`);
  } catch {
    canvasAsk('Crea una tabella HTML di esempio con dati logistici: azienda, paese, tipo, contatto, status');
  }
});

$('canvasChartBtn')?.addEventListener('click', () => {
  canvasAsk('Crea un grafico a barre SVG con i dati disponibili dalla pagina corrente. Se non ci sono dati sufficienti, crea un grafico di esempio su volumi di spedizione per mese.');
});

$('canvasSummaryBtn')?.addEventListener('click', async () => {
  try {
    const scrapeData = await sendMsg({ action: 'scrape' });
    canvasAsk(`Crea un report HTML visuale e professionale riassumendo i punti chiave di questa pagina. Contenuto: ${(scrapeData?.markdown || '').slice(0, 2000)}`);
  } catch {
    canvasAsk('Crea un report HTML di esempio per un\'azienda logistica con sezioni: Overview, Servizi, Contatti, Prossimi passi.');
  }
});

$('canvasClearBtn')?.addEventListener('click', () => {
  const content = $('canvasContent');
  if (content) content.innerHTML = '<div style="text-align:center;color:#999;padding:40px 20px;"><div style="font-size:32px;margin-bottom:8px;">🎨</div><div>Canvas pulito. Scrivi un prompt per generare contenuti.</div></div>';
  canvasHtml = '';
  setStatus('canvasStatus', '', '');
});

$('canvasCopyBtn')?.addEventListener('click', () => {
  if (canvasHtml) {
    navigator.clipboard.writeText(canvasHtml);
    $('canvasCopyBtn').textContent = '✅ Copiato!';
    setTimeout(() => { if ($('canvasCopyBtn')) $('canvasCopyBtn').innerHTML = '📋 Copia HTML'; }, 1200);
  }
});

$('canvasDownloadBtn')?.addEventListener('click', () => {
  if (canvasHtml) {
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>FireScrape Canvas</title></head><body>${canvasHtml}</body></html>`;
    downloadFile(fullHtml, `canvas-${Date.now()}.html`, 'text/html');
  }
});

// ============================================================
// 15. COMMAND BAR — Chat AI universale
// ============================================================
$('commandBtn')?.addEventListener('click', async () => {
  const input = $('commandInput');
  const prompt = input?.value?.trim();
  if (!prompt) return;

  const btn = $('commandBtn');
  const output = $('commandOutput');
  const result = $('commandResult');

  btn.disabled = true;
  btn.textContent = '...';
  show(result);
  output.textContent = '🧠 Penso...';

  try {
    // Manda il prompt al Brain con contesto arricchito
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await sendMsg({
      action: 'brain-think',
      prompt: `L'utente ha chiesto dal command bar: "${prompt}"

CONTESTO:
- URL attivo: ${tab?.url || 'nessuno'}
- Titolo: ${tab?.title || '?'}

ISTRUZIONI:
Analizza la richiesta dell'utente e rispondi con un JSON:
{
  "response": "risposta testuale per l'utente",
  "actions": [lista di azioni da eseguire, ognuna con {action, params}],
  "pipeline": null o definizione pipeline se richiesto un workflow complesso,
  "needs_confirmation": true/false
}

Se l'utente chiede un'operazione (scraping, navigazione, export, ecc.), genera le azioni corrispondenti.
Se chiede un workflow complesso, genera una pipeline.
Se è una domanda, rispondi nel campo "response".`
    });

    // Mostra risposta
    const text = response?.response || response?.raw || JSON.stringify(response, null, 2);
    output.textContent = text;

    // Se ci sono azioni da eseguire
    if (response?.actions?.length > 0 && !response?.needs_confirmation) {
      output.textContent += '\n\n⚡ Eseguendo azioni...';
      try {
        const execResult = await sendMsg({
          action: 'agent-sequence',
          steps: response.actions,
        });
        output.textContent += execResult?.ok
          ? `\n✅ ${execResult.totalSteps} azioni completate`
          : `\n❌ Fermato: ${execResult.reason}`;
      } catch (e) {
        output.textContent += '\n❌ Errore esecuzione: ' + e.message;
      }
    }

    // Se c'è una pipeline
    if (response?.pipeline) {
      output.textContent += '\n\n🔄 Creo pipeline...';
      try {
        const saved = await sendMsg({ action: 'pipeline-save', pipeline: response.pipeline });
        const pipeId = saved?.id || saved?.pipelineId;
        if (pipeId) {
          await sendMsg({ action: 'pipeline-execute', pipelineId: pipeId, variables: {} });
          output.textContent += `\n✅ Pipeline avviata: ${pipeId}`;
        }
      } catch (e) {
        output.textContent += '\n❌ Errore pipeline: ' + e.message;
      }
    }

    // Token info
    if (response?._tokensUsed) {
      output.textContent += `\n\n📊 ${response._tokensUsed} token usati`;
    }
    if (response?._fromLibrary) {
      output.textContent += '\n📚 Risposta dalla libreria (0 token)';
    }

  } catch (e) {
    output.textContent = '❌ ' + e.message;
  }

  btn.disabled = false;
  btn.textContent = '🧠 Go';
});

$('commandInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') $('commandBtn')?.click();
});

// ============================================================
// 16. ELEVENLABS — Voice AI
// ============================================================
let elCurrentAudioBlob = null;
let elMediaRecorder = null;
let elRecordChunks = [];

// Popola lingue
(async () => {
  try {
    const { languages } = await sendMsg({ action: 'el-languages' });
    const sel = $('elLanguage');
    if (sel && languages) {
      languages.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.code;
        opt.textContent = `${l.name} (${l.code})`;
        sel.appendChild(opt);
      });
    }
  } catch {}
})();

// Carica config salvata
async function elLoadConfig() {
  try {
    const cfg = await sendMsg({ action: 'el-config-get' });
    if ($('elLanguage')) $('elLanguage').value = cfg.language || 'it';
    if ($('elModel')) $('elModel').value = cfg.defaultModel || 'eleven_multilingual_v2';
    if ($('elStability')) $('elStability').value = cfg.stability ?? 0.5;
    if ($('elSimilarity')) $('elSimilarity').value = cfg.similarityBoost ?? 0.75;
    if ($('elFormat')) $('elFormat').value = cfg.outputFormat || 'mp3_44100_128';
  } catch {}
}

// Salva config
$('elSaveConfigBtn')?.addEventListener('click', async () => {
  const config = {
    language: $('elLanguage')?.value || 'it',
    defaultModel: $('elModel')?.value || 'eleven_multilingual_v2',
    stability: parseFloat($('elStability')?.value || '0.5'),
    similarityBoost: parseFloat($('elSimilarity')?.value || '0.75'),
    outputFormat: $('elFormat')?.value || 'mp3_44100_128',
  };
  const apiKey = $('elApiKey')?.value?.trim();
  if (apiKey) config.apiKey = apiKey;

  try {
    await sendMsg({ action: 'el-config-set', config });
    setStatus('elConfigStatus', '✅ Configurazione salvata', 'success');
    if ($('elApiKey')) $('elApiKey').value = '';
  } catch (e) {
    setStatus('elConfigStatus', '❌ ' + e.message, 'error');
  }
});

// Refresh voci
async function elRefreshVoices(query) {
  const list = $('elVoiceList');
  if (!list) return;
  setStatus('elVoiceStatus', '🔄 Caricamento voci...', '');

  try {
    let voices;
    if (query) {
      voices = (await sendMsg({ action: 'el-voice-search', query })).voices;
    } else {
      voices = (await sendMsg({ action: 'el-voices', refresh: true })).voices;
    }

    if (!voices?.length) {
      list.innerHTML = '<div style="text-align:center;color:#555;padding:12px;font-size:11px;">Nessuna voce trovata. Inserisci la API key e riprova.</div>';
      setStatus('elVoiceStatus', '', '');
      return;
    }

    list.innerHTML = voices.slice(0, 50).map(v => `
      <div class="result-item" style="cursor:pointer;" data-voice-id="${esc(v.id)}">
        <span style="font-size:14px;">${v.gender === 'male' ? '👨' : v.gender === 'female' ? '👩' : '🗣'}</span>
        <span class="url" style="flex:1;">
          <b style="color:#ccc;">${esc(v.name)}</b>
          <span style="color:#555;font-size:10px;">${esc(v.language || '')} · ${esc(v.category || '')}</span>
        </span>
        <button class="btn btn-secondary btn-sm" style="width:auto;padding:3px 8px;margin:0;font-size:10px;" data-preview="${esc(v.id)}">▶</button>
        <button class="btn btn-primary btn-sm" style="width:auto;padding:3px 8px;margin:0;font-size:10px;" data-select="${esc(v.id)}" data-name="${esc(v.name)}">Usa</button>
      </div>
    `).join('');

    setStatus('elVoiceStatus', `${voices.length} voci caricate`, 'success');

    // Preview click
    list.querySelectorAll('[data-preview]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const vid = btn.dataset.preview;
        try {
          btn.textContent = '...';
          const result = await sendMsg({ action: 'el-voice-preview', voiceId: vid });
          if (result.audioUrl) {
            const audio = $('elAudio');
            if (audio) {
              audio.src = result.audioUrl;
              audio.play();
              show($('elAudioPlayer'));
            }
          }
        } catch (err) {
          setStatus('elVoiceStatus', '❌ ' + err.message, 'error');
        }
        btn.textContent = '▶';
      });
    });

    // Select voice
    list.querySelectorAll('[data-select]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const vid = btn.dataset.select;
        const vname = btn.dataset.name;
        try {
          await sendMsg({ action: 'el-config-set', config: { defaultVoiceId: vid } });
          setStatus('elVoiceStatus', `✅ Voce selezionata: ${vname}`, 'success');
          // Evidenzia
          list.querySelectorAll('.result-item').forEach(r => r.style.borderLeft = '');
          btn.closest('.result-item').style.borderLeft = '3px solid #ff6b35';
        } catch (err) {
          setStatus('elVoiceStatus', '❌ ' + err.message, 'error');
        }
      });
    });

  } catch (e) {
    setStatus('elVoiceStatus', '❌ ' + e.message, 'error');
  }
}

$('elRefreshVoicesBtn')?.addEventListener('click', () => elRefreshVoices());

let elVoiceSearchTimeout;
$('elVoiceSearch')?.addEventListener('input', (e) => {
  clearTimeout(elVoiceSearchTimeout);
  elVoiceSearchTimeout = setTimeout(() => {
    elRefreshVoices(e.target.value.trim());
  }, 300);
});

// TTS — Speak text
$('elSpeakBtn')?.addEventListener('click', async () => {
  const text = $('elTtsText')?.value?.trim();
  if (!text) return setStatus('elTtsStatus', 'Scrivi del testo', 'error');

  const btn = $('elSpeakBtn');
  btn.disabled = true;
  setStatus('elTtsStatus', '🔊 Generando audio...', '');

  try {
    const result = await sendMsg({ action: 'el-speak', text });
    if (result.audioBase64) {
      const audio = $('elAudio');
      audio.src = result.audioBase64;
      audio.play();
      show($('elAudioPlayer'));
      // Salva blob per download
      const resp = await fetch(result.audioBase64);
      elCurrentAudioBlob = await resp.blob();
      setStatus('elTtsStatus', `✅ ${result.size ? Math.round(result.size/1024) + 'KB' : 'Audio generato'}`, 'success');
    }
  } catch (e) {
    setStatus('elTtsStatus', '❌ ' + e.message, 'error');
  }
  btn.disabled = false;
});

// TTS — Speak page
$('elSpeakPageBtn')?.addEventListener('click', async () => {
  const btn = $('elSpeakPageBtn');
  btn.disabled = true;
  setStatus('elTtsStatus', '📄 Riassumo e leggo pagina...', '');

  try {
    const result = await sendMsg({ action: 'el-speak-page' });
    if (result.audioBase64) {
      const audio = $('elAudio');
      audio.src = result.audioBase64;
      audio.play();
      show($('elAudioPlayer'));
      const resp = await fetch(result.audioBase64);
      elCurrentAudioBlob = await resp.blob();
      setStatus('elTtsStatus', '✅ Lettura pagina avviata', 'success');
    }
  } catch (e) {
    setStatus('elTtsStatus', '❌ ' + e.message, 'error');
  }
  btn.disabled = false;
});

// Download audio
$('elDownloadAudioBtn')?.addEventListener('click', () => {
  if (!elCurrentAudioBlob) return;
  const url = URL.createObjectURL(elCurrentAudioBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `firescrape-voice-${Date.now()}.mp3`;
  a.click();
  URL.revokeObjectURL(url);
});

// STT — Record
$('elRecordBtn')?.addEventListener('click', async () => {
  const recordBtn = $('elRecordBtn');
  const stopBtn = $('elStopRecordBtn');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    elMediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    elRecordChunks = [];

    elMediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) elRecordChunks.push(e.data);
    };

    elMediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      recordBtn.disabled = false;
      stopBtn.disabled = true;
      setStatus('elSttStatus', '🧠 Trascrizione in corso...', '');

      const audioBlob = new Blob(elRecordChunks, { type: 'audio/webm' });

      // Converti in base64 per transport
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const result = await sendMsg({ action: 'el-transcribe', audioBase64: reader.result });
          const box = $('elTranscriptBox');
          const transcript = $('elTranscript');
          show(box);
          transcript.textContent = result.text || '(nessun testo riconosciuto)';
          setStatus('elSttStatus', `✅ Trascritto${result.language ? ' (' + result.language + ')' : ''}`, 'success');
        } catch (e) {
          setStatus('elSttStatus', '❌ ' + e.message, 'error');
        }
      };
      reader.readAsDataURL(audioBlob);
    };

    elMediaRecorder.start();
    recordBtn.disabled = true;
    stopBtn.disabled = false;
    setStatus('elSttStatus', '🎤 Registrazione...', '');

    // Auto-stop dopo 5s
    setTimeout(() => {
      if (elMediaRecorder?.state === 'recording') elMediaRecorder.stop();
    }, 5000);

  } catch (e) {
    setStatus('elSttStatus', '❌ Microfono non disponibile: ' + e.message, 'error');
  }
});

$('elStopRecordBtn')?.addEventListener('click', () => {
  if (elMediaRecorder?.state === 'recording') elMediaRecorder.stop();
});

$('elCopyTranscriptBtn')?.addEventListener('click', () => {
  copyText($('elTranscript')?.textContent || '', 'elCopyTranscriptBtn');
});

// Agenti vocali
async function elRefreshAgents() {
  const list = $('elAgentList');
  if (!list) return;

  try {
    const { agents } = await sendMsg({ action: 'el-agent-local-list' });
    if (!agents?.length) {
      list.innerHTML = '<div style="text-align:center;color:#555;padding:8px;font-size:11px;">Nessun agente configurato</div>';
      return;
    }
    list.innerHTML = agents.map(a => `
      <div class="result-item">
        <span style="font-size:14px;">🤖</span>
        <span class="url"><b style="color:#ccc;">${esc(a.name || a.id)}</b> <span style="color:#555;font-size:10px;">${esc(a.language || '')}</span></span>
        <button class="btn btn-danger btn-sm" style="width:auto;padding:3px 8px;margin:0;font-size:10px;" data-del-agent="${esc(a.id)}">🗑</button>
      </div>
    `).join('');

    list.querySelectorAll('[data-del-agent]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await sendMsg({ action: 'el-agent-local-remove', agentId: btn.dataset.delAgent });
          elRefreshAgents();
        } catch (e) {
          setStatus('elAgentStatus', '❌ ' + e.message, 'error');
        }
      });
    });
  } catch {}
}

$('elCreateAgentBtn')?.addEventListener('click', async () => {
  const name = $('elAgentName')?.value?.trim();
  if (!name) return setStatus('elAgentStatus', 'Nome richiesto', 'error');

  try {
    await sendMsg({
      action: 'el-agent-local-save',
      agent: {
        name,
        systemPrompt: $('elAgentPrompt')?.value?.trim() || '',
        firstMessage: $('elAgentFirstMsg')?.value?.trim() || 'Ciao!',
        language: $('elLanguage')?.value || 'it',
      }
    });
    setStatus('elAgentStatus', '✅ Agente creato', 'success');
    if ($('elAgentName')) $('elAgentName').value = '';
    if ($('elAgentPrompt')) $('elAgentPrompt').value = '';
    if ($('elAgentFirstMsg')) $('elAgentFirstMsg').value = '';
    elRefreshAgents();
  } catch (e) {
    setStatus('elAgentStatus', '❌ ' + e.message, 'error');
  }
});

// Usage stats
async function elRefreshStats() {
  const stats = $('elUsageStats');
  if (!stats) return;
  try {
    const s = await sendMsg({ action: 'el-stats' });
    const sub = s.subscription;
    stats.innerHTML = `
      <span class="stat">🗣 <b>${s.voicesLoaded}</b> voci</span>
      <span class="stat">🤖 <b>${s.agentsConfigured}</b> agenti</span>
      <span class="stat">🌐 <b>${esc(s.language)}</b></span>
      ${sub ? `
        <span class="stat">⭐ <b>${esc(sub.tier)}</b></span>
        <span class="stat">📊 <b>${sub.characterCount?.toLocaleString() || 0}</b> / ${sub.characterLimit?.toLocaleString() || '?'} char</span>
        <span class="stat">💎 <b>${sub.remainingCharacters?.toLocaleString() || '?'}</b> rimanenti</span>
      ` : '<span class="stat">⚠ API key non configurata</span>'}
    `;
  } catch {
    stats.innerHTML = '<span class="stat">⚠ Inserisci API key ElevenLabs</span>';
  }
}

// Tab voice refresh
// Aggancio al tab handler - quando si seleziona voice, carica dati
const originalTabClickHandler = document.querySelector('.tabs');
if (originalTabClickHandler) {
  originalTabClickHandler.addEventListener('click', (e) => {
    if (e.target.dataset?.tab === 'voice') {
      elLoadConfig();
      elRefreshAgents();
      elRefreshStats();
    }
  });
}

// ============================================================
// CLEANUP ON POPUP CLOSE
// ============================================================
window.addEventListener('unload', () => {
  crawlPollActive = false;
  if (relayPollInterval) clearInterval(relayPollInterval);
  if (dashInterval) clearInterval(dashInterval);
  if (elMediaRecorder?.state === 'recording') elMediaRecorder.stop();
});
