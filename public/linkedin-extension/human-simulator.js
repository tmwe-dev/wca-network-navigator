// ══════════════════════════════════════════════════════════════
// LinkedIn Extension — Human Simulator (v3.9.57-human-sim)
// Hardcoded rules approvate dall'operatore:
//   - Routing: SEMPRE arrivo diretto al profilo + scroll/pause umane
//   - Digitazione: 1 invio su 3 char-by-char (typing), 2/3 paste classico
//   - Cooldown/limiti: 25-30 invii/giorno per account, pausa 3-7 min
//     ogni 5-8 invii consecutivi, jitter 45±20s tra invii
//
// Layer puramente ADDITIVO. Non tocca dedup, writer principale, fallback
// CDP, autoclose. Se qualcosa fallisce, l'invio prosegue come prima.
// ══════════════════════════════════════════════════════════════

var HumanSimulator = globalThis.HumanSimulator || (function () {
  // ── REGOLE HARDCODED ──
  const RULES = {
    // Profile dwell + scroll
    initialDwellMs:       [1500, 4000],
    scrollProbability:    0.70,           // 70% fa almeno 1 scroll
    scrollDownPx:         [300, 800],
    scrollPauseMs:        [800, 1800],
    secondScrollProbability: 0.20,
    // Typing
    typingProbability:    1 / 3,          // 1 su 3 invii è char-by-char
    typingDelayMs:        [30, 90],       // ms tra tasti
    typingPauseAfterPunctuation: [120, 280],
    typoProbability:      0.05,           // 5% chance per parola: typo+backspace
    // Pre-write dwell
    preWriteDwellMs:      [800, 1800],
    preSendReadDwellMs:   [600, 1500],
    // Post-send choreography
    postSendFeedScrollProbability: 0.30,
    postSendDwellMs:      [400, 1200],
    // Rate limits
    dailyMaxSends:        [25, 30],       // cap deciso a inizio giornata (jitter)
    burstSize:            [5, 8],         // dopo N invii → pausa lunga
    burstPauseMs:         [180000, 420000], // 3-7 minuti
    interSendCooldownMs:  [25000, 65000],   // 45±20s tra invii
  };

  const STORAGE_KEY = "humanSimState_v1";

  function rand(min, max)         { return Math.random() * (max - min) + min; }
  function randInt(min, max)      { return Math.floor(rand(min, max + 1)); }
  function pickRange(rangeArr)    { return Math.floor(rand(rangeArr[0], rangeArr[1])); }
  function chance(p)              { return Math.random() < p; }
  function sleep(ms)              { return new Promise(r => setTimeout(r, ms)); }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  async function loadState() {
    try {
      const obj = await chrome.storage.local.get(STORAGE_KEY);
      return obj[STORAGE_KEY] || {};
    } catch (e) { return {}; }
  }
  async function saveState(s) {
    try { await chrome.storage.local.set({ [STORAGE_KEY]: s }); } catch (e) {}
  }

  // ── RATE LIMIT GATE ──
  // Ritorna { allowed:true, waitMs:n } o { allowed:false, reason, sentToday, dailyCap }
  async function checkRateLimit() {
    const s = await loadState();
    const dk = todayKey();
    if (s.day !== dk) {
      // Nuovo giorno: reset + nuovo cap jitterato
      const newCap = randInt(RULES.dailyMaxSends[0], RULES.dailyMaxSends[1]);
      const newBurst = randInt(RULES.burstSize[0], RULES.burstSize[1]);
      const reset = { day: dk, sentToday: 0, dailyCap: newCap, burstSize: newBurst, sinceBurst: 0, lastSendAt: 0 };
      await saveState(reset);
      return { allowed: true, waitMs: 0, sentToday: 0, dailyCap: newCap };
    }
    if (s.sentToday >= s.dailyCap) {
      return { allowed: false, reason: "daily_cap_reached", sentToday: s.sentToday, dailyCap: s.dailyCap };
    }
    let waitMs = 0;
    const now = Date.now();
    // Burst pause?
    if ((s.sinceBurst || 0) >= (s.burstSize || 5)) {
      const burstWait = pickRange(RULES.burstPauseMs);
      const elapsed = now - (s.lastSendAt || 0);
      if (elapsed < burstWait) waitMs = Math.max(waitMs, burstWait - elapsed);
    }
    // Inter-send cooldown
    const interCool = pickRange(RULES.interSendCooldownMs);
    const sinceLast = now - (s.lastSendAt || 0);
    if (s.lastSendAt && sinceLast < interCool) {
      waitMs = Math.max(waitMs, interCool - sinceLast);
    }
    return { allowed: true, waitMs, sentToday: s.sentToday, dailyCap: s.dailyCap };
  }

  async function recordSend() {
    const s = await loadState();
    const dk = todayKey();
    if (s.day !== dk) {
      const newCap = randInt(RULES.dailyMaxSends[0], RULES.dailyMaxSends[1]);
      const newBurst = randInt(RULES.burstSize[0], RULES.burstSize[1]);
      await saveState({ day: dk, sentToday: 1, dailyCap: newCap, burstSize: newBurst, sinceBurst: 1, lastSendAt: Date.now() });
      return;
    }
    s.sentToday = (s.sentToday || 0) + 1;
    s.sinceBurst = (s.sinceBurst || 0) + 1;
    s.lastSendAt = Date.now();
    if (s.sinceBurst >= (s.burstSize || 5)) {
      // Reset burst counter + nuovo target burst
      s.sinceBurst = 0;
      s.burstSize = randInt(RULES.burstSize[0], RULES.burstSize[1]);
    }
    await saveState(s);
  }

  async function getStats() {
    const s = await loadState();
    return {
      day: s.day || todayKey(),
      sentToday: s.sentToday || 0,
      dailyCap: s.dailyCap || null,
      sinceBurst: s.sinceBurst || 0,
      burstSize: s.burstSize || null,
      lastSendAt: s.lastSendAt || 0,
    };
  }

  // ── PROFILE CHOREOGRAPHY (scroll + dwell) ──
  async function profileChoreography(tabId) {
    const steps = [];
    try {
      const initial = pickRange(RULES.initialDwellMs);
      steps.push({ step: "initial_dwell", ms: initial });
      await sleep(initial);
      if (!chance(RULES.scrollProbability)) {
        return { ok: true, steps, scrolled: false };
      }
      const scrollPx = pickRange(RULES.scrollDownPx);
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (px) => { try { window.scrollBy({ top: px, behavior: "smooth" }); } catch (e) {} },
        args: [scrollPx],
      });
      steps.push({ step: "scroll_down", px: scrollPx });
      const pause1 = pickRange(RULES.scrollPauseMs);
      await sleep(pause1);
      // Scroll back up (più umano del solo down)
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (px) => { try { window.scrollBy({ top: -px, behavior: "smooth" }); } catch (e) {} },
        args: [Math.floor(scrollPx * 0.7)],
      });
      steps.push({ step: "scroll_up", px: Math.floor(scrollPx * 0.7) });
      await sleep(pickRange(RULES.scrollPauseMs));
      if (chance(RULES.secondScrollProbability)) {
        const px2 = pickRange(RULES.scrollDownPx);
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (px) => { try { window.scrollBy({ top: px, behavior: "smooth" }); } catch (e) {} },
          args: [px2],
        });
        steps.push({ step: "scroll_down_2", px: px2 });
        await sleep(pickRange(RULES.scrollPauseMs));
      }
      return { ok: true, steps, scrolled: true };
    } catch (e) {
      return { ok: false, steps, error: String(e && e.message || e) };
    }
  }

  // ── PRE-WRITE DWELL ──
  async function preWriteDwell() {
    const ms = pickRange(RULES.preWriteDwellMs);
    await sleep(ms);
    return ms;
  }

  // ── PRE-SEND READ (rileggo prima di inviare) ──
  async function preSendReadDwell() {
    const ms = pickRange(RULES.preSendReadDwellMs);
    await sleep(ms);
    return ms;
  }

  // ── DECIDI DIGITAZIONE ──
  function shouldTypeChars() { return chance(RULES.typingProbability); }

  // ── TYPING CHAR-BY-CHAR nel composer ──
  // Pre-fill il composer con digitazione umana. Il writer di hybrid-ops
  // vedrà hasText()===true e salterà la propria scrittura (early-exit).
  async function typeIntoComposer(tabId, text) {
    if (!text) return { ok: false, error: "empty_text" };
    const params = {
      text,
      delayMin: RULES.typingDelayMs[0],
      delayMax: RULES.typingDelayMs[1],
      pausePunctMin: RULES.typingPauseAfterPunctuation[0],
      pausePunctMax: RULES.typingPauseAfterPunctuation[1],
      typoProb: RULES.typoProbability,
    };
    try {
      const res = await chrome.scripting.executeScript({
        target: { tabId },
        func: async function (P) {
          function rnd(a, b) { return Math.random() * (b - a) + a; }
          function pause(ms) { return new Promise(r => setTimeout(r, ms)); }
          // Trova composer textbox visibile
          function findBox() {
            var scopes = document.querySelectorAll(
              ".msg-form, [class*='msg-form'], .msg-overlay-conversation-bubble, [class*='msg-overlay-conversation'], [role='dialog']"
            );
            for (var i = 0; i < scopes.length; i++) {
              var sc = scopes[i];
              if (!(sc.offsetParent !== null || sc.getClientRects().length > 0)) continue;
              var box = sc.querySelector("[contenteditable='true'], div[role='textbox'], [role='textbox']");
              if (box) return box;
            }
            return null;
          }
          var box = findBox();
          if (!box) return { ok: false, error: "composer_not_found" };
          try { box.focus(); } catch (e) {}
          // Clear esistente
          try {
            var r = document.createRange();
            r.selectNodeContents(box);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(r);
            document.execCommand("delete", false);
          } catch (e) {}
          function insertChar(ch) {
            try {
              var ev = new InputEvent("beforeinput", { inputType: "insertText", data: ch, bubbles: true, cancelable: true });
              var ok = box.dispatchEvent(ev);
              if (ok) {
                try { document.execCommand("insertText", false, ch); } catch (e) {}
              } else {
                document.execCommand("insertText", false, ch);
              }
              box.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: ch, bubbles: true, composed: true }));
            } catch (e) {}
          }
          function deleteOne() {
            try { document.execCommand("delete", false); box.dispatchEvent(new InputEvent("input", { inputType: "deleteContentBackward", bubbles: true, composed: true })); } catch (e) {}
          }
          var typed = 0, typos = 0;
          for (var i = 0; i < P.text.length; i++) {
            var ch = P.text.charAt(i);
            // Occasionale typo + correzione (solo su lettere, non spazi/punteggiatura)
            if (Math.random() < P.typoProb && /[a-zA-Z]/.test(ch)) {
              var fakeCh = String.fromCharCode(ch.charCodeAt(0) + (Math.random() < 0.5 ? 1 : -1));
              insertChar(fakeCh);
              await pause(rnd(P.delayMin, P.delayMax));
              await pause(rnd(150, 320)); // accorgersi
              deleteOne();
              await pause(rnd(60, 140));
              typos++;
            }
            insertChar(ch);
            typed++;
            // Pausa post char
            if (/[.,;:!?]/.test(ch)) {
              await pause(rnd(P.pausePunctMin, P.pausePunctMax));
            } else if (ch === " ") {
              await pause(rnd(P.delayMin, P.delayMax) + rnd(0, 40));
            } else {
              await pause(rnd(P.delayMin, P.delayMax));
            }
          }
          // Validazione finale
          try { box.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {}
          var tc = (box.textContent || "");
          var match = (tc.indexOf(P.text) !== -1) || (tc.trim() === P.text.trim());
          return { ok: true, typed, typos, match, finalLen: tc.length };
        },
        args: [params],
      });
      const r = (res && res[0] && res[0].result) || { ok: false, error: "no_result" };
      return r;
    } catch (e) {
      return { ok: false, error: String(e && e.message || e) };
    }
  }

  // ── POST-SEND CHOREOGRAPHY (dwell breve + eventuale scroll feed) ──
  async function postSendChoreography(tabId) {
    try {
      const dwell = pickRange(RULES.postSendDwellMs);
      await sleep(dwell);
      if (chance(RULES.postSendFeedScrollProbability)) {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: () => { try { window.scrollBy({ top: 200 + Math.floor(Math.random() * 400), behavior: "smooth" }); } catch (e) {} },
        });
        await sleep(pickRange([600, 1400]));
      }
      return { ok: true, dwellMs: dwell };
    } catch (e) {
      return { ok: false, error: String(e && e.message || e) };
    }
  }

  return {
    RULES,
    checkRateLimit,
    recordSend,
    getStats,
    profileChoreography,
    preWriteDwell,
    preSendReadDwell,
    shouldTypeChars,
    typeIntoComposer,
    postSendChoreography,
    sleep,
  };
})();