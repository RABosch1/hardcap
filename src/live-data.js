// ═══════════════════════════════════════════════════════════════════
// HARDCAP — LIVE DATA ENGINE
// EODHD-backed quote, fundamentals, and earnings calendar refresh.
// Provider-agnostic surface — swap eodhd.* with another adapter and
// the rest of the app does not change.
// ═══════════════════════════════════════════════════════════════════

const STORAGE_KEY_EODHD = 'hardcap_eodhd_key';        // legacy, kept for back-compat
const STORAGE_KEY_EODHD_PLAN = 'hardcap_eodhd_plan'; // 'free' | 'allinone'
const STORAGE_KEY_WORKER_URL = 'hardcap_worker_url'; // e.g. https://hardcap-data-proxy.YOUR-SUBDOMAIN.workers.dev

// The dashboard now talks to a Cloudflare Worker proxy, NOT EODHD directly.
// The worker injects the EODHD api_token as a Cloudflare secret, so the
// token never lives in the browser. Default URL is empty — user pastes
// their worker URL on first run.
const DEFAULT_WORKER_URL = '';

// Map our universe tickers to EODHD symbol codes. Most US tickers are TKR.US;
// override here for non-standard cases.
function eodhdSymbol(tkr) {
  // EODHD US suffix. BRK.B → BRK-B.US in EODHD's convention.
  const t = tkr.replace('.', '-');
  return `${t}.US`;
}

// ─── WORKER URL MANAGEMENT ─────────────────────────────────────────
function getWorkerUrl() {
  return (localStorage.getItem(STORAGE_KEY_WORKER_URL) || DEFAULT_WORKER_URL).trim().replace(/\/$/, '');
}
function setWorkerUrl(u) {
  if (!u) { localStorage.removeItem(STORAGE_KEY_WORKER_URL); return; }
  localStorage.setItem(STORAGE_KEY_WORKER_URL, u.trim().replace(/\/$/, ''));
}
function hasWorkerUrl() { return !!getWorkerUrl(); }

// ─── KEY MANAGEMENT (legacy — kept so users with old saves don't break) ─
function getEodhdKey() { return localStorage.getItem(STORAGE_KEY_EODHD) || ''; }
function setEodhdKey(k) {
  if (!k) localStorage.removeItem(STORAGE_KEY_EODHD);
  else localStorage.setItem(STORAGE_KEY_EODHD, k.trim());
}
function hasEodhdKey() { return !!getEodhdKey(); }
function getEodhdPlan() { return localStorage.getItem(STORAGE_KEY_EODHD_PLAN) || 'free'; }
function setEodhdPlan(p) { localStorage.setItem(STORAGE_KEY_EODHD_PLAN, p); }

// ─── LOW-LEVEL FETCH ───────────────────────────────────────────────
async function eodhdFetch(path, params = {}, timeoutMs = 12000) {
  const base = getWorkerUrl();
  if (!base) throw new Error('No worker URL configured');
  // No api_token in params — the worker injects it server-side.
  const qs = new URLSearchParams({ ...params, fmt: 'json' });
  const url = `${base}${path}?${qs.toString()}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.status === 401 || res.status === 403) {
      throw new Error('EODHD rejected the API token (check your worker secret)');
    }
    if (res.status === 429) {
      throw new Error('EODHD rate limit hit — wait a few minutes or upgrade plan');
    }
    if (res.status === 502) {
      throw new Error('Worker could not reach EODHD — try again in a moment');
    }
    if (!res.ok) {
      throw new Error(`Worker HTTP ${res.status}`);
    }
    let data;
    try { data = await res.json(); }
    catch (e) {
      if (e && e.name === 'AbortError') throw e;
      throw new Error('The worker answered, but not with data (it sent a web page or an empty reply). Check the Worker URL in Import → Settings');
    }
    return data;
  } catch (err) {
    clearTimeout(t);
    if (err.name === 'AbortError') throw new Error('Worker request timed out');
    if (err.message === 'Failed to fetch') throw new Error('Cannot reach worker — check the URL is correct and the worker is deployed');
    throw err;
  }
}

// ─── QUOTE ─────────────────────────────────────────────────────────
// Returns { price, change, changePct, prevClose, volume, timestamp }
async function fetchQuote(tkr) {
  const sym = eodhdSymbol(tkr);
  const data = await eodhdFetch(`/real-time/${sym}`);
  // EODHD real-time response: { code, timestamp, gmtoffset, open, high, low, close, volume, previousClose, change, change_p }
  if (!data || data.close == null || data.close === 'NA') {
    throw new Error(`No quote data for ${tkr}`);
  }
  return {
    price: parseFloat(data.close),
    open: parseFloat(data.open) || null,
    high: parseFloat(data.high) || null,
    low: parseFloat(data.low) || null,
    prevClose: parseFloat(data.previousClose) || null,
    change: parseFloat(data.change) || 0,
    changePct: parseFloat(data.change_p) || 0,
    volume: parseFloat(data.volume) || null,
    timestamp: data.timestamp ? data.timestamp * 1000 : Date.now(),
  };
}

// Batch quote: EODHD supports comma-separated symbols on /real-time/{first}
// with ?s=other1,other2,... — returns an array.
async function fetchQuotesBatch(tickers) {
  if (tickers.length === 0) return {};
  const symbols = tickers.map(eodhdSymbol);
  const [first, ...rest] = symbols;
  const params = rest.length > 0 ? { s: rest.join(',') } : {};
  const data = await eodhdFetch(`/real-time/${first}`, params);
  const arr = Array.isArray(data) ? data : [data];
  const out = {};
  arr.forEach((row, idx) => {
    if (!row || row.close == null || row.close === 'NA') return;
    // Map back to our ticker. EODHD returns code like "AAPL.US"; strip suffix.
    const code = (row.code || symbols[idx] || '').split('.')[0].replace('-', '.');
    out[code] = {
      price: parseFloat(row.close),
      open: parseFloat(row.open) || null,
      high: parseFloat(row.high) || null,
      low: parseFloat(row.low) || null,
      prevClose: parseFloat(row.previousClose) || null,
      change: parseFloat(row.change) || 0,
      changePct: parseFloat(row.change_p) || 0,
      volume: parseFloat(row.volume) || null,
      timestamp: row.timestamp ? row.timestamp * 1000 : Date.now(),
    };
  });
  return out;
}

// ─── FUNDAMENTALS ──────────────────────────────────────────────────
// Returns the fields our memo grid uses: pe, fwdPe, fcfYield, roe,
// marginOp, debtEbitda, plus light extras.
async function fetchFundamentals(tkr) {
  const sym = eodhdSymbol(tkr);
  const data = await eodhdFetch(`/fundamentals/${sym}`, {}, 25000);
  if (!data) throw new Error(`No fundamentals for ${tkr}`);
  return parseFundamentalsSnapshot(data);
}
function parseFundamentalsSnapshot(data) {

  const h = data.Highlights || {};
  const v = data.Valuation || {};
  const t = data.Technicals || {};
  const f = data.Financials || {};
  const bs = f.Balance_Sheet?.quarterly ? Object.values(f.Balance_Sheet.quarterly)[0] : {};
  const ic = f.Income_Statement?.quarterly ? Object.values(f.Income_Statement.quarterly)[0] : {};

  const num = (x) => {
    const n = parseFloat(x);
    return isFinite(n) ? n : null;
  };

  // FCF yield: trailing free cash flow / market cap. EODHD has "FreeCashFlowYield"
  // sometimes; fall back to TTM FCF / market cap.
  let fcfYield = num(h.FreeCashFlowYield);
  if (fcfYield != null) fcfYield = fcfYield * 100;
  if (fcfYield == null && h.MarketCapitalization && f.Cash_Flow?.yearly) {
    const cfYears = Object.values(f.Cash_Flow.yearly);
    const latest = cfYears[0] || {};
    const fcf = num(latest.freeCashFlow);
    const mc = num(h.MarketCapitalization);
    if (fcf && mc) fcfYield = (fcf / mc) * 100;
  }

  // Op margin
  let marginOp = num(h.OperatingMarginTTM);
  if (marginOp != null) marginOp = marginOp * 100;

  // ROE
  let roe = num(h.ReturnOnEquityTTM);
  if (roe != null) roe = roe * 100;

  // Debt / EBITDA — compute from balance sheet + income statement
  let debtEbitda = null;
  if (bs && ic) {
    const totalDebt = num(bs.shortLongTermDebtTotal) || (num(bs.longTermDebt) || 0) + (num(bs.shortTermDebt) || 0);
    const ebitda = num(h.EBITDA);
    if (totalDebt && ebitda && ebitda > 0) debtEbitda = totalDebt / ebitda;
  }

  return {
    pe: num(h.PERatio),
    fwdPe: num(v.ForwardPE),
    peg: num(h.PEGRatio),
    fcfYield: fcfYield != null ? Math.round(fcfYield * 10) / 10 : null,
    revGrowth: num(h.QuarterlyRevenueGrowthYOY) != null ? Math.round(h.QuarterlyRevenueGrowthYOY * 1000) / 10 : null,
    marginOp: marginOp != null ? Math.round(marginOp * 10) / 10 : null,
    roe: roe != null ? Math.round(roe * 10) / 10 : null,
    debtEbitda: debtEbitda != null ? Math.round(debtEbitda * 10) / 10 : null,
    marketCapB: num(h.MarketCapitalization) ? Math.round(h.MarketCapitalization / 1e8) / 10 : null,
    dividendYield: num(h.DividendYield) != null ? Math.round(h.DividendYield * 1000) / 10 : null,
    beta: num(t.Beta),
    fetchedAt: Date.now(),
  };
}

// ─── DEEP FUNDAMENTALS (5-year time series) ────────────────────────
// Returns 5 years of revenue, FCF, op margin, ROE, debt, share count, dividends.
// This is what the Forensic IC tier feeds Claude — trends, not snapshots.
// Cached aggressively: a year of fundamentals doesn't change between earnings.
async function fetchDeepFundamentals(tkr) {
  const sym = eodhdSymbol(tkr);
  const data = await eodhdFetch(`/fundamentals/${sym}`, {}, 25000);
  if (!data) throw new Error(`No fundamentals for ${tkr}`);
  return parseDeepFundamentals(tkr, data);
}
function parseDeepFundamentals(tkr, data) {

  const num = (x) => {
    const n = parseFloat(x);
    return isFinite(n) ? n : null;
  };
  const round = (n, d = 1) => n == null ? null : Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
  const million = (n) => n == null ? null : Math.round(n / 1e6); // raw $ → $M

  const h = data.Highlights || {};
  const v = data.Valuation || {};
  const f = data.Financials || {};
  const general = data.General || {};

  // Build year-keyed arrays from EODHD's date-keyed objects
  // EODHD returns { "2024-12-31": {...}, "2023-12-31": {...} ... }
  const incYearly = f.Income_Statement?.yearly || {};
  const bsYearly  = f.Balance_Sheet?.yearly || {};
  const cfYearly  = f.Cash_Flow?.yearly || {};

  // Sort dates desc, take last 5 fiscal years
  const dates = Object.keys(incYearly).sort().reverse().slice(0, 5);
  const history = dates.map(date => {
    const inc = incYearly[date] || {};
    const bs = bsYearly[date] || {};
    const cf = cfYearly[date] || {};
    const revenue = num(inc.totalRevenue);
    const opIncome = num(inc.operatingIncome);
    const netIncome = num(inc.netIncome);
    const ebitda = num(inc.ebitda);
    const ocf = num(cf.totalCashFromOperatingActivities);
    const capex = num(cf.capitalExpenditures);
    const fcf = (ocf != null && capex != null) ? (ocf + capex) : null; // capex is typically negative in EODHD
    const equity = num(bs.totalStockholderEquity);
    const totalDebt = num(bs.shortLongTermDebtTotal) || ((num(bs.longTermDebt) || 0) + (num(bs.shortTermDebt) || 0));
    const sharesOut = num(bs.commonStockSharesOutstanding);
    const dividends = num(cf.dividendsPaid);
    return {
      year: date.slice(0, 4),
      revenueM: million(revenue),
      opIncomeM: million(opIncome),
      netIncomeM: million(netIncome),
      ebitdaM: million(ebitda),
      fcfM: million(fcf),
      opMarginPct: revenue && opIncome != null ? round((opIncome / revenue) * 100, 1) : null,
      ebitdaMarginPct: revenue && ebitda != null ? round((ebitda / revenue) * 100, 1) : null,
      roePct: equity && netIncome != null && equity > 0 ? round((netIncome / equity) * 100, 1) : null,
      debtToEbitda: totalDebt && ebitda != null && ebitda > 0 ? round(totalDebt / ebitda, 1) : null,
      totalDebtM: million(totalDebt),
      sharesOutM: sharesOut ? round(sharesOut / 1e6, 1) : null,
      dividendsPaidM: million(dividends),
    };
  }).reverse(); // chronological order

  // Compute trends — % CAGR or simple growth where useful
  const trend = (key) => {
    const vals = history.map(h => h[key]).filter(v => v != null && v > 0);
    if (vals.length < 2) return null;
    const first = vals[0], last = vals[vals.length - 1];
    const years = vals.length - 1;
    if (first <= 0) return null;
    const cagr = (Math.pow(last / first, 1 / years) - 1) * 100;
    return round(cagr, 1);
  };

  const trends = {
    revenueCAGRPct: trend('revenueM'),
    fcfCAGRPct: trend('fcfM'),
    netIncomeCAGRPct: trend('netIncomeM'),
    ebitdaCAGRPct: trend('ebitdaM'),
    avgOpMarginPct: history.length ? round(history.reduce((s, h) => s + (h.opMarginPct || 0), 0) / history.filter(h => h.opMarginPct != null).length, 1) : null,
    avgROEPct: history.length ? round(history.reduce((s, h) => s + (h.roePct || 0), 0) / history.filter(h => h.roePct != null).length, 1) : null,
    sharesOutChangePct: (() => {
      const start = history[0]?.sharesOutM, end = history[history.length - 1]?.sharesOutM;
      if (!start || !end) return null;
      return round(((end - start) / start) * 100, 1);
    })(),
  };

  return {
    tkr,
    name: general.Name || h.Name,
    sector: general.Sector,
    industry: general.Industry,
    description: (general.Description || '').slice(0, 600),
    marketCapM: million(num(h.MarketCapitalization)),
    sharesOutM: round(num(h.SharesOutstanding) / 1e6, 1),
    pe: num(h.PERatio),
    fwdPe: num(v.ForwardPE),
    pegRatio: num(h.PEGRatio),
    priceToBook: num(v.PriceBookMRQ),
    priceToSales: num(v.PriceSalesTTM),
    evToEbitda: num(v.EnterpriseValueEbitda),
    dividendYieldPct: num(h.DividendYield) != null ? round(h.DividendYield * 100, 2) : null,
    beta: num(data.Technicals?.Beta),
    week52High: num(data.Technicals?.['52WeekHigh']),
    week52Low: num(data.Technicals?.['52WeekLow']),
    history,        // 5-year array, chronological
    trends,
    fetchedAt: Date.now(),
  };
}

// Refresh deep fundamentals for many tickers in parallel-ish; caches per ticker.
async function refreshDeepFundamentals(state, tickers) {
  const targets = tickers || Object.keys(state.universe);
  const result = { updated: 0, failed: 0, errors: [], at: Date.now() };
  if (!hasWorkerUrl()) {
    result.errors.push({ tkr: '*', msg: 'No worker URL configured' });
    return result;
  }
  for (const tkr of targets) {
    try {
      const f = await fetchDeepFundamentals(tkr);
      if (!state.universe[tkr]) state.universe[tkr] = {};
      state.universe[tkr].deepFundamentals = f;
      state.universe[tkr].liveDeepFundAt = f.fetchedAt;
      result.updated++;
    } catch (err) {
      result.failed++;
      result.errors.push({ tkr, msg: err.message });
    }
    await new Promise(r => setTimeout(r, 300));
  }
  state.live = state.live || {};
  state.live.lastDeepFundamentalsRefresh = result.at;
  return result;
}

// ─── EARNINGS CALENDAR ─────────────────────────────────────────────
// Pulls upcoming earnings for our universe over the next 90 days.
// Returns { TKR: { date, epsEstimate, time } }
async function fetchEarningsCalendar(tickers) {
  if (tickers.length === 0) return {};
  const today = new Date();
  const future = new Date(today.getTime() + 90 * 24 * 3600 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const symbols = tickers.map(eodhdSymbol).join(',');
  const data = await eodhdFetch('/calendar/earnings', {
    from: fmt(today),
    to: fmt(future),
    symbols,
  });
  const out = {};
  const rows = data?.earnings || [];
  rows.forEach(row => {
    const code = (row.code || '').split('.')[0].replace('-', '.');
    if (!code) return;
    // Keep earliest upcoming
    if (!out[code] || row.report_date < out[code].date) {
      out[code] = {
        date: row.report_date,
        epsEstimate: row.estimate != null ? parseFloat(row.estimate) : null,
        epsActual: row.actual != null ? parseFloat(row.actual) : null,
        time: row.before_after_market || null,
      };
    }
  });
  return out;
}

// ─── HIGH-LEVEL: REFRESH ALL QUOTES ────────────────────────────────
// Pulls a quote for every ticker in the universe, writes livePrice
// to universe entries AND updates position.price for held names.
// Returns { updated, failed, errors: [{tkr, msg}] }
async function refreshAllQuotes(state) {
  const tickers = Object.keys(state.universe);
  const result = { updated: 0, failed: 0, errors: [], at: Date.now() };
  if (tickers.length === 0) return result;
  if (!hasWorkerUrl()) {
    result.errors.push({ tkr: '*', msg: 'No worker URL configured' });
    return result;
  }

  // EODHD batch quote works but free tier rate-limits aggressively.
  // We chunk into batches of 8 to stay safe and to keep partial-failure handling clean.
  const chunkSize = 8;
  const chunks = [];
  for (let i = 0; i < tickers.length; i += chunkSize) {
    chunks.push(tickers.slice(i, i + chunkSize));
  }

  let failedChunks = 0;
  for (const chunk of chunks) {
    try {
      const quotes = await fetchQuotesBatch(chunk);
      chunk.forEach(tkr => {
        const q = quotes[tkr];
        if (!q || !q.price) {
          result.failed++;
          result.errors.push({ tkr, msg: 'no quote returned' });
          return;
        }
        // Write to universe
        if (!state.universe[tkr]) state.universe[tkr] = {};
        state.universe[tkr].livePrice = q.price;
        state.universe[tkr].liveChange = q.change;
        state.universe[tkr].liveChangePct = q.changePct;
        state.universe[tkr].livePrevClose = q.prevClose;
        state.universe[tkr].liveQuoteAt = q.timestamp;

        // Sync to held position
        const pos = state.positions.find(p => p.tkr === tkr);
        if (pos) pos.price = q.price;

        result.updated++;
      });
    } catch (err) {
      chunk.forEach(tkr => {
        result.failed++;
        result.errors.push({ tkr, msg: err.message });
      });
      failedChunks++;
      // Two requests in a row failed and nothing has come back: the feed is down. Stop asking.
      if (failedChunks >= 2 && result.updated === 0) {
        const seen = new Set(result.errors.map(e => e.tkr));
        tickers.forEach(tkr => { if (!seen.has(tkr)) { result.failed++; result.errors.push({ tkr, msg: err.message }); } });
        break;
      }
    }
    // Tiny gap between chunks for free-tier politeness
    await new Promise(r => setTimeout(r, 250));
  }
  // every request threw and nothing was updated: tell callers the feed is down
  if (result.updated === 0 && failedChunks > 0 && result.failed === tickers.length) result.down = true;

  state.live = state.live || {};
  if (result.updated > 0) state.live.lastQuoteSuccess = result.at;
  state.live.lastQuoteRefresh = result.at;
  state.live.lastQuoteResult = { updated: result.updated, failed: result.failed };
  return result;
}

// ─── HIGH-LEVEL: REFRESH FUNDAMENTALS (one ticker or all) ──────────
async function refreshFundamentals(state, tickers) {
  const targets = tickers || Object.keys(state.universe);
  const result = { updated: 0, failed: 0, errors: [], at: Date.now() };
  if (!hasWorkerUrl()) {
    result.errors.push({ tkr: '*', msg: 'No worker URL configured' });
    return result;
  }
  for (const tkr of targets) {
    try {
      const f = await fetchFundamentals(tkr);
      if (!state.universe[tkr]) state.universe[tkr] = {};
      // Merge with existing — keep human-edited fields if API returns null
      const existing = state.universe[tkr].fundamentals || {};
      const merged = { ...existing };
      Object.entries(f).forEach(([k, v]) => { if (v != null) merged[k] = v; });
      state.universe[tkr].fundamentals = merged;
      state.universe[tkr].liveFundamentalsAt = f.fetchedAt;
      result.updated++;
    } catch (err) {
      result.failed++;
      result.errors.push({ tkr, msg: err.message });
    }
    // Free-tier politeness — fundamentals is heavier
    await new Promise(r => setTimeout(r, 400));
  }
  state.live = state.live || {};
  state.live.lastFundamentalsRefresh = result.at;
  return result;
}

// ─── HIGH-LEVEL: REFRESH EARNINGS ──────────────────────────────────
async function refreshEarnings(state) {
  const tickers = Object.keys(state.universe);
  const result = { updated: 0, failed: 0, errors: [], at: Date.now() };
  if (!hasWorkerUrl()) {
    result.errors.push({ tkr: '*', msg: 'No worker URL configured' });
    return result;
  }
  try {
    const cal = await fetchEarningsCalendar(tickers);
    Object.keys(cal).forEach(tkr => {
      if (!state.universe[tkr]) state.universe[tkr] = {};
      state.universe[tkr].nextEarnings = cal[tkr];
      result.updated++;
    });
  } catch (err) {
    result.errors.push({ tkr: '*', msg: err.message });
    result.failed = tickers.length;
  }
  state.live = state.live || {};
  state.live.lastEarningsRefresh = result.at;
  return result;
}

// ─── EXTRAS: analyst, estimates, technicals, dividends, quarterly trend ──
// Everything here is read defensively. A field EODHD does not return for a
// ticker simply stays null; nothing is guessed.
function parseFundamentalsExtras(data) {
  const num = (x) => { const n = parseFloat(x); return isFinite(n) ? n : null; };
  const round = (n, d = 2) => n == null ? null : Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
  const million = (n) => n == null ? null : Math.round(n / 1e6);
  const h = data.Highlights || {};
  const v = data.Valuation || {};
  const t = data.Technicals || {};
  const ar = data.AnalystRatings || {};
  const sd = data.SplitsDividends || {};
  const e = data.Earnings || {};
  const f = data.Financials || {};

  const revTTM = num(h.RevenueTTM);
  const grossTTM = num(h.GrossProfitTTM);

  // earnings surprises: most recent reported quarters first
  const history = Object.values(e.History || {})
    .filter(r => r && num(r.epsActual) != null)
    .sort((a, b) => String(b.reportDate || b.date).localeCompare(String(a.reportDate || a.date)))
    .slice(0, 6)
    .map(r => ({ date: r.reportDate || r.date || null, actual: num(r.epsActual), estimate: num(r.epsEstimate), surprisePct: round(num(r.surprisePercent), 1) }));

  // estimate trend: the latest entry for this quarter, next quarter, this year, next year
  const seen = {};
  const estimateTrend = Object.values(e.Trend || {})
    .filter(r => r && r.period)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .filter(r => { if (seen[r.period]) return false; seen[r.period] = 1; return ['0q', '+1q', '0y', '+1y'].indexOf(r.period) >= 0; })
    .map(r => ({
      period: r.period, date: r.date || null,
      eps: num(r.earningsEstimateAvg) != null ? num(r.earningsEstimateAvg) : num(r.epsTrendCurrent),
      epsGrowthPct: num(r.earningsEstimateGrowth) != null ? round(num(r.earningsEstimateGrowth) * 100, 1) : null,
      revenueM: million(num(r.revenueEstimateAvg)),
      revenueGrowthPct: num(r.revenueEstimateGrowth) != null ? round(num(r.revenueEstimateGrowth) * 100, 1) : null,
      eps7d: num(r.epsTrend7daysAgo), eps30d: num(r.epsTrend30daysAgo), eps90d: num(r.epsTrend90daysAgo),
      upLast30d: num(r.epsRevisionsUpLast30days), downLast30d: num(r.epsRevisionsDownLast30days),
      analysts: num(r.earningsEstimateNumberOfAnalysts),
    }));

  // last six quarters: revenue, operating income, margin
  const incQ = (f.Income_Statement && f.Income_Statement.quarterly) || {};
  const quarters = Object.keys(incQ).sort().reverse().slice(0, 6).map(date => {
    const q = incQ[date] || {};
    const rev = num(q.totalRevenue), op = num(q.operatingIncome), ni = num(q.netIncome);
    return { date, revenueM: million(rev), opIncomeM: million(op), netIncomeM: million(ni), opMarginPct: rev && op != null ? round(op / rev * 100, 1) : null };
  }).reverse();

  const bsQ = (f.Balance_Sheet && f.Balance_Sheet.quarterly) || {};
  const bsDate = Object.keys(bsQ).sort().reverse()[0];
  const bs = bsDate ? bsQ[bsDate] : {};
  const cash = num(bs.cashAndShortTermInvestments) != null ? num(bs.cashAndShortTermInvestments) : (num(bs.cashAndEquivalents) != null ? num(bs.cashAndEquivalents) : num(bs.cash));
  const debt = num(bs.shortLongTermDebtTotal) != null ? num(bs.shortLongTermDebtTotal) : ((num(bs.longTermDebt) || 0) + (num(bs.shortTermDebt) || 0)) || null;

  return {
    epsTTM: num(h.DilutedEpsTTM) != null ? num(h.DilutedEpsTTM) : num(h.EarningsShare),
    epsEstCurrentYear: num(h.EPSEstimateCurrentYear),
    epsEstNextYear: num(h.EPSEstimateNextYear),
    revenueTTM_M: million(revTTM),
    ebitdaM: million(num(h.EBITDA)),
    profitMarginPct: num(h.ProfitMargin) != null ? round(num(h.ProfitMargin) * 100, 1) : null,
    grossMarginPct: revTTM && grossTTM != null ? round(grossTTM / revTTM * 100, 1) : null,
    earningsGrowthYoYPct: num(h.QuarterlyEarningsGrowthYOY) != null ? round(num(h.QuarterlyEarningsGrowthYOY) * 100, 1) : null,
    trailingPE: num(v.TrailingPE) != null ? num(v.TrailingPE) : num(h.PERatio),
    forwardPE: num(v.ForwardPE),
    evToEbitda: num(v.EnterpriseValueEbitda),
    evToRevenue: num(v.EnterpriseValueRevenue),
    ma50: num(t['50DayMA']), ma200: num(t['200DayMA']),
    week52High: num(t['52WeekHigh']), week52Low: num(t['52WeekLow']),
    shortPctFloat: num(t.ShortPercent) != null ? round(num(t.ShortPercent) * 100, 1) : null,
    analyst: {
      rating: num(ar.Rating), targetPrice: num(ar.TargetPrice) != null ? num(ar.TargetPrice) : num(h.WallStreetTargetPrice),
      strongBuy: num(ar.StrongBuy), buy: num(ar.Buy), hold: num(ar.Hold), sell: num(ar.Sell), strongSell: num(ar.StrongSell),
    },
    dividend: {
      forwardRate: num(sd.ForwardAnnualDividendRate),
      forwardYieldPct: num(sd.ForwardAnnualDividendYield) != null ? round(num(sd.ForwardAnnualDividendYield) * 100, 2) : null,
      payoutRatioPct: num(sd.PayoutRatio) != null ? round(num(sd.PayoutRatio) * 100, 1) : null,
      exDate: sd.ExDividendDate || null,
    },
    earningsHistory: history,
    estimateTrend,
    quarters,
    balance: { asOf: bsDate || null, cashM: million(cash), totalDebtM: million(debt), netDebtM: cash != null && debt != null ? million(debt - cash) : null },
    fetchedAt: Date.now(),
  };
}

// ─── ONE CALL PER NAME: snapshot + 5-year history + extras ─────────
// Skips names fetched recently. Stops early if the feed is plainly down,
// so a dead worker costs three timeouts instead of thirty.
async function ensureFundamentals(state, tickers, opts = {}) {
  const maxAgeMs = (opts.maxAgeDays == null ? 5 : opts.maxAgeDays) * 86400000;
  const result = { fetched: [], skipped: [], errors: [], at: Date.now(), aborted: false };
  if (!hasWorkerUrl()) { result.errors.push({ tkr: '*', msg: 'No worker URL configured' }); return result; }
  const list = (tickers || []).filter(t => state.universe && state.universe[t]);
  let streak = 0;
  for (let i = 0; i < list.length; i++) {
    const tkr = list[i];
    const u = state.universe[tkr];
    const last = (u.liveSnapshot && u.liveSnapshot.fetchedAt) || 0;
    if (!opts.force && last && (Date.now() - last) < maxAgeMs && u.deepFundamentals && u.fundExtras) { result.skipped.push(tkr); continue; }
    if (opts.onProgress) { try { opts.onProgress(tkr, i + 1, list.length); } catch (e) { /* display only */ } }
    try {
      const data = await eodhdFetch(`/fundamentals/${eodhdSymbol(tkr)}`, {}, 25000);
      if (!data || typeof data !== 'object' || (!data.Highlights && !data.Financials && !data.General)) throw new Error('No fundamentals returned');
      const snap = parseFundamentalsSnapshot(data);
      u.liveSnapshot = snap;                                  // clean feed values, nulls kept
      const merged = Object.assign({}, u.fundamentals || {});
      Object.keys(snap).forEach(k => { if (snap[k] != null) merged[k] = snap[k]; });
      u.fundamentals = merged;                                 // legacy memo grid
      u.liveFundamentalsAt = snap.fetchedAt;
      u.deepFundamentals = parseDeepFundamentals(tkr, data);
      u.liveDeepFundAt = u.deepFundamentals.fetchedAt;
      u.fundExtras = parseFundamentalsExtras(data);
      result.fetched.push(tkr);
      streak = 0;
    } catch (err) {
      result.errors.push({ tkr, msg: err.message });
      streak++;
      if (streak >= 3 && result.fetched.length === 0) { result.aborted = true; break; }
    }
    await new Promise(r => setTimeout(r, 250));
  }
  state.live = state.live || {};
  if (result.fetched.length) { state.live.lastFundamentalsRefresh = result.at; state.live.lastDeepFundamentalsRefresh = result.at; }
  return result;
}

// ─── MARKET GAUGE: how far the S&P 500 is below its 52-week high ───
// Uses SPY as the proxy. Tries the fundamentals endpoint first (the
// worker is known to pass it through), then a year of daily prices.
async function refreshMarketGauge(state) {
  if (!hasWorkerUrl()) throw new Error('No worker URL configured');
  const q = await fetchQuote('SPY');
  let hi = null, source = null;
  try {
    const f = await eodhdFetch('/fundamentals/SPY.US');
    const x = parseFloat(f && f.Technicals && f.Technicals['52WeekHigh']);
    if (isFinite(x) && x > 0) { hi = x; source = 'SPY vs its 52-week high (data feed)'; }
  } catch (e) { /* try the next route */ }
  if (!(hi > 0)) {
    try {
      const from = new Date(Date.now() - 366 * 86400000).toISOString().slice(0, 10);
      const rows = await eodhdFetch('/eod/SPY.US', { from, period: 'd' });
      if (Array.isArray(rows) && rows.length > 20) {
        const highs = rows.map(r => parseFloat(r.high != null ? r.high : r.close)).filter(n => isFinite(n) && n > 0);
        if (highs.length) { hi = Math.max.apply(null, highs); source = 'SPY vs its highest price in 12 months (data feed)'; }
      }
    } catch (e) { /* fall through */ }
  }
  if (!(hi > 0)) throw new Error('The feed returned a SPY quote but no 52-week high. Enter the figure by hand.');
  const top = Math.max(hi, q.price);
  const ddPct = Math.round((1 - q.price / top) * 1000) / 10;
  state.market = { ddPct, price: q.price, high52: top, asOf: new Date().toISOString().slice(0, 10), source, manual: false };
  return state.market;
}

// ─── PUBLIC API ────────────────────────────────────────────────────
window.HardcapLive = {
  // worker URL mgmt (the new way — token lives in Cloudflare, not browser)
  getWorkerUrl, setWorkerUrl, hasWorkerUrl,
  // legacy key mgmt (kept so we don't break old saves; not used for fetch anymore)
  getKey: getEodhdKey,
  setKey: setEodhdKey,
  // hasKey now means "ready to make live requests" — i.e. has worker URL
  hasKey: hasWorkerUrl,
  getPlan: getEodhdPlan,
  setPlan: setEodhdPlan,
  // low-level (for testing)
  fetchQuote, fetchQuotesBatch, fetchFundamentals, fetchEarningsCalendar,
  fetchDeepFundamentals,
  // high-level
  refreshAllQuotes, refreshFundamentals, refreshEarnings, refreshDeepFundamentals,
  // one-call fundamentals (snapshot + 5-year history + extras) and the S&P 500 gauge
  ensureFundamentals, refreshMarketGauge, parseFundamentalsExtras, parseFundamentalsSnapshot, parseDeepFundamentals,
};
