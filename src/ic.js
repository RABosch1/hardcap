// ═══════════════════════════════════════════════════════════════════
// HARDCAP — INVESTMENT COMMITTEE (IC)
// The rules engine sets the dollars. The IC underwrites them: it tests
// each buy and each holding against the data, says where it disagrees,
// and proposes changes to your inputs (signal, conviction, buy zone)
// that you approve or dismiss. It never moves an amount itself.
// ═══════════════════════════════════════════════════════════════════

const STORAGE_KEY_IC_LOG = 'hardcap_ic_log_v1';
const STORAGE_KEY_IC_LAST = 'hardcap_ic_last_v2';

// fundamentals: false = use what is cached; 'missing' = fetch names with none; 'fresh' = refetch anything older than 5 days
const IC_TIERS = {
  fast:     { label: 'Fast',     model: 'claude-sonnet-5-5', effort: 'low',    maxTokens: 8000,  fundamentals: false,     transcripts: false, outTokens: 3000 },
  deep:     { label: 'Deep',     model: 'claude-opus-5-5',   effort: 'medium', maxTokens: 24000, fundamentals: 'missing', transcripts: false, outTokens: 11000 },
  forensic: { label: 'Forensic', model: 'claude-opus-5-5',   effort: 'high',   maxTokens: 64000, fundamentals: 'fresh',   transcripts: true,  outTokens: 28000 },
};

// ─── WHO GETS A FULL WORK-UP ───────────────────────────────────────
// Everything held, everything being bought, every slot name, every pinned
// name, the bench of any sector that cannot buy anything, and the best
// unpinned candidates for a sector that still has an open slot to fill.
function icFocus(state, plan) {
  const out = [];
  const add = (t) => { if (t && out.indexOf(t) < 0 && state.universe[t]) out.push(t); };
  plan.rows.filter(r => r.held).sort((a, b) => b.cur - a.cur).forEach(r => add(r.tkr));
  plan.buys.forEach(r => add(r.tkr));
  plan.rows.filter(r => r.slot && !r.held).forEach(r => add(r.tkr));
  plan.rows.filter(r => r.pinned).forEach(r => add(r.tkr));
  plan.coreSectors.filter(s => s.remaining > 1 && !s.fundable).forEach(s => s.blockers.slice(0, 4).forEach(b => add(b.tkr)));
  plan.coreSectors.filter(s => s.remaining > 1 && s.openSlots > 0).forEach(s => (s.bench || []).slice(0, s.fundable ? 1 : 2).forEach(b => add(b.tkr)));
  return out.slice(0, 22);
}

function icRulesText(plan) {
  const r = plan.rules;
  const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const bands = plan.coreSectors.map(s => `${s.name} ${s.min}-${s.max}% (engine target ${s.targetPct.toFixed(1)}%)`).join('; ');
  const price = r.priceMode === 'strict'
    ? `Strict price mode: a name is bought only at or below fair value, and only on a buy zone reviewed within ${r.staleZoneDays} days.`
    : `Price tilt: a buy zone reviewed within ${r.staleZoneDays} days scales the size (below the zone low 1.5x, in zone 1x, above fair value 0.6x, above the zone high 0.3x). An older or placeholder zone does not steer size at all, in either direction.`;
  return [
    `Cash hold-back by market mode, set by how far the S&P 500 is below its 52-week high: normal ${r.cashNormal}%, correction (10%+ below) ${r.cashCorrection}%, bear (20%+) ${r.cashBear}%, crash (30%+) ${r.cashCrash}%. Cash above the hold-back is dry powder.`,
    `Pace: in a normal market each monthly run releases dry powder divided by the runs left through ${r.finishBy}. A correction releases at least a third per run; a bear market or crash at least half.`,
    `All weights are measured against the book: total capital less the hold-back (${usd(plan.book)} today).`,
    `Core sector bands: ${bands}. A sector with a 0% floor is optional and receives no new money.`,
    `At most ${r.maxPositions} positions. Each core sector gets slots in proportion to its target. Names already held keep their slots. ${r.newNames === 'conviction'
      ? 'Open slots go to names the owner pinned, then to any buy-rated name by conviction.'
      : 'An open slot goes only to a name the owner has pinned: a buy-rated name that is not pinned stays on the bench and gets no money. Pinning is a decision for the owner alone.'}`,
    `Inside a sector, name targets are conviction-weighted across the slot names. The budget is shared in proportion to each name's dollar gap to its target.`,
    `Only signals Strong Buy and Accumulate receive money. Hold, Watch, Trim, Sell and never-buy names receive none.`,
    price,
    `No buy may lift a name above ${r.capPct}% of the book. A buy under ${usd(r.minOrder)} is dropped and its share goes to the other names.`,
    `Buy-only. Nothing is sold or trimmed.`,
  ];
}

// ─── BUILD CONTEXT FOR THE IC ──────────────────────────────────────
function buildICContext(state, plan, opts) {
  opts = opts || {};
  const tier = opts.tier || 'fast';
  const focus = opts.focus || icFocus(state, plan);
  const RS = window.RESEARCH_SNAPSHOT || {};
  const byTkr = {};
  plan.rows.forEach(r => { byTkr[r.tkr] = r; });
  const money = (n) => Math.round(n || 0);
  const pct = (n) => n == null || !isFinite(n) ? null : Math.round(n * 10) / 10;
  const clip = (s, n) => s ? String(s).slice(0, n) : null;
  const full = tier !== 'fast';

  const shape = (tkr) => {
    const u = state.universe[tkr] || {};
    const r = byTkr[tkr];
    const sc = window.HardcapScore.build(state, tkr, r, plan.book);
    const t = u.thesis || {};
    const o = {
      tkr, name: u.name || tkr, sector: r.sector, subsector: u.subsector || null,
      position: sc.position,                                   // null when not held
      engine: {
        status: r.status, note: r.statusText, buyThisRun: r.buy || 0, hasSlot: r.slot,
        targetWeightPct: plan.book > 0 ? pct(r.target / plan.book * 100) : null,
        weightAfterPct: pct(r.afterPct), reasons: r.reasons.length ? r.reasons : undefined,
      },
      yourInputs: { signal: u.signal || null, conviction: u.conviction != null ? u.conviction : null, pinned: !!u.pinned || undefined, neverBuy: !!u.noBuy || undefined, buyZone: sc.zone, positionNote: clip(u.notes, 300) },
      price: { value: r.price, source: r.priceSrc, todayChangePct: u.liveChangePct != null ? pct(u.liveChangePct) : undefined },
      scorecard: window.HardcapScore.compact(sc),
      thesis: {
        lastReviewed: t.quarterlyReviewedAt || t.anchorReviewed || t.lastReviewed || null,
        anchor: clip(t.anchor, full ? 800 : 400),
        bull: full ? clip(t.bull, 900) : undefined,
        bear: full ? clip(t.bear, 700) : undefined,
        changeMyMind: clip(t.changeMyMind, 400),
        catalysts: full ? (t.catalysts || []) : undefined,
        risks: full ? (t.risks || []) : undefined,
        quarterlyReview: full ? clip(t.quarterlyReview, 600) : undefined,
        recentObservations: full ? (t.recentObservations || []).slice(-5) : undefined,
      },
      returnScenarios: full && u.returnRates ? { bear: u.returnRates.bear, base: u.returnRates.base, bull: u.returnRates.bull, rationale: clip(u.returnRates.rationale, 300), writtenBy: 'seed, May 2026' } : undefined,
      nextEarnings: sc.nextEarnings || undefined,
    };
    if (full) {
      const deep = u.deepFundamentals;
      const ex = u.fundExtras;
      const liveAsOf = sc.data.liveAsOf;
      if (deep && deep.history && deep.history.length) {
        o.fiveYear = { source: 'live ' + liveAsOf, history: deep.history, trends: deep.trends, marketCapM: deep.marketCapM, sharesOutM: deep.sharesOutM };
      }
      if (ex) {
        o.recent = {
          source: 'live ' + liveAsOf,
          lastSixQuarters: ex.quarters && ex.quarters.length ? ex.quarters : undefined,
          revenueTTM_M: ex.revenueTTM_M, ebitdaM: ex.ebitdaM, grossMarginPct: ex.grossMarginPct, profitMarginPct: ex.profitMarginPct,
          earningsGrowthYoYPct: ex.earningsGrowthYoYPct, epsTTM: ex.epsTTM,
          balance: ex.balance, dividend: ex.dividend,
          ma50: ex.ma50, ma200: ex.ma200, shortPctFloat: ex.shortPctFloat,
        };
        o.street = {
          source: 'live ' + liveAsOf,
          analyst: ex.analyst, estimateTrend: ex.estimateTrend && ex.estimateTrend.length ? ex.estimateTrend : undefined,
          earningsSurprises: ex.earningsHistory && ex.earningsHistory.length ? ex.earningsHistory : undefined,
        };
      }
    }
    if (tier === 'forensic' && window.HardcapTranscripts) {
      const T = window.HardcapTranscripts.getTranscripts(tkr);
      if (T && T.quarters && T.quarters.length > 0) {
        const sorted = [...T.quarters].sort((a, b) => a.year !== b.year ? b.year - a.year : b.quarter - a.quarter);
        const latest = sorted[0];
        o.managementPulse = {
          source: 'earnings call transcripts, fetched ' + new Date(T.fetchedAt).toISOString().slice(0, 10),
          sentimentArc: window.HardcapTranscripts.getSentimentArc(tkr),
          toneDelta: window.HardcapTranscripts.computeToneDelta(T.quarters),
          latestCall: latest ? {
            period: `${latest.year}Q${latest.quarter}`, date: latest.date, sentiment: latest.sentiment,
            summary: latest.summary, guidance: latest.guidance, risk_factors: latest.risk_factors,
            prepared_remarks: latest.prepared_remarks, qa_risk_extracts: latest.qa_risk_extracts || [],
          } : null,
          priorQuarters: sorted.slice(1).map(q => ({ period: `${q.year}Q${q.quarter}`, date: q.date, sentiment: q.sentiment, summary: q.summary, guidance: q.guidance })),
        };
      }
    }
    return o;
  };

  const names = focus.map(shape);
  const focusSet = {};
  focus.forEach(t => { focusSet[t] = 1; });
  const bench = plan.rows.filter(r => r.inUniverse && !focusSet[r.tkr]).map(r => ({
    tkr: r.tkr, sector: r.sector, signal: r.signal, conviction: r.conviction, price: r.price, priceSource: r.priceSrc,
    zone: r.zone.has ? `${r.zone.low}/${r.zone.fair}/${r.zone.high}` : null, zoneAgeDays: r.zone.ageDays, engine: r.statusText,
  }));
  const cov = window.HardcapScore.coverage(state, focus);
  const quotes = { live: 0, import: 0, snapshot: 0, manual: 0, none: 0 };
  focus.forEach(t => { const s = byTkr[t].priceSrc || 'none'; quotes[s] = (quotes[s] || 0) + 1; });

  return {
    today: plan.today,
    positionsAsOf: state.importDate || null,
    tier,
    rules: icRulesText(plan),
    capital: {
      total: money(plan.total), cash: money(plan.cash), invested: money(plan.equity),
      marketMode: plan.mode.label, sp500BelowHighPct: plan.mode.ddPct,
      sp500ReadingAsOf: (state.market && state.market.asOf) || null, sp500ReadingSource: (state.market && state.market.source) || 'not set',
      holdBackPct: plan.holdPct, holdBack: money(plan.hold), dryPowder: money(plan.excess),
      runsLeftOnSchedule: plan.runsLeft, book: money(plan.book), singleNameCapDollars: money(plan.capDollar),
    },
    plan: {
      budget: money(plan.budget), budgetSource: plan.override ? 'typed in by the owner (overrides the rule amount of $' + money(plan.budgetRule) + ')' : 'rule',
      buys: plan.buys.map(r => ({ tkr: r.tkr, action: r.held ? 'ADD' : 'INITIATE', amount: r.buy, shares: r.buyShares != null ? Math.round(r.buyShares * 1000) / 1000 : null, atPrice: r.price, weightNowPct: pct(r.curPct), weightAfterPct: pct(r.afterPct), why: r.reasons })),
      totalBuys: money(plan.spend), leftInCashFromBudget: money(plan.unplaced), cashAfter: money(plan.cashAfter), cashAfterPct: pct(plan.cashAfterPct),
    },
    sectors: plan.coreSectors.map(s => ({
      sector: s.name, band: `${s.min}-${s.max}%`, engineTargetPct: pct(s.targetPct), nowPct: pct(s.curPct), afterPct: pct(s.afterPct),
      stillBelowTargetBy: money(s.remaining), slots: s.slots, openSlots: s.openSlots,
      ratedBuyButNotPinned: s.remaining > 1 && s.openSlots > 0 && s.bench && s.bench.length ? s.bench.slice(0, 5).map(b => `${b.tkr} (${b.signal}, conviction ${b.conviction == null ? 'n/a' : b.conviction})`) : undefined,
      notBuying: s.remaining > 1 ? s.blockers.map(b => `${b.tkr}: ${b.reason}`) : [],
    })),
    optionalSectorsHeld: plan.sectors.filter(s => !s.core && s.cur > 0).map(s => ({ sector: s.name, value: money(s.cur) })),
    overCap: plan.overCap.map(o => ({ tkr: o.tkr, weightPct: pct(o.pct), overBy: money(o.over) })),
    untrackedHoldings: plan.untracked.map(x => ({ tkr: x.tkr, value: money(x.value) })),
    names,
    bench,
    dataCoverage: {
      sourceTags: { live: 'data feed (EODHD), date given per name', snap: 'research snapshot dated ' + (RS.asOf || 'n/a') + ', approximate; its 5-yr averages are simple means of year-end figures', seed: 'typed into the universe in May 2026 from memory, never verified' },
      liveFundamentals: cov.live, snapshotOnly: cov.snap, seedOnly: cov.seedOnly,
      transcripts: tier === 'forensic' ? cov.transcripts : 'not loaded at this tier',
      prices: quotes,
      staleBuyZones: plan.staleZones,
    },
  };
}

// ─── BUILD THE PROMPT ──────────────────────────────────────────────
function buildICPrompt(context) {
  const tier = context.tier;
  const forensic = tier === 'forensic';
  const deep = tier === 'deep';
  const sectorNames = Object.keys(window.SECTOR_TARGETS || {}).join(', ');

  const buyBlock = forensic
    ? `For each buy, a heading \`### TKR — Company · $amount · AGREE\` (or CAUTION, or DISSENT), then:
**Dominant question:** the one thing that decides whether this works.
**Variant perception:** what the market believes that the data contradicts, or an honest "no variant view: quality at a fair price".
**Underwriting:** 200-350 words. Walk the numbers in DATA: valuation against its own history, growth, margins, leverage, cash returned, estimate direction, and what management said if a managementPulse is present. Tie them together. Quote figures with their source tag when it is snap or seed.
**Downside, quantified:** a specific bear case with a resulting price and % drawdown, built from DATA figures.
**Catalyst path:** the next two or three things that should happen, with timing where DATA gives a date.
**Kill switch:** one observable with a threshold.`
    : deep
    ? `For each buy, a heading \`### TKR — Company · $amount · AGREE\` (or CAUTION, or DISSENT), then 100-150 words: the dominant question, the numbers that answer it, a quantified downside, and one kill switch with a threshold.`
    : `For each buy, one line: \`**TKR · $amount · AGREE**\` (or CAUTION, or DISSENT) followed by two sentences with the numbers that justify the stance.`;

  const holdingBlock = forensic
    ? `For EVERY name in DATA.names that has a position, including the ones getting no money this month, a heading \`### TKR — THESIS INTACT\` (or WATCH, or AT RISK), then:
**Where it stands:** price against the buy zone, valuation against its own history, growth, margins, leverage. Numbers, with source tags where snap or seed.
**What has changed since the thesis was written:** the anchor in DATA states the price and multiple it was written at. Compare with today.
**Kill switch check:** take the changeMyMind text and say, for each trigger, tripped / not tripped / cannot tell from data.
**New money:** whether the owner's signal, conviction and buy zone still fit the data, and what you would change.
150-250 words per holding.`
    : deep
    ? `For EVERY name in DATA.names that has a position, a heading \`### TKR — THESIS INTACT\` (or WATCH, or AT RISK), then 60-100 words: where it stands in numbers, whether a kill switch has tripped, and whether the signal and zone still fit.`
    : `For EVERY name in DATA.names that has a position, one line: \`**TKR — INTACT**\` (or WATCH, or AT RISK) and one sentence with the number that drives it.`;

  const actionsBlock = tier === 'fast' ? '' : `
## V. Proposed updates
Where DATA shows one of the owner's inputs is out of date or wrong, propose the change as an action block. The owner approves or dismisses each one. Rules:
- At most ${forensic ? 10 : 4} actions. One per name. Only where DATA supports it; say which figures in the sentence before the block.
- A buy zone is {low, fair, high} in dollars with low < fair < high. Derive it from DATA (state the multiple and earnings figure you used) or do not propose one.
- A name on Watch with no thesis may be proposed for activation only if DATA holds enough to underwrite it. Otherwise say what is missing. Activation changes the signal only: the engine still opens no position until the owner pins the name, so say that in the summary.
- Never propose a Sell or Trim signal, never touch a never-buy name, never propose buying crypto.
- Sectors must be one of: ${sectorNames}.

Use exactly these shapes (JSON inside a fenced block labelled action):

\`\`\`action
{"type":"update_quarterly_review","params":{"tkr":"XOM","review":"Oct 2026: two or three sentences of evidence with numbers.","newConviction":85,"newSignal":"Accumulate","newBuyZone":{"low":140,"fair":165,"high":190}},"summary":"One line: what changes and why"}
\`\`\`

\`\`\`action
{"type":"add_observation","params":{"tkr":"APO","note":"One dated fact from DATA worth keeping."},"summary":"Log it"}
\`\`\`

newConviction, newSignal and newBuyZone are each optional. Signals: Strong Buy, Accumulate, Hold, Watch.`;

  const system = `You are the Investment Committee for Hardcap, a personal long-only equity portfolio. You write with the discipline of Marc Rowan at Apollo: economically rigorous, downside-first, contrarian only where the numbers support it. You are an underwriter, not a market commentator.

# HOW THIS SHOP WORKS
- 30-year horizon. Long-duration compounding. Not traders.
- A rules engine sets every dollar amount in the plan. You do not change amounts. You underwrite them: say whether each buy stands up, and where you disagree say so plainly and name the input (signal, conviction, buy zone) you would change.
- Buy-only. Flag concerns about size or thesis decay; never recommend a sale as an action.
- The rules are listed in DATA.rules. Hold them fixed. If a rule itself looks wrong for this portfolio, say so once, in section I.

# EVIDENCE RULES (NON-NEGOTIABLE)
1. Every number you cite must appear in DATA. Do not supply figures from memory.
2. Figures in a scorecard are pairs: [value, source]. Sources: "live" = data feed, dated per name; "snap" = research snapshot, approximate; "seed" = typed in from memory in May 2026 and never verified. Prefer live, then snap. When you lean on a seed figure, call it an unverified seed.
3. If the data needed to answer your own question is missing, write "not in data" and name what is missing. A stated gap is underwriting, not a disclaimer.
4. If you bring in outside knowledge (an event, a deal, an industry fact), mark it "(background, not in data)" and attach no number to it unless the number is in DATA.
5. The theses in DATA were written in May-June 2026 at the prices named in their anchors. Test them against today's numbers. Do not repeat them back.
6. The owner's buy zones and convictions are inputs, not facts. DATA.dataCoverage.staleBuyZones lists the zones too old to steer anything.
7. No boilerplate disclaimers. No vague phrases ("strong company", "favorable backdrop"). No "may / could / potentially" where a number exists.

# FORMAT
Markdown with ## and ### headings, **bold** and - bullets only. No tables. Dense: every paragraph carries a number, a comparison or a falsifiable claim.

## I. Verdict on this month's plan
Two paragraphs at most. What the plan does with the budget and what it deliberately leaves in cash, and whether you would sign it. If the stale inputs make the plan weaker than it looks, say that first.

## II. The buys
${buyBlock}
If DATA.plan.buys is empty, say why in two sentences and move on.

## III. Holdings rundown
${holdingBlock}

## IV. Waiting and blocked
For each sector in DATA.sectors still below target, why its money is waiting, and which of the owner's inputs is the blocker. Call out inputs that contradict each other (a Strong Buy priced above its own zone high; a name in its buy zone that is on Hold). Where a sector lists openSlots and ratedBuyButNotPinned names, the engine is waiting for the owner to pin one: say which candidate the numbers favour and why, or that none earns the slot. Pinning is the owner's decision; recommend, do not assume. ${forensic ? 'For names on Watch in DATA.names, say whether the data on hand is enough to underwrite them and what the first number to check is.' : 'Keep it to a few lines.'}
${actionsBlock}

## ${tier === 'fast' ? 'V' : 'VI'}. What would force a re-underwrite
One or two observables, with thresholds, that would invalidate this cycle's plan as a whole.`;

  const user = `DATA (JSON). Positions as of ${context.positionsAsOf || 'unknown'}; today is ${context.today}.

${JSON.stringify(context)}

Underwrite this month's plan and review the holdings, following the format exactly. ${forensic ? 'Be exhaustive in reasoning and tight in language.' : tier === 'deep' ? 'Be tight.' : 'Be brief: this is the quick read.'}`;

  return { system, user };
}

// Kept for anything that still calls the old name.
function buildICSystemPrompt(context) { return buildICPrompt(context).system; }

// ─── PRE-RUN ESTIMATE ──────────────────────────────────────────────
function estimateICRun(state, plan, tier) {
  const T = IC_TIERS[tier] || IC_TIERS.fast;
  const ctx = buildICContext(state, plan, { tier });
  const p = buildICPrompt(ctx);
  const nowTok = window.HardcapClaude.estimateTokens(p.system + p.user);
  // Data this tier pulls before it runs is not in the prompt yet, so allow for it:
  // about 1,100 tokens of fundamentals per name, and 2,500 (up to 4,000) of earnings calls.
  const feed = window.HardcapLive && window.HardcapLive.hasWorkerUrl();
  let pending = 0;
  if (feed && T.fundamentals) pending += ctx.names.filter(n => !n.fiveYear && !n.recent).length * 1100;
  if (feed && T.transcripts) pending += ctx.names.filter(n => !n.managementPulse).length * 2500;
  const inTok = nowTok + pending;
  const cost = window.HardcapClaude.estimateCost(T.model, inTok, T.outTokens);
  // ceiling: a heavier data pull than usual, and every token of the output budget used
  const maxCost = window.HardcapClaude.estimateCost(T.model, nowTok + pending * 1.6, T.maxTokens);
  return { inputTokens: inTok, promptTokensNow: nowTok, outputTokens: T.outTokens, cost, maxCost, names: ctx.names.length, model: T.model };
}

// ─── CHECK WHAT THE IC PROPOSES BEFORE SHOWING IT ──────────────────
function sanitizeICActions(state, actions) {
  const okSignals = { 'Strong Buy': 1, 'Accumulate': 1, 'Hold': 1, 'Watch': 1 };
  // model text ends up in the memo tab, which renders thesis fields as HTML: keep it plain
  const plain = (s, n) => String(s == null ? '' : s).replace(/[<>]/g, '').slice(0, n);
  const out = [];
  (actions || []).forEach(a => {
    try {
      if (!a || !a.params) return;
      const tkr = String(a.params.tkr || '').toUpperCase();
      const u = state.universe[tkr];
      if (!u || u.noBuy) return;
      if (a.type === 'add_observation') {
        if (!a.params.note) return;
        out.push({ type: a.type, params: { tkr, note: plain(a.params.note, 600) }, summary: plain(a.summary, 200) || ('Log a note on ' + tkr) });
        return;
      }
      if (a.type !== 'update_quarterly_review') return;
      const p = { tkr, review: plain(a.params.review, 1200) };
      if (!p.review) return;
      if (a.params.newConviction != null) {
        const c = Number(a.params.newConviction);
        if (isFinite(c) && c >= 0 && c <= 100) p.newConviction = Math.round(c);
      }
      if (a.params.newSignal && okSignals[a.params.newSignal]) p.newSignal = a.params.newSignal;
      const z = a.params.newBuyZone;
      if (z) {
        const low = Number(z.low), fair = Number(z.fair), high = Number(z.high);
        if (low > 0 && fair > low && high > fair) p.newBuyZone = { low, fair, high };
      }
      out.push({ type: a.type, params: p, summary: plain(a.summary, 200) || ('Update ' + tkr) });
    } catch (e) { console.warn('[IC] dropped a malformed action', e); }
  });
  return out;
}

// ─── CALL THE IC ───────────────────────────────────────────────────
// opts: { tier, amount, onStatus(text), onText(fullText) }
async function runIC(state, opts) {
  opts = opts || {};
  const tierKey = IC_TIERS[opts.tier] ? opts.tier : 'fast';
  const T = IC_TIERS[tierKey];
  const status = (m) => { if (opts.onStatus) { try { opts.onStatus(m); } catch (e) { /* display only */ } } };
  if (!window.HardcapClaude.hasKey()) throw new Error('No Anthropic API key set. Add one in Import → Settings.');

  const planOpts = opts.amount != null ? { amount: opts.amount } : {};
  let plan = window.HardcapEngine.plan(state, planOpts);
  let focus = icFocus(state, plan);
  const dataNotes = [];
  const feed = window.HardcapLive && window.HardcapLive.hasWorkerUrl();
  let feedDown = false;   // set when the feed plainly is not answering, so we stop asking it

  // 1. data: quotes, fundamentals, transcripts — only what this tier asks for
  if (T.fundamentals && !feed) dataNotes.push('No data feed is configured, so nothing was refreshed.');
  if (T.fundamentals && feed) {
    const lastQ = (state.live && state.live.lastQuoteSuccess) || 0;   // last time quotes actually came back
    if (Date.now() - lastQ > 30 * 60000) {
      status('Refreshing quotes…');
      try {
        const q = await window.HardcapLive.refreshAllQuotes(state);
        if (q.down) { feedDown = true; dataNotes.push('The data feed did not answer (' + ((q.errors[0] && q.errors[0].msg) || 'no reply') + '), so nothing was refreshed for this run.'); }
        else if (q.updated === 0) dataNotes.push('Quote refresh failed: ' + ((q.errors[0] && q.errors[0].msg) || 'no quotes returned') + '.');
        else if (q.failed > 0) dataNotes.push('Quotes: ' + q.updated + ' updated, ' + q.failed + ' failed.');
      } catch (e) { dataNotes.push('Quote refresh failed: ' + e.message + '.'); }
      if (!feedDown && state.market && !state.market.manual) {
        try { await window.HardcapLive.refreshMarketGauge(state); } catch (e) { dataNotes.push('S&P 500 reading not refreshed: ' + e.message); }
      }
      plan = window.HardcapEngine.plan(state, planOpts);
      focus = icFocus(state, plan);
    }
    if (!feedDown) status('Pulling fundamentals for ' + focus.length + ' names…');
    if (!feedDown) try {
      const f = await window.HardcapLive.ensureFundamentals(state, focus, {
        maxAgeDays: T.fundamentals === 'fresh' ? 5 : 3650,
        onProgress: (tkr, i, n) => status('Pulling fundamentals: ' + tkr + ' (' + i + ' of ' + n + ')…'),
      });
      if (f.aborted) { feedDown = true; dataNotes.push('Fundamentals: the feed did not answer (' + ((f.errors[0] && f.errors[0].msg) || 'unknown error') + ').'); }
      else if (f.errors.length) dataNotes.push('Fundamentals missing for ' + f.errors.map(e => e.tkr).join(', ') + ' (' + f.errors[0].msg + ').');
    } catch (e) { dataNotes.push('Fundamentals refresh failed: ' + e.message + '.'); }
  }
  if (T.transcripts && feed && !feedDown && window.HardcapTranscripts) {
    // one name at a time, so the status line moves and a dead transcript route is dropped after two failures
    try {
      let streak = 0, got = 0, firstErr = null;
      const failed = [];
      for (let k = 0; k < focus.length; k++) {
        status('Pulling earnings calls: ' + focus[k] + ' (' + (k + 1) + ' of ' + focus.length + ')…');
        const tr = await window.HardcapTranscripts.ensureTranscripts([focus[k]]);
        const hard = tr.errors.filter(e => !/No transcripts found/i.test(e.msg));
        if (hard.length) { streak++; failed.push(focus[k]); if (!firstErr) firstErr = hard[0].msg; }
        else { streak = 0; got += tr.fetched.length + tr.skipped.length; }
        if (streak >= 2 && got === 0) { failed.length = 0; break; }
      }
      if (firstErr && got === 0) dataNotes.push('Earnings call transcripts unavailable (' + firstErr + ').');
      else if (failed.length) dataNotes.push('No earnings calls for ' + failed.join(', ') + ' (' + firstErr + ').');
    } catch (e) { dataNotes.push('Earnings call transcripts unavailable: ' + e.message + '.'); }
  }

  // 2. context + prompt
  const context = buildICContext(state, plan, { tier: tierKey, focus });
  const prompt = buildICPrompt(context);
  const estIn = window.HardcapClaude.estimateTokens(prompt.system + prompt.user);
  status(T.label + ' IC is reading ' + context.names.length + ' names (about ' + Math.round(estIn / 1000) + 'k tokens of data)…');

  // 3. the call
  const res = await window.HardcapClaude.call({
    model: T.model, effort: T.effort, maxTokens: T.maxTokens,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
    onText: opts.onText,
  });
  if (!res.text || !res.text.trim()) throw new Error('The model returned no text' + (res.truncated ? ' (it ran out of its output budget while thinking). Try the Deep tier.' : '.'));

  const rawActions = tierKey === 'fast' ? [] : window.HardcapChat.parseActions(res.text);
  const actions = sanitizeICActions(state, rawActions).map(a => Object.assign({}, a, { status: 'pending' }));
  const cleanText = window.HardcapChat.stripActionBlocks(res.text).replace(/\n{3,}/g, '\n\n').trim();
  const cov = context.dataCoverage;

  return {
    runAt: Date.now(),
    tier: tierKey, tierLabel: T.label,
    model: res.model, modelLabel: window.HardcapClaude.label(res.model),
    deployAmount: Math.round(plan.budget),
    budgetSource: plan.override ? 'override' : 'rule',
    picks: plan.buys.map(r => ({
      tkr: r.tkr, action: r.held ? 'ADD' : 'INITIATE', amount: r.buy,
      shares: r.buyShares != null ? Math.round(r.buyShares * 1000) / 1000 : null, atPrice: r.price,
      newWeight: r.afterPct.toFixed(1) + '%', rationale: r.reasons.join(' · '), convictionUsed: r.conviction,
    })),
    spend: plan.spend, cashAfter: Math.round(plan.cashAfter),
    text: cleanText, actions,
    usage: res.usage, costEstimate: res.cost, elapsedMs: res.elapsedMs, truncated: res.truncated,
    coverage: { live: cov.liveFundamentals.length, snap: cov.snapshotOnly.length, seed: cov.seedOnly.length,
      transcripts: Array.isArray(cov.transcripts) ? cov.transcripts.length : null, names: context.names.length },
    dataNotes,
  };
}

// ─── LAST RUN (survives a reload) ──────────────────────────────────
function saveLastICRun(run) {
  try { localStorage.setItem(STORAGE_KEY_IC_LAST, JSON.stringify(run)); } catch (e) { console.warn('IC last-run save failed', e); }
}
function loadLastICRun() {
  try { const raw = localStorage.getItem(STORAGE_KEY_IC_LAST); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function clearLastICRun() { try { localStorage.removeItem(STORAGE_KEY_IC_LAST); } catch (e) { /* nothing to clear */ } }

// ─── RUN LOG ───────────────────────────────────────────────────────
function loadICLog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_IC_LOG);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveICLog(log) {
  try { localStorage.setItem(STORAGE_KEY_IC_LOG, JSON.stringify(log.slice(-60))); }
  catch (e) { console.error('IC log save failed', e); }
}
function logICRun(run, accepted) {
  const log = loadICLog().filter(l => l.runAt !== run.runAt);
  log.push({
    runAt: run.runAt, model: run.model, tier: run.tier, deployAmount: run.deployAmount,
    picks: run.picks, accepted: accepted || [], text: run.text,
    elapsedMs: run.elapsedMs, costEstimate: run.costEstimate,
  });
  saveICLog(log);
}

window.HardcapIC = {
  TIERS: IC_TIERS,
  runIC, buildICContext, buildICPrompt, buildICSystemPrompt, estimate: estimateICRun, focus: icFocus,
  sanitizeActions: sanitizeICActions,
  saveLast: saveLastICRun, loadLast: loadLastICRun, clearLast: clearLastICRun,
  loadLog: loadICLog, saveLog: saveICLog, logRun: logICRun,
};
