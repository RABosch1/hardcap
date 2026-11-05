// ═══════════════════════════════════════════════════════════════════
// HARDCAP — SAMPLE PORTFOLIO
// A fictional $100,000 book for the public demo. None of these holdings,
// cost bases or cash balances belong to a real account. Prices are the
// closing prices in the research snapshot (src/data/research-snapshot.js),
// so the demo is internally consistent. A browser with no portfolio of
// its own starts here; the first real CSV import replaces it.
// ═══════════════════════════════════════════════════════════════════
window.SAMPLE_PORTFOLIO = {
  label: 'Sample portfolio',
  asOf: '2026-10-07',
  cash: 35218.65,
  positions: [
    { tkr: 'NVDA', shares: 55, price: 237.47, cost: 168.40 },
    { tkr: 'TSM',  shares: 20, price: 472.20, cost: 301.25 },
    { tkr: 'AMZN', shares: 35, price: 259.92, cost: 214.80 },
    { tkr: 'XOM',  shares: 55, price: 164.05, cost: 118.60 },
    { tkr: 'CVX',  shares: 25, price: 205.15, cost: 158.90 },
    { tkr: 'COP',  shares: 30, price: 129.84, cost: 112.35 },
    { tkr: 'APO',  shares: 60, price: 115.55, cost: 138.20 },
    { tkr: 'BX',   shares: 40, price: 111.83, cost: 129.75 },
    { tkr: 'RIO',  shares: 40, price: 93.16,  cost: 101.40 },
  ],
};
