// ═══════════════════════════════════════════════════════════════════
// HARDCAP — APP CONTROLLER
// Bootstraps state, wires events, orchestrates rendering.
// ═══════════════════════════════════════════════════════════════════

let state;


// ─── SAMPLE PORTFOLIO (public demo) ────────────────────────────────
// A browser with no portfolio of its own starts on the fictional book in
// src/data/sample-portfolio.js (see HardcapState.seedSample). The first real
// CSV import replaces it.
function applyFirstLoadDemo(state) {
  if (state.positions.length > 0 || state.lastImport) return state;
  return window.HardcapState.seedSample(state);
}

// Names in UNIVERSE_EXPANSION are merged into a saved universe that does not
// have them yet. Nothing already in your universe is overwritten.
function migrateUniverse(state) {
  if (!window.UNIVERSE_EXPANSION) return state;
  let added = 0;
  Object.keys(window.UNIVERSE_EXPANSION).forEach(tkr => {
    if (!state.universe[tkr]) {
      state.universe[tkr] = JSON.parse(JSON.stringify(window.UNIVERSE_EXPANSION[tkr]));
      added++;
    }
  });
  if (added > 0) console.log('[Hardcap] Universe migration: added', added, 'tickers');
  return state;
}

// ─── INIT ──────────────────────────────────────────────────────────
function init() {
  state = window.HardcapState.load();
  state = migrateUniverse(state);
  state = applyFirstLoadDemo(state);
  applySavedSectorTargets(state);
  state = window.HardcapRules.ensure(state);   // pins the deployment schedule's finish month on first run
  window.HardcapState.save(state);

  // Wire each subsystem in isolation — if one throws, the others still register.
  // This was the silent-failure pattern that previously broke ic-mode buttons when
  // an earlier wireFn threw.
  const safelyWire = (label, fn) => {
    try { fn(); }
    catch (e) { console.error('[Hardcap] ' + label + ' failed:', e); }
  };
  safelyWire('wireNav',           wireNav);
  safelyWire('wireImport',        wireImport);
  safelyWire('wireDeploy',        wireDeploy);
  safelyWire('wirePlan',          wirePlan);
  safelyWire('wireUniverse',      wireUniverse);
  safelyWire('wireSettings',      wireSettings);
  safelyWire('wireChatShortcut',  wireChatShortcut);
  safelyWire('wireIC',            wireIC);

  try { refreshAll(); }
  catch (e) { console.error('[Hardcap] initial refreshAll failed:', e); }

  tickClock();
  setInterval(tickClock, 30000);
  setInterval(() => { if (window.HardcapApp?.renderLivePip) window.HardcapApp.renderLivePip(); }, 60000);
}

function wireChatShortcut() {
  document.addEventListener('keydown', (e) => {
    // ⌘K or Ctrl+K toggles chat panel
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggleChatPanel();
    }
    // Esc closes panel
    if (e.key === 'Escape') {
      const panel = document.getElementById('chat-panel');
      if (panel && panel.classList.contains('open')) closeChatPanel();
    }
  });
}

function refreshAll() {
  renderDemoBanner();
  window.HardcapRender.overview(state);
  window.HardcapRender.deploy(state);
  window.HardcapRender.risk(state);
  window.HardcapRender.holdings(state);
  window.HardcapRender.exposure(state);
  window.HardcapRender.universe(state);
  window.HardcapRender.history(state);
  window.HardcapRender.import(state);
  if (window.HardcapApp && window.HardcapApp.renderLivePip) window.HardcapApp.renderLivePip();
}

// The banner under the top bar is shown only while the sample portfolio is loaded
function renderDemoBanner() {
  const el = document.getElementById('demo-banner');
  if (el) el.style.display = state && state.seedSource === 'sample' ? '' : 'none';
}

function persist() {
  window.HardcapState.save(state);
}

// ─── NAV ───────────────────────────────────────────────────────────
function wireNav() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => {
      const target = el.dataset.target;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      el.classList.add('active');
      document.getElementById('page-' + target).classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

// ─── IMPORT (CSV upload + drag/drop) ──────────────────────────────
function wireImport() {
  const dz = document.getElementById('dropzone');
  const input = document.getElementById('csv-input');

  if (dz && input) {
    dz.addEventListener('click', () => input.click());
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
    dz.addEventListener('drop', e => {
      e.preventDefault();
      dz.classList.remove('drag');
      if (e.dataTransfer.files.length) processCSV(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', e => {
      if (e.target.files.length) processCSV(e.target.files[0]);
    });
  }

  const clearBtn = document.getElementById('btn-clear-data');
  if (clearBtn) clearBtn.addEventListener('click', window.HardcapState.clear);

  // Backup export
  const exportBtn = document.getElementById('btn-export-backup');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      window.HardcapState.exportBackup(state);
      const status = document.getElementById('backup-status');
      if (status) status.innerHTML = `<span class="gain">✓ Backup downloaded · ${new Date().toLocaleTimeString()}</span>`;
    });
  }

  // Backup import
  const importBtn = document.getElementById('btn-import-backup');
  const backupInput = document.getElementById('backup-input');
  if (importBtn && backupInput) {
    importBtn.addEventListener('click', () => backupInput.click());
    backupInput.addEventListener('change', e => {
      if (!e.target.files.length) return;
      const file = e.target.files[0];
      const status = document.getElementById('backup-status');
      const reader = new FileReader();
      reader.onload = ev => {
        const result = window.HardcapState.importBackup(ev.target.result);
        if (result.success) {
          if (!confirm('Restore from this backup? This will replace all current data.')) return;
          state = result.state;
          state = migrateUniverse(state);
          applySavedSectorTargets(state);
          state = window.HardcapRules.ensure(state);
          _deployOverride = null;
          persist();
          refreshAll();
          if (status) status.innerHTML = `<span class="gain">✓ Restored from backup (exported ${new Date(result.exportedAt).toLocaleString()})</span>`;
        } else {
          if (status) status.innerHTML = `<span class="loss">⚠ ${result.error}</span>`;
        }
      };
      reader.readAsText(file);
    });
  }
}

function processCSV(file) {
  const status = document.getElementById('import-status');
  status.innerHTML = `<span class="mute">Reading ${file.name}…</span>`;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      _lastCsvText = e.target.result;
      const parsed = window.HardcapState.parseCSV(_lastCsvText, { accounts: state.accountFilter || undefined });
      if (parsed.error) {
        status.innerHTML = `<span class="loss">⚠ ${parsed.error}</span>`;
        return;
      }
      if (parsed.positions.length === 0 && parsed.cash === 0) {
        status.innerHTML = `<span class="loss">⚠ Could not extract any positions. Make sure this is a Fidelity portfolio export.</span>`;
        return;
      }
      state = window.HardcapState.applyImport(state, parsed);
      _deployOverride = null;
      persist();
      refreshAll();
      const dateLabel = parsed.importDate || 'today';
      const skipped = (parsed.accounts || []).filter(a => (parsed.included || []).indexOf(a.key) < 0).map(a => a.name);
      const scope = (parsed.accounts || []).length > 1
        ? ` · from ${importScopeText(parsed)}${skipped.length ? ' (left out: ' + skipped.join(', ') + ')' : ''}`
        : '';
      status.innerHTML = `<span class="gain">✓ Imported ${parsed.positions.length} position${parsed.positions.length === 1 ? '' : 's'}, ${window.HardcapRender.fmtK(parsed.cash)} cash · as of ${dateLabel}${scope}</span>`;
      // Switch to deploy (was overview, but overview was merged into deploy)
      const navTarget = document.querySelector('.nav-item[data-target="deploy"]');
      if (navTarget) navTarget.click();
    } catch (err) {
      console.error('Import failed:', err);
      status.innerHTML = `<span class="loss">⚠ ${err.message}</span>`;
    }
  };
  reader.onerror = () => {
    status.innerHTML = `<span class="loss">⚠ Could not read file</span>`;
  };
  reader.readAsText(file);
}

// ─── DEPLOY ────────────────────────────────────────────────────────
function wireDeploy() {
  const input = document.getElementById('deploy-input');
  const useRule = document.getElementById('deploy-use-rule');
  const useCash = document.getElementById('deploy-use-cash');

  if (input) {
    // typing your own number overrides the rule amount until you click "Rule amount"
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      _deployOverride = isFinite(v) && v >= 0 ? v : null;
      renderPlanNow();
    });
  }
  if (useRule) {
    useRule.addEventListener('click', () => {
      _deployOverride = null;
      if (input && document.activeElement === input) input.blur();
      renderPlanNow();
    });
  }
  if (useCash) {
    useCash.addEventListener('click', () => {
      const P = window.HardcapEngine.plan(state);
      _deployOverride = Math.round(P.excess);
      if (input && document.activeElement === input) input.blur();
      renderPlanNow();
    });
  }
}

// ─── UNIVERSE ──────────────────────────────────────────────────────
function wireUniverse() {
  const btn = document.getElementById('btn-add-ticker');
  if (!btn) return;
  btn.addEventListener('click', () => {
    window.HardcapRender.openTickerEditor(null, state, (newTkr, data) => {
      state.universe[newTkr] = data;
      persist();
      refreshAll();
    });
  });
}

function editTicker(tkr) {
  window.HardcapRender.openTickerEditor(tkr, state, (newTkr, data) => {
    if (newTkr !== tkr) {
      delete state.universe[tkr];
    }
    state.universe[newTkr] = data;
    persist();
    refreshAll();
  });
}

function removeTicker(tkr) {
  if (!confirm(`Remove ${tkr} from your universe?`)) return;
  delete state.universe[tkr];
  persist();
  refreshAll();
}

// ─── SETTINGS ──────────────────────────────────────────────────────
function wireSettings() {
  const monthlyInput = document.getElementById('setting-monthly');
  if (monthlyInput) {
    monthlyInput.value = state.monthlyDeposit || 2000;
    monthlyInput.addEventListener('change', () => {
      state.monthlyDeposit = parseFloat(monthlyInput.value) || 2000;
      persist();
      refreshAll();
    });
  }

  // Anthropic API key
  const anthInput = document.getElementById('setting-anthropic-key');
  const anthSave = document.getElementById('btn-save-anthropic-key');
  const anthStatus = document.getElementById('anthropic-key-status');
  if (anthInput && anthSave) {
    // Show masked existing key
    const existing = (typeof getApiKey === 'function') ? getApiKey() : (localStorage.getItem('hardcap_api_key') || '');
    if (existing) {
      anthInput.placeholder = '•••• saved ••••';
      if (anthStatus) { anthStatus.textContent = '✓ saved'; anthStatus.style.color = 'var(--gain)'; }
    }
    anthSave.addEventListener('click', () => saveAnthropicKey());
    anthInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveAnthropicKey(); });
  }

  // Worker URL
  const wInput = document.getElementById('setting-worker-url');
  const wSave = document.getElementById('btn-save-worker-url');
  const wTest = document.getElementById('btn-test-worker-url');
  const wStatus = document.getElementById('worker-url-status');
  if (wInput) {
    const existingUrl = window.HardcapLive?.getWorkerUrl ? window.HardcapLive.getWorkerUrl() : '';
    if (existingUrl) {
      wInput.value = existingUrl;
      if (wStatus) { wStatus.textContent = '✓ saved'; wStatus.style.color = 'var(--gain)'; }
    }
    if (wSave) wSave.addEventListener('click', () => saveWorkerUrl());
    if (wTest) wTest.addEventListener('click', () => testWorkerUrl());
    wInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveWorkerUrl(); });
  }
}

function saveAnthropicKey() {
  const input = document.getElementById('setting-anthropic-key');
  const status = document.getElementById('anthropic-key-status');
  if (!input) return;
  const key = input.value.trim();
  if (!key) {
    if (status) { status.textContent = '✗ paste a key first'; status.style.color = 'var(--loss)'; }
    return;
  }
  localStorage.setItem('hardcap_api_key', key);
  input.value = '';
  input.placeholder = '•••• saved ••••';
  if (status) { status.textContent = '✓ saved'; status.style.color = 'var(--gain)'; }
}

function saveWorkerUrl() {
  const input = document.getElementById('setting-worker-url');
  const status = document.getElementById('worker-url-status');
  if (!input) return;
  const url = input.value.trim();
  if (!url) {
    if (status) { status.textContent = '✗ paste a URL first'; status.style.color = 'var(--loss)'; }
    return;
  }
  if (!/^https?:\/\/.+/.test(url)) {
    if (status) { status.textContent = '✗ must start with https://'; status.style.color = 'var(--loss)'; }
    return;
  }
  window.HardcapLive.setWorkerUrl(url);
  if (status) { status.textContent = '✓ saved'; status.style.color = 'var(--gain)'; }
  refreshAll();
}

async function testWorkerUrl() {
  const input = document.getElementById('setting-worker-url');
  const status = document.getElementById('worker-url-status');
  if (!input) return;
  const url = input.value.trim() || window.HardcapLive.getWorkerUrl();
  if (!url) {
    if (status) { status.textContent = '✗ paste a URL first'; status.style.color = 'var(--loss)'; }
    return;
  }
  // Save first so fetchQuote can use it
  if (input.value.trim()) window.HardcapLive.setWorkerUrl(url);
  if (status) { status.textContent = 'testing…'; status.style.color = 'var(--text-3)'; }
  try {
    const q = await window.HardcapLive.fetchQuote('AAPL');
    if (status) {
      status.style.color = 'var(--gain)';
      status.textContent = `✓ AAPL @ $${q.price.toFixed(2)} (${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%)`;
    }
  } catch (err) {
    if (status) {
      status.style.color = 'var(--loss)';
      status.textContent = '✗ ' + err.message;
    }
  }
}

// ─── CLOCK ─────────────────────────────────────────────────────────
function tickClock() {
  const el = document.getElementById('topbar-date');
  if (el) {
    el.textContent = new Date().toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
}

// ─── TRANSCRIPTS — MANUAL REFRESH FROM MEMO TAB ────────────────────
async function refreshTranscript(tkr) {
  if (!tkr) return;
  if (!window.HardcapTranscripts) {
    alert('Transcripts module not loaded.');
    return;
  }
  if (!window.HardcapLive?.hasWorkerUrl()) {
    alert('Set your Cloudflare Worker URL in Import → Settings first.');
    return;
  }

  // Find any "Pull transcripts" / "Refresh" button for this ticker and show spinner
  const btns = document.querySelectorAll(`button[onclick*="refreshTranscript('${tkr}')"]`);
  btns.forEach(b => { b.disabled = true; b.dataset.prevHtml = b.innerHTML; b.innerHTML = '<span class="spin"></span> Pulling…'; });

  try {
    const result = await window.HardcapTranscripts.ensureTranscripts([tkr], { force: true });
    // Re-render the holdings/memo panel so the new card shows up
    if (window.HardcapRender?.holdings) window.HardcapRender.holdings(state);
    // If a memo is already selected for this ticker, re-render its inner content too
    const selectedTkr = document.querySelector('.sidebar-row.sidebar-row-active')?.dataset?.tkr;
    if (selectedTkr && selectedTkr.toUpperCase() === tkr.toUpperCase() && window.HardcapApp?.selectMemoTicker) {
      window.HardcapApp.selectMemoTicker(selectedTkr);
    }
    // Toast-style log to console
    if (result.errors.length > 0) {
      console.warn('[Transcripts]', tkr, 'errors:', result.errors);
      alert(`Transcripts for ${tkr}: ${result.errors.map(e => e.msg).join(' / ')}`);
    } else {
      const fetched = result.fetched.find(f => f.tkr === tkr.toUpperCase());
      console.info('[Transcripts]', tkr, 'fetched', fetched?.count || 0, 'quarters');
    }
  } catch (err) {
    console.error('[Transcripts] refresh failed:', err);
    alert(`Transcript refresh failed: ${err.message}`);
  } finally {
    btns.forEach(b => {
      b.disabled = false;
      if (b.dataset.prevHtml) { b.innerHTML = b.dataset.prevHtml; delete b.dataset.prevHtml; }
    });
  }
}

// Expose for inline onclick in render.js
window.HardcapApp = {
  init, refreshAll, persist, editTicker, removeTicker,
  confirmAction, rejectAction,
  selectMemoTicker,
  toggleChatPanel, openChatPanel, closeChatPanel,
  askAboutTicker, askAboutSector, askAboutDeployment,
  handleLiveRefreshClick, renderLivePip,
  liveRefreshQuotes,
  runICAnalysis, setICMode, acceptICPick, acceptAllICPicks,
  applyICAction, dismissICAction, clearICResult,
  renderPlanNow, logPlanToJournal, refreshHoldingsData,
  hasCsvInMemory: () => !!_lastCsvText,
  saveAnthropicKey, saveWorkerUrl,
  refreshTranscript,
  getState: () => state,
};

// ═══════════════════════════════════════════════════════════════════
// DEPLOY PLAN WIRING — the rules engine's card on the Deploy tab
// ═══════════════════════════════════════════════════════════════════
let _deployOverride = null;   // a number once you type your own amount; null = use the rule
let _lastCsvText = null;      // kept in memory so accounts can be re-picked without re-dropping the file

function todayStamp() { return window.HardcapRules.todayISO(); }

let _planKeep = null;        // 'inputs' | 'rules' while a change from that panel is being applied

// refreshAll, but the panel the change came from is updated in place rather than rebuilt
function refreshAllKeeping(panel) {
  _planKeep = panel;
  try { refreshAll(); } finally { _planKeep = null; }
}

function renderPlanNow() {
  if (!window.HardcapPlanUI) return;
  const P = window.HardcapPlanUI.render(state, { amount: _deployOverride, keep: _planKeep });
  window.HardcapPlanUI.renderScorecard(state);
  syncICRunButtonAmount();
  renderICDataLine(P);
}

function onPlanInputChange(t) {
  const u = state.universe[t.dataset.tkr];
  if (!u) return;
  const f = t.dataset.f;
  if (f === 'signal') u.signal = t.value;
  else if (f === 'conviction') {
    const v = parseInt(t.value, 10);
    if (isFinite(v)) u.conviction = Math.max(0, Math.min(100, v));
    t.value = u.conviction != null ? u.conviction : '';
  }
  else if (f === 'pinned' || f === 'noBuy') { if (t.checked) u[f] = true; else delete u[f]; }
  else if (f === 'price') {
    const v = parseFloat(t.value);
    if (v > 0) u.manualPrice = { value: v, at: todayStamp() }; else delete u.manualPrice;
  }
  else if (f === 'low' || f === 'fair' || f === 'high') {
    const z = Object.assign({}, u.buyZone || {});
    const v = parseFloat(t.value);
    z[f] = v > 0 ? v : null;
    delete z.placeholder;
    delete z.sampleReview;
    // typing a complete, ordered zone counts as reviewing it today
    if (z.low > 0 && z.fair > z.low && z.high > z.fair) z.reviewed = todayStamp(); else delete z.reviewed;
    u.buyZone = z;
  }
  persist();
  refreshAllKeeping('inputs');
}

function markZoneReviewed(tkr) {
  const u = state.universe[tkr];
  if (!u) return;
  const z = u.buyZone || {};
  if (!(z.low > 0 && z.fair > z.low && z.high > z.fair)) {
    showLiveBanner(tkr + ' needs a low, a fair value and a high, in that order, before its zone can be marked as reviewed.', 'warn', 6000);
    return;
  }
  u.buyZone = { low: z.low, fair: z.fair, high: z.high, reviewed: todayStamp() };
  persist();
  refreshAllKeeping('inputs');
}

function onRuleChange(t) {
  const key = t.dataset.rule;
  let value;
  if (key === 'finishBy') { if (!/^\d{4}-\d{2}$/.test(t.value)) return; value = t.value; }
  else if (key === 'priceMode') value = t.value === 'strict' ? 'strict' : 'tilt';
  else if (key === 'newNames') value = t.value === 'conviction' ? 'conviction' : 'pinned';
  else { value = parseFloat(t.value); if (!isFinite(value) || value < 0) { t.value = window.HardcapRules.get(state)[key]; return; } }
  window.HardcapRules.set(state, key, value);
  persist();
  refreshAllKeeping('rules');
}

function onMarketChange(t) {
  const v = parseFloat(t.value);
  if (!isFinite(v) || v < 0) return;
  state.market = { ddPct: Math.min(100, Math.round(v * 10) / 10), asOf: todayStamp(), source: 'Typed in', manual: true };
  persist();
  refreshAllKeeping('rules');
}

function onBandChange(t) {
  const name = t.dataset.band;
  const T = window.SECTOR_TARGETS[name];
  if (!T) return;
  const v = Math.max(0, Math.min(100, parseFloat(t.value) || 0));
  if (t.dataset.edge === 'min') { T.min = v; if (T.max < v) T.max = v; }
  else { T.max = v; if (T.min > v) T.min = v; }
  state.sectorTargets = {};
  Object.keys(window.SECTOR_TARGETS).forEach(k => { state.sectorTargets[k] = { min: window.SECTOR_TARGETS[k].min, max: window.SECTOR_TARGETS[k].max }; });
  persist();
  refreshAllKeeping('rules');
}

// saved band edits are applied on top of the built-in bands at start-up
function applySavedSectorTargets(state) {
  const saved = state.sectorTargets;
  if (!saved) return;
  Object.keys(saved).forEach(k => {
    const T = window.SECTOR_TARGETS[k], s = saved[k];
    if (T && s && isFinite(s.min) && isFinite(s.max) && s.max >= s.min) { T.min = s.min; T.max = s.max; }
  });
}

async function refreshGauge() {
  const btn = document.getElementById('rule-gauge-refresh');
  if (!window.HardcapLive.hasWorkerUrl()) { showLiveBanner('Add your Cloudflare Worker URL in Import → Settings first.', 'warn', 6000); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Reading…'; }
  try {
    const m = await window.HardcapLive.refreshMarketGauge(state);
    persist();
    showLiveBanner('S&P 500 is ' + m.ddPct.toFixed(1) + '% below its 52-week high (SPY ' + m.price.toFixed(2) + ' vs ' + m.high52.toFixed(2) + ').', 'success', 6000);
  } catch (err) {
    showLiveBanner('Could not read the S&P 500 from the feed: ' + err.message, 'error', 9000);
  }
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  refreshAll();
}

// Quotes for everything, then fundamentals for the names that matter this month.
async function refreshHoldingsData() {
  const btn = document.getElementById('score-refresh');
  if (!window.HardcapLive.hasWorkerUrl()) { showLiveBanner('Add your Cloudflare Worker URL in Import → Settings first.', 'warn', 6000); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Refreshing…'; }
  try {
    showLiveBanner('Refreshing quotes…', 'info');
    const q = await window.HardcapLive.refreshAllQuotes(state);
    if (q.down) {
      // The feed is not answering at all: stop here instead of timing out on every name.
      showLiveBanner('The data feed did not answer: ' + ((q.errors[0] && q.errors[0].msg) || 'no reply') + '. Nothing was changed. The plan keeps using the last prices it has.', 'error', 12000);
      if (btn) { btn.disabled = false; btn.textContent = 'Refresh data'; }
      refreshAll();
      return;
    }
    if (state.market && !state.market.manual) { try { await window.HardcapLive.refreshMarketGauge(state); } catch (e) { /* gauge is optional */ } }
    const P = window.HardcapEngine.plan(state, _deployOverride != null ? { amount: _deployOverride } : {});
    const names = window.HardcapIC.focus(state, P);
    const f = await window.HardcapLive.ensureFundamentals(state, names, {
      maxAgeDays: 1,
      onProgress: (tkr, i, n) => showLiveBanner('Pulling fundamentals: ' + tkr + ' (' + i + ' of ' + n + ')…', 'info'),
    });
    persist();
    const bits = [];
    bits.push(q.updated + ' quote' + (q.updated === 1 ? '' : 's') + ' updated' + (q.failed ? ', ' + q.failed + ' failed' : ''));
    bits.push(f.fetched.length + ' name' + (f.fetched.length === 1 ? '' : 's') + ' with fresh fundamentals' + (f.skipped.length ? ', ' + f.skipped.length + ' already current' : ''));
    if (f.aborted) bits.push('fundamentals stopped early: ' + ((f.errors[0] && f.errors[0].msg) || 'the feed did not answer'));
    else if (f.errors.length) bits.push('no fundamentals for ' + f.errors.map(e => e.tkr).join(', ') + ' (' + f.errors[0].msg + ')');
    showLiveBanner(bits.join(' · ') + '.', (q.updated === 0 || f.aborted) ? 'error' : f.errors.length ? 'warn' : 'success', 12000);
  } catch (err) {
    showLiveBanner('Refresh failed: ' + err.message, 'error', 9000);
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Refresh data'; }
  refreshAll();
}

function copyBuyList(btn) {
  const text = window.HardcapPlanUI.buyListText();
  if (!text) return;
  const done = (ok) => { const prev = 'Copy buy list'; btn.textContent = ok ? 'Copied' : 'Copy failed'; setTimeout(() => { btn.textContent = prev; }, 1600); };
  try { navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); } catch (e) { done(false); }
}

function logPlanToJournal() {
  const P = window.HardcapPlanUI.lastPlan();
  if (!P || !P.buys.length) return;
  if (!confirm(`Log these ${P.buys.length} buys ($${P.spend.toLocaleString()}) to your deployment journal?\n\nThis records the decision and the reason. It does NOT place trades.`)) return;
  state.deploymentLog = state.deploymentLog || [];
  P.buys.forEach(b => {
    state.deploymentLog.push({
      date: new Date().toISOString(), ticker: b.tkr, action: b.held ? 'ADD' : 'INITIATE',
      shares: b.buyShares != null ? Math.round(b.buyShares * 1000) / 1000 : null, price: b.price, amount: b.buy,
      rationale: b.reasons.join(' · '), source: P.override ? 'Rules engine (your amount)' : 'Rules engine',
    });
  });
  if (state.deploymentLog.length > 200) state.deploymentLog = state.deploymentLog.slice(-200);
  persist();
  refreshAll();
  showLiveBanner('Logged ' + P.buys.length + ' buys to the journal (History tab). Place the orders at Fidelity.', 'success', 6000);
}

function applyAccountPick() {
  if (!_lastCsvText) return;
  const picked = Array.from(document.querySelectorAll('.acct-pick')).filter(c => c.checked).map(c => c.value);
  const status = document.getElementById('import-status');
  if (!picked.length) { if (status) status.innerHTML = '<span class="loss">⚠ Tick at least one account.</span>'; return; }
  const parsed = window.HardcapState.parseCSV(_lastCsvText, { accounts: picked });
  if (parsed.error) { if (status) status.innerHTML = `<span class="loss">⚠ ${parsed.error}</span>`; return; }
  state = window.HardcapState.applyImport(state, parsed);
  _deployOverride = null;
  persist();
  refreshAll();
  if (status) status.innerHTML = `<span class="gain">✓ Now using ${importScopeText(parsed)}: ${parsed.positions.length} position${parsed.positions.length === 1 ? '' : 's'}, ${window.HardcapRender.fmtK(parsed.cash)} cash</span>`;
}

function importScopeText(parsed) {
  const inc = (parsed.accounts || []).filter(a => (parsed.included || []).indexOf(a.key) >= 0).map(a => a.name);
  return inc.length ? inc.join(' + ') : 'the file';
}

function wirePlan() {
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t || !t.dataset) return;
    if (t.classList && t.classList.contains('pi-in') && t.dataset.tkr) return onPlanInputChange(t);
    if (t.dataset.rule) return onRuleChange(t);
    if (t.dataset.market) return onMarketChange(t);
    if (t.dataset.band) return onBandChange(t);
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest ? e.target.closest('button') : null;
    if (!b) return;
    if (b.id === 'plan-copy') copyBuyList(b);
    else if (b.id === 'plan-log') logPlanToJournal();
    else if (b.id === 'score-refresh') refreshHoldingsData();
    else if (b.id === 'rule-gauge-refresh') refreshGauge();
    else if (b.id === 'acct-apply') applyAccountPick();
    else if (b.classList.contains('pi-ok') && b.dataset.tkr) markZoneReviewed(b.dataset.tkr);
  });
}

// ═══════════════════════════════════════════════════════════════════
// INVESTMENT COMMITTEE WIRING
// ═══════════════════════════════════════════════════════════════════
let _icMode = 'fast';
let _icCurrentRun = null;   // last run, restored on load
let _icRunning = false;

function setICMode(mode) {
  _icMode = mode;
  document.querySelectorAll('.ic-tier-card').forEach(b => {
    b.classList.toggle('active', b.dataset.icMode === mode);
  });
  // Legacy class toggle kept for any old markup that might still be in DOM
  document.querySelectorAll('.ic-mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.icMode === mode);
  });
}

function getICAmount() {
  const P = window.HardcapPlanUI && window.HardcapPlanUI.lastPlan();
  return P ? Math.round(P.budget) : 0;
}

function syncICRunButtonAmount() {
  const amt = getICAmount();
  const el = document.getElementById('ic-run-amount');
  if (el) el.textContent = '$' + Math.round(amt).toLocaleString();
}

function renderICDataLine(P) {
  const line = document.getElementById('ic-data-line');
  if (!line || !P || !window.HardcapIC) return;
  try {
    const names = window.HardcapIC.focus(state, P);
    const cov = window.HardcapScore.coverage(state, names);
    line.textContent = `${names.length} names in scope · live fundamentals for ${cov.live.length} · snapshot only ${cov.snap.length} · unverified seeds ${cov.seedOnly.length} · earnings calls for ${cov.transcripts.length}`;
    ['fast', 'deep', 'forensic'].forEach(tier => {
      const el = document.getElementById('ic-est-' + tier);
      if (!el) return;
      const est = window.HardcapIC.estimate(state, P, tier);
      // the estimate allows for the data the tier pulls first; Forensic also shows its ceiling
      el.textContent = tier === 'forensic' ? '~$' + est.cost.toFixed(2) + ', $' + est.maxCost.toFixed(2) + ' at most' : '~$' + est.cost.toFixed(2);
    });
  } catch (e) { console.warn('[IC] estimate failed', e); }
}

function fmtElapsed(ms) {
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

async function runICAnalysis() {
  if (_icRunning) return;
  if (!window.HardcapClaude.hasKey()) {
    showICStatus('No Anthropic API key set. Add one in Import → Settings, then come back.', 'warn');
    return;
  }
  if (!state.positions.length && !(state.cash > 0)) {
    showICStatus('No portfolio loaded. Drop your Fidelity CSV in the Import tab first.', 'warn');
    return;
  }
  const tier = _icMode || 'fast';
  const T = window.HardcapIC.TIERS[tier];
  _icRunning = true;
  const btn = document.getElementById('ic-run-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span><span style="margin-left:8px;">Underwriting…</span>'; }
  const host = document.getElementById('ic-result');
  document.getElementById('ic-empty').style.display = 'none';
  host.style.display = 'block';
  host.innerHTML = '<div class="ic-result-block"><div class="ic-stream" id="ic-stream"></div></div>';
  const stream = document.getElementById('ic-stream');

  const started = Date.now();
  let phase = 'Starting';
  let writing = false;
  let latest = '';
  let painted = 0;
  const paint = () => {
    const waiting = !writing && /reading/.test(phase) ? ' The model thinks before it writes; the memo appears below when it starts.' : '';
    showICStatus(`${T.label} IC · ${phase} · ${fmtElapsed(Date.now() - started)} elapsed.${waiting}`, 'info');
    if (latest.length !== painted && stream) { stream.textContent = latest; painted = latest.length; stream.scrollTop = stream.scrollHeight; }
  };
  const tick = setInterval(paint, 500);
  paint();

  try {
    const run = await window.HardcapIC.runIC(state, {
      tier,
      amount: _deployOverride,
      onStatus: (m) => { phase = m.replace(/[….]+$/, ''); },
      onText: (full) => { writing = true; phase = 'Writing the memo'; latest = full; },
    });
    _icCurrentRun = run;
    window.HardcapIC.saveLast(run);
    persist();          // the run may have refreshed quotes and fundamentals
    refreshAll();
    renderICResult(run);
    hideICStatus();
  } catch (err) {
    persist();
    refreshAll();
    showICStatus('IC run failed: ' + err.message, 'error');
    if (_icCurrentRun) renderICResult(_icCurrentRun);
    else { host.style.display = 'none'; host.innerHTML = ''; document.getElementById('ic-empty').style.display = 'block'; }
  } finally {
    clearInterval(tick);
    _icRunning = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>Run IC on </span><span id="ic-run-amount" style="font-variant-numeric:tabular-nums;font-weight:700;">$0</span>';
      syncICRunButtonAmount();
    }
  }
}

function showICStatus(msg, kind) {
  const el = document.getElementById('ic-status');
  if (!el) return;
  el.style.display = 'block';
  el.textContent = msg;
  el.style.borderColor = kind === 'error' ? 'rgba(207,34,46,0.3)' :
                         kind === 'warn'  ? 'rgba(154,103,0,0.3)' :
                                            'var(--rule)';
  el.style.background = kind === 'error' ? 'rgba(207,34,46,0.06)' :
                        kind === 'warn'  ? 'rgba(154,103,0,0.06)' :
                                           'var(--surface-2)';
  el.style.color = kind === 'error' ? '#9d3838' :
                   kind === 'warn'  ? '#8a6618' :
                                      'var(--text-2)';
}
function hideICStatus() {
  const el = document.getElementById('ic-status');
  if (el) el.style.display = 'none';
}

function icActionChange(a) {
  const u = state.universe[a.params.tkr] || {};
  const p = a.params;
  const bits = [];
  if (p.newConviction != null) bits.push(`Conviction ${u.conviction != null ? u.conviction : '—'} → ${p.newConviction}`);
  if (p.newSignal) bits.push(`Signal ${u.signal || '—'} → ${p.newSignal}`);
  if (p.newBuyZone) {
    const z = u.buyZone || {};
    bits.push(`Zone ${z.low ? z.low + ' / ' + z.fair + ' / ' + z.high : 'none'} → ${p.newBuyZone.low} / ${p.newBuyZone.fair} / ${p.newBuyZone.high}`);
  }
  return bits.join('   ·   ');
}

function renderICResult(run) {
  const host = document.getElementById('ic-result');
  if (!host || !run) return;
  document.getElementById('ic-empty').style.display = 'none';

  const memoHtml = formatICMemo(run.text);
  const picks = run.picks || [];
  const actions = run.actions || [];
  const cov = run.coverage || {};
  const tierIcon = run.tier === 'forensic' ? '🔬' : run.tier === 'deep' ? '🔍' : '⚡';

  // has the plan moved since this memo was written?
  const P = window.HardcapPlanUI && window.HardcapPlanUI.lastPlan();
  const sig = (list) => list.map(x => x.tkr + ':' + x.amount).sort().join('|');
  const nowSig = P ? sig(P.buys.map(b => ({ tkr: b.tkr, amount: b.buy }))) : null;
  const moved = nowSig != null && nowSig !== sig(picks);

  const notes = [];
  if (run.truncated) notes.push('<div class="plan-note warn"><strong>The memo hit its length limit and stops early.</strong> Run it again, or use the Deep tier for a shorter one.</div>');
  (run.dataNotes || []).forEach(n => notes.push('<div class="plan-note warn">' + escapeHtml(n) + ' The memo is built on whatever data was already on hand for those names.</div>'));
  if (moved) notes.push('<div class="plan-note">Your inputs or prices have changed since this memo was written. The plan card above is current; this memo underwrites the amounts listed at the bottom.</div>');

  const actionsHtml = actions.length === 0 ? '' : `
    <div class="ic-result-block">
      <h3 style="margin-top:0;">Proposed updates to your inputs · ${actions.filter(a => a.status === 'pending').length} to review</h3>
      <p style="font-size:13px;margin-top:0;">Nothing changes until you apply it. Applying one updates the plan above straight away.</p>
      ${actions.map((a, i) => {
        const cls = a.status === 'applied' ? 'done' : a.status === 'dismissed' ? 'off' : '';
        const kind = a.status === 'applied' ? '✓ Applied' : a.status === 'dismissed' ? 'Dismissed' : (a.type === 'add_observation' ? 'Proposed note' : 'Proposed change');
        const change = a.type === 'update_quarterly_review' && a.status === 'pending' ? icActionChange(a) : '';
        return `<div class="ic-proposal ${cls}">
          <div class="ic-proposal-k">${kind} · ${escapeHtml(a.params.tkr)}</div>
          <div style="font-size:14px;color:var(--ink);font-weight:600;line-height:1.4;">${escapeHtml(a.summary || '')}</div>
          ${change ? `<div class="ic-proposal-change">${escapeHtml(change)}</div>` : ''}
          <div style="font-size:13px;color:var(--text-2);line-height:1.55;margin-top:6px;">${escapeHtml(a.params.review || a.params.note || '')}</div>
          ${a.status === 'pending' ? `<div style="display:flex;gap:8px;margin-top:10px;">
            <button class="btn sm" onclick="window.HardcapApp.applyICAction(${i})">Apply</button>
            <button class="btn ghost sm" onclick="window.HardcapApp.dismissICAction(${i})">Dismiss</button>
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>`;

  const picksTotal = picks.reduce((sum, p) => sum + (p.amount || 0), 0);
  const picksHtml = picks.length === 0
    ? '<div style="padding:12px 0;color:var(--text-3);font-size:13px;">The plan had no buys when this memo was written.</div>'
    : picks.map((p, idx) => {
        const u = state.universe[p.tkr];
        const name = u?.name || p.tkr;
        const action = (p.action || 'ADD').toUpperCase();
        return `
          <div class="ic-pick action-${action}">
            <div>
              <div class="ic-pick-tkr">${escapeHtml(p.tkr)}</div>
              <span class="ic-pick-action ${action}">${action}</span>
            </div>
            <div class="ic-pick-body">
              <div class="ic-pick-rationale">${escapeHtml(name)}</div>
              <div class="ic-pick-meta">
                ${p.atPrice ? `<span>@ $${Number(p.atPrice).toFixed(2)}</span>` : ''}
                ${p.newWeight ? `<span>→ ${escapeHtml(p.newWeight)} of book</span>` : ''}
                ${p.rationale ? `<span>${escapeHtml(p.rationale)}</span>` : ''}
              </div>
            </div>
            <div class="ic-pick-amount">
              <div class="ic-pick-amount-big">$${(p.amount || 0).toLocaleString()}</div>
              ${p.shares ? `<div class="ic-pick-amount-shares">${p.shares} sh</div>` : ''}
              <button class="btn-refresh secondary" style="margin-top:8px;font-size:11px;padding:5px 10px;" onclick="window.HardcapApp.acceptICPick(${idx})">Log it</button>
            </div>
          </div>
        `;
      }).join('');

  const covBits = [];
  if (cov.names != null) covBits.push(`${cov.names} names`);
  if (cov.live != null) covBits.push(`live fundamentals ${cov.live}`);
  if (cov.snap) covBits.push(`snapshot only ${cov.snap}`);
  if (cov.seed) covBits.push(`unverified seeds ${cov.seed}`);
  if (cov.transcripts != null) covBits.push(`earnings calls ${cov.transcripts}`);

  host.innerHTML = `
    <div class="ic-meta-row">
      <span><strong style="color:var(--ink);">${tierIcon} ${escapeHtml(run.tierLabel || run.tier)}</strong></span>
      <span>${escapeHtml(run.modelLabel || run.model || '')}</span>
      <span>~$${(run.costEstimate || 0).toFixed(2)}</span>
      ${run.elapsedMs ? `<span>${fmtElapsed(run.elapsedMs)}</span>` : ''}
      <span>${new Date(run.runAt).toLocaleString()}</span>
      ${covBits.length ? `<span>Data: ${covBits.join(' · ')}</span>` : ''}
    </div>
    ${notes.length ? '<div class="plan-notes">' + notes.join('') + '</div>' : ''}

    <div class="ic-result-block">
      ${memoHtml}
    </div>

    ${actionsHtml}

    <div class="ic-result-block" style="border-color:var(--accent-line);background:linear-gradient(180deg,var(--accent-soft) 0%,transparent 60%);">
      <h3 style="color:var(--accent);margin-top:0;">The plan this memo underwrites · ${picks.length} buy${picks.length === 1 ? '' : 's'} · amounts set by your rules</h3>
      ${picksHtml}
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--rule);font-size:12px;color:var(--text-3);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <span>Total: <strong style="color:var(--ink);">$${picksTotal.toLocaleString()}</strong></span>
        <span>Budget: <strong style="color:var(--ink);">$${(run.deployAmount || 0).toLocaleString()}</strong> (${run.budgetSource === 'override' ? 'your amount' : 'rule'})</span>
        ${run.cashAfter != null ? `<span>Cash after: <strong style="color:var(--ink);">$${run.cashAfter.toLocaleString()}</strong></span>` : ''}
      </div>
      <div class="ic-actions-row">
        ${picks.length ? '<button class="btn-refresh" onclick="window.HardcapApp.acceptAllICPicks()">Log all buys to deployment journal</button>' : ''}
        <button class="btn-refresh secondary" onclick="window.HardcapApp.runICAnalysis()">Re-run</button>
        <button class="btn-refresh secondary" onclick="window.HardcapApp.clearICResult()">Clear memo</button>
        <span style="flex:1"></span>
        <span style="font-size:11px;color:var(--text-3);">Logging records the decision; it does not place trades. Execute at Fidelity.</span>
      </div>
    </div>
  `;
  host.style.display = 'block';
}

function clearICResult() {
  _icCurrentRun = null;
  window.HardcapIC.clearLast();
  const host = document.getElementById('ic-result');
  if (host) { host.innerHTML = ''; host.style.display = 'none'; }
  document.getElementById('ic-empty').style.display = 'block';
}

function applyICAction(i) {
  if (!_icCurrentRun || !_icCurrentRun.actions) return;
  const a = _icCurrentRun.actions[i];
  if (!a || a.status !== 'pending') return;
  const result = window.HardcapChat.executeAction(state, a);
  if (!result.success) { showICStatus('Could not apply: ' + result.message, 'error'); return; }
  a.status = 'applied';
  window.HardcapIC.saveLast(_icCurrentRun);
  persist();
  refreshAll();
  renderICResult(_icCurrentRun);
}

function dismissICAction(i) {
  if (!_icCurrentRun || !_icCurrentRun.actions) return;
  const a = _icCurrentRun.actions[i];
  if (!a || a.status !== 'pending') return;
  a.status = 'dismissed';
  window.HardcapIC.saveLast(_icCurrentRun);
  renderICResult(_icCurrentRun);
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Light markdown formatter for the IC memo — headings, bold, code, bullets, numbered lists, rules
function formatICMemo(text) {
  if (!text) return '';
  let out = escapeHtml(text);
  out = out.replace(/^#{4,} (.+)$/gm, '<h3>$1</h3>');
  out = out.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  out = out.replace(/^#{1,2} (.+)$/gm, '<h2>$1</h2>');
  out = out.replace(/^\s*(?:-{3,}|\*{3,})\s*$/gm, '<hr>');
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/`([^`\n]+)`/g, '<code style="font-family:var(--mono);font-size:12px;background:var(--bg-2);padding:1px 5px;border-radius:3px;">$1</code>');
  out = out.replace(/(^[-*] .+(?:\n[-*] .+)*)/gm, (block) => {
    const items = block.split('\n').map(l => l.replace(/^[-*] /, '')).map(t => `<li>${t}</li>`).join('');
    return `<ul>${items}</ul>`;
  });
  out = out.replace(/(^\d+\. .+(?:\n\d+\. .+)*)/gm, (block) => {
    const items = block.split('\n').map(l => l.replace(/^\d+\. /, '')).map(t => `<li>${t}</li>`).join('');
    return `<ul style="list-style:decimal;">${items}</ul>`;
  });
  out = out.split(/\n{2,}/).map(para => {
    const p = para.trim();
    if (!p) return '';
    // a heading followed directly by text: keep the heading, wrap the rest
    const m = p.match(/^(<h[23]>.*?<\/h[23]>)\n([\s\S]+)$/);
    if (m) return m[1] + (/^<(ul|hr)/.test(m[2].trim()) ? m[2] : `<p>${m[2].replace(/\n/g, '<br>')}</p>`);
    if (/^<(h2|h3|ul|hr)/.test(p)) return p;
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
  return out;
}

function journalFromPick(pick, run) {
  return {
    date: new Date().toISOString(),
    ticker: pick.tkr,
    action: pick.action,
    shares: pick.shares,
    price: pick.atPrice,
    amount: pick.amount,
    rationale: pick.rationale,
    source: 'Rules engine · IC ' + (run.tierLabel || run.tier),
    runAt: run.runAt,
  };
}

function acceptICPick(idx) {
  if (!_icCurrentRun) return;
  const pick = _icCurrentRun.picks[idx];
  if (!pick) return;
  if (!confirm(`Log this buy to your deployment journal?\n\n${pick.action} ${pick.tkr} · $${pick.amount?.toLocaleString()} @ $${pick.atPrice}\n\nThis records the decision and rationale; it does NOT place a trade.`)) return;
  state.deploymentLog = state.deploymentLog || [];
  state.deploymentLog.push(journalFromPick(pick, _icCurrentRun));
  window.HardcapIC.logRun(_icCurrentRun, [pick]);
  persist();
  refreshAll();
  showICStatus(`Logged ${pick.tkr} to the deployment journal (History tab). Execute at Fidelity to actually trade.`, 'info');
  setTimeout(hideICStatus, 5000);
}

function acceptAllICPicks() {
  if (!_icCurrentRun || _icCurrentRun.picks.length === 0) return;
  if (!confirm(`Log all ${_icCurrentRun.picks.length} buys to the deployment journal?\n\nThis records the decision and rationale; it does NOT place trades.`)) return;
  state.deploymentLog = state.deploymentLog || [];
  _icCurrentRun.picks.forEach(pick => { state.deploymentLog.push(journalFromPick(pick, _icCurrentRun)); });
  window.HardcapIC.logRun(_icCurrentRun, _icCurrentRun.picks);
  persist();
  refreshAll();
  showICStatus(`Logged ${_icCurrentRun.picks.length} buys (History tab). Execute at Fidelity to actually trade.`, 'info');
  setTimeout(hideICStatus, 5000);
}

function wireIC() {
  // Event delegation on the document — survives any re-render of the IC card,
  // and immune to wire-order or "is the element in the DOM yet" timing bugs.
  document.addEventListener('click', (e) => {
    const modeBtn = e.target.closest('.ic-tier-card, .ic-mode-btn');
    if (modeBtn && modeBtn.dataset.icMode) {
      setICMode(modeBtn.dataset.icMode);
      return;
    }
    const runBtn = e.target.closest('#ic-run-btn');
    if (runBtn) {
      e.preventDefault();
      runICAnalysis();
      return;
    }
  });
  // bring back the last memo, so a reload does not throw away a run you paid for
  try {
    const last = window.HardcapIC.loadLast();
    if (last && last.text) { _icCurrentRun = last; if (last.tier) setICMode(last.tier); renderICResult(last); }
  } catch (e) { console.warn('[IC] could not restore the last run', e); }
  syncICRunButtonAmount();
}

// ═══════════════════════════════════════════════════════════════════
// LIVE DATA WIRING
// ═══════════════════════════════════════════════════════════════════

// Update the topbar pip to reflect current state
function renderLivePip() {
  const pip = document.getElementById('live-refresh-pip');
  if (!pip) return;
  const text = document.getElementById('live-pip-text');
  const time = document.getElementById('live-pip-time');
  const hasKey = window.HardcapLive && window.HardcapLive.hasKey();
  const lastQ = state?.live?.lastQuoteRefresh;

  // Reset classes
  pip.classList.remove('is-disabled', 'is-loading', 'is-fresh', 'is-stale', 'is-error');

  if (!hasKey) {
    pip.classList.add('is-disabled');
    pip.setAttribute('title', 'Set up your Cloudflare Worker URL in Import → Settings');
    if (text) text.textContent = 'Setup needed';
    if (time) time.textContent = '';
    return;
  }
  if (state?.live?.refreshing) {
    pip.classList.add('is-loading');
    if (text) text.textContent = 'Refreshing…';
    if (time) time.textContent = '';
    return;
  }
  if (state?.live?.lastError) {
    pip.classList.add('is-error');
    if (text) text.textContent = 'Refresh failed';
    if (time) time.textContent = state.live.lastError.slice(0, 32);
    pip.setAttribute('title', state.live.lastError);
    return;
  }
  if (!lastQ) {
    if (text) text.textContent = 'Refresh data';
    if (time) time.textContent = '';
    pip.setAttribute('title', 'Pull live quotes for your universe');
    return;
  }
  const ageMs = Date.now() - lastQ;
  const fresh = ageMs < 30 * 60 * 1000;        // < 30 min = fresh
  const stale = ageMs > 6 * 3600 * 1000;       // > 6 hr = stale
  pip.classList.add(stale ? 'is-stale' : (fresh ? 'is-fresh' : 'is-stale'));
  if (text) text.textContent = stale ? 'Stale data' : 'Live';
  if (time) time.textContent = relTimeShort(lastQ);
  pip.setAttribute('title', `Last refreshed ${new Date(lastQ).toLocaleString()} — click to refresh`);
}

function relTimeShort(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  return d + 'd ago';
}

// Topbar pip click — refresh quotes directly, or go to Import (settings) if not configured
function handleLiveRefreshClick() {
  if (!window.HardcapLive.hasWorkerUrl()) {
    // Send to Import tab where Settings + Worker URL config now live
    const navItem = document.querySelector('.nav-item[data-target="import"]');
    if (navItem) navItem.click();
    setTimeout(() => {
      const input = document.getElementById('setting-worker-url');
      if (input) {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus();
      }
    }, 200);
    return;
  }
  liveRefreshQuotes();
}

// Refresh quotes for entire universe
async function liveRefreshQuotes() {
  if (!window.HardcapLive.hasKey()) {
    showLiveBanner('Add your Cloudflare Worker URL first.', 'warn');
    return;
  }
  state.live = state.live || {};
  state.live.refreshing = true;
  state.live.lastError = null;
  renderLivePip();
  setLiveButtonsBusy(true);
  showLiveBanner('Refreshing quotes for all universe tickers…', 'info');
  try {
    const result = await window.HardcapLive.refreshAllQuotes(state);
    if (result.updated > 0 && !(state.market && state.market.manual)) {
      try { await window.HardcapLive.refreshMarketGauge(state); } catch (e) { console.warn('[Hardcap] S&P gauge not refreshed:', e.message); }
    }
    state.live.refreshing = false;
    if (result.updated === 0 && result.failed > 0) {
      state.live.lastError = result.errors[0]?.msg || 'All quote requests failed';
      showLiveBanner(`Refresh failed: ${state.live.lastError}`, 'error');
    } else if (result.failed > 0) {
      showLiveBanner(`Updated ${result.updated} tickers, ${result.failed} failed. Common cause on free tier: rate limits.`, 'warn');
    } else {
      showLiveBanner(`Refreshed ${result.updated} live quotes successfully.`, 'success', 4000);
    }
    persist();
    refreshAll();
  } catch (err) {
    state.live.refreshing = false;
    state.live.lastError = err.message;
    showLiveBanner('Refresh failed: ' + err.message, 'error');
    renderLivePip();
  }
  setLiveButtonsBusy(false);
}

// Refresh fundamentals — slower, free tier may struggle, ask first
async function liveRefreshFundamentals() {
  if (!window.HardcapLive.hasKey()) {
    showLiveBanner('Add your Cloudflare Worker URL first.', 'warn');
    return;
  }
  const tickers = Object.keys(state.universe || {});
  const planNote = window.HardcapLive.getPlan() === 'free'
    ? '\n\nNote: Fundamentals on the free tier costs ~10 calls per ticker. With 22 tickers, this may exceed the daily limit. Consider upgrading to All-In-One (€19.99/mo) for unlimited access.'
    : '';
  if (!confirm(`Refresh fundamentals for ${tickers.length} tickers?\n\nThis pulls P/E, FCF yield, ROE, margins, and debt/EBITDA from EODHD and overwrites the seed values.${planNote}`)) {
    return;
  }
  state.live = state.live || {};
  state.live.refreshing = true;
  renderLivePip();
  setLiveButtonsBusy(true);
  showLiveBanner('Refreshing fundamentals — this takes ~30 seconds…', 'info');
  try {
    const result = await window.HardcapLive.refreshFundamentals(state);
    state.live.refreshing = false;
    if (result.failed > 0) {
      showLiveBanner(`Updated fundamentals for ${result.updated} tickers, ${result.failed} failed.`, 'warn');
    } else {
      showLiveBanner(`Refreshed fundamentals for ${result.updated} tickers.`, 'success', 4000);
    }
    persist();
    refreshAll();
  } catch (err) {
    state.live.refreshing = false;
    showLiveBanner('Fundamentals refresh failed: ' + err.message, 'error');
    renderLivePip();
  }
  setLiveButtonsBusy(false);
}

async function liveRefreshEarnings() {
  if (!window.HardcapLive.hasKey()) {
    showLiveBanner('Add your Cloudflare Worker URL first.', 'warn');
    return;
  }
  state.live = state.live || {};
  state.live.refreshing = true;
  renderLivePip();
  setLiveButtonsBusy(true);
  showLiveBanner('Pulling earnings calendar…', 'info');
  try {
    const result = await window.HardcapLive.refreshEarnings(state);
    state.live.refreshing = false;
    if (result.errors.length > 0 && result.updated === 0) {
      showLiveBanner('Earnings calendar failed: ' + result.errors[0].msg, 'error');
    } else {
      showLiveBanner(`Loaded earnings for ${result.updated} tickers over the next 90 days.`, 'success', 4000);
    }
    persist();
    refreshAll();
  } catch (err) {
    state.live.refreshing = false;
    showLiveBanner('Earnings calendar failed: ' + err.message, 'error');
    renderLivePip();
  }
  setLiveButtonsBusy(false);
}

function setLiveButtonsBusy(busy) {
  ['live-refresh-quotes-btn', 'live-refresh-fundamentals-btn', 'live-refresh-earnings-btn'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.disabled = busy;
  });
}

function showLiveBanner(msg, kind, autoHideMs) {
  const b = document.getElementById('live-banner');
  if (!b) return;
  b.className = 'live-banner show ' + (kind || '');
  b.textContent = msg;
  if (autoHideMs) {
    setTimeout(() => { b.className = 'live-banner ' + (kind || ''); }, autoHideMs);
  }
}

// API key / worker URL handlers
function liveSaveKey() {
  const input = document.getElementById('live-key-input');
  if (!input) return;
  const url = input.value.trim();
  if (!url) {
    showLiveBanner('Paste your Cloudflare Worker URL in the field first.', 'warn');
    return;
  }
  // Lightweight validation
  if (!/^https?:\/\/.+/.test(url)) {
    showLiveBanner('That doesn\'t look like a URL. It should start with https://', 'warn');
    return;
  }
  window.HardcapLive.setWorkerUrl(url);
  input.value = '';
  showLiveBanner('Worker URL saved. Click "Quotes (all 22)" to pull live data, or "Test" to verify the connection.', 'success', 5000);
  refreshAll();
}

function liveClearKey() {
  if (!confirm('Remove your Cloudflare Worker URL from this browser?')) return;
  window.HardcapLive.setWorkerUrl('');
  showLiveBanner('Worker URL removed.', 'info', 3000);
  refreshAll();
}

async function liveTestKey() {
  if (!window.HardcapLive.hasWorkerUrl()) {
    const input = document.getElementById('live-key-input');
    if (input?.value.trim()) {
      window.HardcapLive.setWorkerUrl(input.value.trim());
      input.value = '';
    } else {
      showLiveBanner('Paste your worker URL in the field first.', 'warn');
      return;
    }
  }
  const msgEl = document.getElementById('live-key-msg');
  if (msgEl) { msgEl.textContent = 'Testing connection…'; msgEl.style.color = 'var(--text-3)'; }
  try {
    const q = await window.HardcapLive.fetchQuote('AAPL');
    if (msgEl) {
      msgEl.style.color = 'var(--gain)';
      msgEl.textContent = `✓ Connected. Test pull: AAPL @ $${q.price.toFixed(2)} (${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%)`;
    }
  } catch (err) {
    if (msgEl) {
      msgEl.style.color = 'var(--loss)';
      msgEl.textContent = '✗ ' + err.message;
    }
  }
  refreshAll();
}

// Wire up Live Data page buttons after DOM loads (called from init)
function wireLiveData() {
  const map = [
    ['live-refresh-quotes-btn', liveRefreshQuotes],
    ['live-refresh-fundamentals-btn', liveRefreshFundamentals],
    ['live-refresh-earnings-btn', liveRefreshEarnings],
    ['live-key-save', liveSaveKey],
    ['live-key-clear', liveClearKey],
    ['live-key-test', liveTestKey],
  ];
  map.forEach(([id, fn]) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  });
  // Enter key in API key field saves
  const input = document.getElementById('live-key-input');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') liveSaveKey();
    });
  }
}

// ─── CHAT PANEL (slide-out from topbar) ─────────────────────────
let _chatPanelInitialized = false;

function toggleChatPanel() {
  const panel = document.getElementById('chat-panel');
  if (panel.classList.contains('open')) closeChatPanel();
  else openChatPanel();
}

function openChatPanel() {
  const panel = document.getElementById('chat-panel');
  const backdrop = document.getElementById('chat-panel-backdrop');
  panel.classList.add('open');
  backdrop.classList.add('open');

  // Render the chat into its host (idempotent)
  if (typeof renderChat === 'function') {
    renderChat(state);
  }
  const chatHost = document.getElementById('chat-host');
  if (chatHost) {
    chatHost.style.height = 'calc(100vh - 80px)';
    chatHost.style.display = 'flex';
    chatHost.style.flexDirection = 'column';
  }

  // Focus the input after the slide-in animation
  setTimeout(() => {
    const input = document.getElementById('chat-input');
    if (input && !input.disabled) input.focus();
  }, 300);
}

function closeChatPanel() {
  document.getElementById('chat-panel').classList.remove('open');
  document.getElementById('chat-panel-backdrop').classList.remove('open');
}

// Removed - using openChatPanel directly now

function askAboutTicker(tkr) {
  openChatPanel();
  setTimeout(() => {
    const input = document.getElementById('chat-input');
    if (input) {
      const u = state.universe[tkr];
      const name = u?.name || tkr;
      input.value = `Tell me about ${tkr} (${name}) — current thesis, recent observations, what to watch.`;
      input.focus();
    }
  }, 350);
}

function askAboutSector(sector) {
  openChatPanel();
  setTimeout(() => {
    const input = document.getElementById('chat-input');
    if (input) {
      input.value = `What's the best path to fix my ${sector} allocation? Which names should I prioritize and why?`;
      input.focus();
    }
  }, 350);
}

function askAboutDeployment(amount) {
  openChatPanel();
  setTimeout(() => {
    const input = document.getElementById('chat-input');
    if (input) {
      input.value = amount
        ? `If I deploy $${amount.toLocaleString()} this month, what's the healthiest allocation given my current portfolio?`
        : `Walk me through the current deployment recommendation — why these picks, why these sizes?`;
      input.focus();
    }
  }, 350);
}

// Sidebar row click handler — switches the memo panel content without re-rendering the whole page.
// Updates the sidebar active state too.
function selectMemoTicker(tkr) {
  if (!tkr) return;
  window._hardcapSelectedTicker = tkr;

  // Update memo panel only
  const verdicts = window.HardcapDeployment.verdict(state);
  const heldTkrs = new Set(verdicts.map(v => v.tkr));
  let entry;
  if (heldTkrs.has(tkr)) {
    entry = verdicts.find(v => v.tkr === tkr);
  } else {
    const u = state.universe[tkr];
    if (!u) return;
    entry = {
      tkr,
      universeName: u.name || tkr,
      sectorAssigned: u.sector || 'Other',
      conviction: u.conviction,
      signal: u.signal,
      buyZone: u.buyZone,
      shares: 0, price: u.buyZone?.fair || null, cost: 0, value: 0, weight: 0, gl: 0, glPct: 0,
      verdict: 'WATCHLIST',
      rationale: [],
      zoneStatus: u.buyZone ? window.HardcapAnalytics.buyZoneStatus(u.buyZone.fair, u.buyZone) : null,
    };
  }
  const memoPanel = document.getElementById('memo-panel');
  if (memoPanel) {
    memoPanel.innerHTML = window.HardcapRender.buildMemoCard
      ? window.HardcapRender.buildMemoCard(entry, state, heldTkrs.has(tkr))
      : '';
    memoPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Update sidebar active state
  document.querySelectorAll('.sidebar-row').forEach(row => {
    if (row.dataset.tkr === tkr) {
      row.classList.add('sidebar-row-active');
      row.style.background = 'var(--bg-2)';
    } else {
      row.classList.remove('sidebar-row-active');
      row.style.background = '';
    }
  });
}

function confirmAction(messageIdx, actionIdx) {
  const chat = window.HardcapChat.loadChat();
  const msg = chat.messages[messageIdx];
  if (!msg || !msg.actions || !msg.actions[actionIdx]) return;
  const action = msg.actions[actionIdx];
  if (action.status !== 'pending') return;

  const result = window.HardcapChat.executeAction(state, action);
  msg.actions[actionIdx] = {
    ...action,
    status: result.success ? 'confirmed' : 'pending',
    result: result.message,
  };

  if (result.success) {
    persist();
    refreshAll();
  } else {
    // Show error inline without changing state
    alert('Action failed: ' + result.message);
  }
  window.HardcapChat.saveChat(chat);
  // Re-render only the chat to reflect status change
  if (window.HardcapRender && window.HardcapRender.chat) {
    document.getElementById('chat-host').innerHTML = '';
    window.HardcapRender.chat(state);
  }
}

function rejectAction(messageIdx, actionIdx) {
  const chat = window.HardcapChat.loadChat();
  const msg = chat.messages[messageIdx];
  if (!msg || !msg.actions || !msg.actions[actionIdx]) return;
  msg.actions[actionIdx] = { ...msg.actions[actionIdx], status: 'rejected' };
  window.HardcapChat.saveChat(chat);
  document.getElementById('chat-host').innerHTML = '';
  window.HardcapRender.chat(state);
}

// Boot
document.addEventListener('DOMContentLoaded', init);
