// ═══════════════════════════════════════════════════════════════════
// HARDCAP — ANALYTICS ENGINE
// Pure functions. Given state, compute everything else.
// ═══════════════════════════════════════════════════════════════════

function totalEquity(state) {
  return state.positions.reduce((a, p) => a + p.shares * p.price, 0);
}

function totalCostBasis(state) {
  return state.positions.reduce((a, p) => a + p.shares * p.cost, 0);
}

function totalGainLoss(state) {
  return totalEquity(state) - totalCostBasis(state);
}

function totalGainLossPct(state) {
  const cb = totalCostBasis(state);
  return cb > 0 ? (totalEquity(state) / cb - 1) * 100 : 0;
}

function todayPnL(state) {
  return state.positions.reduce((a, p) => {
    if (p.todayDol != null) return a + p.todayDol;
    if (p.todayPct != null) return a + (p.shares * p.price) * (p.todayPct / 100);
    return a;
  }, 0);
}

function netPortfolio(state) {
  // Equity + cash, but pending activity is settled cash that's "spoken for"
  // It's already reflected in SPAXX (typically) but Fidelity shows it as separate line
  // We treat pending activity as informational, not double-counted
  return totalEquity(state) + state.cash;
}

// ─── THE BOOK ──────────────────────────────────────────────────────
// Weights are measured against the invested book you are building toward:
// total capital less the cash hold-back for the current market mode. While
// excess cash is still being deployed, that is larger than today's equity,
// so a position is not flagged as oversized just because cash is high.
// Once cash is at or below the hold-back, the book is simply equity.
function bookValue(state) {
  const eq = totalEquity(state);
  const total = eq + (state.cash || 0);
  let hold = 0;
  try { if (window.HardcapRules) hold = window.HardcapRules.cashTargetPct(state); } catch (e) { hold = 0; }
  return Math.max(eq, total * (1 - hold / 100));
}
function capPct(state) {
  try { return window.HardcapRules ? window.HardcapRules.get(state).capPct : 22; } catch (e) { return 22; }
}

// ─── SECTOR ANALYSIS ───────────────────────────────────────────────
function sectorWeights(state) {
  const eq = bookValue(state);
  const map = {};
  state.positions.forEach(p => {
    const s = p.sector || window.SECTOR_MAP[p.tkr] || 'Other';
    map[s] = (map[s] || 0) + p.shares * p.price;
  });
  const out = {};
  Object.keys(map).forEach(s => out[s] = eq > 0 ? (map[s] / eq * 100) : 0);
  return out;
}

function sectorGaps(state) {
  const sw = sectorWeights(state);
  const eq = bookValue(state);
  const allSectors = new Set([...Object.keys(sw), ...Object.keys(window.SECTOR_TARGETS)]);
  const gaps = [];
  allSectors.forEach(s => {
    if (s === 'Cash') return;
    const cur = sw[s] || 0;
    const tgt = window.SECTOR_TARGETS[s] || { min: 0, max: 100, priority: 5, color: '#a08060' };
    const midpoint = (tgt.min + tgt.max) / 2;
    const gapPct = cur - midpoint; // negative = under, positive = over
    const dollarGap = (midpoint - cur) / 100 * eq; // $ to add to hit midpoint
    let status;
    if (cur < tgt.min && tgt.min > 0) status = 'underweight';
    else if (cur > tgt.max) status = 'overweight';
    else status = 'on-target';
    gaps.push({
      sector: s,
      current: cur,
      target: tgt,
      gapPct,
      dollarGap,
      status,
      priority: tgt.priority || 5,
    });
  });
  return gaps.sort((a, b) => {
    // Underweight high-priority first, then overweight, then on-target
    const order = { underweight: 0, overweight: 1, 'on-target': 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return a.priority - b.priority;
  });
}

// ─── POSITION ANALYSIS ─────────────────────────────────────────────
function enrichPositions(state) {
  const eq = bookValue(state);
  const eqOnly = totalEquity(state);
  return state.positions.map(p => {
    const value = p.shares * p.price;
    const cost = p.shares * p.cost;
    const gl = value - cost;
    const glPct = p.cost > 0 ? (p.price / p.cost - 1) * 100 : 0;
    const weight = eq > 0 ? value / eq * 100 : 0;
    const u = state.universe[p.tkr] || {};
    return {
      ...p,
      value, cost, gl, glPct, weight,
      weightOfEquity: eqOnly > 0 ? value / eqOnly * 100 : 0,
      conviction: u.conviction || null,
      signal: u.signal || null,
      buyZone: u.buyZone || null,
      universeName: u.name || p.name || p.tkr,
      sectorAssigned: p.sector || window.SECTOR_MAP[p.tkr] || 'Other',
    };
  }).sort((a, b) => b.value - a.value);
}

// ─── BUY ZONE STATUS ───────────────────────────────────────────────
function buyZoneStatus(price, zone) {
  if (!zone || zone.low == null) return { label: 'No zone set', class: 'neutral', distance: null };
  if (price <= zone.low) return { label: 'Below buy zone', class: 'strong-buy', distance: ((zone.low - price) / zone.low * 100).toFixed(1) + '%' };
  if (price <= zone.fair) return { label: 'In buy zone', class: 'buy', distance: 'fair value below' };
  if (price <= zone.high) return { label: 'Above fair', class: 'hold', distance: ((price - zone.fair) / zone.fair * 100).toFixed(1) + '% over' };
  return { label: 'Overvalued', class: 'wait', distance: ((price - zone.high) / zone.high * 100).toFixed(1) + '% over high' };
}

// ─── IC READINESS SCORE ────────────────────────────────────────────
// 0-100 score reflecting how close the portfolio is to your target architecture
function icReadiness(state) {
  const sw = sectorWeights(state);
  const positionCount = state.positions.length;
  let score = 50; // base

  // Energy alignment (max +15)
  const energyPct = sw['Energy'] || 0;
  const energyTgt = window.SECTOR_TARGETS['Energy'];
  if (energyPct >= energyTgt.min) score += 15;
  else if (energyPct >= energyTgt.min * 0.6) score += 10;
  else if (energyPct >= energyTgt.min * 0.3) score += 5;

  // Alt managers alignment (max +15)
  const altPct = sw['Alt. Managers'] || 0;
  const altTgt = window.SECTOR_TARGETS['Alt. Managers'];
  if (altPct >= altTgt.min) score += 15;
  else if (altPct >= altTgt.min * 0.6) score += 8;
  else if (altPct >= altTgt.min * 0.3) score += 4;

  // Diversification (max +10)
  if (positionCount >= 10) score += 10;
  else if (positionCount >= 7) score += 6;
  else if (positionCount >= 5) score += 3;

  // Concentration penalty (max -15)
  const enriched = enrichPositions(state);
  const top1 = enriched[0]?.weight || 0;
  if (top1 > 30) score -= 15;
  else if (top1 > 25) score -= 8;
  else if (top1 > 20) score -= 3;

  // Cash balance (max +10, penalty if too much/too little)
  const eq = totalEquity(state);
  const cashPct = eq > 0 ? state.cash / (eq + state.cash) * 100 : 100;
  if (cashPct >= 15 && cashPct <= 30) score += 10;
  else if (cashPct >= 10 && cashPct <= 40) score += 5;
  else if (cashPct > 50) score -= 5; // too much cash drag

  // Overweight penalty (max -10)
  const semis = sw['Semiconductors'] || 0;
  if (semis > window.SECTOR_TARGETS['Semiconductors'].max + 10) score -= 10;
  else if (semis > window.SECTOR_TARGETS['Semiconductors'].max + 5) score -= 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── HISTORY ANALYSIS ──────────────────────────────────────────────
function historyDelta(state) {
  if (state.history.length < 2) return null;
  const latest = state.history[state.history.length - 1];
  const prev = state.history[state.history.length - 2];
  return {
    daysSince: Math.round((new Date(latest.date) - new Date(prev.date)) / 86400000),
    valueDelta: latest.totalValue - prev.totalValue,
    valueDeltaPct: prev.totalValue > 0 ? (latest.totalValue / prev.totalValue - 1) * 100 : 0,
    equityDelta: latest.equityValue - prev.equityValue,
    cashDelta: latest.cash - prev.cash,
  };
}

window.HardcapAnalytics = {
  totalEquity, totalCostBasis, totalGainLoss, totalGainLossPct,
  todayPnL, netPortfolio, sectorWeights, sectorGaps,
  enrichPositions, buyZoneStatus, icReadiness, historyDelta,
  bookValue, capPct,
};
