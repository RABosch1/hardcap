// ═══════════════════════════════════════════════════════════════════
// HARDCAP — RISK ENGINE
// Stress tests, downside scenarios, factor exposure analysis.
// The Rowan core: "if this position goes against me, am I OK?"
// ═══════════════════════════════════════════════════════════════════

// ─── FACTOR MAP ────────────────────────────────────────────────────
// Each ticker has factor loadings (0 to 1) showing exposure to risk factors.
// These are YOUR assessments, editable per-ticker via universe.
// 1.0 = pure exposure, 0.5 = significant, 0.2 = modest, 0 = none.

window.FACTOR_LOADINGS = {
  NVDA: {
    'AI Capex Cycle':       1.0,
    'Taiwan Geopolitics':   0.6,  // indirect via TSM
    'US-China Tensions':    0.7,
    'Risk-Off / Multiple':  0.7,
  },
  TSM: {
    'Taiwan Geopolitics':   1.0,  // existential
    'AI Capex Cycle':       0.8,
    'US-China Tensions':    0.6,
    'Semiconductor Cycle':  0.9,
  },
  AMZN: {
    'AI Capex Cycle':       0.5,  // AWS demand
    'Consumer Spending':    0.6,
    'Risk-Off / Multiple':  0.4,
  },
  GOOGL: {
    'AI Capex Cycle':       0.5,
    'Consumer Spending':    0.4,
    'Search Disruption':    0.6,
    'Antitrust Risk':       0.5,
  },
  META: {
    'Consumer Spending':    0.6,
    'Risk-Off / Multiple':  0.4,
    'AI Capex Cycle':       0.4,
  },
  CVX: {
    'Oil Price':            1.0,
    'Energy Transition':    0.5,
  },
  XOM: {
    'Oil Price':            1.0,
    'Energy Transition':    0.5,
  },
  COP: {
    'Oil Price':            1.0,
    'Energy Transition':    0.4,
  },
  EOG: {
    'Oil Price':            1.0,
    'Energy Transition':    0.3,
  },
  SLB: {
    'Oil Price':            0.8,
    'Energy Transition':    0.3,
  },
  APO: {
    'Credit Cycle':         0.9,
    'Interest Rates':       0.6,
    'Private Credit':       1.0,
    'Insurance / Athene':   0.7,
  },
  BX: {
    'Real Estate':          0.7,
    'Credit Cycle':         0.6,
    'Interest Rates':       0.6,
  },
  KKR: {
    'Credit Cycle':         0.7,
    'Interest Rates':       0.5,
    'Private Credit':       0.7,
  },
  ARES: {
    'Credit Cycle':         0.9,
    'Private Credit':       1.0,
    'Interest Rates':       0.6,
  },
  PLTR: {
    'Risk-Off / Multiple':  0.9,
    'Defense Spending':     0.6,
    'AI Capex Cycle':       0.4,
  },
  BTC: {
    'Risk-Off / Multiple':  0.9,
    'Crypto Sentiment':     1.0,
  },
  // Added Oct 2026 so new names are not invisible to the stress tests.
  // First-pass loadings: edit them as you learn the names.
  TTE: {
    'Oil Price':            0.9,
    'Energy Transition':    0.4,
  },
  CEG: {
    'AI Capex Cycle':       0.6,   // priced on data-center power demand
    'Risk-Off / Multiple':  0.5,
    'Interest Rates':       0.3,
  },
  VST: {
    'AI Capex Cycle':       0.6,
    'Risk-Off / Multiple':  0.5,
    'Interest Rates':       0.3,
  },
  CCJ: {
    'AI Capex Cycle':       0.4,
    'Risk-Off / Multiple':  0.7,
  },
  GEV: {
    'AI Capex Cycle':       0.7,
    'Risk-Off / Multiple':  0.6,
  },
};

// ─── STRESS SCENARIOS ──────────────────────────────────────────────
// Each scenario specifies a shock to one or more factors,
// and the system computes portfolio impact.
// shock = expected % change in price for a position with full (1.0) factor loading.

window.STRESS_SCENARIOS = [
  {
    id: 'oil-crash',
    name: 'Oil to $50',
    description: 'WTI breaks below $60 sustainably. OPEC+ discipline fails, demand softens.',
    factors: { 'Oil Price': -0.30 },
    severity: 'high',
  },
  {
    id: 'ai-capex-pause',
    name: 'AI Capex Pause',
    description: 'Hyperscaler 2027 capex guidance comes in flat. Multiple compression on every AI name.',
    factors: { 'AI Capex Cycle': -0.35 },
    severity: 'high',
  },
  {
    id: 'taiwan-stress',
    name: 'Taiwan Stress Event',
    description: 'PLA exercises escalate to a serious incident short of war. Market reprices Taiwan risk.',
    factors: { 'Taiwan Geopolitics': -0.40, 'US-China Tensions': -0.20 },
    severity: 'extreme',
  },
  {
    id: 'credit-cycle',
    name: 'Private Credit Default Cycle',
    description: 'First real default cycle for private credit. Loss rates exceed 3%. APO/ARES marks come down.',
    factors: { 'Credit Cycle': -0.25, 'Private Credit': -0.20 },
    severity: 'high',
  },
  {
    id: 'rate-shock',
    name: 'Rates Spike +200bps',
    description: 'Fed forced to hike on inflation reacceleration. Long-duration assets reprice.',
    factors: { 'Interest Rates': -0.18, 'Real Estate': -0.15, 'Risk-Off / Multiple': -0.20 },
    severity: 'medium',
  },
  {
    id: 'risk-off',
    name: 'Risk-Off Drawdown (-20%)',
    description: 'Generalized equity drawdown on macro shock. High-multiple names hit worst.',
    factors: { 'Risk-Off / Multiple': -0.30, 'Crypto Sentiment': -0.40, 'AI Capex Cycle': -0.25 },
    severity: 'medium',
  },
  {
    id: 'crypto-crash',
    name: 'Crypto Drawdown',
    description: 'BTC retraces to $50k on regulatory or ETF outflow shock.',
    factors: { 'Crypto Sentiment': -0.45 },
    severity: 'low',
  },
];

// ─── COMPUTE STRESS IMPACT ─────────────────────────────────────────
function applyStress(state, scenario) {
  const positions = state.positions;
  const totalEq = positions.reduce((a, p) => a + p.shares * p.price, 0);
  const totalPort = totalEq + state.cash;

  let totalImpact = 0;
  const positionImpacts = [];

  positions.forEach(p => {
    const value = p.shares * p.price;
    const loadings = window.FACTOR_LOADINGS[p.tkr] || {};
    let positionShock = 0;

    Object.keys(scenario.factors).forEach(factor => {
      const loading = loadings[factor] || 0;
      const factorShock = scenario.factors[factor];
      positionShock += loading * factorShock;
    });

    // Cap shock at -80% (no instrument goes to zero in a stress test, except crypto)
    const cap = p.tkr === 'BTC' ? -0.95 : -0.80;
    positionShock = Math.max(positionShock, cap);

    const dollarImpact = value * positionShock;
    totalImpact += dollarImpact;

    positionImpacts.push({
      tkr: p.tkr,
      currentValue: value,
      shockPct: positionShock,
      dollarImpact,
      newValue: value + dollarImpact,
    });
  });

  return {
    scenario,
    totalImpact,           // dollar P&L impact
    totalImpactPct: totalEq > 0 ? totalImpact / totalEq * 100 : 0,
    portfolioImpactPct: totalPort > 0 ? totalImpact / totalPort * 100 : 0,
    portfolioBefore: totalPort,
    portfolioAfter: totalPort + totalImpact,
    positionImpacts: positionImpacts.sort((a, b) => a.dollarImpact - b.dollarImpact),
  };
}

function runAllStressTests(state) {
  return window.STRESS_SCENARIOS.map(s => applyStress(state, s))
    .sort((a, b) => a.totalImpact - b.totalImpact);
}

// ─── FACTOR EXPOSURE — total $ exposure to each factor across portfolio ───
function factorExposure(state) {
  const factorTotals = {};
  state.positions.forEach(p => {
    const value = p.shares * p.price;
    const loadings = window.FACTOR_LOADINGS[p.tkr] || {};
    Object.keys(loadings).forEach(factor => {
      const loading = loadings[factor];
      factorTotals[factor] = (factorTotals[factor] || 0) + value * loading;
    });
  });
  const totalEq = state.positions.reduce((a, p) => a + p.shares * p.price, 0);
  return Object.entries(factorTotals)
    .map(([factor, dollarExposure]) => ({
      factor,
      dollarExposure,
      pctOfPortfolio: totalEq > 0 ? dollarExposure / totalEq * 100 : 0,
    }))
    .sort((a, b) => b.dollarExposure - a.dollarExposure);
}

// ─── POSITION-LEVEL DOWNSIDE ───────────────────────────────────────
// "If this name goes to zero, what happens?"
// "What's the worst-case loss in any single stress scenario?"
function positionDownside(state) {
  const totalEq = state.positions.reduce((a, p) => a + p.shares * p.price, 0);
  const allStress = runAllStressTests(state);

  return state.positions.map(p => {
    const value = p.shares * p.price;
    const weight = totalEq > 0 ? value / totalEq * 100 : 0;
    // Worst single-scenario impact for this position
    let worstScenario = null;
    let worstImpact = 0;
    allStress.forEach(s => {
      const posImpact = s.positionImpacts.find(pi => pi.tkr === p.tkr);
      if (posImpact && posImpact.dollarImpact < worstImpact) {
        worstImpact = posImpact.dollarImpact;
        worstScenario = s.scenario;
      }
    });
    return {
      tkr: p.tkr,
      value,
      weight,
      ifZero: -value,                     // total loss
      ifZeroPctPortfolio: -weight,        // % of portfolio lost
      worstStressDollar: worstImpact,
      worstStressPct: value > 0 ? worstImpact / value * 100 : 0,
      worstStressScenario: worstScenario,
    };
  }).sort((a, b) => a.worstStressDollar - b.worstStressDollar);
}

// ─── REQUIRED TRIM CALCULATION ─────────────────────────────────────
// Cycle 3 preview: "you must trim X dollars to get back under cap"
function requiredTrims(state) {
  // weights against the book (see HardcapAnalytics.bookValue); cap from your rules
  const totalEq = window.HardcapAnalytics.bookValue(state);
  const cap = window.HardcapAnalytics.capPct(state);
  const trims = [];

  // Position-level: any holding over the single-name cap
  state.positions.forEach(p => {
    const value = p.shares * p.price;
    const weight = totalEq > 0 ? value / totalEq * 100 : 0;
    if (weight > cap) {
      const targetValue = cap / 100 * totalEq;
      const trimDollar = value - targetValue;
      const trimShares = Math.ceil(trimDollar / p.price * 100) / 100;
      trims.push({
        type: 'position',
        tkr: p.tkr,
        currentWeight: weight,
        capWeight: cap,
        trimDollar,
        trimShares,
        urgency: weight > cap + 8 ? 'critical' : 'high',
        reason: `Position is ${weight.toFixed(1)}% of book, over your ${cap}% single-stock cap`,
      });
    }
  });

  // Sector-level: any sector over max
  const sw = window.HardcapAnalytics.sectorWeights(state);
  Object.keys(window.SECTOR_TARGETS).forEach(sector => {
    const tgt = window.SECTOR_TARGETS[sector];
    const cur = sw[sector] || 0;
    if (cur > tgt.max) {
      const dollarOver = (cur - tgt.max) / 100 * totalEq;
      trims.push({
        type: 'sector',
        sector,
        currentWeight: cur,
        capWeight: tgt.max,
        trimDollar: dollarOver,
        urgency: cur > tgt.max + 10 ? 'critical' : cur > tgt.max + 5 ? 'high' : 'medium',
        reason: `${sector} at ${cur.toFixed(1)}% of book is over its ${tgt.max}% ceiling`,
      });
    }
  });

  return trims.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.urgency] - order[b.urgency];
  });
}

// ─── DRIFT DETECTION ───────────────────────────────────────────────
// Compare current state to previous snapshot. What changed? Is portfolio
// drifting away from strategic targets, or toward them?
function detectDrift(state) {
  if (!state.history || state.history.length < 2) return null;

  const latest = state.history[state.history.length - 1];
  const prev = state.history[state.history.length - 2];
  const daysSince = Math.round((new Date(latest.date) - new Date(prev.date)) / 86400000);

  // Compute sector weights for both snapshots (using stored positions)
  const sectorsFrom = (snap) => {
    const totalEq = snap.positions.reduce((a, p) => a + p.value, 0);
    const m = {};
    snap.positions.forEach(p => {
      const sec = window.SECTOR_MAP[p.tkr] || 'Other';
      m[sec] = (m[sec] || 0) + p.value;
    });
    const out = {};
    Object.keys(m).forEach(s => out[s] = totalEq > 0 ? m[s] / totalEq * 100 : 0);
    return out;
  };

  const swNow = sectorsFrom(latest);
  const swPrev = sectorsFrom(prev);

  const drifts = [];
  const allSectors = new Set([...Object.keys(swNow), ...Object.keys(swPrev), ...Object.keys(window.SECTOR_TARGETS)]);
  allSectors.forEach(sector => {
    if (sector === 'Cash') return;
    const cur = swNow[sector] || 0;
    const old = swPrev[sector] || 0;
    const delta = cur - old;
    const tgt = window.SECTOR_TARGETS[sector];
    const tgtMid = tgt ? (tgt.min + tgt.max) / 2 : null;

    // Is the drift moving us toward or away from target?
    let direction = 'neutral';
    if (tgt && tgtMid != null) {
      const oldDistance = Math.abs(old - tgtMid);
      const newDistance = Math.abs(cur - tgtMid);
      if (newDistance < oldDistance - 0.5) direction = 'converging';
      else if (newDistance > oldDistance + 0.5) direction = 'diverging';
    }

    if (Math.abs(delta) >= 0.5) {  // only report meaningful moves
      drifts.push({
        sector,
        from: old,
        to: cur,
        delta,
        direction,
        target: tgt,
        targetMid: tgtMid,
        distanceFromTarget: tgtMid != null ? cur - tgtMid : null,
      });
    }
  });

  // Position-level drift: did anything become significantly larger or smaller?
  const positionDrifts = [];
  const tkrSet = new Set([...latest.positions.map(p => p.tkr), ...prev.positions.map(p => p.tkr)]);
  const totalEqNow = latest.positions.reduce((a, p) => a + p.value, 0);
  const totalEqPrev = prev.positions.reduce((a, p) => a + p.value, 0);

  tkrSet.forEach(tkr => {
    const now = latest.positions.find(p => p.tkr === tkr);
    const old = prev.positions.find(p => p.tkr === tkr);
    const wNow = now && totalEqNow > 0 ? now.value / totalEqNow * 100 : 0;
    const wOld = old && totalEqPrev > 0 ? old.value / totalEqPrev * 100 : 0;
    const wDelta = wNow - wOld;
    if (Math.abs(wDelta) >= 1) {
      positionDrifts.push({
        tkr,
        weightNow: wNow,
        weightOld: wOld,
        weightDelta: wDelta,
        added: !old,
        removed: !now,
      });
    }
  });

  return {
    daysSince,
    fromDate: prev.date,
    toDate: latest.date,
    portfolioDelta: latest.totalValue - prev.totalValue,
    portfolioDeltaPct: prev.totalValue > 0 ? (latest.totalValue / prev.totalValue - 1) * 100 : 0,
    sectorDrifts: drifts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    positionDrifts: positionDrifts.sort((a, b) => Math.abs(b.weightDelta) - Math.abs(a.weightDelta)),
  };
}

window.HardcapRisk = {
  applyStress,
  runAllStressTests,
  factorExposure,
  positionDownside,
  requiredTrims,
  detectDrift,
};
