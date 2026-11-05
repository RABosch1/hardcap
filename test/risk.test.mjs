import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHardcap, plain } from './helpers/load.mjs';

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);
const book = (positions, cash = 0) => ({ positions, cash, universe: {}, rules: {}, history: [] });
const pos = (tkr, value) => ({ tkr, shares: 1, price: value, cost: value });
const scenario = (F, id) => F.STRESS_SCENARIOS.find(s => s.id === id);

test('stress: impact is value x loading x shock, summed over factors', () => {
  const F = loadHardcap();
  const state = book([pos('NVDA', 10000)], 5000);
  // AI capex pause: NVDA loads 1.0 on the AI Capex Cycle factor, shocked -35%
  close(F.HardcapRisk.applyStress(state, scenario(F, 'ai-capex-pause')).totalImpact, -3500);
  // Taiwan stress: 0.6 x -40% (Taiwan) + 0.7 x -20% (US-China) = -38%
  const r = F.HardcapRisk.applyStress(state, scenario(F, 'taiwan-stress'));
  close(r.totalImpact, -3800);
  close(r.totalImpactPct, -38);          // of invested equity
  close(r.portfolioImpactPct, -3800 / 15000 * 100);
  close(r.portfolioAfter, 11200);
});

test('stress: a single name cannot lose more than 80% (95% for bitcoin)', () => {
  const F = loadHardcap();
  const extreme = { id: 'x', name: 'x', factors: { 'AI Capex Cycle': -5, 'Crypto Sentiment': -5 } };
  const r = F.HardcapRisk.applyStress(book([pos('NVDA', 1000), pos('BTC', 1000)]), extreme);
  const hit = Object.fromEntries(r.positionImpacts.map(p => [p.tkr, p.shockPct]));
  close(hit.NVDA, -0.8);
  close(hit.BTC, -0.95);
});

test('stress: a name with no factor loadings is untouched', () => {
  const F = loadHardcap();
  const r = F.HardcapRisk.applyStress(book([pos('ZZZZ', 5000)]), scenario(F, 'oil-crash'));
  assert.equal(r.totalImpact, 0);
});

test('scenarios come back worst first', () => {
  const F = loadHardcap();
  const all = F.HardcapRisk.runAllStressTests(book([pos('NVDA', 10000), pos('XOM', 10000), pos('APO', 5000)]));
  for (let i = 1; i < all.length; i++) assert.ok(all[i - 1].totalImpact <= all[i].totalImpact);
});

test('factor exposure is the loading-weighted dollar sum', () => {
  const F = loadHardcap();
  const exp = F.HardcapRisk.factorExposure(book([pos('NVDA', 10000), pos('TSM', 10000)]));
  const ai = exp.find(e => e.factor === 'AI Capex Cycle');
  close(ai.dollarExposure, 10000 * 1.0 + 10000 * 0.8);
  close(ai.pctOfPortfolio, 90);
});

test('required trims: a position over the cap is measured against the book', () => {
  const F = loadHardcap();
  // $50k invested, $50k cash, 15% hold-back: the book is $85k and a 22% cap is $18,700
  const state = book([pos('NVDA', 30000), pos('XOM', 20000)], 50000);
  const trims = F.HardcapRisk.requiredTrims(state).filter(t => t.type === 'position');
  assert.deepEqual(plain(trims.map(t => t.tkr)).sort(), ['NVDA', 'XOM']);
  close(trims.find(t => t.tkr === 'NVDA').trimDollar, 30000 - 18700);
  close(F.HardcapAnalytics.bookValue(state), 85000);
});
