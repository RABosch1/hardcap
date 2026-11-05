// ═══════════════════════════════════════════════════════════════════
// HARDCAP — SCORECARD
// One computed fact sheet per name. Every figure carries where it came
// from, so nothing stale is passed off as current:
//   live — your data feed, with the fetch date
//   snap — the dated research snapshot (approximate)
//   seed — typed into the universe in May 2026 and never verified
// The Deploy tab shows it; the IC receives it as its evidence.
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const DAY = 86400000;
  const isNum = (x) => typeof x === 'number' && isFinite(x);
  const r1 = (x) => isNum(x) ? Math.round(x * 10) / 10 : null;
  const r2 = (x) => isNum(x) ? Math.round(x * 100) / 100 : null;
  const iso = (ts) => ts ? new Date(ts).toISOString().slice(0, 10) : null;

  // first non-null wins: [value, source]
  function pick() {
    for (let i = 0; i < arguments.length; i++) {
      const a = arguments[i];
      if (a && isNum(a[0])) return { v: a[0], src: a[1] };
    }
    return { v: null, src: null };
  }

  function build(state, tkr, planRow, book) {
    const u = (state.universe && state.universe[tkr]) || {};
    const RS = window.RESEARCH_SNAPSHOT || {};
    const snap = (RS.data && RS.data[tkr]) || null;
    const snapAge = RS.asOf ? Math.round((Date.now() - new Date(RS.asOf + 'T12:00:00').getTime()) / DAY) : null;
    const snapOk = snap && snapAge != null && (snapAge <= 45 || state.seedSource === 'sample');   // context, not a price to trade on (the demo accepts it at any age)
    const live = u.liveSnapshot || null;          // parsed feed values, nulls kept
    const deep = u.deepFundamentals || null;
    const ex = u.fundExtras || null;
    const liveAt = (live && live.fetchedAt) || (deep && deep.fetchedAt) || null;
    const liveAge = liveAt ? Math.round((Date.now() - liveAt) / DAY) : null;
    const liveOk = liveAge != null && liveAge <= 45;
    const seed = u.fundamentals || {};
    const L = (v) => liveOk ? [v, 'live'] : null;
    const S = (v) => snapOk ? [v, 'snap'] : null;
    const D = (v) => !liveAt ? [v, 'seed'] : null;   // once the feed has answered, seeds are retired

    const price = planRow ? planRow.price : null;
    const m = {};
    m.fwdPe      = pick(L(ex && ex.forwardPE), L(live && live.fwdPe), S(snap && snap.fwdPe), D(seed.fwdPe));
    m.pe         = pick(L(ex && ex.trailingPE), L(live && live.pe), D(seed.pe));
    m.pe5        = pick(S(snap && snap.pe5));                       // 5-yr average forward P/E (snapshot only)
    m.peg        = pick(L(live && live.peg), D(seed.peg));
    m.evEbitda   = pick(L(deep && deep.evToEbitda), L(ex && ex.evToEbitda));
    m.ps         = pick(L(deep && deep.priceToSales));
    m.pb         = pick(L(deep && deep.priceToBook));
    m.fcfYield   = pick(L(live && live.fcfYield), D(seed.fcfYield));
    m.divYield   = pick(L(ex && ex.dividend && ex.dividend.forwardYieldPct), L(live && live.dividendYield), S(snap && snap.yld));
    m.divYield5  = pick(S(snap && snap.yld5));
    m.revGrowth  = pick(L(live && live.revGrowth), D(seed.revGrowth));            // latest quarter, year on year
    m.rev5yCagr  = pick(L(deep && deep.trends && deep.trends.revenueCAGRPct));
    m.fcf5yCagr  = pick(L(deep && deep.trends && deep.trends.fcfCAGRPct));
    m.opMargin   = pick(L(live && live.marginOp), D(seed.marginOp));
    m.opMargin5  = pick(L(deep && deep.trends && deep.trends.avgOpMarginPct));
    m.roe        = pick(L(live && live.roe), D(seed.roe));
    m.roe5       = pick(L(deep && deep.trends && deep.trends.avgROEPct));
    m.debtEbitda = pick(L(live && live.debtEbitda), D(seed.debtEbitda));
    m.sharesChg5 = pick(L(deep && deep.trends && deep.trends.sharesOutChangePct));
    m.hi52       = pick(L(deep && deep.week52High), L(ex && ex.week52High), S(snap && snap.hi52));
    m.lo52       = pick(L(deep && deep.week52Low), L(ex && ex.week52Low));
    m.ma200      = pick(L(ex && ex.ma200));
    m.beta       = pick(L(deep && deep.beta), L(live && live.beta));
    m.marketCapB = pick(L(live && live.marketCapB));
    m.target     = pick(L(ex && ex.analyst && ex.analyst.targetPrice));
    m.epsThisYr  = pick(L(ex && ex.epsEstCurrentYear));
    m.epsNextYr  = pick(L(ex && ex.epsEstNextYear));

    // derived, only from figures that exist
    const d = {};
    d.offHighPct   = isNum(price) && isNum(m.hi52.v) && m.hi52.v > 0 ? r1((price / m.hi52.v - 1) * 100) : null;
    d.vsMa200Pct   = isNum(price) && isNum(m.ma200.v) && m.ma200.v > 0 ? r1((price / m.ma200.v - 1) * 100) : null;
    d.peVsOwnPct   = isNum(m.fwdPe.v) && isNum(m.pe5.v) && m.pe5.v > 0 ? r1((m.fwdPe.v / m.pe5.v - 1) * 100) : null;
    d.yieldVsOwnPct = isNum(m.divYield.v) && isNum(m.divYield5.v) && m.divYield5.v > 0 ? r1((m.divYield.v / m.divYield5.v - 1) * 100) : null;
    d.marginVs5    = isNum(m.opMargin.v) && isNum(m.opMargin5.v) ? r1(m.opMargin.v - m.opMargin5.v) : null;
    d.upsideToTargetPct = isNum(price) && isNum(m.target.v) && price > 0 ? r1((m.target.v / price - 1) * 100) : null;
    d.epsGrowthNextYrPct = isNum(m.epsThisYr.v) && isNum(m.epsNextYr.v) && m.epsThisYr.v > 0 ? r1((m.epsNextYr.v / m.epsThisYr.v - 1) * 100) : null;
    // estimate revision over 30 days for the current fiscal year
    const trendFY = ex && ex.estimateTrend ? ex.estimateTrend.filter(t => t.period === '0y')[0] : null;
    d.epsRevision30dPct = trendFY && isNum(trendFY.eps) && isNum(trendFY.eps30d) && trendFY.eps30d !== 0 ? r1((trendFY.eps / trendFY.eps30d - 1) * 100) : null;
    const hist = (ex && ex.earningsHistory) || [];
    const last4 = hist.slice(0, 4).filter(h => isNum(h.surprisePct));
    d.beatsLast4 = last4.length ? last4.filter(h => h.surprisePct > 0).length + ' of ' + last4.length : null;
    d.avgSurprisePct = last4.length ? r1(last4.reduce((a, h) => a + h.surprisePct, 0) / last4.length) : null;

    const zone = planRow ? planRow.zone : null;
    const th = u.thesis || {};
    const today = window.HardcapRules.todayISO();
    const age = (s) => window.HardcapRules.daysBetween(s, today);
    const held = planRow && planRow.held;
    const costPerShare = held && planRow.shares > 0 ? planRow.costBasis / planRow.shares : null;
    const glPct = held && costPerShare > 0 && isNum(price) ? r1((price / costPerShare - 1) * 100) : null;

    // plain observations, each one checkable against the numbers above
    const flags = [];
    const flag = (level, text) => flags.push({ level, text });
    if (zone && zone.has && zone.cls && isNum(zone.pctVsFair)) {
      const z = zone.cls === 'below' ? 'below your zone low ($' + zone.low + ')' : zone.cls === 'in' ? 'inside your buy zone' : zone.cls === 'above' ? 'above your fair value ($' + zone.fair + ')' : 'above your zone high ($' + zone.high + ')';
      flag(zone.fresh ? (zone.cls === 'below' || zone.cls === 'in' ? 'good' : 'warn') : 'info',
        'Price is ' + z + ', ' + Math.abs(zone.pctVsFair).toFixed(0) + '% ' + (zone.pctVsFair >= 0 ? 'over' : 'under') + ' fair value.' + (zone.fresh ? '' : ' That zone is stale (' + zone.staleWhy + ').'));
    } else if (zone && !zone.has) flag('info', 'No buy zone set');
    if (isNum(d.offHighPct) && d.offHighPct <= -20) flag('warn', Math.abs(d.offHighPct).toFixed(0) + '% below its 52-week high');
    if (isNum(d.peVsOwnPct) && Math.abs(d.peVsOwnPct) >= 15) {
      const softPe = !!(snap && snap.soft) && m.fwdPe.src === 'snap';
      flag(softPe ? 'info' : d.peVsOwnPct < 0 ? 'good' : 'warn',
        'Forward P/E ' + (softPe ? 'about ' : '') + m.fwdPe.v.toFixed(1) + 'x is ' + Math.abs(d.peVsOwnPct).toFixed(0) + '% ' + (d.peVsOwnPct < 0 ? 'below' : 'above') + ' its 5-yr average (' + m.pe5.v.toFixed(1) + 'x)' + (softPe ? '. Sources disagree on this P/E, so treat the gap as rough' : ''));
    }
    if (isNum(glPct) && glPct <= -10) flag('warn', 'Down ' + Math.abs(glPct).toFixed(0) + '% from your cost');
    if (isNum(d.marginVs5) && d.marginVs5 <= -3) flag('warn', 'Operating margin ' + m.opMargin.v + '% is ' + Math.abs(d.marginVs5).toFixed(1) + ' pts under its 5-yr average');
    if (isNum(d.marginVs5) && d.marginVs5 >= 3) flag('good', 'Operating margin ' + m.opMargin.v + '% is ' + d.marginVs5.toFixed(1) + ' pts over its 5-yr average');
    if (isNum(m.debtEbitda.v) && m.debtEbitda.v >= 3) flag('warn', 'Debt is ' + m.debtEbitda.v + 'x EBITDA');
    if (isNum(d.epsRevision30dPct) && Math.abs(d.epsRevision30dPct) >= 2) flag(d.epsRevision30dPct > 0 ? 'good' : 'warn', 'This year\'s EPS estimate ' + (d.epsRevision30dPct > 0 ? 'raised ' : 'cut ') + Math.abs(d.epsRevision30dPct).toFixed(1) + '% in 30 days');
    if (isNum(m.sharesChg5.v) && m.sharesChg5.v >= 5) flag('warn', 'Share count up ' + m.sharesChg5.v + '% over 5 years');
    if (isNum(m.sharesChg5.v) && m.sharesChg5.v <= -5) flag('good', 'Share count down ' + Math.abs(m.sharesChg5.v) + '% over 5 years');
    if (!th.bull || /^not written yet/i.test(th.bull)) flag('warn', 'No thesis written');
    else {
      const a = age(th.quarterlyReviewedAt || th.anchorReviewed || th.lastReviewed);
      if (a != null && a > 120) flag('info', 'Thesis last reviewed ' + a + ' days ago');
    }
    if (!liveAt && !snapOk) flag('warn', 'No current fundamentals: figures are unverified May seeds');
    else if (!liveAt) flag('info', 'No live fundamentals yet: valuation is from the ' + RS.asOf + ' snapshot');

    return {
      tkr, name: u.name || tkr, sector: planRow ? planRow.sector : u.sector, held: !!held,
      price, priceSrc: planRow ? planRow.priceSrc : null,
      position: held ? { value: Math.round(planRow.cur), shares: r2(planRow.shares), weightOfBookPct: r1(planRow.curPct), costPerShare: r2(costPerShare), gainLossPct: glPct } : null,
      conviction: u.conviction != null ? u.conviction : null, signal: u.signal || null, pinned: !!u.pinned, noBuy: !!u.noBuy,
      zone: zone ? { low: zone.low, fair: zone.fair, high: zone.high, status: zone.cls ? zone.label : null, pctVsFair: r1(zone.pctVsFair), reviewed: zone.reviewed, ageDays: zone.ageDays, current: zone.fresh, note: zone.staleWhy } : null,
      m, d, flags,
      data: { liveAsOf: iso(liveAt), liveAgeDays: liveAge, snapAsOf: snapOk ? RS.asOf : null, softSnap: !!(snap && snap.soft) },
      nextEarnings: (u.nextEarnings && u.nextEarnings.date) || null,
      thesisAgeDays: age(th.quarterlyReviewedAt || th.anchorReviewed || th.lastReviewed),
    };
  }

  function forPlan(state, plan, filter) {
    return plan.rows.filter(filter || (r => r.held)).map(r => build(state, r.tkr, r, plan.book));
  }

  // Compact form for the IC prompt: values with their source tag, nulls dropped.
  function compact(sc) {
    const out = {};
    Object.keys(sc.m).forEach(k => { const x = sc.m[k]; if (x && x.v != null) out[k] = [x.v, x.src]; });
    const der = {};
    Object.keys(sc.d).forEach(k => { if (sc.d[k] != null) der[k] = sc.d[k]; });
    return { metrics: out, derived: der, liveAsOf: sc.data.liveAsOf, snapAsOf: sc.data.snapAsOf, softSnapshot: sc.data.softSnap || undefined,
      observations: sc.flags.map(f => f.text) };
  }

  function coverage(state, tickers) {
    const c = { live: [], snap: [], seedOnly: [], transcripts: [], noTranscripts: [] };
    const RS = window.RESEARCH_SNAPSHOT || {};
    tickers.forEach(t => {
      const u = (state.universe && state.universe[t]) || {};
      const liveAt = (u.liveSnapshot && u.liveSnapshot.fetchedAt) || (u.deepFundamentals && u.deepFundamentals.fetchedAt);
      if (liveAt && (Date.now() - liveAt) < 45 * DAY) c.live.push(t);
      else if (RS.data && RS.data[t]) c.snap.push(t);
      else c.seedOnly.push(t);
      const T = window.HardcapTranscripts && window.HardcapTranscripts.getTranscripts(t);
      if (T && T.quarters && T.quarters.length) c.transcripts.push(t); else c.noTranscripts.push(t);
    });
    return c;
  }

  window.HardcapScore = { build, forPlan, compact, coverage };
})();
