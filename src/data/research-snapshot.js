// ═══════════════════════════════════════════════════════════════════
// RESEARCH SNAPSHOT — a dated fallback, not a live feed.
// Used only when the live feed has nothing newer: prices for names you
// do not hold (for 14 days), and valuation context on the scorecard.
// The 5-year averages are simple means of five year-end forward P/Es
// and year-end dividend yields. Treat them as approximate.
// ═══════════════════════════════════════════════════════════════════
window.RESEARCH_SNAPSHOT = {
  asOf: '2026-10-07',
  gathered: '2026-10-08',
  source: 'StockAnalysis, GuruFocus and Yahoo Finance pages read on Oct 8, 2026',
  spx: { close: 7801.77, hi52: 7844.52 },
  data: {
    AMZN: { price: 259.92, hi52: 287.20,  fwdPe: 27.64, pe5: 39.59, yld: 0,    yld5: null },
    APO:  { price: 115.55, hi52: 153.29,  fwdPe: 11.88, pe5: 14.69, yld: 1.95, yld5: null },
    BX:   { price: 111.83, hi52: 166.39,  fwdPe: 17.67, pe5: 23.56, yld: 4.25, yld5: null },
    COP:  { price: 129.84, hi52: 141.62,  fwdPe: 11.86, pe5: 11.29, yld: 2.59, yld5: 2.26 },
    CVX:  { price: 205.15, hi52: 217.78,  fwdPe: 12.16, pe5: 13.45, yld: 3.47, yld5: 3.99 },
    NVDA: { price: 237.47, hi52: 243.37,  fwdPe: 19.63, pe5: 35.79, yld: 0.42, yld5: null, soft: true },
    TSM:  { price: 472.20, hi52: 487.47,  fwdPe: 20.29, pe5: 20.31, yld: 0.68, yld5: 1.35 },
    XOM:  { price: 164.05, hi52: 176.41,  fwdPe: 12.67, pe5: 12.28, yld: 2.51, yld5: 3.90 },
    TTE:  { price: 84.23,  hi52: 94.17,   fwdPe: 7.76,  pe5: 7.49,  yld: 4.73, yld5: 5.41, soft: true },
    RIO:  { price: 93.16,  hi52: 112.58,  fwdPe: 11.67, pe5: 9.38,  yld: 4.95, yld5: 7.46 },
    CEG:  { price: 299.59, hi52: 412.70,  fwdPe: 24.41, pe5: 24.30, yld: 0.56, yld5: null },
    VST:  { price: 166.72, hi52: 217.10,  fwdPe: 16.21, pe5: 13.74, yld: 0.56, yld5: null },
    CCJ:  { price: 89.07,  hi52: 135.24,  fwdPe: 61.93, pe5: 41.58, yld: 0.19, yld5: null, soft: true },
    GEV:  { price: 997.09, hi52: 1195.94, fwdPe: 47.68, pe5: null,  yld: 0.20, yld5: null, soft: true },
  },
  // soft: true = sources disagreed materially on the forward P/E.
};
