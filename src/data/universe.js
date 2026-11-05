// ═══════════════════════════════════════════════════════════════════
// HARDCAP — UNIVERSE DATABASE
// Pre-populated thesis memos, fundamentals, and signals for your watchlist.
// All data is YOUR view — edit anytime in the Universe tab.
// ═══════════════════════════════════════════════════════════════════

// This is the seed dataset. The app loads from localStorage if it exists,
// falls back to this if not. You edit through the UI, never this file.

window.UNIVERSE_SEED = {
  // ─── CORE NAMES ───────────────────────────────────────────────────
  NVDA: {
    name: 'NVIDIA Corporation',
    sector: 'Semiconductors',
    subsector: 'AI Compute',
    conviction: 80,
    signal: 'Hold',
    buyZone: { low: 165, fair: 200, high: 240 },
    returnRates: {
      bear: -0.18,   // multiple compression to 25x + AI capex deceleration
      base:  0.11,   // 30% growth + ~10% multiple compression nets to 11%
      bull:  0.28,   // sustained 60%+ growth + hyperscaler 2027 capex re-acceleration
      rationale: 'Bear: Custom silicon takes share, capex peaks 2025, multiple compresses 38x→25x. Base: 30% growth offset by gradual de-rating. Bull: AI capex sustains, sovereign AI ramps, multiple holds.',
    },
    fundamentals: {
      pe: 52, fwdPe: 38, peg: 1.8, fcfYield: 1.6,
      revGrowth: 78, marginOp: 62, roe: 105,
      netCashB: 38, debtEbitda: 0.1,
    },
    thesis: {
      bull: 'NVIDIA owns the picks-and-shovels economics of the AI buildout. Quantitatively: Datacenter revenue compounding at +75% YoY, gross margins 75%, operating margins 62%, ROE 105%, FCF yield 1.6% (low because of growth reinvestment, not stress). $38B net cash. CUDA moat is generational — every meaningful AI workload is written against it. Hyperscaler capex commitments through 2027 are signed: Microsoft, Meta, Google, and Amazon collectively guiding to $250B+ in 2026 capex, the bulk going to NVIDIA silicon. Optionality on sovereign AI, robotics, and inference compute beyond training.',
      bear: 'Buying the most-loved name in the largest theme on the planet at 38x forward earnings. Hyperscaler capex is cyclical — the 2024-2026 peak will end, and the comp base from here is brutal. Custom silicon (Trainium, TPU, MTIA) is real and getting closer. Geopolitical exposure to Taiwan via TSM is existential, not theoretical. China revenue is structurally impaired.',
      changeMyMind: 'A clean miss on datacenter revenue with guidance cut, OR custom silicon taking >25% of frontier training workloads, OR Taiwan tail risk repricing globally.',
      anchor: 'At $211, you are paying 38x FY27 earnings of ~$5.50. To justify holding, AI capex must remain at or above 2025 levels through 2027. Any deceleration to "merely strong" 30% growth resets the multiple to 25x and the stock to $137.',
      catalysts: ['Blackwell ramp data', 'China export license clarity', 'Hyperscaler 2027 capex guidance', 'Sovereign AI deal flow'],
      risks: ['Taiwan geopolitics (existential)', 'Custom silicon adoption', 'AI capex cycle peak', 'Margin compression as AMD MI400 ships'],
      anchorReviewed: '2026-05-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-05-08',
    },
    notes: 'Quality at a full multiple. Add only inside the buy zone; trim if the position grows past the single-name cap.',
  },

  TSM: {
    name: 'Taiwan Semiconductor Manufacturing',
    sector: 'Semiconductors',
    subsector: 'Foundry',
    conviction: 88,
    signal: 'Accumulate',
    buyZone: { low: 320, fair: 400, high: 480 },
    returnRates: {
      bear: -0.12,   // Taiwan tail risk repricing without invasion
      base:  0.14,   // 4% FCF + 12% rev growth + slight re-rating
      bull:  0.22,   // AI mix expansion drives margin uplift, multiple expands to 28x
      rationale: 'Bear: Taiwan stress event, multiple compresses 22x→16x temporarily. Base: 12% revenue growth with margin expansion. Bull: AI accelerator mix lifts margins to 52%, re-rated to peer foundry premium.',
    },
    fundamentals: {
      pe: 28, fwdPe: 22, peg: 1.0, fcfYield: 3.8,
      revGrowth: 38, marginOp: 48, roe: 32,
      netCashB: 42, debtEbitda: 0.5,
    },
    thesis: {
      bull: 'Effective monopoly on leading-edge logic — every chip you care about (Apple, NVIDIA, AMD, Qualcomm, Broadcom) is fabbed here. Quantitatively: 22x forward earnings, 3.8% FCF yield, 48% operating margins (structurally widening as AI mix grows), 32% ROE, 38% revenue growth, $42B net cash. Capex intensity is high but funded internally. 5-year technology lead at N2 and below — competitors (Intel, Samsung) are years behind in yield and density. Arizona/Japan/Germany de-risking happening on customer dollars, not theirs.',
      bear: 'Taiwan invasion is not a tail risk — it is a base case for some asset allocators, and the stock prices in zero of it. Customer concentration is brutal: NVIDIA + Apple = ~40% of revenue. Capex intensity is rising. Geopolitical export controls one bad headline away from impairing China revenue.',
      changeMyMind: 'Material PLA exercise escalation around Taiwan, OR a customer (Apple specifically) qualifying Samsung/Intel for leading-edge node at scale, OR a technology stumble at N2.',
      anchor: 'At $414, you are paying 22x FY27 EPS of ~$19. Versus a 5-year monopoly window at the leading edge with 48% operating margins, this is conservatively cheap. A Taiwan-risk-free comparable would trade at 32x — implying $608 fair value before geopolitical discount.',
      catalysts: ['N2 ramp 2026', 'AI accelerator volume guidance', 'Arizona Fab 2 yield data', 'CoWoS capacity expansion'],
      risks: ['Taiwan Strait escalation', 'US-China export controls', 'Customer concentration', 'N2 yield issues'],
      anchorReviewed: '2026-05-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-05-08',
    },
    notes: 'Highest-conviction semiconductor name. Add on pullbacks below $400.',
  },

  AMZN: {
    name: 'Amazon.com Inc',
    sector: 'Consumer Tech',
    subsector: 'E-commerce + Cloud',
    conviction: 72,
    signal: 'Hold',
    buyZone: { low: 220, fair: 270, high: 320 },
    returnRates: {
      bear: -0.06,   // AWS decel + retail margin reverts
      base:  0.10,   // 14% revenue growth, modest margin expansion, 30x SOTP premium narrows
      bull:  0.18,   // AWS reaccelerates to 22%, retail margins step up to 8%
      rationale: 'Bear: Azure takes AWS share, retail margins compress. Base: AWS at 18% growth, ad business compounds at software margins. Bull: All three engines fire, ad disclosure forces re-rating.',
    },
    fundamentals: {
      pe: 42, fwdPe: 32, peg: 1.4, fcfYield: 3.2,
      revGrowth: 14, marginOp: 12, roe: 22,
      netCashB: 76, debtEbitda: 1.2,
    },
    thesis: {
      bull: 'AWS is the second-best business in software (after Microsoft) and is finally being priced as one — operating margins 38%+, $115B run-rate, growing 22%. Retail is operationally levered: every basis point of margin on $700B+ of GMV drops directly to FCF. Advertising business is a hidden $60B run-rate growing 20% at software margins.',
      bear: 'Three businesses bolted together with one valuation that always rounds up. Retail margins still 5%, perennially "about to inflect." AWS facing real Azure competition for the first time in a decade. Capex commitments to AI infrastructure are running ahead of revenue.',
      changeMyMind: 'AWS growth decelerating below 18%, OR retail margin reverting below 4%, OR a sustained advertising slowdown.',
      anchor: 'At $271, sum-of-parts: AWS at 12x revenue = $1.4T, Ads at 18x EBITDA = $400B, Retail at 0.6x revenue = $420B. Combined $2.2T vs current ~$2.85T market cap. You are paying ~30% premium to SOTP — fair, not cheap.',
      catalysts: ['AWS reaccel', 'Retail margin step-up', 'Ads disclosure improvement', 'AI Bedrock traction'],
      risks: ['Azure share gain', 'Retail competition (Shein/Temu)', 'Capex outpacing returns', 'Regulatory'],
      anchorReviewed: '2026-05-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-05-08',
    },
    notes: 'Decent compounder. Not a strong-buy at current levels — hold.',
  },

  CVX: {
    name: 'Chevron Corporation',
    sector: 'Energy',
    subsector: 'Integrated Major',
    conviction: 70,
    signal: 'Hold',
    buyZone: { low: 145, fair: 175, high: 200 },
    returnRates: {
      bear: -0.08,   // Oil to $50 sustained, buyback math breaks
      base:  0.09,   // 8% FCF yield + 1% growth, multiple flat
      bull:  0.16,   // $90 oil, Guyana ramp accelerates, EV thesis fades
      rationale: 'Bear: WTI sustained sub-$60 breaks the buyback economics. Base: $75 oil, steady 8% FCF return, dividend covers downside. Bull: Supply discipline holds, Guyana adds 500kboed, multiple re-rates.',
    },
    fundamentals: {
      pe: 14, fwdPe: 12, peg: 2.4, fcfYield: 8.2,
      revGrowth: 4, marginOp: 14, roe: 14,
      netCashB: -22, debtEbitda: 0.8,
    },
    thesis: {
      bull: 'Best-in-class capital allocator among the supermajors. Quantitatively: 8.2% FCF yield at $75 WTI, 12x forward earnings, 14% ROE, dividend covered at $50 oil, $20B+ annual buybacks at current prices reduce share count ~5%/year. Permian + Tengiz growth drivers fully funded through 2030. Hess acquisition gives Guyana exposure — best new oil basin globally with $25/bbl breakeven. Dividend aristocrat with 37 consecutive years of increases. Net debt is modest at 0.8x EBITDA.',
      bear: 'Oil is structurally challenged regardless of cycle — EV penetration, peak demand thesis, capital starvation. Hess deal closed expensive. Permian decline curves are accelerating. 8% FCF yield needs $75 oil to hold; below $65 the buyback math breaks.',
      changeMyMind: 'WTI sustainably below $60 (breaks the buyback), OR EV penetration accelerating beyond 25% globally, OR a major operational issue at Tengiz.',
      anchor: 'At $182 with $75 WTI assumption, EV/DACF of 6.5x is below historical 8x average. Fair value $215. Below $65 oil, fair value drops to $145.',
      catalysts: ['Guyana production ramp', 'Permian 1mboed milestone', 'OPEC+ discipline', 'Buyback pace acceleration'],
      risks: ['Oil price below $65', 'EV demand destruction', 'Regulatory carbon pricing', 'Geopolitical supply shocks (mixed)'],
      anchorReviewed: '2026-05-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-05-08',
    },
    notes: 'Add on dips below $170. Of the two integrated majors, XOM has the stronger balance sheet and the higher FCF yield.',
  },

  BTC: {
    name: 'Bitcoin',
    sector: 'Crypto',
    subsector: 'Digital Asset',
    conviction: 55,
    signal: 'Hold',
    buyZone: { low: 60000, fair: 85000, high: 120000 },
    returnRates: {
      bear: -0.40,   // ETF outflow cascade, regulatory event
      base:  0.08,   // mean-revert assumption, halving cycle math weakened
      bull:  0.45,   // sovereign adoption, supply shock from ETF demand
      rationale: 'No cash flow anchor — return purely a function of demand. Bear: institutional flows reverse. Base: gold-replacement thesis at 5% of gold market cap. Bull: sovereign reserve adoption, supply/demand mismatch.',
    },
    fundamentals: {
      pe: null, fwdPe: null, peg: null, fcfYield: null,
      revGrowth: null, marginOp: null, roe: null,
      netCashB: null, debtEbitda: null,
    },
    thesis: {
      bull: 'Hardest money ever invented. ETF flows institutionalised the asset class — Larry Fink owns it. Sovereign reserve thesis is no longer fringe. Halving supply dynamics + ETF demand is a structural mismatch. Asymmetric tail at portfolio level even at 1-3% sizing.',
      bear: 'Produces no cash flow — the entire thesis is greater fool. Correlation with NASDAQ has not broken despite "digital gold" narrative. Regulatory risk in any administration that wants to make an example. Energy use politically vulnerable.',
      changeMyMind: 'A sustained breakdown below $50k (rejects the institutional bid), OR loss of correlation favourably (becomes uncorrelated to risk assets again).',
      anchor: 'No cash-flow anchor. Position sizing matters more than entry — keep below 5% of portfolio regardless of price.',
      catalysts: ['Sovereign adoption headlines', 'ETF flows', 'Next halving cycle math', 'US regulatory clarity'],
      risks: ['Regulatory clampdown', 'ETF outflow cascade', 'Correlation breakdown', 'Liquidity events'],
      anchorReviewed: '2026-05-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-05-08',
    },
    noBuy: true,
    notes: 'Optionality sleeve only, marked never-buy: hold small, do not add, do not trim. Volatility is the cost of the option.',
  },

  // ─── WATCHLIST ────────────────────────────────────────────────────
  APO: {
    name: 'Apollo Global Management',
    sector: 'Alt. Managers',
    subsector: 'Private Credit + PE',
    conviction: 92,
    signal: 'Strong Buy',
    buyZone: { low: 155, fair: 185, high: 220 },
    returnRates: {
      bear: -0.05,   // private credit default cycle, Athene marks come down
      base:  0.18,   // 20% FRE growth + 6% FCF yield, slight de-rating
      bull:  0.28,   // re-rating to 20x FRE on growth proof + Athene flows accelerate
      rationale: 'Highest conviction in the universe (92). Bear: real default cycle tests private credit, FRE growth slows to 12%. Base: 20% FRE growth compounds, multiple holds at 13x. Bull: re-rated to 20x as growth thesis proves out — most asymmetric mainstream public equity.',
    },
    fundamentals: {
      pe: 16, fwdPe: 13, peg: 0.7, fcfYield: 6.2,
      revGrowth: 22, marginOp: 38, roe: 24,
      netCashB: 8, debtEbitda: 1.4,
    },
    thesis: {
      bull: 'The Rowan thesis: private credit is replacing the regional bank balance sheet across $40T of US assets. Quantitatively, Apollo is the single best-positioned firm: 13x forward FRE (fee-related earnings), 6.2% FCF yield, 38% FRE margins, 22% revenue growth, 24% ROE. Athene gives them $300B+ of permanent insurance capital they can lend through their origination platform. They originate $200B+ annually and credit Athene policyholders ~5%, capturing the spread which is structurally widening. FRE is non-cyclical and compounding 20%+ — there is no public alternative manager with this combination of growth, margin, and capital base. Bank of America trades at 12x earnings with single-digit growth — APO at 13x with 22% growth is mispriced.',
      bear: 'Levered to private credit cycle that has not been tested through a real default cycle. Athene mark-to-model exposure to commercial real estate. If alt assets get repriced down by LPs, fundraising slows and FRE growth decelerates. KKR and Blackstone are formidable competitors with bigger brands.',
      changeMyMind: 'A genuine private credit default cycle producing >3% loss rates, OR Athene fixed annuity spread compressing materially, OR LP allocation pullback from alts at scale.',
      anchor: 'At $155, paying 13x forward FRE of ~$12. Versus 20% FRE growth, 38% FRE margins, and a structural growth runway, fair value is 18-22x = $216-264. This is the most asymmetric mainstream public equity right now.',
      catalysts: ['Athene flows quarterly', 'Origination platform $300B target', 'Private credit AUM milestones', 'Insurance M&A'],
      risks: ['Private credit default cycle', 'Athene CRE exposure', 'Regulatory capital rules on insurance', 'LP allocation pullback'],
      anchorReviewed: '2026-05-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-05-08',
    },
    notes: 'Top conviction in the alt-manager sleeve. Most attractive below fair value.',
  },

  XOM: {
    name: 'ExxonMobil Corporation',
    sector: 'Energy',
    subsector: 'Integrated Major',
    conviction: 87,
    signal: 'Strong Buy',
    buyZone: { low: 105, fair: 130, high: 155 },
    returnRates: {
      bear: -0.06,   // Oil to $55 sustained, slowed Permian ramp
      base:  0.12,   // 9% FCF yield + 3% production growth, multiple flat at 11x
      bull:  0.22,   // $90 oil + Guyana 1mboed milestone + buyback accelerates
      rationale: 'Best balance sheet in supermajors at 0.7x EBITDA. Bear: WTI below $60 sustained, Pioneer integration stalls. Base: $75 oil supports 9% FCF yield + 3% production growth. Bull: Guyana 1mboed, Permian 2mboed by 2027, multiple re-rates.',
    },
    fundamentals: {
      pe: 13, fwdPe: 11, peg: 1.8, fcfYield: 9.4,
      revGrowth: 6, marginOp: 16, roe: 18,
      netCashB: -8, debtEbitda: 0.7,
    },
    thesis: {
      bull: 'The disciplined supermajor. Quantitatively: 9.4% FCF yield at $75 WTI (highest in supermajors), 11x forward earnings, 18% ROE, dividend covered at $40 oil, $20B annual buybacks. Permian + Guyana = the two best oil resources globally and Exxon owns lead positions in both. Pioneer acquisition fully integrated — Permian production at 1.5mboed and rising. Upstream breakeven below $40/bbl. Best balance sheet in the sector at 0.7x EBITDA. Guyana production economics are extraordinary: full-cycle breakeven ~$25/bbl, IRR >25% at $50 oil.',
      bear: 'Same secular oil bear thesis as CVX. Pioneer was paid for at peak. Permian decline curves are universal. Refining margins normalising. ESG capital pressure ongoing.',
      changeMyMind: 'WTI sustainably below $60, OR Guyana operational issue, OR a transformational bad acquisition.',
      anchor: 'At $115 with $75 WTI, 11x forward earnings is a steal for this asset base. EV/DACF 6x vs 8x historical = 33% upside to $153 fair value. Below $65 oil, fair value $95.',
      catalysts: ['Guyana 1mboed milestone', 'Permian 2mboed by 2027', 'OPEC+ discipline', 'LNG project FIDs'],
      risks: ['Oil below $65', 'Guyana legal/political (Venezuela)', 'Refining margin compression', 'Carbon regulations'],
      anchorReviewed: '2026-05-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-05-08',
    },
    notes: 'Preferred integrated major: strongest balance sheet and highest FCF yield of the group.',
  },

  GOOGL: {
    name: 'Alphabet Inc',
    sector: 'Consumer Tech',
    subsector: 'Search + Cloud + AI',
    conviction: 78,
    signal: 'Accumulate',
    buyZone: { low: 165, fair: 200, high: 240 },
    returnRates: {
      bear: -0.10,   // Search disruption accelerates, Chrome divestiture
      base:  0.13,   // 14% rev growth + 5% FCF yield, multiple flat at 18x
      bull:  0.20,   // Cloud margin step-up + Gemini enterprise traction
      rationale: 'Cheapest of mag 7 by every metric. Bear: ChatGPT/Perplexity take high-intent commercial queries, antitrust forces Chrome divestiture. Base: search query volume holds, Cloud margins improve. Bull: Gemini wins enterprise share, Waymo monetizes.',
    },
    fundamentals: {
      pe: 22, fwdPe: 18, peg: 1.2, fcfYield: 4.8,
      revGrowth: 14, marginOp: 32, roe: 30,
      netCashB: 105, debtEbitda: 0.2,
    },
    thesis: {
      bull: 'Cheapest of the magnificent 7 by every metric. 18x forward earnings for a business with 32% operating margins, 14% revenue growth, $105B net cash, and the second-best AI research lab on earth (Gemini, DeepMind). Search disruption thesis is overstated — query volume is actually rising, not falling. YouTube + Cloud + Waymo + Gemini are four call options worth $500B+ collectively.',
      bear: 'Search is in genuine secular decline as users shift to ChatGPT/Perplexity for high-intent commercial queries — and those are the queries that monetise. Antitrust Chrome divestiture risk. Cloud margin still subscale. AI capex enormous with unclear monetisation.',
      changeMyMind: 'Search query volume turning negative YoY, OR a credible Chrome/Android forced divestiture, OR Cloud margin not improving.',
      anchor: 'At $165 with $9 in 2027 EPS, 18x is conservative. Sum-of-parts: Search at 15x = $1.5T, Cloud at 8x revenue = $400B, YouTube at 12x revenue = $480B, net cash $105B, Other Bets $100B. Fair value $2.6T = $213/share.',
      catalysts: ['Search query trend disclosure', 'Cloud margin expansion', 'Gemini enterprise traction', 'Waymo monetisation'],
      risks: ['Antitrust Chrome divestiture', 'Search disruption acceleration', 'Cloud share loss', 'AI capex returns'],
      anchorReviewed: '2026-05-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-05-08',
    },
    notes: 'Second-tier add after APO and XOM. Wide buy zone: comfortable adding up to fair value ($200).',
  },

  PLTR: {
    name: 'Palantir Technologies',
    sector: 'Enterprise Software',
    subsector: 'Defense + Commercial AI',
    conviction: 61,
    signal: 'Watch',
    buyZone: { low: 35, fair: 65, high: 95 },
    returnRates: {
      bear: -0.40,   // any commercial deceleration prints catastrophic compression
      base:  0.05,   // 32% growth offset by major multiple compression from 110x
      bull:  0.30,   // commercial inflects, defense compounds, multiple holds
      rationale: 'Trading at 110x forward. Bear: commercial deceleration triggers multiple collapse. Base: 32% growth offset by 110x→60x re-rating. Bull: AIP traction proves out, defense compounds. Position size: starter only.',
    },
    fundamentals: {
      pe: 180, fwdPe: 110, peg: 4.2, fcfYield: 1.2,
      revGrowth: 32, marginOp: 24, roe: 14,
      netCashB: 5, debtEbitda: 0,
    },
    thesis: {
      bull: 'Real moat in defense — government contracts are sticky, growing, and high-margin. Commercial AIP business inflecting fast with named-account momentum. Karp is a generational founder operator. Long runway in both segments.',
      bear: 'Trading at 110x forward earnings and 25x revenue. The math requires perfection. Any commercial deceleration prints catastrophic multiple compression. Every major dilution event is met with retail buying — unsustainable.',
      changeMyMind: 'A clean commercial revenue beat with multiple expansion, OR a commercial deceleration creating a real entry below $40.',
      anchor: 'No reasonable anchor at $90+. Wait for $50-60 range with deceleration narrative shaken out. Position size: starter only.',
      catalysts: ['Commercial AIP traction', 'Defense budget cycles', 'Foundry expansion', 'Margin step-up'],
      risks: ['Multiple compression on any miss', 'Commercial concentration', 'Government contract delays', 'Founder dependency'],
      anchorReviewed: '2026-05-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-05-08',
    },
    notes: 'WATCH — do not buy at current levels. Set alert at $50.',
  },

  // ═══════════════════════════════════════════════════════════════
  // ENERGY — your target sector, currently underweight
  // ═══════════════════════════════════════════════════════════════
  EOG: {
    name: 'EOG Resources',
    sector: 'Energy',
    subsector: 'Upstream E&P · Premium Permian + Eagle Ford',
    conviction: 88,
    signal: 'Strong Buy',
    buyZone: { low: 110, fair: 130, high: 155 },
    fundamentals: { pe: 11, fwdPe: 10, fcfYield: 9.5, revGrowth: 6, marginOp: 38, roe: 22, netCashB: 5, debtEbitda: 0.4 },
    thesis: {
      bull: 'Best-in-class Permian operator. ~$36/bbl breakeven, 9-10% FCF yield, capital-light return-of-capital model. Premium acreage + technology edge produces ~30% lower well costs than peers. Net-cash balance sheet, $5B war chest. Disciplined hedging, never overpays for inventory.',
      bear: 'Pure-play upstream — no downstream cushion when oil prices collapse. Permian decline curves accelerating; needs to acquire to hold production flat past 2028. WTI below $55 compresses FCF to mid-single digits. ESG-driven institutional outflows could compress multiple another 1-2 turns.',
      anchor: 'At $130, paying 10x forward EPS on $13/sh earnings power at $75 WTI. FCF yield 9.5% — every $10/bbl move = ~$1B FCF. Fair value $135-145 in base case, $170+ if WTI sustains $80+.',
      changeMyMind: 'WTI sustains below $55 for >2 quarters / Permian inventory life shortens below 8 years / Capital discipline breaks (M&A spree) / FCF yield compresses below 6% at strip.',
      catalysts: ['Q1 2026 capex guide', 'Permian production update', 'Special dividend announcement', 'Strategic acreage acquisition'],
      risks: ['WTI < $55', 'Permian depletion', 'Methane regulation', 'ESG capital flight'],
      anchorReviewed: '2026-05-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-05-08',
    },
    returnRates: {
      bear: -0.08, base: 0.12, bull: 0.22,
      rationale: 'Bear: WTI collapses to $50, FCF compresses, multiple stays at 10x. Base: WTI $70-80, steady 10% FCF yield + 2% buyback + 4% dividend. Bull: WTI sustains $85+, multiple re-rates to 12x on capital return.',
    },
    notes: 'Pair with XOM/CVX for diversified energy exposure. EOG is the pure upstream play; XOM/CVX provide downstream offset.',
  },

  COP: {
    name: 'ConocoPhillips',
    sector: 'Energy',
    subsector: 'Diversified Upstream · Permian + Eagle Ford + Alaska',
    conviction: 84,
    signal: 'Accumulate',
    buyZone: { low: 95, fair: 115, high: 140 },
    fundamentals: { pe: 10, fwdPe: 9, fcfYield: 9, revGrowth: 8, marginOp: 32, roe: 19, netCashB: 2, debtEbitda: 0.6 },
    thesis: {
      bull: 'Largest pure-play upstream in U.S. post-Marathon merger. Massive Permian + Eagle Ford acreage (10+ years inventory at sub-$40 breakeven) + Willow project Alaska (long-life, low-decline). Variable dividend framework returns 30-40% of operating CF directly to shareholders. $24B Marathon synergies still flowing through.',
      bear: 'Marathon integration risk — operational complexity, cost overruns. Alaska Willow exposure to environmental litigation. Pure E&P means no refining cushion. Variable dividend can be cut without warning if FCF compresses.',
      anchor: 'At $115, paying 9x forward EPS, 9% FCF yield. Marathon adds $2B annual FCF at synergy run-rate. Fair value $120-135 base case.',
      changeMyMind: 'Willow project gets blocked / Marathon synergies undershoot $5B by Q4 2026 / Variable dividend cut signals capital stress / WTI < $60 sustained.',
      catalysts: ['Marathon synergy update', 'Willow first oil 2029 milestone', 'Variable dividend declarations', 'Permian rig count signals'],
      risks: ['Integration execution', 'Willow legal challenges', 'Oil price collapse', 'Dividend volatility scaring retail'],
      anchorReviewed: '2026-05-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-05-08',
    },
    returnRates: {
      bear: -0.10, base: 0.11, bull: 0.20,
      rationale: 'Bear: WTI $55, integration delays, multiple compresses. Base: $75 WTI, synergies on track, 9% FCF yield + 4% dividend yield. Bull: $85+ WTI, Willow online, multiple expands to 11x.',
    },
    notes: 'Excellent complement to EOG — same thesis but with Alaska + bigger Permian footprint and variable dividend mechanics.',
  },

  WMB: {
    name: 'Williams Companies',
    sector: 'Energy',
    subsector: 'Midstream · Natural Gas Pipelines',
    conviction: 80,
    signal: 'Accumulate',
    buyZone: { low: 50, fair: 60, high: 72 },
    fundamentals: { pe: 22, fwdPe: 20, fcfYield: 5.5, revGrowth: 7, marginOp: 30, roe: 18, debtEbitda: 4.0 },
    thesis: {
      bull: 'Operates the largest U.S. natural gas pipeline network (Transco). AI datacenter power demand thesis — gas-fired generation is the only practical baseload to support hyperscaler load growth (50+ GW expected by 2030). 95%+ regulated/contracted cash flows. 5%+ growing dividend, 8-10% total return profile with bond-like predictability.',
      bear: 'Pipeline buildout timelines stretch 5-7 years with permitting delays. Renewable + battery progress could outpace gas demand growth past 2030. Highly leveraged (4x debt/EBITDA) — vulnerable to rate spikes. Methane regulation could force costly retrofit.',
      anchor: 'At $60, paying 20x EPS but 5.5% FCF yield + 4.5% dividend = 10% total cash return. EV/EBITDA ~13x vs midstream historical 10x — slight premium for AI datacenter exposure.',
      changeMyMind: 'AI datacenter buildout slows materially / Major pipeline rejection (FERC or state level) / Renewable + battery cost curve accelerates past gas / Debt/EBITDA breaches 5x.',
      catalysts: ['Datacenter pipeline contract announcements', 'Transco expansion approvals', 'LNG export demand updates', 'Dividend hikes'],
      risks: ['Permitting delays', 'Rate sensitivity', 'Renewable substitution', 'Methane regulation'],
      anchorReviewed: '2026-05-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-05-08',
    },
    returnRates: {
      bear: -0.02, base: 0.10, bull: 0.16,
      rationale: 'Bear: rates spike, multiple compresses to 10x EBITDA. Base: 4-5% volume growth + 4.5% dividend + modest re-rate = 10%. Bull: AI datacenter demand drives multiple to 14x EBITDA.',
    },
    notes: 'Energy infrastructure exposure — different risk profile than upstream EOG/COP. Adds bond-like cash flow stability.',
  },

  // ═══════════════════════════════════════════════════════════════
  // ALT MANAGERS — your second-biggest gap, currently 0%
  // ═══════════════════════════════════════════════════════════════
  BX: {
    name: 'Blackstone',
    sector: 'Alt. Managers',
    subsector: 'Alts Pioneer · RE + PE + Private Credit + Infra',
    conviction: 90,
    signal: 'Strong Buy',
    buyZone: { low: 145, fair: 175, high: 215 },
    fundamentals: { pe: 28, fwdPe: 22, fcfYield: 4.5, revGrowth: 14, marginOp: 47, roe: 35 },
    thesis: {
      bull: 'Category-defining alts manager. $1.1T+ AUM, growing 12-15% annually. Real estate, private equity, private credit, infrastructure, hedge fund solutions. Fee-related earnings (FRE) doubling every 5-6 years on management fee growth. Insurance integration via Lockheed/Corebridge expanding permanent capital base. Best-in-class operating margins at 47%+ — pure operating leverage as AUM scales.',
      bear: 'Management fee growth slows when fundraising cycles cool. Real estate exposure (40% of AUM) faces office secular decline + cap rate pressure. Performance fees lumpy. High multiple (22x forward) means any growth disappointment = sharp re-rating. Concentration risk — Schwarzman/Gray succession.',
      anchor: 'At $175, paying 22x forward FRE on ~13% AUM CAGR. Fair value $180-200 base case. Insurance partnerships add 2-3 years of permanent capital growth runway.',
      changeMyMind: 'AUM growth drops below 8% / Real estate write-downs cascade / Major performance fee disappointment / Schwarzman succession causes operating disruption.',
      catalysts: ['Quarterly fundraising data', 'Insurance partnership deals', 'Performance fee crystallization events', 'Buyback announcements'],
      risks: ['RE office exposure', 'Fundraising cycle', 'Multiple compression', 'Key-person succession'],
      anchorReviewed: '2026-05-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-05-08',
    },
    returnRates: {
      bear: -0.05, base: 0.16, bull: 0.26,
      rationale: 'Bear: AUM growth halves, multiple compresses to 16x. Base: 12-14% AUM CAGR, FRE doubles, dividend grows. Bull: insurance integration accelerates, multiple holds at 24x.',
    },
    notes: 'Cleanest pure-play comp to APO. Pair them — APO leans private credit, BX leans real estate + PE. Together = full alts spectrum.',
  },

  KKR: {
    name: 'KKR & Co.',
    sector: 'Alt. Managers',
    subsector: 'PE Pioneer · Private Equity + Insurance (Global Atlantic)',
    conviction: 87,
    signal: 'Strong Buy',
    buyZone: { low: 115, fair: 145, high: 175 },
    fundamentals: { pe: 24, fwdPe: 18, fcfYield: 5.5, revGrowth: 22, marginOp: 41, roe: 26 },
    thesis: {
      bull: 'Direct Apollo peer, pioneered modern PE 50 years ago. $620B AUM + Global Atlantic insurance permanent capital ($150B+). Strategic Holdings segment compounds earnings through long-duration ownership of cash-flow businesses. FRE growing 20%+. Insurance integration provides multi-year visible AUM runway. Trades at a discount to APO/BX on FRE multiple.',
      bear: 'Strategic Holdings segment volatile — book value swings on private mark-to-market. Global Atlantic concentrated in insurance products that face spread compression risk. Younger insurance arm vs APO\'s Athene, less proven through cycles.',
      anchor: 'At $145, paying 18x forward FRE — 4 turns below APO/BX. Strategic Holdings adds optionality. Fair value $160-185 base case.',
      changeMyMind: 'Global Atlantic spread compression / Strategic Holdings markdowns cascade / Major fundraising miss / FRE growth drops below 12%.',
      catalysts: ['Quarterly FRE growth', 'Global Atlantic flow data', 'Strategic Holdings monetization', 'New fund launches'],
      risks: ['Insurance spread compression', 'Strategic Holdings volatility', 'Younger insurance integration', 'Multiple gap to peers may persist'],
      anchorReviewed: '2026-05-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-05-08',
    },
    returnRates: {
      bear: -0.06, base: 0.17, bull: 0.27,
      rationale: 'Bear: Global Atlantic spread compression, Strategic Holdings markdowns. Base: AUM grows 15%, multiple holds, FRE compounds. Bull: multiple re-rates to APO/BX level (22x), Strategic Holdings monetization unlocks value.',
    },
    notes: 'Triangulate APO/BX/KKR — three-legged alts stool. Each has different sector tilt and capital base structure.',
  },

  BAM: {
    name: 'Brookfield Asset Management',
    sector: 'Alt. Managers',
    subsector: 'Infrastructure + Renewables + RE · Pure Asset-Light',
    conviction: 82,
    signal: 'Accumulate',
    buyZone: { low: 50, fair: 60, high: 72 },
    fundamentals: { pe: 32, fwdPe: 26, fcfYield: 3.5, revGrowth: 16, marginOp: 53, roe: 19 },
    thesis: {
      bull: 'Pure-play asset manager (spun out of Brookfield Corp) with $1T+ AUM, heavy in infrastructure, renewable power, and global real estate. Asset-light model — no balance sheet exposure to investments, only fee income. International diversification (40%+ AUM outside U.S.). Infra and renewable secular growth drivers more durable than pure PE/RE.',
      bear: 'Higher multiple (26x forward) than peers reflects asset-light premium — vulnerable to multiple compression if AUM growth slows. Infrastructure and renewables are highly capex-intensive at the asset level — fundraising must keep pace. Less U.S. diversification means FX and emerging-market policy risk.',
      anchor: 'At $60, paying 26x forward FRE — premium to peers reflects asset-light + infra/renewable secular tilt. Fair value $62-70 base case.',
      changeMyMind: 'Infra/renewable AUM growth slows below 12% / Major regulatory shift in renewable subsidies / FX exposure causes earnings volatility / Multiple compression to 22x.',
      catalysts: ['Renewable AUM milestones', 'Infrastructure fund closings', 'Insurance partnership build-out', 'BAM/BN spin-off final structure'],
      risks: ['Multiple compression', 'Renewable policy headwinds', 'FX volatility', 'Slower fundraising'],
      anchorReviewed: '2026-05-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-05-08',
    },
    returnRates: {
      bear: -0.07, base: 0.13, bull: 0.21,
      rationale: 'Bear: infra fundraising stalls, multiple compresses. Base: AUM grows 14%, fee margin holds, dividend grows 8-10%. Bull: renewable buildout accelerates, multiple holds at 28x.',
    },
    notes: 'Different flavor than APO/BX/KKR — infrastructure + renewables + international. Adds genuine diversification within Alt Managers bucket.',
  },

  // ═══════════════════════════════════════════════════════════════
  // QUALITY COMPOUNDERS — institutional staples (Other bucket)
  // ═══════════════════════════════════════════════════════════════
  'BRK.B': {
    name: 'Berkshire Hathaway · Class B',
    sector: 'Other',
    subsector: 'Diversified Holdco · Buffett Discipline',
    conviction: 86,
    signal: 'Accumulate',
    buyZone: { low: 380, fair: 450, high: 540 },
    fundamentals: { pe: 21, fwdPe: 19, fcfYield: 4.5, revGrowth: 8, marginOp: 14, roe: 12, netCashB: 325 },
    thesis: {
      bull: 'The most disciplined capital allocator in modern history. $325B+ cash hoard ready for any market dislocation — optionality value alone worth significant premium. Operating businesses (BNSF rail, GEICO insurance, energy utilities) generate $40B+ FCF annually. Stock buybacks at any level below intrinsic value. Apple position (~6% of book value) and growing equity portfolio. Buffett+Munger philosophy embedded in Greg Abel succession.',
      bear: 'Size is anchor — $1T market cap means ANY single investment is dilutive to portfolio returns. Cash drag at 5%+ rates is positive but limits upside. Insurance underwriting cycles can produce $10B+ swings. Buffett succession to Greg Abel is a 5-year proof requirement.',
      anchor: 'At $450, trading at ~1.5x P/B which has historically marked attractive entry. Operating earnings power $50/sh + investment income. Fair value $470-510 base case.',
      changeMyMind: 'Greg Abel deployment shows poor judgment in major opportunity / Insurance underwriting blows up / Tax law changes hurt Berkshire structure / Multi-year P/B compression below 1.4x.',
      catalysts: ['Annual letter (February)', 'Major capital deployments', 'Insurance underwriting results', 'Buyback acceleration'],
      risks: ['Size constraint', 'Succession proof', 'Insurance volatility', 'Tax law changes'],
      anchorReviewed: '2026-05-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-05-08',
    },
    returnRates: {
      bear: -0.03, base: 0.09, bull: 0.14,
      rationale: 'Bear: market crash, BRK falls less but no buyback acceleration. Base: 8-9% IRR matches long-term BRK average. Bull: market dislocation lets BRK deploy $100B+ at attractive prices.',
    },
    notes: 'Defensive anchor position and volatility dampener.',
  },

  V: {
    name: 'Visa',
    sector: 'Other',
    subsector: 'Payment Network Duopoly',
    conviction: 84,
    signal: 'Accumulate',
    buyZone: { low: 280, fair: 320, high: 380 },
    fundamentals: { pe: 28, fwdPe: 24, fcfYield: 4, revGrowth: 10, marginOp: 67, roe: 52, netCashB: 18 },
    thesis: {
      bull: 'Network duopoly with Mastercard — virtually impossible to replicate the merchant + issuer + cardholder network effect. 67%+ operating margins, 52% ROE — among the highest of any megacap. Cross-border travel recovery + digital payments secular growth + B2B payments expansion = 10%+ revenue growth runway. Asset-light, capex < 4% of revenue. Returns 95%+ of FCF via buybacks + dividends.',
      bear: 'Regulatory risk — interchange fee caps in EU and increasing scrutiny in U.S. (Durbin Amendment expansion). Stablecoin/CBDC threat over 5-10 years. China still closed market. Antitrust litigation overhang.',
      anchor: 'At $320, paying 24x forward EPS on 11% earnings growth + 5% buyback yield + 1% dividend = 17%+ owner earnings. Fair value $330-365 base case.',
      changeMyMind: 'Major interchange regulation passes / Stablecoin adoption accelerates faster than expected / Mastercard takes meaningful share / Cross-border travel pulls back.',
      catalysts: ['Cross-border volume growth', 'B2B payments penetration', 'Buyback authorizations', 'Acquired payments tech integrations'],
      risks: ['Interchange regulation', 'Stablecoin disruption', 'Antitrust', 'Travel slowdown'],
      anchorReviewed: '2026-05-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-05-08',
    },
    returnRates: {
      bear: -0.02, base: 0.12, bull: 0.18,
      rationale: 'Bear: regulation hits, multiple compresses to 20x. Base: 10% revenue, 11% EPS, 5% buyback = 17% IRR. Bull: B2B payments accelerate, multiple holds at 26x.',
    },
    notes: 'Quintessential quality compounder. Often cited as a "what would Buffett buy" name. Wide moat, high margins, low capital intensity.',
  },

  COST: {
    name: 'Costco Wholesale',
    sector: 'Other',
    subsector: 'Membership Retail · Defensive Growth',
    conviction: 78,
    signal: 'Hold',
    buyZone: { low: 750, fair: 880, high: 1050 },
    fundamentals: { pe: 52, fwdPe: 44, fcfYield: 2.5, revGrowth: 7, marginOp: 3.5, roe: 28 },
    thesis: {
      bull: 'Membership flywheel = 90%+ renewal rate, $5B+ membership fees fall directly to bottom line. Same-store-sales growth 6-8% even in recessions (last cut was 2009). Limited SKU strategy + direct sourcing = pricing power most retailers can\'t match. International expansion runway (Asia, Europe). Annual special dividend reflects extreme cash generation.',
      bear: 'Trades at 44x forward EPS — extremely rich for any retailer regardless of quality. Operating margin only 3.5% — leaves no buffer if input costs surge. Currency drag on international segment. Membership fee hike cycle is 5-6 years and is the primary multiple-supporting catalyst.',
      anchor: 'At $880, paying 44x forward EPS — premium 2x to retail sector. Fair value $850-950 base case but it rarely trades at fair value. Patience required for entry below $800.',
      changeMyMind: 'Same-store-sales drops below 4% / Membership renewals fall below 88% / International expansion stalls / Major operational miss in supply chain.',
      catalysts: ['Membership fee hikes', 'International store openings', 'Special dividend declarations', 'Same-store-sales monthly data'],
      risks: ['Multiple compression risk', 'Margin pressure', 'FX headwinds', 'Membership saturation'],
      anchorReviewed: '2026-05-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-05-08',
    },
    returnRates: {
      bear: -0.10, base: 0.07, bull: 0.13,
      rationale: 'Bear: multiple compresses to 32x as growth slows. Base: 7-8% earnings + 1% dividend yield. Bull: membership fee hike + international acceleration sustains multiple.',
    },
    notes: 'Outstanding business at a difficult valuation. Wait for pullbacks below $800. Defensive sleeve when added.',
  },

  MSFT: {
    name: 'Microsoft',
    sector: 'Consumer Tech',
    subsector: 'Enterprise Software + Azure + AI',
    conviction: 85,
    signal: 'Accumulate',
    buyZone: { low: 380, fair: 450, high: 520 },
    fundamentals: { pe: 35, fwdPe: 30, fcfYield: 3, revGrowth: 13, marginOp: 44, roe: 38, netCashB: 70 },
    thesis: {
      bull: 'Strongest enterprise software moat — Office, Azure, GitHub, Teams, Copilot, Defender all entrenched. Azure growing 28-30% on AI workload tailwind, gaining share vs AWS. Copilot monetization layer ($30/user/month) starting to scale across Office. 44%+ operating margins with $70B+ net cash. Returns 85%+ of FCF via buybacks + dividends. AI capex justified by $200B+ ARR run-rate from cloud.',
      bear: 'Trades at 30x forward EPS — premium even for quality. Massive AI capex ($80B+ annually) compresses near-term FCF. Azure growth deceleration would crush multiple. Antitrust attention growing globally. OpenAI partnership has unclear terms past 2030.',
      anchor: 'At $450, paying 30x forward EPS on 13-15% revenue growth + 80% FCF return = ~12% owner earnings. Fair value $460-500 base case.',
      changeMyMind: 'Azure growth drops below 25% / OpenAI partnership unwinds / Major antitrust action / AI capex doesn\'t produce ROI by 2027.',
      catalysts: ['Azure quarterly growth rates', 'Copilot adoption metrics', 'Activision integration', 'AI ROI evidence'],
      risks: ['Azure deceleration', 'AI capex burden', 'OpenAI uncertainty', 'Antitrust'],
      anchorReviewed: '2026-05-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-05-08',
    },
    returnRates: {
      bear: -0.05, base: 0.13, bull: 0.20,
      rationale: 'Bear: Azure decelerates, AI capex without ROI, multiple compresses. Base: 13% revenue, 30% Azure, Copilot scaling = 12-14% IRR. Bull: AI ROI proves out, multiple holds at 32x, FCF accelerates.',
    },
    notes: 'Cleaner large-cap tech exposure than NVDA. Already owned indirectly through GOOGL — but MSFT adds enterprise software depth.',
  },
};

// ═══════════════════════════════════════════════════════════════════
// HARDCAP — UNIVERSE EXPANSION (10 names)
// Energy, power & nuclear, alt managers, commodities and industrials.
// Merged into a saved universe on load when missing (migrateUniverse).
// Each memo follows Rowan-style discipline: quantitative bull/bear,
// FCF yield, valuation anchors, concrete change-my-mind triggers.
// ═══════════════════════════════════════════════════════════════════

window.UNIVERSE_EXPANSION = {

  // ─── ENERGY ──────────────────────────────────────────────────────
  CTRA: {
    name: 'Coterra Energy',
    sector: 'Energy',
    subsector: 'E&P · Dual-Basin',
    conviction: 75,
    signal: 'Accumulate',
    buyZone: { low: 22, fair: 30, high: 38 },
    returnRates: {
      bear: -0.12,
      base: 0.10,
      bull: 0.18,
      rationale: 'Bear: gas oversupply, $2.50 Henry Hub. Base: balanced commodity, 8% FCF yield. Bull: AI datacenter gas demand + Permian oil exposure compounds.',
    },
    fundamentals: {
      pe: 10, fwdPe: 9, peg: 1.3, fcfYield: 8.5,
      revGrowth: 8, marginOp: 30, roe: 18,
      netCashB: 1.5, debtEbitda: 0.6,
    },
    thesis: {
      bull: 'Dual-basin operator — Permian oil (50% of production) + Marcellus gas (50%) — gives natural hedge across commodities. Lowest-cost gas producer in the US at $1.50 cash cost. AI datacenter buildout structurally lifts US power demand 4-6% annually through 2030, 60% of new generation is gas-fired. Marcellus sits adjacent to PJM grid where datacenter demand is concentrated. 8.5% FCF yield, 60% of FCF returned via base + variable dividend + buybacks. Balance sheet pristine: $1.5B net cash, debt/EBITDA 0.6x.',
      bear: 'Smaller scale than majors means less optionality, less negotiating leverage on takeaway capacity. Gas-heavy mix underperforms when oil rallies disproportionately. Henry Hub at $2.50 makes the Marcellus economics marginal. Dual-basin focus splits management attention. Less liquid stock — trades thinner than EOG/COP, gets pulled around in sector flows.',
      changeMyMind: 'Henry Hub sustained sub-$2.25, OR AI datacenter gas demand thesis fails to materialize, OR Permian acreage productivity surprises negatively.',
      anchor: 'At $30, paying 9x forward earnings on $3.30 EPS. 8.5% FCF yield + 3% variable + 1% growth = 12.5% total return potential.',
      catalysts: ['Henry Hub gas pricing', 'Datacenter PPA announcements in PJM', 'Variable dividend', 'Permian inventory updates'],
      risks: ['Henry Hub gas pricing', 'Datacenter demand thesis', 'Smaller scale vs majors', 'Dual-basin execution'],
      anchorReviewed: '2026-05-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-05-08',
    },
    notes: 'Energy diversifier with AI/gas optionality. 2-3% position. Pairs with EOG (oil-pure) for balanced energy exposure.',
  },

  // ─── ADDED 2026-10-08 ─────────────────────────────────────────────
  // TotalEnergies: an example of a name added before it is underwritten.
  // Conviction 50 and the buy zone are mechanical placeholders, not a view,
  // and a placeholder zone never steers size. It is rated Accumulate but not
  // pinned, so the engine will not open a position until you pin it.
  TTE: {
    name: 'TotalEnergies SE (ADR)',
    sector: 'Energy',
    subsector: 'Integrated Major · LNG + Integrated Power',
    conviction: 50,
    signal: 'Accumulate',
    buyZone: { low: 69, fair: 81, high: 94, placeholder: true, reviewed: '2026-10-08' },
    fundamentals: {
      pe: null, fwdPe: 7.8, peg: null, fcfYield: null,
      revGrowth: null, marginOp: null, roe: null,
      netCashB: null, debtEbitda: null,
    },
    thesis: {
      bull: 'Not written yet. Added to the universe on 2026-10-08.',
      bear: 'Not written yet.',
      changeMyMind: 'Not written yet.',
      anchor: 'Snapshot 2026-10-07: $84.23, 52-week high $94.17, forward P/E 7.8x (5-yr average about 7.5x), dividend yield 4.7% (5-yr average about 5.4%). Sources disagree on the forward P/E (7.8x to 10.8x). The placeholder zone is mechanical: fair = price at the 5-yr average forward P/E, low and high = 15% either side.',
      catalysts: [],
      risks: [],
      anchorReviewed: '2026-10-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-10-08',
    },
    notes: 'Not underwritten yet: conviction 50 and the zone are neutral placeholders. Write the thesis, or run a Forensic IC and apply its proposal.',
  },

  // ─── POWER & NUCLEAR FOR AI (added 2026-10-08) ────────────────────
  // All four are on Watch: the engine buys none of them until you (or a
  // Forensic IC proposal you approve) set a conviction, a buy zone and
  // switch the signal to Accumulate. The text below is a factual snapshot,
  // not a thesis.
  CEG: {
    name: 'Constellation Energy',
    sector: 'Power & Nuclear',
    subsector: 'Nuclear Fleet Operator · Competitive Power',
    conviction: 50,
    signal: 'Watch',
    buyZone: { low: null, fair: null, high: null },
    fundamentals: { pe: null, fwdPe: 24.4, peg: null, fcfYield: null, revGrowth: null, marginOp: null, roe: null, netCashB: null, debtEbitda: null },
    thesis: {
      bull: 'Not written yet.',
      bear: 'Not written yet.',
      changeMyMind: 'Not written yet.',
      anchor: 'Snapshot 2026-10-07: $299.59, 52-week high $412.70 (27% below it), forward P/E 24.4x versus a 4-year average of about 24.3x (spun off in 2022, so no 5-year history), dividend yield 0.6%.',
      catalysts: [], risks: [],
      anchorReviewed: '2026-10-08', quarterlyReview: '', quarterlyReviewedAt: null, recentObservations: [], lastReviewed: '2026-10-08',
    },
    notes: 'WATCH. Candidate for the Power & Nuclear sector. Not underwritten.',
  },
  VST: {
    name: 'Vistra Corp.',
    sector: 'Power & Nuclear',
    subsector: 'Texas Power Producer + Retail · Gas, Nuclear, Batteries',
    conviction: 50,
    signal: 'Watch',
    buyZone: { low: null, fair: null, high: null },
    fundamentals: { pe: null, fwdPe: 16.2, peg: null, fcfYield: null, revGrowth: null, marginOp: null, roe: null, netCashB: null, debtEbitda: null },
    thesis: {
      bull: 'Not written yet.',
      bear: 'Not written yet.',
      changeMyMind: 'Not written yet.',
      anchor: 'Snapshot 2026-10-07: $166.72, 52-week high $217.10 (23% below it), forward P/E 16.2x versus a 5-year average of about 13.7x, dividend yield 0.6%.',
      catalysts: [], risks: [],
      anchorReviewed: '2026-10-08', quarterlyReview: '', quarterlyReviewedAt: null, recentObservations: [], lastReviewed: '2026-10-08',
    },
    notes: 'WATCH. Candidate for the Power & Nuclear sector. Not underwritten.',
  },
  CCJ: {
    name: 'Cameco Corporation',
    sector: 'Power & Nuclear',
    subsector: 'Uranium Producer · 49% of Westinghouse',
    conviction: 50,
    signal: 'Watch',
    buyZone: { low: null, fair: null, high: null },
    fundamentals: { pe: null, fwdPe: 61.9, peg: null, fcfYield: null, revGrowth: null, marginOp: null, roe: null, netCashB: null, debtEbitda: null },
    thesis: {
      bull: 'Not written yet.',
      bear: 'Not written yet.',
      changeMyMind: 'Not written yet.',
      anchor: 'Snapshot 2026-10-07: $89.07 (NYSE), 52-week high $135.24 (34% below it), forward P/E 61.9x versus a 4-year average of about 41.6x (sources range from 54x to 62x), dividend yield 0.2%.',
      catalysts: [], risks: [],
      anchorReviewed: '2026-10-08', quarterlyReview: '', quarterlyReviewedAt: null, recentObservations: [], lastReviewed: '2026-10-08',
    },
    notes: 'WATCH. Candidate for the Power & Nuclear sector. Not underwritten.',
  },
  GEV: {
    name: 'GE Vernova',
    sector: 'Power & Nuclear',
    subsector: 'Gas Turbines + Grid Equipment · SMR via GE Hitachi',
    conviction: 50,
    signal: 'Watch',
    buyZone: { low: null, fair: null, high: null },
    fundamentals: { pe: null, fwdPe: 47.7, peg: null, fcfYield: null, revGrowth: null, marginOp: null, roe: null, netCashB: null, debtEbitda: null },
    thesis: {
      bull: 'Not written yet.',
      bear: 'Not written yet.',
      changeMyMind: 'Not written yet.',
      anchor: 'Snapshot 2026-10-07: $997.09, 52-week high $1,195.94 (17% below it), forward P/E 47.7x (sources range from 41x to 48x). Listed in April 2024, so there is no 5-year average. Dividend yield 0.2%.',
      catalysts: [], risks: [],
      anchorReviewed: '2026-10-08', quarterlyReview: '', quarterlyReviewedAt: null, recentObservations: [], lastReviewed: '2026-10-08',
    },
    notes: 'WATCH. Candidate for the Power & Nuclear sector. Not underwritten.',
  },

  // ─── ALTERNATIVE ASSET MANAGERS ──────────────────────────────────
  ARES: {
    name: 'Ares Management',
    sector: 'Alt. Managers',
    subsector: 'Pure-Play Credit Specialist',
    conviction: 86,
    signal: 'Accumulate',
    buyZone: { low: 145, fair: 175, high: 215 },
    returnRates: {
      bear: 0.05,
      base: 0.18,
      bull: 0.28,
      rationale: 'Bear: rate cuts compress spreads. Base: credit AUM compounds 20%+. Bull: direct lending takes structural bank share, multiple expands.',
    },
    fundamentals: {
      pe: 30, fwdPe: 24, peg: 1.0, fcfYield: 3.2,
      revGrowth: 22, marginOp: 38, roe: 24,
      netCashB: 0, debtEbitda: 2.5,
    },
    thesis: {
      bull: 'Fastest-growing of the major alt managers — AUM compounding at 22% annually, focused almost entirely on private credit and direct lending. $440B AUM with the cleanest growth runway: regional bank retreat from middle-market lending creates a secular demand shift toward direct lenders. Floating-rate loan book benefits from "higher for longer" rate regime — net interest margins expand. FRE growing 25% annually with disciplined cost management. Insurance partnership through Aspida adds permanent capital at scale. Less complex than KKR/Blackstone — pure-play exposure to the strongest secular theme in alts (private credit).',
      bear: 'Concentrated exposure to credit means the next default cycle is asymmetric risk — if direct lending books mark down, the multiple compresses sharply. Rate cuts compress NIMs and reset earnings. Premium multiple (24x) leaves little margin for credit stress. Less diversified than peers — when credit is in favor, ARES outperforms; when it\'s out, ARES suffers.',
      changeMyMind: 'Direct lending default rates rising materially, OR rate cycle compresses NIMs faster than AUM compounds, OR private credit market structurally saturates.',
      anchor: 'At $175, paying 24x forward earnings on $7.30. Pure-play exposure to highest-growth alt category justifies the premium. Base case 22% AUM growth + 25% FRE growth = 18-20% total return potential.',
      catalysts: ['Quarterly AUM raises in direct lending', 'Aspida insurance ramp', 'Regional bank retreat data', 'Default rate trends'],
      risks: ['Credit cycle (primary)', 'Rate cycle compression', 'Premium multiple', 'Concentrated credit exposure'],
      anchorReviewed: '2026-05-08',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-05-08',
    },
    notes: 'Pure-play credit alt manager. Best growth in the category. 3% position alongside APO/KKR/BX for full alt diversification.',
  },

  // ─── COMMODITIES ─────────────────────────────────────────────────
  RIO: {
    name: 'Rio Tinto plc (ADR)',
    sector: 'Commodities',
    subsector: 'Diversified Miner · Iron Ore + Copper + Aluminium',
    conviction: 74,
    signal: 'Hold',
    buyZone: { low: 85, fair: 105, high: 125 },
    returnRates: {
      bear: -0.15,
      base: 0.08,
      bull: 0.18,
      rationale: 'Bear: iron ore to $70/t on weak China steel demand, dividend cut risk. Base: iron ore $90-100/t holds, ~6% dividend + low-single-digit volume growth. Bull: Oyu Tolgoi + Simandou copper/iron ramp re-rates the multiple, energy-transition copper demand inflects.',
    },
    fundamentals: {
      pe: 10, fwdPe: 10, peg: 2.0, fcfYield: 7.0,
      revGrowth: 3, marginOp: 32, roe: 20,
      netCashB: -5, debtEbitda: 0.6,
    },
    thesis: {
      bull: 'The highest-quality diversified major in mining. Iron ore from the Pilbara (world-leading scale, ~345-360Mtpa mid-term capacity) is the cash engine, throwing off a ~6% dividend yield at mid-cycle prices. Three genuine growth legs reduce the iron-ore monoculture: Oyu Tolgoi copper ramping (drove +9% YoY group copper-equivalent in Q1 2026), Simandou high-grade iron ore in Guinea, and the largest integrated aluminium business in the Western world. Low-cost position across the board, fortress balance sheet at ~0.6x EBITDA, and a tier-one lithium pipeline gives optional energy-transition upside. Resolution Copper (Arizona) and Rhodes Ridge are decade-long resource options most peers cannot match.',
      bear: 'Earnings are a leveraged bet on the iron-ore price and, through it, on Chinese steel demand and property — a structurally maturing driver. ~70%+ of EBITDA still comes from iron ore despite the copper story. Weather (Pilbara cyclones cut ~8Mt of Q1 2026 shipments) and operational/safety events (two 2026 fatalities) recur. Dividend is formula-linked to earnings, so it falls in a downcycle — it is not bond-like. Dual-listed structure and Australian/Guinea jurisdiction add complexity.',
      changeMyMind: 'Iron ore sustained below $75/t, OR a China hard-landing in steel demand, OR Simandou/Oyu Tolgoi ramp materially stalls, OR a dividend-policy cut.',
      anchor: 'At ~$100 the ADR trades ~10x earnings with a ~6% yield and ~7% FCF yield at iron ore ~$95/t. Base return is the yield plus low-single-digit volume growth (~8%). Bear case (iron ore $70/t) compresses earnings ~25% and the yield is cut — fair value falls toward ~$80. Bull case re-rates copper to a higher multiple toward ~$125.',
      catalysts: ['Simandou first production / ramp', 'Oyu Tolgoi copper ramp milestones', 'Iron ore price vs China stimulus', 'Half-year dividend declarations', 'Rhodes Ridge / Resolution approvals'],
      risks: ['Iron ore price (primary)', 'China steel/property demand', 'Pilbara weather disruption', 'Operational & safety events', 'Dividend cut in downcycle'],
      anchorReviewed: '2026-06-07',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-06-07',
    },
    notes: 'Highest-quality diversified miner. Iron ore is still ~70% of earnings, so size it as an iron-ore position and do not stack it with VALE.',
  },

  VALE: {
    name: 'Vale S.A. (ADR)',
    sector: 'Commodities',
    subsector: 'Iron Ore + Base Metals · Brazil',
    conviction: 60,
    signal: 'Hold',
    buyZone: { low: 11, fair: 14, high: 18 },
    returnRates: {
      bear: -0.20,
      base: 0.07,
      bull: 0.20,
      rationale: 'Bear: iron ore $70/t + BRL/political shock + renewed dam litigation outflows. Base: lowest-cost iron ore (~$21/t C1) defends an 8-10% capital-return yield at flat prices. Bull: copper-led Vale Base Metals ramp + a VBM partial IPO crystallizes a sum-of-the-parts re-rate.',
    },
    fundamentals: {
      pe: 6, fwdPe: 7, peg: 2.5, fcfYield: 9.0,
      revGrowth: 2, marginOp: 34, roe: 19,
      netCashB: -13.5, debtEbitda: 1.0,
    },
    thesis: {
      bull: 'The world\'s largest iron ore producer (~20% of the seaborne market) sitting at the very bottom of the cost curve — C1 cash cost ~$21/t means Vale stays profitable at prices that bankrupt marginal supply. Trades at a deep discount to RIO/BHP (~6x earnings, ~9% FCF yield) for the same core commodity. The real option is Vale Base Metals: record copper output (Salobo, Sossego) and nickel, guided toward 30-35% of group EBITDA by ~2035, with a potential partial IPO around mid-2026 that could surface hidden value. Conservative balance sheet, ongoing buybacks, and a high (if variable) capital-return yield.',
      bear: 'Even more concentrated in iron ore / China than RIO, with none of RIO\'s aluminium diversification. Carries a permanent Brazil discount: BRL volatility swings reported costs, and the Brumadinho/Mariana dam-disaster liabilities — though the Mariana definitive agreement reduced uncertainty — still face London/Amsterdam litigation that could mean incremental outflows. Political/regulatory interference risk is real. Dividend is variable and falls hard in a downcycle.',
      changeMyMind: 'Iron ore sustained below $75/t, OR a material adverse dam-litigation ruling, OR a Brazilian policy shock to the mining/tax regime, OR the VBM value-crystallization path is abandoned.',
      anchor: 'At ~$15 the ADR is ~6-7x earnings with a ~9% FCF yield at iron ore ~$95/t — cheap for the lowest-cost producer, with a free copper option. Base return is the capital-return yield (~8%). Bear case (iron ore $70/t + BRL weakness) takes fair value toward ~$11; bull case (VBM re-rate) toward ~$18+.',
      catalysts: ['Vale Base Metals partial IPO (~mid-2026)', 'Copper production records', 'Capanema / Vargem Grande ramp', 'Iron ore price vs China stimulus', 'Buyback execution'],
      risks: ['Iron ore price / China demand', 'BRL & Brazil political risk', 'Brumadinho/Mariana dam litigation', 'Variable dividend in downcycle', 'Concentration alongside RIO'],
      anchorReviewed: '2026-06-07',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-06-07',
    },
    notes: 'The same core exposure as RIO (iron ore) at a lower multiple, with a Brazil and dam-litigation discount. Hold one or the other at size, not both.',
  },

  // ─── INDUSTRIALS ─────────────────────────────────────────────────
  GE: {
    name: 'GE Aerospace',
    sector: 'Industrials',
    subsector: 'Aerospace · Jet Engines + Aftermarket',
    conviction: 70,
    signal: 'Hold',
    buyZone: { low: 250, fair: 300, high: 350 },
    returnRates: {
      bear: -0.12,
      base: 0.10,
      bull: 0.18,
      rationale: 'Bear: air-traffic shock (recession / prolonged Middle East conflict) defers shop visits and the ~40x multiple compresses. Base: mid-teens services growth compounds, multiple holds. Bull: 777X/GE9X entry into service, RISE program traction, and defense ramp add a second growth engine.',
    },
    fundamentals: {
      pe: 40, fwdPe: 34, peg: 2.6, fcfYield: 3.0,
      revGrowth: 12, marginOp: 20, roe: 30,
      netCashB: -2, debtEbitda: 1.0,
    },
    thesis: {
      bull: 'The best installed-base annuity in industrials. ~70% of revenue is high-margin aftermarket services — every engine sold creates a multi-decade tail of maintenance and spare-parts revenue that competitors cannot dislodge. The LEAP engine (via the CFM JV with Safran) is the dominant narrowbody powerplant on the 737 MAX and A320neo, with an installed base set to roughly triple 2024-2030 and shop visits already compounding mid-20s%. GEnx (787) and the GE9X (777X) extend the widebody franchise. Raised its 2026 profit outlook by ~$1B; Q1 2026 equipment revenue +20% with engine deliveries +50%. A $1B US manufacturing investment and a Palantir AI partnership accelerate a growing defense leg.',
      bear: 'Priced for perfection at ~40x earnings — a quality business, but the multiple leaves no margin for error. Heavily dependent on Boeing\'s production and certification cadence (sole engine supplier on 737 MAX and 777X); 777X entry-into-service has already slipped toward 2027. Air-traffic sensitivity is real: the 2026 Middle East conflict cut regional departures and trimmed full-year traffic guidance. The aerospace supply chain (castings, forgings) remains brittle.',
      changeMyMind: 'A sustained air-traffic downturn that breaks the services compounding story, OR a major Boeing/777X program failure, OR multiple compression from ~40x toward ~25x without a corresponding fundamentals break (which would actually make it a buy).',
      anchor: 'At ~$328 the stock is ~34x forward earnings with only a ~3% FCF yield — you are paying up for mid-teens earnings durability. Base return ~10% is earnings growth with a flat multiple. The buy zone ($250-300) is well below the current price; this is a hold, not an add, here.',
      catalysts: ['LEAP shop-visit volume growth', '777X / GE9X entry into service (~2027)', 'Defense engine awards (GEK1500 / CCA)', 'RISE open-fan milestones', 'Quarterly services margin trend'],
      risks: ['Premium valuation (~40x)', 'Boeing production/certification dependence', 'Air-traffic / macro shock', 'Aerospace supply-chain fragility'],
      anchorReviewed: '2026-06-07',
      quarterlyReview: '',
      quarterlyReviewedAt: null,
      recentObservations: [],
      lastReviewed: '2026-06-07',
    },
    notes: 'High-quality compounder, but rich at ~34x forward earnings and above the buy zone. Industrials has no target band, so the engine never adds new money here.',
  },

};
