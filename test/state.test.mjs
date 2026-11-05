import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHardcap, plain, readFixture } from './helpers/load.mjs';

const csv = readFixture('fidelity-positions.csv');
const byTkr = (positions) => Object.fromEntries(plain(positions).map(p => [p.tkr, p]));

test('CSV: defaults to the Individual account when the file holds several', () => {
  const F = loadHardcap();
  const r = F.HardcapState.parseCSV(csv);
  assert.equal(r.error, null);
  assert.equal(r.accounts.length, 2);
  assert.deepEqual(plain(r.included), ['Z00000001']);
  const p = byTkr(r.positions);
  assert.deepEqual(Object.keys(p).sort(), ['NVDA', 'XOM']);
  assert.equal(p.NVDA.shares, 10);
  assert.equal(p.NVDA.price, 200);
  assert.equal(p.NVDA.cost, 150);
  assert.equal(p.XOM.glDol, -200);       // "-$200.00"
  assert.equal(p.XOM.todayPct, -0.9);    // "-0.90%"
});

test('CSV: money market is cash, and pending activity is folded into it', () => {
  const F = loadHardcap();
  const r = F.HardcapState.parseCSV(csv);
  assert.equal(r.coreCash, 5000);
  assert.equal(r.pendingActivity, -300);
  assert.equal(r.cash, 4700);
});

test('CSV: chosen accounts are merged, one row per ticker at a weighted cost', () => {
  const F = loadHardcap();
  const r = F.HardcapState.parseCSV(csv, { accounts: ['Z00000001', 'Z00000002'] });
  const p = byTkr(r.positions);
  assert.equal(p.NVDA.shares, 15);
  assert.equal(p.NVDA.cost, 160);         // (10 x 150 + 5 x 180) / 15
  assert.equal(p.BTC.shares, 0.01);       // "BTC/USD" becomes BTC
  assert.equal(p.BTC.sector, 'Crypto');
  assert.equal(r.cash, 5700);
});

test('CSV: reads the download date and ignores the disclaimer', () => {
  const F = loadHardcap();
  const r = F.HardcapState.parseCSV(csv);
  assert.equal(r.importDate, 'Oct-08-2026');
  assert.ok(!r.positions.some(p => /provided|brokerage/i.test(p.tkr)));
});

test('CSV: a file with no positions header is rejected', () => {
  const F = loadHardcap();
  const r = F.HardcapState.parseCSV('Name,Value\nfoo,1\n');
  assert.match(r.error, /header/i);
  assert.equal(r.positions.length, 0);
});

test('sample portfolio: $100,000 in total, priced at the research snapshot', () => {
  const F = loadHardcap();
  const S = F.SAMPLE_PORTFOLIO;
  const equity = S.positions.reduce((a, p) => a + p.shares * p.price, 0);
  assert.equal(Math.round((equity + S.cash) * 100) / 100, 100000);
  for (const p of S.positions) {
    assert.equal(p.price, F.RESEARCH_SNAPSHOT.data[p.tkr].price, `${p.tkr} price`);
    assert.ok(F.UNIVERSE_SEED[p.tkr] || F.UNIVERSE_EXPANSION[p.tkr], `${p.tkr} is in the universe`);
  }
});

test('sample portfolio: the demo plan buys only underwritten names in sectors below target', () => {
  const F = loadHardcap();
  // same order as the app: merge the expansion names, then seed the sample book
  const base = F.HardcapState.init();
  for (const t of Object.keys(F.UNIVERSE_EXPANSION)) if (!base.universe[t]) base.universe[t] = plain(F.UNIVERSE_EXPANSION[t]);
  const state = F.HardcapState.seedSample(base);
  assert.equal(state.seedSource, 'sample');
  const P = F.HardcapEngine.plan(state);
  assert.equal(Math.round(P.total), 100000);
  assert.ok(P.buys.length > 0);
  assert.ok(P.spend <= P.budget);
  const semis = P.coreSectors.find(s => s.name === 'Semiconductors');
  assert.ok(semis.curPct > semis.targetPct, 'semis start above target');
  assert.ok(!P.buys.some(b => b.sector === 'Semiconductors'), 'no new money for an over-target sector');
  for (const b of P.buys) {
    assert.ok(!/^not written yet/i.test(state.universe[b.tkr].thesis.bull), `${b.tkr} has a thesis`);
  }
});

test('the first real import leaves the demo cleanly', () => {
  const F = loadHardcap();
  const state = F.HardcapState.seedSample(F.HardcapState.init());
  state.deploymentLog.push({ ticker: 'BX', amount: 100 });
  assert.ok(state.universe.APO.buyZone.sampleReview);
  const parsed = F.HardcapState.parseCSV(csv);
  F.HardcapState.applyImport(state, parsed);
  assert.equal(state.seedSource, undefined);
  assert.equal(state.deploymentLog.length, 0);
  assert.equal(state.history.length, 1);                  // only the new snapshot
  assert.equal(state.universe.APO.buyZone.sampleReview, undefined);
  assert.equal(state.universe.APO.buyZone.reviewed, undefined);
  assert.deepEqual(plain(state.positions.map(p => p.tkr)).sort(), ['NVDA', 'XOM']);
  assert.equal(state.cash, 4700);
});

test('backup round-trip keeps positions, cash and universe edits', () => {
  const F = loadHardcap();
  const state = F.HardcapState.seedSample(F.HardcapState.init());
  state.universe.APO.conviction = 61;
  const json = JSON.stringify({ version: 'hardcap_v1', exportedAt: '2026-11-05T00:00:00Z', state });
  const r = F.HardcapState.importBackup(json);
  assert.equal(r.success, true);
  assert.equal(r.state.cash, state.cash);
  assert.equal(r.state.positions.length, state.positions.length);
  assert.equal(r.state.universe.APO.conviction, 61);
  assert.equal(F.HardcapState.importBackup('{"nope":1}').success, false);
});
