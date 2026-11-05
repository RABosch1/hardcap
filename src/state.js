// ═══════════════════════════════════════════════════════════════════
// HARDCAP — STATE MANAGEMENT
// localStorage persistence + Fidelity CSV parsing.
// All data stays in your browser. Nothing is sent anywhere.
// ═══════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'hardcap_v1';

// ─── DEFAULT STATE ─────────────────────────────────────────────────
const DEFAULT_STATE = {
  positions: [],
  cash: 0,
  pendingActivity: 0,
  lastImport: null,
  importDate: null,
  history: [],          // [{ date, totalValue, equityValue, cash, positions: [...] }]
  universe: {},         // editable copy of UNIVERSE_SEED
  monthlyDeposit: 2000,  // rough figure for projections only; the deploy engine works from actual cash
  rules: null,          // deploy-engine rules — see HardcapRules.DEFAULTS
  market: null,         // { ddPct, asOf, source } — S&P 500 distance below its 52-week high
  accountFilter: null,  // account keys to include on CSV import (null = decide on first import)
  importAccounts: null, // what the last CSV contained: { all: [...], included: [...] }
  sectorTargets: null,  // your edits to the sector bands, if any
  notes: '',
  deploymentLog: [],    // [{ date, ticker, action, shares, price, rationale }]
  live: {               // live data layer state — see HardcapLive
    lastQuoteRefresh: null,
    lastFundamentalsRefresh: null,
    lastEarningsRefresh: null,
    lastQuoteResult: null,
    refreshing: false,
    lastError: null,
  },
};

// ─── LOAD / SAVE ───────────────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initState();
    const parsed = JSON.parse(raw);
    // Merge universe seed with stored universe (so new seed entries appear)
    const merged = { ...DEFAULT_STATE, ...parsed };
    merged.universe = { ...window.UNIVERSE_SEED, ...(parsed.universe || {}) };
    // Ensure live layer is present even on old saves
    merged.live = { ...DEFAULT_STATE.live, ...(parsed.live || {}) };
    // Reset transient flags on load — refreshing should never persist
    merged.live.refreshing = false;
    return merged;
  } catch (e) {
    console.warn('State load failed, resetting:', e);
    return initState();
  }
}

function initState() {
  const s = JSON.parse(JSON.stringify(DEFAULT_STATE));
  s.universe = JSON.parse(JSON.stringify(window.UNIVERSE_SEED));
  return s;
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('Save failed:', e);
    return false;
  }
}

function clearState() {
  if (confirm('Clear ALL data including history? This cannot be undone.')) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
}

// ─── EXPORT / IMPORT BACKUP ────────────────────────────────────────
// JSON snapshot of everything: positions, cash, history, universe, edits.
// Saves to a downloadable file. Restorable on any browser/machine.
function exportBackup(state) {
  const payload = {
    version: 'hardcap_v1',
    exportedAt: new Date().toISOString(),
    state: state,
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `hardcap-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

function importBackup(jsonText) {
  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed.state) throw new Error('Invalid backup file — no state object');
    if (parsed.version !== 'hardcap_v1') {
      console.warn('Backup version mismatch:', parsed.version);
    }
    const restored = parsed.state;
    // Re-merge universe seed in case new tickers were added
    restored.universe = { ...window.UNIVERSE_SEED, ...(restored.universe || {}) };
    return { success: true, state: restored, exportedAt: parsed.exportedAt };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── HISTORY SNAPSHOT ──────────────────────────────────────────────
function snapshotPortfolio(state) {
  const equity = state.positions.reduce((a, p) => a + p.shares * p.price, 0);
  const snap = {
    date: new Date().toISOString().slice(0, 10),
    totalValue: equity + state.cash,
    equityValue: equity,
    cash: state.cash,
    positionCount: state.positions.length,
    positions: state.positions.map(p => ({
      tkr: p.tkr, shares: p.shares, price: p.price,
      value: p.shares * p.price, cost: p.cost,
    })),
    // which accounts this snapshot covers, so a change of scope is not read as performance
    scope: state.importAccounts && state.importAccounts.all
      ? state.importAccounts.all.filter(a => (state.importAccounts.included || []).indexOf(a.key) >= 0).map(a => a.name || a.key).join(' + ')
      : (state.accountScope || null),
  };
  // dedup same-day snapshots — replace
  state.history = state.history.filter(h => h.date !== snap.date);
  state.history.push(snap);
  // keep last 60 snapshots
  if (state.history.length > 60) state.history = state.history.slice(-60);
  return state;
}

// ─── FIDELITY CSV PARSER ───────────────────────────────────────────
// Handles real Fidelity exports including:
// - several accounts in one file (you choose which ones count)
// - money market rows (SPAXX and friends) as cash
// - pending activity (unsettled trades and transfers), folded into cash
// - crypto rows (BTC/USD format)
// - trailing disclaimer text
//
// opts.accounts — array of account keys to include. Omit it and the parser
// includes the account named "Individual" if there is one, else every account.
const FIDELITY_CASH_SYMBOLS = { SPAXX: 1, FDRXX: 1, FZFXX: 1, FCASH: 1, CORE: 1, SPRXX: 1, FDLXX: 1, FZDXX: 1, USD: 1 };

function parseFidelityCSV(text, opts) {
  opts = opts || {};
  let raw = String(text);
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);   // byte-order mark some exports start with
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  let headerIdx = -1;
  let headers = [];
  let importDate = null;
  const fail = (error) => ({ positions: [], cash: 0, pendingActivity: 0, importDate: null, accounts: [], included: [], error });

  // Find header row
  for (let i = 0; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.some(c => /symbol/i.test(c)) && cols.some(c => /quantity/i.test(c))) {
      headerIdx = i;
      headers = cols.map(c => c.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
      break;
    }
  }
  if (headerIdx < 0) return fail('Could not find header row in CSV.');

  // Find date in disclaimer
  for (const line of lines) {
    const m = line.match(/Date downloaded\s+([A-Z][a-z]+-\d+-\d+|\d{1,2}\/\d{1,2}\/\d{2,4})/i);   // "Oct-08-2026" or "10/08/2026"
    if (m) { importDate = m[1]; break; }
  }

  const findCol = (...names) => {
    for (const n of names) {
      const idx = headers.findIndex(h => h.includes(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const iAcctNum = findCol('accountnumber');
  const iAcctNam = findCol('accountname');
  const iSym    = findCol('symbol');
  const iDesc   = findCol('description');
  const iVal    = findCol('currentvalue');
  const iQty    = findCol('quantity');
  const iPrice  = findCol('lastprice');
  const iCost   = findCol('averagecostbasis', 'averagecost');
  const iTodayP = findCol('todaysgainlosspercent');
  const iTodayD = findCol('todaysgainlossdollar');
  const iGLD    = findCol('totalgainlossdollar');
  const iGLP    = findCol('totalgainlosspercent');

  const acct = {};
  const order = [];
  const accountFor = (cols) => {
    const number = iAcctNum >= 0 ? (cols[iAcctNum] || '').trim() : '';
    const name = iAcctNam >= 0 ? (cols[iAcctNam] || '').trim() : '';
    const key = number || name || 'Account';
    if (!acct[key]) { acct[key] = { key, number, name: name || number || 'Account', cash: 0, pending: 0, positions: [] }; order.push(key); }
    return acct[key];
  };

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 3) continue;

    const sym = (iSym >= 0 ? cols[iSym] : '').trim().replace(/\*+/g, '').replace(/®/g, '');
    const desc = (iDesc >= 0 ? cols[iDesc] : '').trim();
    if (!sym) continue;

    // Stop at disclaimer
    if (sym.length > 30 || /provided to you|brokerage services|fidelity\.com|trade confirmations/i.test(sym)) break;

    const rawVal = iVal >= 0 ? parseNum(cols[iVal]) : 0;
    const A = accountFor(cols);

    // ─── Pending activity ───
    if (/pending activity/i.test(sym) || /pending activity/i.test(desc)) {
      A.pending += rawVal;
      continue;
    }

    // ─── Cash / money market ───
    if (FIDELITY_CASH_SYMBOLS[sym.toUpperCase()] || /money market|us dollars/i.test(desc)) {
      if (rawVal > 0) A.cash += rawVal;
      continue;
    }

    const qty   = iQty   >= 0 ? parseNum(cols[iQty])   : 0;
    const price = iPrice >= 0 ? parseNum(cols[iPrice]) : 0;
    const cost  = iCost  >= 0 ? parseNum(cols[iCost])  : price;
    const tpct  = iTodayP >= 0 ? parseNum(cols[iTodayP]) : null;
    const tdol  = iTodayD >= 0 ? parseNum(cols[iTodayD]) : null;
    const glD   = iGLD   >= 0 ? parseNum(cols[iGLD])   : null;
    const glP   = iGLP   >= 0 ? parseNum(cols[iGLP])   : null;

    if (!qty && !price && !rawVal) continue;
    if (qty <= 0 || price <= 0) continue;

    // Normalise crypto ticker: "BTC/USD" -> "BTC"
    const cleanTkr = sym.includes('/') ? sym.split('/')[0].toUpperCase() : sym.toUpperCase();

    A.positions.push({
      tkr: cleanTkr,
      name: desc,
      shares: qty,
      price: price,
      cost: cost,
      sector: window.SECTOR_MAP[cleanTkr] || 'Other',
      todayPct: tpct,
      todayDol: tdol,
      glDol: glD,
      glPct: glP,
    });
  }

  const all = order.map(k => acct[k]);
  // which accounts count
  let included;
  if (Array.isArray(opts.accounts) && opts.accounts.some(k => acct[k])) {
    included = opts.accounts.filter(k => acct[k]);
  } else if (all.length > 1) {
    const individual = all.filter(a => /individual/i.test(a.name));
    included = (individual.length ? individual : all).map(a => a.key);
  } else {
    included = all.map(a => a.key);
  }

  // merge the included accounts: one row per ticker
  const merged = {};
  const positions = [];
  let cashTotal = 0;
  let pendingActivity = 0;
  included.forEach(k => {
    const A = acct[k];
    cashTotal += A.cash;
    pendingActivity += A.pending;
    A.positions.forEach(p => {
      const m = merged[p.tkr];
      if (!m) { merged[p.tkr] = Object.assign({}, p); positions.push(merged[p.tkr]); return; }
      const shares = m.shares + p.shares;
      m.cost = shares > 0 ? (m.cost * m.shares + p.cost * p.shares) / shares : m.cost;
      m.shares = shares;
      m.price = p.price;
      m.todayDol = (m.todayDol || 0) + (p.todayDol || 0);
      m.glDol = (m.glDol || 0) + (p.glDol || 0);
      m.glPct = m.cost > 0 ? (m.price / m.cost - 1) * 100 : m.glPct;
    });
  });

  return {
    positions,
    // Unsettled trades and transfers are already reflected in the share counts
    // Fidelity shows, so they are folded into cash rather than counted twice.
    cash: Math.max(0, cashTotal + pendingActivity),
    coreCash: cashTotal,
    pendingActivity,
    importDate,
    accounts: all.map(a => ({
      key: a.key, number: a.number, name: a.name, positions: a.positions.length,
      cash: a.cash + a.pending,
      value: a.cash + a.pending + a.positions.reduce((s, p) => s + p.shares * p.price, 0),
    })),
    included,
    error: null,
  };
}

function parseCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  result.push(cur.trim());
  return result;
}

function parseNum(s) {
  if (s == null || s === '') return 0;
  const cleaned = s.toString()
    .replace(/[$,%]/g, '')
    .replace(/^\+/, '')
    .replace(/\((.+)\)/, '-$1');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// ─── PRICE UPDATE FROM CSV (preserves position list, refreshes prices) ───
function applyImport(state, parsed) {
  // your universe decides the sector when it knows the name; the static map is the fallback
  state.positions = parsed.positions.map(p => {
    const u = state.universe && state.universe[p.tkr];
    return u && u.sector ? Object.assign({}, p, { sector: u.sector }) : p;
  });
  if (parsed.accounts && parsed.accounts.length) {
    state.importAccounts = { all: parsed.accounts, included: parsed.included || [] };
    state.accountFilter = (parsed.included || []).slice();
  }
  if (state.seedSource === 'sample') {
    // leaving the demo: drop the sample history, journal and buy-zone review stamps
    state.history = [];
    state.deploymentLog = [];
    delete state.accountScope;
    Object.keys(state.universe || {}).forEach(t => {
      const z = state.universe[t].buyZone;
      if (z && z.sampleReview) { delete z.reviewed; delete z.sampleReview; }
    });
  }
  delete state.seedSource;
  state.cash = parsed.cash;
  state.pendingActivity = parsed.pendingActivity;
  state.importDate = parsed.importDate || new Date().toISOString().slice(0, 10);
  state.lastImport = new Date().toISOString();
  return snapshotPortfolio(state);
}

// ─── DEPLOYMENT LOG ────────────────────────────────────────────────
function logDeployment(state, entry) {
  state.deploymentLog.push({
    date: new Date().toISOString().slice(0, 10),
    ...entry,
  });
  if (state.deploymentLog.length > 200) state.deploymentLog = state.deploymentLog.slice(-200);
  return state;
}

// ─── SAMPLE PORTFOLIO ──────────────────────────────────────────────
// Loads the fictional book in src/data/sample-portfolio.js. Used by the
// public demo when a browser has no portfolio of its own. applyImport
// undoes the demo-only parts on the first real CSV import.
function seedSample(state) {
  const S = window.SAMPLE_PORTFOLIO;
  if (!S) return state;
  const U = state.universe || {};
  state.positions = S.positions.map(p => {
    const u = U[p.tkr] || {};
    return {
      tkr: p.tkr, name: u.name || p.tkr, shares: p.shares, price: p.price, cost: p.cost,
      sector: u.sector || window.SECTOR_MAP[p.tkr] || 'Other',
      todayPct: null, todayDol: null,
      glDol: Math.round((p.price - p.cost) * p.shares * 100) / 100,
      glPct: Math.round((p.price / p.cost - 1) * 10000) / 100,
    };
  });
  state.cash = S.cash;
  state.pendingActivity = 0;
  state.importDate = S.asOf;
  state.lastImport = null;
  state.importAccounts = null;
  state.accountScope = S.label;
  state.seedSource = 'sample';

  // Sample buy zones count as reviewed the day the demo opens, so the price
  // tilt is visible. Each stamp is marked and removed on the first real import.
  const today = window.HardcapRules.todayISO();
  Object.keys(U).forEach(t => {
    const z = U[t].buyZone;
    if (z && !z.placeholder && z.low > 0 && z.fair > z.low && z.high > z.fair) {
      z.reviewed = today;
      z.sampleReview = true;
    }
  });

  // S&P 500 reading from the research snapshot, until the feed or you update it
  const RS = window.RESEARCH_SNAPSHOT;
  if (RS && RS.spx) {
    state.market = {
      ddPct: Math.round((1 - RS.spx.close / RS.spx.hi52) * 1000) / 10, price: RS.spx.close, high52: RS.spx.hi52,
      asOf: RS.asOf, source: 'S&P 500 close vs 52-week high, research snapshot', manual: false,
    };
  }
  return window.HardcapState.snapshot(state);
}

// Expose
window.HardcapState = {
  load: loadState,
  save: saveState,
  clear: clearState,
  init: initState,
  snapshot: snapshotPortfolio,
  parseCSV: parseFidelityCSV,
  applyImport,
  seedSample,
  logDeployment,
  exportBackup,
  importBackup,
};
