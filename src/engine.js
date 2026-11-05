// ═══════════════════════════════════════════════════════════════════
// HARDCAP — RULES + DEPLOYMENT ENGINE
// Deterministic. Same inputs, same dollars. The IC explains the plan;
// it does not set the amounts.
//
//  1. How much:  cash above the hold-back for the current market mode is
//                dry powder. Each run releases a scheduled slice of it.
//  2. Where:     every core sector (band minimum above zero) is filled
//                toward its target, measured against the fully deployed
//                book. Sectors get slots. Names you hold keep theirs; an
//                open slot goes to a name you pinned. Nothing you have not
//                pinned is opened, unless you switch that rule.
//  3. How fast:  a buy zone reviewed recently tilts the size up or down.
//                A stale zone does not steer anything.
//  4. Limits:    single-name cap, position count, smallest order.
//                Buy-only. Nothing here ever sells.
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const RULE_DEFAULTS = {
    cashNormal: 15,        // % of total capital held back in a normal market
    cashCorrection: 10,    // S&P 500 10-20% below its 52-week high
    cashBear: 5,           // 20-30% below
    cashCrash: 0,          // 30%+ below
    capPct: 22,            // single-name cap, % of the book
    maxPositions: 15,      // total names the engine will let you hold
    paceRuns: 3,           // monthly runs used to work off the starting backlog
    finishBy: null,        // 'YYYY-MM' — set once, on first use
    priceMode: 'tilt',     // 'tilt' | 'strict'
    minOrder: 150,         // smallest single buy, $
    staleZoneDays: 120,    // a buy zone older than this stops steering size
    newNames: 'pinned',    // 'pinned' = a new position opens only in a name you pinned
                           // 'conviction' = any buy-rated name may fill an open slot, best conviction first
  };

  const MODES = [
    { key: 'crash',      label: 'Crash',       floor: 30, cashKey: 'cashCrash',      share: 0.5 },
    { key: 'bear',       label: 'Bear market', floor: 20, cashKey: 'cashBear',       share: 0.5 },
    { key: 'correction', label: 'Correction',  floor: 10, cashKey: 'cashCorrection', share: 1 / 3 },
    { key: 'normal',     label: 'Normal',      floor: -Infinity, cashKey: 'cashNormal', share: 0 },
  ];

  const ACTIVE_SIGNALS = { 'Strong Buy': 1, 'Accumulate': 1 };
  const TILT = { below: 1.5, in: 1, above: 0.6, over: 0.3 };
  const STRICT = { below: 1.5, in: 1, above: 0, over: 0 };
  const ZONE_LABEL = { below: 'Below buy zone', in: 'In buy zone', above: 'Above fair value', over: 'Above zone high' };

  const num = (x) => { const n = parseFloat(x); return isFinite(n) ? n : null; };
  const pad2 = (n) => String(n).padStart(2, '0');

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function addMonths(ym, n) {
    const p = String(ym).split('-').map(Number);
    const d = new Date(p[0], (p[1] - 1) + n, 1);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  }
  function monthsUntil(todayStr, ym) {
    const t = String(todayStr).split('-').map(Number);
    const p = String(ym || '').split('-').map(Number);
    if (!p[0] || !p[1]) return 0;
    return (p[0] - t[0]) * 12 + (p[1] - t[1]);
  }
  function daysBetween(fromStr, toStr) {
    if (!fromStr) return null;
    const a = new Date(String(fromStr).slice(0, 10) + 'T12:00:00');
    const b = new Date(String(toStr).slice(0, 10) + 'T12:00:00');
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
    return Math.round((b - a) / 86400000);
  }

  // ─── RULES ─────────────────────────────────────────────────────────
  function getRules(state) {
    const r = Object.assign({}, RULE_DEFAULTS, (state && state.rules) || {});
    ['cashNormal', 'cashCorrection', 'cashBear', 'cashCrash', 'capPct', 'maxPositions', 'paceRuns', 'minOrder', 'staleZoneDays'].forEach(k => {
      const v = num(r[k]);
      r[k] = v == null || v < 0 ? RULE_DEFAULTS[k] : v;
    });
    r.maxPositions = Math.max(1, Math.round(r.maxPositions));
    r.paceRuns = Math.max(1, Math.round(r.paceRuns));
    if (r.priceMode !== 'strict') r.priceMode = 'tilt';
    if (r.newNames !== 'conviction') r.newNames = 'pinned';
    if (!/^\d{4}-\d{2}$/.test(String(r.finishBy || ''))) {
      r.finishBy = addMonths(todayISO().slice(0, 7), r.paceRuns - 1);
    }
    return r;
  }
  // Pins the finish month the first time the engine runs, so the schedule
  // counts down instead of sliding forward every month.
  function ensureRules(state) {
    const r = getRules(state);
    state.rules = Object.assign({}, state.rules || {}, { finishBy: r.finishBy });
    return state;
  }
  function setRule(state, key, value) {
    state.rules = Object.assign({}, state.rules || {});
    state.rules[key] = value;
    return state;
  }
  function marketMode(state) {
    const dd = Math.max(0, num(state && state.market && state.market.ddPct) || 0);
    const m = MODES.find(x => dd >= x.floor) || MODES[MODES.length - 1];
    return Object.assign({ ddPct: dd }, m);
  }
  function cashTargetPct(state) {
    const r = getRules(state);
    return Math.min(100, Math.max(0, r[marketMode(state).cashKey]));
  }

  // ─── PRICES ────────────────────────────────────────────────────────
  // Held names: the position price (CSV import, or live refresh if newer).
  // Other names: live quote, then a price you typed, then the dated
  // research snapshot. Anything too old is treated as no price at all.
  function priceFor(state, tkr, pos, today) {
    const u = (state.universe && state.universe[tkr]) || {};
    const snap = window.RESEARCH_SNAPSHOT || {};
    const now = Date.now();
    if (pos && pos.price > 0) {
      const live = u.liveQuoteAt && state.lastImport && u.liveQuoteAt > new Date(state.lastImport).getTime();
      return { price: pos.price, src: live ? 'live' : 'import', stale: false };
    }
    if (u.livePrice > 0 && u.liveQuoteAt && (now - u.liveQuoteAt) < 10 * 86400000) {
      return { price: u.livePrice, src: 'live', stale: (now - u.liveQuoteAt) > 4 * 86400000 };
    }
    if (u.manualPrice && u.manualPrice.value > 0) {
      const age = daysBetween(u.manualPrice.at, today);
      if (age != null && age <= 10) return { price: u.manualPrice.value, src: 'manual', stale: age > 4 };
    }
    const s = snap.data && snap.data[tkr];
    if (s && s.price > 0) {
      const age = daysBetween(snap.asOf, today);
      // the sample portfolio is priced off this snapshot, so the demo accepts it at any age
      const sample = !!(state && state.seedSource === 'sample');
      if (age != null && (age <= 14 || sample)) return { price: s.price, src: 'snapshot', stale: !sample && age > 4, asOf: snap.asOf };
    }
    return { price: null, src: null, stale: true };
  }

  // ─── BUY ZONE ──────────────────────────────────────────────────────
  function zoneInfo(u, price, rules, today) {
    const z = (u && u.buyZone) || {};
    const has = z.low > 0 && z.fair > z.low && z.high > z.fair;   // a complete, ordered zone
    const t = (u && u.thesis) || {};
    const reviewed = z.reviewed || t.quarterlyReviewedAt || t.anchorReviewed || t.lastReviewed || null;
    const ageDays = daysBetween(reviewed, today);
    const fresh = has && !z.placeholder && ageDays != null && ageDays <= rules.staleZoneDays;
    let cls = null;
    if (has && price > 0) cls = price <= z.low ? 'below' : price <= z.fair ? 'in' : price <= z.high ? 'above' : 'over';
    let why = null;
    if (!has) why = 'no buy zone set';
    else if (z.placeholder) why = 'placeholder zone';
    else if (ageDays == null) why = 'zone never reviewed';
    else if (!fresh) why = 'zone ' + ageDays + ' days old';
    const table = rules.priceMode === 'strict' ? STRICT : TILT;
    let mult;
    if (fresh && cls) mult = table[cls];
    else mult = rules.priceMode === 'strict' ? 0 : 1;
    return {
      has, low: z.low || null, fair: z.fair || null, high: z.high || null,
      reviewed, ageDays, fresh, placeholder: !!z.placeholder, cls,
      label: cls ? ZONE_LABEL[cls] : (has ? 'No price' : 'No zone'),
      pctVsFair: has && price > 0 ? (price / z.fair - 1) * 100 : null,
      mult, staleWhy: why,
    };
  }

  // ─── SLOTS ─────────────────────────────────────────────────────────
  // Positions are shared out across core sectors in proportion to their
  // targets (largest-remainder, at least one each).
  function allocateSlots(core, maxPositions) {
    const total = core.reduce((a, s) => a + s.targetPct, 0) || 1;
    const out = {};
    let used = 0;
    const rem = [];
    core.forEach(s => {
      const q = maxPositions * s.targetPct / total;
      const base = Math.max(1, Math.floor(q));
      out[s.name] = base; used += base;
      // a sector lifted to its one guaranteed slot has already had its rounding-up
      rem.push({ name: s.name, r: Math.floor(q) < 1 ? -1 : q - Math.floor(q), q });
    });
    rem.sort((a, b) => b.r - a.r);
    let i = 0;
    while (used < maxPositions && rem.length) { out[rem[i % rem.length].name]++; used++; i++; }
    const big = () => Object.keys(out).filter(k => out[k] > 1).sort((a, b) => out[b] - out[a])[0];
    while (used > maxPositions && big()) { out[big()]--; used--; }
    return out;
  }

  // ─── THE PLAN ──────────────────────────────────────────────────────
  // opts.amount  — manual budget override ($). Omit to use the rule.
  // opts.today   — 'YYYY-MM-DD', for tests.
  function plan(state, opts) {
    opts = opts || {};
    const today = opts.today || todayISO();
    const rules = getRules(state);
    const mode = marketMode(state);
    const TARGETS = window.SECTOR_TARGETS || {};
    const MAP = window.SECTOR_MAP || {};
    const universe = state.universe || {};
    const positions = state.positions || [];

    // capital
    const equity = positions.reduce((a, p) => a + p.shares * p.price, 0);
    const cash = Math.max(0, state.cash || 0);
    const total = equity + cash;
    const holdPct = Math.min(100, Math.max(0, rules[mode.cashKey]));
    const hold = total * holdPct / 100;
    const excess = Math.max(0, cash - hold);
    const runsLeft = Math.max(1, monthsUntil(today, rules.finishBy) + 1);
    const share = mode.key === 'normal' ? 1 / runsLeft : Math.max(1 / runsLeft, mode.share);
    const budgetRule = excess * share;
    const override = opts.amount != null && isFinite(opts.amount);
    const budget = override ? Math.max(0, Math.min(opts.amount, cash)) : budgetRule;
    // The book: what the invested portfolio will be once the hold-back is all that is left in cash.
    const book = Math.max(equity + (override ? budget : 0), total * (1 - holdPct / 100), equity);
    const capDollar = book * rules.capPct / 100;

    // holdings by ticker (a ticker may appear once per account in older saves)
    const held = {};
    positions.forEach(p => {
      const h = held[p.tkr] || (held[p.tkr] = { tkr: p.tkr, value: 0, shares: 0, price: p.price, cost: 0, name: p.name, sector: p.sector });
      h.value += p.shares * p.price; h.shares += p.shares; h.cost += p.shares * (p.cost || 0); h.price = p.price;
    });
    const sectorOf = (tkr) => (universe[tkr] && universe[tkr].sector) || (held[tkr] && held[tkr].sector) || MAP[tkr] || 'Other';

    // sectors
    const sectors = {};
    Object.keys(TARGETS).forEach(name => {
      const t = TARGETS[name];
      sectors[name] = { name, min: t.min, max: t.max, mid: (t.min + t.max) / 2, core: t.min > 0, color: t.color,
        cur: 0, targetPct: 0, target: 0, gap: 0, slots: 0, bought: 0, names: [], blockers: [] };
    });
    const ensureSector = (name) => sectors[name] || (sectors[name] = { name, min: 0, max: 0, mid: 0, core: false, color: '#b0a090',
      cur: 0, targetPct: 0, target: 0, gap: 0, slots: 0, bought: 0, names: [], blockers: [] });
    Object.keys(held).forEach(t => { ensureSector(sectorOf(t)).cur += held[t].value; });
    const core = Object.keys(sectors).map(k => sectors[k]).filter(s => s.core);
    const optionalHeld = Object.keys(sectors).map(k => sectors[k]).filter(s => !s.core).reduce((a, s) => a + s.cur, 0);
    const midSum = core.reduce((a, s) => a + s.mid, 0) || 1;
    const corePct = book > 0 ? Math.max(0, 100 - optionalHeld / book * 100) : 100;
    core.forEach(s => {
      s.targetPct = s.mid / midSum * corePct;
      s.target = book * s.targetPct / 100;
      s.gap = Math.max(0, s.target - s.cur);
    });
    const slots = allocateSlots(core, rules.maxPositions);
    core.forEach(s => { s.slots = slots[s.name] || 0; });

    // one row per name the engine knows about
    const tickers = Array.from(new Set(Object.keys(universe).concat(Object.keys(held))));
    const rows = tickers.map(tkr => {
      const u = universe[tkr] || null;
      const h = held[tkr] || null;
      const sec = ensureSector(sectorOf(tkr));
      const px = priceFor(state, tkr, h, today);
      const zone = zoneInfo(u || {}, px.price, rules, today);
      const conv = u && u.conviction != null ? Number(u.conviction) : null;
      const row = {
        tkr, name: (u && u.name) || (h && h.name) || tkr, sector: sec.name, core: sec.core,
        held: !!h, cur: h ? h.value : 0, shares: h ? h.shares : 0, costBasis: h ? h.cost : 0,
        inUniverse: !!u, conviction: conv, signal: u ? u.signal || null : null,
        pinned: !!(u && u.pinned), noBuy: !!(u && u.noBuy),
        price: px.price, priceSrc: px.src, priceStale: px.stale, zone,
        active: false, slot: false, target: 0, gap: 0, mult: zone.mult, neutral: 0, buy: 0, buyShares: null,
        status: '', statusText: '', reasons: [],
      };
      row.curPct = book > 0 ? row.cur / book * 100 : 0;
      if (!u) { row.status = 'untracked'; row.statusText = 'Not in your universe'; }
      else if (row.noBuy) { row.status = 'nobuy'; row.statusText = 'Marked never-buy'; }
      else if (row.signal === 'Sell' || row.signal === 'Trim') { row.status = 'sell'; row.statusText = 'Your signal is ' + row.signal; }
      else if (row.signal === 'Watch') { row.status = 'watch'; row.statusText = 'On Watch: not underwritten yet'; }
      else if (!ACTIVE_SIGNALS[row.signal]) { row.status = 'hold'; row.statusText = 'Your signal is Hold'; }
      else if (!sec.core) { row.status = 'optional'; row.statusText = sec.name + ' has no target'; }
      else row.active = true;
      sec.names.push(row);
      return row;
    });

    // slots: held names keep theirs. An open slot goes to a pinned name. A buy-rated
    // name you have not pinned sits on the bench (unless the rule is set to 'conviction').
    const heldCount = Object.keys(held).length;
    let newAllowed = Math.max(0, rules.maxPositions - heldCount);
    const rank = (a, b) => (b.pinned - a.pinned) || ((b.conviction || 0) - (a.conviction || 0)) || a.tkr.localeCompare(b.tkr);
    core.forEach(s => {
      s.names.filter(r => r.held).forEach(r => { r.slot = true; });
      s.freeSlots = Math.max(0, s.slots - s.names.filter(r => r.held).length);
    });
    // hand out new-name slots sector by sector, best-ranked first, within the global position limit
    const wanting = [];
    core.forEach(s => {
      let taken = 0;
      s.names.filter(r => !r.held && r.active).sort(rank).forEach(r => {
        if (rules.newNames === 'pinned' && !r.pinned) {
          r.active = false; r.status = 'bench'; r.statusText = 'Not pinned, so no new position';
        } else if (taken < s.freeSlots) { wanting.push(r); taken++; }
        else { r.active = false; r.status = 'noslot'; r.statusText = s.name + ' has ' + s.slots + ' slot' + (s.slots === 1 ? '' : 's') + ', all taken'; }
      });
    });
    wanting.sort(rank).forEach(r => {
      if (newAllowed > 0) { r.slot = true; newAllowed--; }
      else { r.active = false; r.status = 'noslot'; r.statusText = 'Position limit of ' + rules.maxPositions + ' reached'; }
    });

    // name targets: conviction-weighted across the names holding a slot in the sector
    core.forEach(s => {
      const slotNames = s.names.filter(r => r.slot);
      const w = (r) => Math.max(1, r.conviction == null ? 50 : r.conviction);
      const sumW = slotNames.reduce((a, r) => a + w(r), 0) || 1;
      slotNames.forEach(r => {
        r.target = s.target * w(r) / sumW;
        r.gap = Math.max(0, r.target - r.cur);
      });
    });

    // who can take money this run
    rows.forEach(r => {
      if (!r.active) return;
      if (!(r.price > 0)) { r.active = false; r.status = 'noprice'; r.statusText = 'No current price'; return; }
      if (rules.priceMode === 'strict' && r.mult === 0) {
        r.active = false; r.status = 'price';
        r.statusText = r.zone.fresh ? r.zone.label + ' (strict mode buys at or below fair value only)' : 'Strict mode needs a current buy zone (' + (r.zone.staleWhy || 'none') + ')';
        return;
      }
      if (capDollar - r.cur <= 1) { r.active = false; r.status = 'cap'; r.statusText = 'At the ' + rules.capPct + '% cap'; return; }
      if (r.gap <= 1) { r.active = false; r.status = 'full'; r.statusText = 'At its target weight'; return; }
    });

    // neutral water-fill: budget in proportion to each name's gap, inside sector and cap room
    function fill(pool, amount, weightOf) {
      const got = {};
      pool.forEach(r => { got[r.tkr] = 0; });
      const secUsed = {};
      let left = amount;
      for (let pass = 0; pass < 40 && left > 0.5; pass++) {
        const open = pool.filter(r => {
          const s = sectors[r.sector];
          const room = Math.min(r.gap - got[r.tkr], capDollar - r.cur - got[r.tkr], s.gap - (secUsed[s.name] || 0));
          return room > 0.5 && weightOf(r) > 0;
        });
        if (!open.length) break;
        const sw = open.reduce((a, r) => a + weightOf(r), 0);
        let used = 0;
        open.forEach(r => {
          const s = sectors[r.sector];
          const room = Math.min(r.gap - got[r.tkr], capDollar - r.cur - got[r.tkr], s.gap - (secUsed[s.name] || 0));
          const give = Math.max(0, Math.min(left * weightOf(r) / sw, room));
          got[r.tkr] += give; secUsed[s.name] = (secUsed[s.name] || 0) + give; used += give;
        });
        left -= used;
        if (used < 0.01) break;
      }
      return { got, left };
    }

    let dropped = [];
    let buys = {};
    let spend = 0;
    for (let guard = 0; guard < 40; guard++) {
      const pool = rows.filter(r => r.active && dropped.indexOf(r.tkr) < 0);
      const neutral = fill(pool, budget, r => r.gap);
      // price tilt: slow the expensive names, let the cheap ones pick up what they free
      const b = {};
      let freed = 0;
      pool.forEach(r => {
        const n = neutral.got[r.tkr];
        r.neutral = n;
        const m = Math.min(1, r.mult);
        b[r.tkr] = n * m; freed += n * (1 - m);
      });
      const boosted = pool.filter(r => r.mult > 1 && neutral.got[r.tkr] > 0);
      if (freed > 0.5 && boosted.length) {
        const want = {};
        let sumWant = 0;
        boosted.forEach(r => {
          const s = sectors[r.sector];
          const secSpent = pool.filter(x => x.sector === r.sector).reduce((a, x) => a + b[x.tkr], 0);
          const room = Math.min(r.gap - b[r.tkr], capDollar - r.cur - b[r.tkr], s.gap - secSpent);
          want[r.tkr] = Math.max(0, Math.min(neutral.got[r.tkr] * (r.mult - 1), room));
          sumWant += want[r.tkr];
        });
        const k = sumWant > 0 ? Math.min(1, freed / sumWant) : 0;
        boosted.forEach(r => { b[r.tkr] += want[r.tkr] * k; });
      }
      // smallest-order rule: drop the smallest buy under the minimum and run again
      const small = pool.filter(r => b[r.tkr] > 0 && b[r.tkr] < rules.minOrder).sort((x, y) => b[x.tkr] - b[y.tkr])[0];
      if (small) { dropped.push(small.tkr); continue; }
      buys = b;
      break;
    }

    rows.forEach(r => {
      const amt = Math.floor(buys[r.tkr] || 0);
      if (r.active && dropped.indexOf(r.tkr) >= 0) {
        r.status = 'small'; r.statusText = 'Its share this run is under the $' + rules.minOrder + ' minimum order';
      } else if (r.active && amt >= 1) {
        r.buy = amt; r.status = 'buy';
        r.buyShares = r.price > 0 ? amt / r.price : null;
        r.statusText = r.held ? 'Add' : 'New position';
        sectors[r.sector].bought += amt; spend += amt;
        // why, in plain words
        const s = sectors[r.sector];
        r.reasons.push(s.name + ' ' + (book > 0 ? (s.cur / book * 100).toFixed(1) : '0') + '% vs ' + s.targetPct.toFixed(1) + '% target');
        if (r.conviction != null) r.reasons.push('Conviction ' + r.conviction);
        if (r.pinned && !r.held) r.reasons.push('Pinned');
        const th = (universe[r.tkr] && universe[r.tkr].thesis) || {};
        if (!th.bull || /^not written yet/i.test(th.bull)) r.reasons.push('No thesis on file');
        if (r.zone.fresh && r.zone.cls) {
          r.reasons.push(r.zone.label + (r.mult !== 1 ? ' · ' + r.mult + '× size' : ''));
        } else if (rules.priceMode !== 'strict') {
          r.reasons.push('Price tilt off: ' + (r.zone.staleWhy || 'no zone'));
        }
        if (r.priceSrc === 'snapshot') r.reasons.push('Price from ' + (window.RESEARCH_SNAPSHOT && window.RESEARCH_SNAPSHOT.asOf) + ' snapshot');
        if (r.priceStale && r.priceSrc !== 'snapshot') r.reasons.push('Price is several days old');
      } else if (r.active) {
        if (sectors[r.sector].gap <= 1) { r.status = 'full'; r.statusText = r.sector + ' is at its target'; }
        else { r.status = 'none'; r.statusText = 'No share of this run'; }
      }
      r.after = r.cur + r.buy;
      r.afterPct = book > 0 ? r.after / book * 100 : 0;
    });

    // what is holding each core sector back
    core.forEach(s => {
      s.curPct = book > 0 ? s.cur / book * 100 : 0;
      s.after = s.cur + s.bought;
      s.afterPct = book > 0 ? s.after / book * 100 : 0;
      s.remaining = Math.max(0, s.target - s.after);
      s.fundable = s.names.some(r => r.status === 'buy' || r.status === 'small' || r.status === 'none');
      const anyCandidate = s.names.some(r => r.slot && !r.held) || s.fundable;
      // open slots, and the buy-rated names waiting for a pin that could fill them
      s.openSlots = Math.max(0, s.slots - s.names.filter(r => r.slot).length);
      s.bench = s.names.filter(r => r.status === 'bench').sort(rank).map(r => ({ tkr: r.tkr, conviction: r.conviction, signal: r.signal }));
      s.names.forEach(r => {
        if (r.status === 'buy' || r.status === 'full' || r.status === 'none' || r.status === 'untracked' || r.status === 'bench') return;
        // show what matters: names you hold, names with a slot, names you pinned.
        // If the sector has nothing it can buy at all, show the whole bench.
        if (!(r.held || r.slot || r.pinned || !anyCandidate)) return;
        s.blockers.push({ tkr: r.tkr, reason: r.statusText, status: r.status, held: r.held });
      });
    });

    const overCap = rows.filter(r => r.held && r.cur > capDollar + 1).map(r => ({ tkr: r.tkr, pct: r.curPct, over: r.cur - capDollar }));
    const buyRows = rows.filter(r => r.buy > 0).sort((a, b) => b.buy - a.buy);
    const stale = rows.filter(r => (r.slot || r.held) && r.inUniverse && !r.noBuy && sectors[r.sector].core && !r.zone.fresh)
      .map(r => ({ tkr: r.tkr, why: r.zone.staleWhy, ageDays: r.zone.ageDays }));

    return {
      today, rules, mode, total, cash, equity, holdPct, hold, excess, runsLeft, share,
      budgetRule, budget, override, book, capDollar,
      sectors: Object.keys(sectors).map(k => sectors[k]),
      coreSectors: core,
      rows, buys: buyRows, spend, unplaced: Math.max(0, budget - spend),
      cashAfter: cash - spend, cashAfterPct: total > 0 ? (cash - spend) / total * 100 : 0,
      overCap, staleZones: stale,
      untracked: rows.filter(r => r.status === 'untracked' && r.held).map(r => ({ tkr: r.tkr, value: r.cur })),
      optionalHeld,
    };
  }

  // ─── VERDICTS (Holdings table) — read straight off the plan ────────
  function holdingsVerdict(state) {
    const P = plan(state);
    const byTkr = {};
    P.rows.forEach(r => { byTkr[r.tkr] = r; });
    const enriched = window.HardcapAnalytics.enrichPositions(state);
    const cap = P.rules.capPct;
    return enriched.map(p => {
      const r = byTkr[p.tkr];
      const u = state.universe[p.tkr];
      let verdict = 'HOLD', urgency = 'normal';
      const rationale = [];
      if (!u || !r) {
        return Object.assign({}, p, { verdict: 'NO COVERAGE', urgency: 'low', zoneStatus: null,
          rationale: ['Not in your universe yet. Add a thesis to enable analysis.'] });
      }
      const zoneStatus = window.HardcapAnalytics.buyZoneStatus(p.price, u.buyZone);
      const z = r.zone;
      const zoneNote = z.fresh ? z.label + '.' : 'Price check is off (' + (z.staleWhy || 'no zone') + ').';
      if (r.status === 'buy') {
        verdict = z.fresh && z.cls === 'below' ? 'ADD AGGRESSIVELY' : (z.fresh && (z.cls === 'above' || z.cls === 'over')) ? 'ADD SLOWLY' : 'ADD';
        urgency = verdict === 'ADD SLOWLY' ? 'normal' : 'high';
        rationale.push('$' + r.buy.toLocaleString() + ' this run. ' + zoneNote);
      } else if (r.status === 'nobuy') { verdict = 'DO NOT ADD'; urgency = 'low'; rationale.push('Marked never-buy. The engine and the IC skip it.'); }
      else if (r.status === 'watch') { verdict = 'DO NOT ADD'; urgency = 'low'; rationale.push('On Watch: not underwritten yet.'); }
      else if (r.status === 'sell') { verdict = String(u.signal).toUpperCase(); urgency = 'high'; rationale.push('Active ' + String(u.signal).toLowerCase() + ' signal in your universe.'); }
      else if (r.status === 'hold') { rationale.push('Your signal is Hold, so no new money. ' + zoneNote); }
      else if (r.status === 'cap') { verdict = 'AT CAP'; rationale.push('At the ' + cap + '% single-name cap. No new money; nothing is sold.'); }
      else if (r.status === 'price') { verdict = 'WAIT FOR PULLBACK'; rationale.push(r.statusText + '.'); }
      else if (r.status === 'full') { rationale.push('At its target weight. New money goes to names further below target.'); }
      else if (r.status === 'small') { rationale.push(r.statusText + '. It gets money when its share is larger.'); }
      else if (r.status === 'optional') { rationale.push(r.sector + ' has no target, so the engine does not add to it.'); }
      else if (r.status === 'noprice') { rationale.push('No current price loaded.'); }
      else { rationale.push(r.statusText || 'No share of this run.'); }
      if (p.weight > cap) rationale.push(p.weight.toFixed(1) + '% of the book, above the ' + cap + '% cap.');
      if (p.glPct < -15) rationale.push('Down ' + Math.abs(p.glPct).toFixed(1) + '% from cost. Re-check the thesis before adding.');
      return Object.assign({}, p, { verdict, rationale, urgency, zoneStatus });
    });
  }

  // ─── Legacy adapter (Exposure tab "what if I deploy $X") ───────────
  function generateDeployment(state, cashToDeploy) {
    const P = plan(state, { amount: cashToDeploy });
    const bySector = {};
    P.sectors.forEach(s => { bySector[s.name] = s; });
    const T = window.SECTOR_TARGETS || {};
    return {
      cashAvailable: cashToDeploy,
      cashDeployed: P.spend,
      cashReserved: Math.max(0, cashToDeploy - P.spend),
      reserveTarget: 0,
      candidatesConsidered: P.rows.filter(r => r.slot).length,
      plan: P,
      allocations: P.buys.map((r, i) => ({
        tkr: r.tkr, name: r.name, sector: r.sector, conviction: r.conviction == null ? 50 : r.conviction, signal: r.signal,
        price: r.price, held: r.held, currentWeight: r.curPct,
        currentSectorWeight: bySector[r.sector] ? bySector[r.sector].curPct || 0 : 0,
        sectorTarget: T[r.sector] || null, buyZone: r.zone,
        zoneLabel: r.zone.fresh ? r.zone.label : 'Zone stale',
        shares: Math.floor((r.buyShares || 0) * 1000) / 1000, dollarAmount: r.buy, tier: i + 1, reasons: r.reasons,
      })),
      skippedHoldings: P.rows.filter(r => r.held && (r.status === 'hold' || r.status === 'watch' || r.status === 'sell'))
        .map(r => ({ tkr: r.tkr, signal: r.signal, weight: r.curPct })),
    };
  }

  window.HardcapRules = { DEFAULTS: RULE_DEFAULTS, MODES, get: getRules, ensure: ensureRules, set: setRule, marketMode, cashTargetPct, todayISO, addMonths, daysBetween };
  window.HardcapEngine = { plan, priceFor, zoneInfo, allocateSlots };
  window.HardcapDeployment = { generate: generateDeployment, verdict: holdingsVerdict };
})();
