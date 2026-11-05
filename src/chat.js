// ═══════════════════════════════════════════════════════════════════
// HARDCAP — CLAUDE CHAT
// API client, system prompt builder, action proposal handling.
// ═══════════════════════════════════════════════════════════════════

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const STORAGE_KEY_API = 'hardcap_api_key';
const STORAGE_KEY_MODEL = 'hardcap_model';
const STORAGE_KEY_CHAT = 'hardcap_chat_v1';

const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5 (recommended) — $2/$10 per M tokens',   short: 'Sonnet 5.5' },
  { id: 'claude-opus-5-5',   label: 'Opus 5.5 (smartest) — $4/$20 per M tokens',        short: 'Opus 5.5' },
  { id: 'claude-haiku-5-5',  label: 'Haiku 5.5 (cheapest) — $0.10/$0.50 per M tokens',  short: 'Haiku 5.5' },
];

function getModel() {
  // a model saved by an older version of this file falls back to the default
  const saved = localStorage.getItem(STORAGE_KEY_MODEL);
  return AVAILABLE_MODELS.find(m => m.id === saved) ? saved : 'claude-sonnet-5-5';
}
function setModel(modelId) {
  if (AVAILABLE_MODELS.find(m => m.id === modelId)) {
    localStorage.setItem(STORAGE_KEY_MODEL, modelId);
  }
}

// ─── API KEY MANAGEMENT ────────────────────────────────────────────
function getApiKey() {
  return localStorage.getItem(STORAGE_KEY_API) || '';
}
function setApiKey(key) {
  if (!key) localStorage.removeItem(STORAGE_KEY_API);
  else localStorage.setItem(STORAGE_KEY_API, key);
}
function hasApiKey() { return !!getApiKey(); }

// ─── CONVERSATION STORAGE ──────────────────────────────────────────
function loadChat() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHAT);
    return raw ? JSON.parse(raw) : { messages: [], createdAt: new Date().toISOString() };
  } catch { return { messages: [], createdAt: new Date().toISOString() }; }
}
function saveChat(chat) {
  try { localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(chat)); }
  catch (e) { console.error('Chat save failed', e); }
}
function clearChat() {
  if (confirm('Clear conversation history? This cannot be undone.')) {
    localStorage.removeItem(STORAGE_KEY_CHAT);
    return true;
  }
  return false;
}

// ─── SYSTEM PROMPT BUILDER ─────────────────────────────────────────
// On every message, we send Claude a fresh snapshot of the portfolio.
// This is what makes Claude know about YOUR dashboard, not generic advice.
function buildSystemPrompt(state) {
  const A = window.HardcapAnalytics;
  const eq = A.totalEquity(state);
  const cash = state.cash;
  const total = eq + cash;
  const sw = A.sectorWeights(state);
  const gaps = A.sectorGaps(state);
  const ic = A.icReadiness(state);
  const enriched = A.enrichPositions(state);
  const verdicts = window.HardcapDeployment.verdict(state);
  const trims = window.HardcapRisk.requiredTrims(state);

  const now = new Date().toISOString().slice(0, 10);
  const importDate = state.importDate || 'unknown';

  // Position summary
  const today = new Date();
  const daysAgo = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return Math.floor((today - d) / 86400000);
  };
  const staleness = (u) => {
    const t = u?.thesis;
    if (!t) return '';
    const anchorAge = daysAgo(t.anchorReviewed || t.lastReviewed);
    const qAge = daysAgo(t.quarterlyReviewedAt);
    const obsCount = (t.recentObservations || []).length;
    const parts = [];
    if (anchorAge != null) parts.push(`anchor ${anchorAge}d old`);
    if (qAge != null) parts.push(`90-day review ${qAge}d old`);
    else parts.push('no 90-day review yet');
    parts.push(`${obsCount} observations`);
    return parts.join(', ');
  };

  const posLines = enriched.map(p => {
    const u = state.universe[p.tkr];
    return `  - ${p.tkr}: ${p.shares} sh @ $${p.price.toFixed(2)} = $${p.value.toFixed(0)} (${p.weight.toFixed(1)}% weight, ${p.glPct >= 0 ? '+' : ''}${p.glPct.toFixed(1)}% gain) | conviction ${u?.conviction || '—'}, signal ${u?.signal || '—'}, sector ${p.sectorAssigned}${u ? ' | ' + staleness(u) : ''}`;
  }).join('\n');

  // Universe (research watchlist beyond holdings)
  const heldSet = new Set(enriched.map(p => p.tkr));
  const watchlist = Object.keys(state.universe)
    .filter(t => !heldSet.has(t))
    .map(t => {
      const u = state.universe[t];
      const zoneTxt = u.buyZone && u.buyZone.low ? `buy zone $${u.buyZone.low}-$${u.buyZone.fair}-$${u.buyZone.high}` : 'no buy zone set';
      return `  - ${t}: ${u.name || ''} | conviction ${u.conviction || '—'}, signal ${u.signal || '—'}, sector ${u.sector || '—'}, ${zoneTxt}${u.noBuy ? ' | NEVER BUY' : ''}${u.pinned ? ' | pinned' : ''}`;
    }).join('\n');

  // Sector status
  const sectorLines = Object.keys(window.SECTOR_TARGETS).map(s => {
    const cur = sw[s] || 0;
    const tgt = window.SECTOR_TARGETS[s];
    const status = cur < tgt.min ? 'UNDER' : cur > tgt.max ? 'OVER' : 'on-target';
    return `  - ${s}: ${cur.toFixed(1)}% vs ${tgt.min}-${tgt.max}% target [${status}]`;
  }).join('\n');

  // This month's deployment plan, straight from the rules engine
  const P = window.HardcapEngine.plan(state);
  const usd0 = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const coreBands = P.coreSectors.map(s => `${s.min}-${s.max}% ${s.name}`).join(', ');
  const planLines = [
    `  Market mode: ${P.mode.label} (S&P 500 ${P.mode.ddPct}% below its 52-week high${state.market && state.market.asOf ? ', read ' + state.market.asOf : ''}). Hold-back ${P.holdPct}% = ${usd0(P.hold)}. Dry powder ${usd0(P.excess)}. Runs left on schedule: ${P.runsLeft} (through ${P.rules.finishBy}).`,
    `  Budget this run: ${usd0(P.budget)}. Buys: ${P.buys.length ? P.buys.map(r => `${r.tkr} ${usd0(r.buy)}`).join(', ') : 'none'}. Cash after: ${usd0(P.cashAfter)} (${P.cashAfterPct.toFixed(1)}% of capital).`,
  ].concat(P.coreSectors.filter(s => s.remaining > 1).map(s =>
    `  ${s.name}: ${(s.curPct || 0).toFixed(1)}% now vs ${s.targetPct.toFixed(1)}% engine target; ${usd0(s.remaining)} still below target after this run${s.blockers.length ? '. Not buying: ' + s.blockers.map(b => b.tkr + ' (' + b.reason + ')').join('; ') : ''}${s.openSlots > 0 && s.bench && s.bench.length ? '. ' + s.openSlots + ' open slot(s); rated a buy but not pinned: ' + s.bench.slice(0, 5).map(b => b.tkr).join(', ') : ''}.`
  )).join('\n');
  const ruleLines = (window.HardcapIC && window.HardcapIC.buildICContext)
    ? window.HardcapIC.buildICContext(state, P, { tier: 'fast', focus: [] }).rules.map(r => '  - ' + r).join('\n')
    : '';
  const inflow = Number(state.monthlyDeposit) > 0 ? Math.round(Number(state.monthlyDeposit)) : null;

  // Active alerts
  const alertLines = trims.length > 0
    ? trims.map(t => `  - [${t.urgency.toUpperCase()}] ${t.reason} - trim $${t.trimDollar.toFixed(0)}`).join('\n')
    : '  (none)';

  return `You are the Investment Committee analyst for Hardcap, a personal long-only equity portfolio. You answer questions about the portfolio with the discipline and analytical rigor of Marc Rowan (Apollo CEO) — quantitative, risk-first, focused on FCF yield, growth durability, and concentration limits.

The user is a long-term individual investor with a 30-year horizon. New cash arrives irregularly${inflow ? ` (recently around $${inflow.toLocaleString('en-US')} a month)` : ''} and the amount varies, so never assume a fixed inflow. Core sector bands: ${coreBands}.

All weights and sector percentages below are measured against the book: total capital less the cash hold-back ($${Math.round(P.book).toLocaleString('en-US')}). That keeps a position from looking oversized only because cash is high.

# CURRENT PORTFOLIO STATE (as of ${importDate}, today is ${now})

Total capital: $${total.toFixed(0)} ($${eq.toFixed(0)} equity + $${cash.toFixed(0)} cash)
IC Readiness Score: ${ic}/100
Pending settlement: $${state.pendingActivity || 0}

## POSITIONS HELD
${posLines || '  (none)'}

## WATCHLIST (in universe but not held)
${watchlist || '  (none)'}

## SECTOR ALLOCATION
${sectorLines}

## ACTIVE RISK ALERTS
${alertLines}

## THIS MONTH'S DEPLOYMENT PLAN (set by the rules engine, not by you)
${planLines}

## THE RULES THE ENGINE FOLLOWS
${ruleLines}

# YOUR CAPABILITIES

You can answer questions about the portfolio, explain reasoning, project returns, run scenarios, and PROPOSE changes to the data. When the user asks you to change something (add a ticker, adjust conviction, edit a thesis, change monthly deposit, etc.), you must respond with a structured proposal in this exact JSON format embedded inside an \`\`\`action code block:

\`\`\`action
{
  "type": "add_ticker" | "edit_ticker" | "remove_ticker" | "set_monthly_deposit" | "update_position",
  "params": { ... },
  "summary": "One-line description of what will happen"
}
\`\`\`

The user will see this as Confirm/Reject buttons. Do NOT make changes through any other mechanism — proposals are the ONLY way to modify state.

## ACTION SCHEMAS

**add_ticker** — Add a new ticker to the universe. Use this when the user mentions any ticker not currently in the universe. Build the most rigorous Rowan-style analysis you can with what you know — flag estimates clearly:
\`\`\`action
{
  "type": "add_ticker",
  "params": {
    "tkr": "APO",
    "name": "Apollo Global Management",
    "sector": "Alt. Managers",
    "subsector": "Private Credit + PE",
    "conviction": 92,
    "signal": "Strong Buy",
    "buyZone": { "low": 155, "fair": 185, "high": 220 },
    "thesis": {
      "bull": "Quantitative bull case with FCF yield, growth, multiple, ROE — Rowan style.",
      "bear": "Specific failure modes with numerical thresholds.",
      "anchor": "At $X price, you are paying Y multiple of Z. Fair value math = $W.",
      "changeMyMind": "Specific events/data that would flip the thesis.",
      "catalysts": ["Q3 earnings", "Sector specific event"],
      "risks": ["Concrete risk 1", "Concrete risk 2"],
      "anchorReviewed": "YYYY-MM-DD"
    },
    "returnRates": {
      "bear": -0.05,
      "base": 0.18,
      "bull": 0.28,
      "rationale": "Bear: ... Base: ... Bull: ..."
    },
    "fundamentals": {
      "pe": 16, "fwdPe": 13, "fcfYield": 6.2, "revGrowth": 22, "marginOp": 38, "roe": 24, "netCashB": 8, "debtEbitda": 1.4
    },
    "notes": "Position-level guidance — sizing, timing."
  },
  "summary": "Add Apollo Global Management with conviction 92, Strong Buy signal"
}
\`\`\`

**edit_ticker** — Modify any field on an existing universe entry. Use \`updates\` with only the fields that change:
\`\`\`action
{
  "type": "edit_ticker",
  "params": {
    "tkr": "NVDA",
    "updates": { "conviction": 75, "signal": "Hold" }
  },
  "summary": "Lower NVDA conviction from 80 to 75"
}
\`\`\`

**update_quarterly_review** — Update the 90-day quarterly review for a ticker. Use this when discussing earnings, sector developments, or quarterly reassessments. Optionally include conviction/signal/buyZone updates:
\`\`\`action
{
  "type": "update_quarterly_review",
  "params": {
    "tkr": "NVDA",
    "review": "Q1 2026 (May): Datacenter rev +68% YoY, in line. Blackwell ramp on track. Margin softness on Hopper transition cited but expected to recover. Custom silicon chatter from Meta intensified. Net: thesis intact but Hopper-Blackwell transition adds 1-2 quarters of multiple-compression risk. Conviction nudged to 75.",
    "newConviction": 75,
    "newSignal": "Hold"
  },
  "summary": "Update NVDA 90-day review post-Q1 earnings, lower conviction to 75"
}
\`\`\`

**add_observation** — Add a dated note to a ticker's recent observations log. Use for breaking news, market events, single data points worth recording. Date defaults to today:
\`\`\`action
{
  "type": "add_observation",
  "params": {
    "tkr": "APO",
    "note": "Athene reported $14B Q1 inflows, beat estimate of $12B. Spread compression in line."
  },
  "summary": "Log Athene Q1 flows beat to APO observations"
}
\`\`\`

**update_anchor** — Rewrite the long-form anchor thesis (bull, bear, valuation, catalysts, risks). Use ONLY when the foundational thesis materially changes — not for routine updates. Resets the anchorReviewed date:
\`\`\`action
{
  "type": "update_anchor",
  "params": {
    "tkr": "NVDA",
    "bull": "Updated bull case...",
    "bear": "Updated bear case...",
    "anchor": "Updated valuation anchor...",
    "catalysts": ["..."],
    "risks": ["..."]
  },
  "summary": "Rewrite NVDA anchor thesis to reflect custom silicon shift"
}
\`\`\`

**remove_ticker** — Remove from universe:
\`\`\`action
{ "type": "remove_ticker", "params": { "tkr": "PLTR" }, "summary": "Remove PLTR from universe" }
\`\`\`

**set_monthly_deposit** — Update monthly inflow assumption:
\`\`\`action
{ "type": "set_monthly_deposit", "params": { "amount": 25000 }, "summary": "Update monthly inflow to $25,000" }
\`\`\`

# LAYERED THESIS PHILOSOPHY (CRITICAL)

Each ticker memo has three layers with different update cadences:

1. **Anchor** — long-form thesis (bull, bear, valuation, catalysts, risks). Edited rarely (1-2x per year). Use \`update_anchor\` only when the foundational thesis genuinely shifts.

2. **90-Day Review** — quarterly reassessment after earnings or major events. Use \`update_quarterly_review\`. This is where conviction scores typically move.

3. **Recent Observations** — short dated notes on news, data points, market events. Use \`add_observation\` liberally for anything worth logging. Keep notes to 1-2 sentences.

When the user mentions news, earnings, or events, default to \`add_observation\` for individual data points, and \`update_quarterly_review\` if they want a holistic reassessment.

# RULES

1. Numbers always come from the portfolio state above — never invent figures
2. When proposing thesis content, write it in the same Rowan-style as existing entries: quantitative, with FCF yields, multiples, breakeven prices, and concrete numerical thresholds
3. Conviction scores are 0-100. Signals: 'Strong Buy', 'Accumulate', 'Hold', 'Watch', 'Trim', 'Sell'
4. Be direct and analytical. No fluff, no generic disclaimers, no "consult a financial advisor" hedging — the user wants institutional-grade analysis, not retail caution
5. Proactively flag concerns. If user asks something that touches a known risk (concentration, sector overweight, stale review), bring it up unprompted
6. Sectors must be one of: ${Object.keys(window.SECTOR_TARGETS).join(', ')}
7. For new tickers, populate full fundamentals from your training-data knowledge (P/E, FCF yield, ROE, op margin, etc.). Flag these explicitly as "training-data estimates as of [training cutoff]" so the user knows to verify with current data
8. When user mentions news/earnings, default to creating an \`add_observation\` action — log it, don't just discuss it
9. Keep prose responses focused and tight. Lead with the answer/recommendation, then context. Don't pad
10. When proposing a conviction change, always cite the specific evidence: "Lowering NVDA from 80 to 75 because [specific catalyst]" — never vague
11. If a thesis is older than 90 days (check anchorReviewed/quarterlyReviewedAt dates above), proactively suggest a refresh when relevant to the user's question
12. Buy amounts are set by the rules engine (the plan above). When asked what to buy or how much, start from that plan and explain it. If you disagree, propose changing an input (signal, conviction, buy zone) with an action; do not substitute your own dollar figure
13. The portfolio is buy-only. Flag concentration or thesis decay, but do not propose a trim or sale as an action
14. Never propose buying crypto or any name marked NEVER BUY
15. When you propose a buy zone, give all three of low, fair and high, and say which multiple and earnings figure you used. If you are working from training-data memory rather than figures above, say so
16. The engine opens a new position only in a name the user has pinned (see the rules above). Which new names to own is the user's decision. If the user asks to start a name, propose edit_ticker with updates {"pinned": true} (and a signal of Accumulate or Strong Buy if it is on Watch or Hold). Never propose a pin the user did not ask for

# OUTPUT STYLE

- Lead with the verdict/answer in the first 1-2 sentences
- Use bold sparingly for key numbers and thresholds
- Use bullet points for lists of 3+ items
- When showing multiple scenarios, use clear labels (Bull/Base/Bear, or Bull/Bear if comparing two)
- Cite specific portfolio numbers from the state above when relevant — "Your APO position at $0 is your largest gap" not "you should consider APO"
- For action proposals, include a brief rationale BEFORE the action block explaining why this is the right move`;
}

// ─── SEND MESSAGE TO CLAUDE ────────────────────────────────────────
async function sendMessage(state, userMessage, history) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { error: 'No API key set. Add one in Import → Settings.' };
  }

  const systemPrompt = buildSystemPrompt(state);

  const messages = [
    ...history.filter(m => m.role !== 'system').map(m => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  // keep the last 20 turns, and make sure the conversation opens on a user turn
  let trimmed = messages.slice(-21);
  while (trimmed.length > 1 && trimmed[0].role !== 'user') trimmed = trimmed.slice(1);

  try {
    const res = await window.HardcapClaude.call({
      model: getModel(),
      effort: 'medium',
      maxTokens: 8192,
      system: systemPrompt,
      messages: trimmed,
    });
    return { text: res.text || '', usage: res.usage };
  } catch (e) {
    return { error: e.message };
  }
}

// ─── PARSE ACTION PROPOSALS FROM CLAUDE'S RESPONSE ─────────────────
// Claude embeds action blocks in fenced code blocks like ```action {...} ```
function parseActions(text) {
  const actions = [];
  const regex = /```action\s*\n([\s\S]*?)\n```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      actions.push({
        ...parsed,
        rawJSON: match[1].trim(),
        matchStart: match.index,
        matchEnd: match.index + match[0].length,
      });
    } catch (e) {
      console.warn('Failed to parse action block:', e);
    }
  }
  return actions;
}

// Strip action blocks from displayed text (we render them as buttons separately)
function stripActionBlocks(text) {
  return text.replace(/```action\s*\n[\s\S]*?\n```/g, '').trim();
}

// ─── EXECUTE ACTIONS ───────────────────────────────────────────────
function stampZone(z) {
  if (!z) return z;
  const low = Number(z.low), fair = Number(z.fair), high = Number(z.high);
  if (!(low > 0 && fair > 0 && high > 0)) return { low: z.low || null, fair: z.fair || null, high: z.high || null };
  return { low, fair, high, reviewed: new Date().toISOString().slice(0, 10) };
}

function executeAction(state, action) {
  const { type, params } = action;
  try {
    if (type === 'add_ticker') {
      if (!params.tkr) throw new Error('Ticker symbol required');
      const tkr = params.tkr.toUpperCase();
      if (state.universe[tkr]) throw new Error(`${tkr} already exists in universe`);
      state.universe[tkr] = {
        name: params.name || '',
        sector: params.sector || 'Other',
        subsector: params.subsector || '',
        conviction: params.conviction != null ? Number(params.conviction) : 65,
        signal: params.signal || 'Watch',
        buyZone: params.buyZone ? stampZone(params.buyZone) : { low: null, fair: null, high: null },
        thesis: params.thesis || { bull: '', bear: '', anchor: '', changeMyMind: '', catalysts: [], risks: [], lastReviewed: new Date().toISOString().slice(0,10) },
        returnRates: params.returnRates || null,
        fundamentals: params.fundamentals || {},
        notes: params.notes || '',
      };
      return { success: true, message: `Added ${tkr} to universe` };
    }
    if (type === 'edit_ticker') {
      const tkr = params.tkr?.toUpperCase();
      if (!tkr || !state.universe[tkr]) throw new Error(`${tkr || 'Ticker'} not found in universe`);
      const updates = params.updates || {};
      Object.keys(updates).forEach(key => {
        if (key === 'thesis' && state.universe[tkr].thesis) {
          state.universe[tkr].thesis = { ...state.universe[tkr].thesis, ...updates.thesis };
        } else if (key === 'buyZone') {
          state.universe[tkr].buyZone = stampZone(updates.buyZone);
        } else {
          state.universe[tkr][key] = updates[key];
        }
      });
      return { success: true, message: `Updated ${tkr}` };
    }
    if (type === 'update_quarterly_review') {
      const tkr = params.tkr?.toUpperCase();
      if (!tkr || !state.universe[tkr]) throw new Error(`${tkr || 'Ticker'} not found in universe`);
      if (!params.review) throw new Error('Review text required');
      state.universe[tkr].thesis = state.universe[tkr].thesis || {};
      state.universe[tkr].thesis.quarterlyReview = params.review;
      state.universe[tkr].thesis.quarterlyReviewedAt = new Date().toISOString().slice(0, 10);
      // Optionally update conviction or buy zone if Claude proposed them
      if (params.newConviction != null) {
        state.universe[tkr].conviction = Number(params.newConviction);
      }
      if (params.newSignal) {
        state.universe[tkr].signal = params.newSignal;
      }
      if (params.newBuyZone) {
        state.universe[tkr].buyZone = stampZone(params.newBuyZone);
      }
      return { success: true, message: `Updated ${tkr} 90-day review` };
    }
    if (type === 'add_observation') {
      const tkr = params.tkr?.toUpperCase();
      if (!tkr || !state.universe[tkr]) throw new Error(`${tkr || 'Ticker'} not found in universe`);
      if (!params.note) throw new Error('Observation note required');
      state.universe[tkr].thesis = state.universe[tkr].thesis || {};
      state.universe[tkr].thesis.recentObservations = state.universe[tkr].thesis.recentObservations || [];
      state.universe[tkr].thesis.recentObservations.push({
        date: params.date || new Date().toISOString().slice(0, 10),
        note: params.note,
      });
      // Keep last 12 observations max per ticker
      if (state.universe[tkr].thesis.recentObservations.length > 12) {
        state.universe[tkr].thesis.recentObservations = state.universe[tkr].thesis.recentObservations.slice(-12);
      }
      return { success: true, message: `Added observation to ${tkr}` };
    }
    if (type === 'update_anchor') {
      const tkr = params.tkr?.toUpperCase();
      if (!tkr || !state.universe[tkr]) throw new Error(`${tkr || 'Ticker'} not found in universe`);
      state.universe[tkr].thesis = state.universe[tkr].thesis || {};
      const t = state.universe[tkr].thesis;
      if (params.bull) t.bull = params.bull;
      if (params.bear) t.bear = params.bear;
      if (params.anchor) t.anchor = params.anchor;
      if (params.changeMyMind) t.changeMyMind = params.changeMyMind;
      if (params.catalysts) t.catalysts = params.catalysts;
      if (params.risks) t.risks = params.risks;
      t.anchorReviewed = new Date().toISOString().slice(0, 10);
      return { success: true, message: `Updated ${tkr} anchor thesis` };
    }
    if (type === 'remove_ticker') {
      const tkr = params.tkr?.toUpperCase();
      if (!tkr || !state.universe[tkr]) throw new Error(`${tkr || 'Ticker'} not in universe`);
      delete state.universe[tkr];
      return { success: true, message: `Removed ${tkr} from universe` };
    }
    if (type === 'set_monthly_deposit') {
      const amt = Number(params.amount);
      if (!amt || amt < 0) throw new Error('Invalid amount');
      state.monthlyDeposit = amt;
      return { success: true, message: `Monthly deposit set to $${amt.toLocaleString()}` };
    }
    if (type === 'update_position') {
      // Position updates only happen via CSV import — but allow manual override
      throw new Error('Positions are managed via CSV import only');
    }
    throw new Error(`Unknown action type: ${type}`);
  } catch (e) {
    return { success: false, message: e.message };
  }
}

window.HardcapChat = {
  getApiKey, setApiKey, hasApiKey,
  getModel, setModel, AVAILABLE_MODELS,
  loadChat, saveChat, clearChat,
  buildSystemPrompt,
  sendMessage,
  parseActions, stripActionBlocks,
  executeAction,
};
