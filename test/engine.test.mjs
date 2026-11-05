import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHardcap, plain } from './helpers/load.mjs';

const TODAY = '2026-11-05';
const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

// Two core sectors with equal bands and one optional sector, so the expected
// targets are easy to work out by hand.
const SECTORS = {
  Alpha: { min: 40, max: 60, color: '#000', priority: 1 },
  Beta:  { min: 40, max: 60, color: '#000', priority: 1 },
  Other: { min: 0,  max: 10, color: '#000', priority: 5 },
};

const name = (sector, conviction, signal, zone, extra = {}) => ({
  name: sector + ' co', sector, conviction, signal,
  buyZone: zone ? { ...zone, reviewed: TODAY } : {},
  thesis: { bull: 'Written.', anchorReviewed: TODAY },
  ...extra,
});

// $25,000 invested in AAA and BBB, $75,000 cash, a schedule with three runs left.
// Book = $85,000, so the default 22% cap is $18,700 per name.
function setup(over = {}) {
  const F = loadHardcap();
  F.SECTOR_TARGETS = SECTORS;
  const state = {
    positions: [
      { tkr: 'AAA', shares: 50, price: 300, cost: 250, sector: 'Alpha' },
      { tkr: 'BBB', shares: 50, price: 200, cost: 220, sector: 'Beta' },
    ],
    cash: 75000,
    universe: {
      AAA: name('Alpha', 80, 'Strong Buy', { low: 250, fair: 300, high: 350 }),
      BBB: name('Beta', 70, 'Accumulate', { low: 180, fair: 210, high: 240 }),
    },
    rules: { finishBy: '2027-01' },
    market: null,
    history: [],
  };
  Object.assign(state, over);
  return { F, state };
}

test('budget: cash above the hold-back, released over the runs left', () => {
  const { F, state } = setup();
  const P = F.HardcapEngine.plan(state, { today: TODAY });
  assert.equal(P.total, 100000);
  assert.equal(P.holdPct, 15);
  assert.equal(P.hold, 15000);
  assert.equal(P.excess, 60000);
  assert.equal(P.runsLeft, 3);          // Nov, Dec, Jan
  close(P.budget, 20000);
  assert.equal(P.book, 85000);          // total capital less the hold-back
});

test('budget: falling markets lower the hold-back and release more per run', () => {
  const cases = [
    { dd: 12, hold: 10, share: 1 / 3 },  // correction
    { dd: 22, hold: 5, share: 0.5 },     // bear market
    { dd: 35, hold: 0, share: 0.5 },     // crash
  ];
  for (const c of cases) {
    const { F, state } = setup({ market: { ddPct: c.dd } });
    const P = F.HardcapEngine.plan(state, { today: TODAY });
    assert.equal(P.holdPct, c.hold, `hold-back at ${c.dd}% off the high`);
    close(P.budget, (75000 - 100000 * c.hold / 100) * c.share);
  }
});

test('a typed amount overrides the rule but never exceeds cash', () => {
  const { F, state } = setup();
  assert.equal(F.HardcapEngine.plan(state, { today: TODAY, amount: 2500 }).budget, 2500);
  assert.equal(F.HardcapEngine.plan(state, { today: TODAY, amount: 999999 }).budget, 75000);
});

test('the cap binds: money with no room left stays in cash', () => {
  const { F, state } = setup();
  const P = F.HardcapEngine.plan(state, { today: TODAY });
  // AAA has $3,700 of room under the cap and BBB $8,700; the $20,000 budget cannot all be placed
  const buy = (t) => (P.buys.find(r => r.tkr === t) || { buy: 0 }).buy;
  assert.ok(buy('AAA') <= 3700 && buy('AAA') >= 3699, `AAA ${buy('AAA')}`);
  assert.ok(buy('BBB') <= 8700 && buy('BBB') >= 8699, `BBB ${buy('BBB')}`);
  assert.ok(P.unplaced > 7500);
});

test('invariants: spend within budget, nothing past the cap, no order under the minimum', () => {
  for (const amount of [500, 3000, 12000, 40000]) {
    const { F, state } = setup();
    const P = F.HardcapEngine.plan(state, { today: TODAY, amount });
    assert.ok(P.spend <= P.budget + 1e-9, `spend ${P.spend} > budget ${P.budget}`);
    close(P.cashAfter, state.cash - P.spend);
    for (const r of P.buys) {
      assert.ok(r.buy >= P.rules.minOrder, `${r.tkr} buy ${r.buy} under the minimum`);
      assert.ok(r.cur + r.buy <= P.capDollar + 1, `${r.tkr} pushed past the cap`);
    }
  }
});

test('the plan is deterministic', () => {
  const { F, state } = setup();
  const a = plain(F.HardcapEngine.plan(state, { today: TODAY }).buys);
  const b = plain(F.HardcapEngine.plan(state, { today: TODAY }).buys);
  assert.deepEqual(a, b);
});

test('a name at the single-name cap gets nothing', () => {
  const { F, state } = setup({ rules: { finishBy: '2027-01', capPct: 15 } });
  // book is $85,000, so the cap is $12,750; AAA is $15,000
  const P = F.HardcapEngine.plan(state, { today: TODAY });
  const aaa = P.rows.find(r => r.tkr === 'AAA');
  assert.equal(aaa.status, 'cap');
  assert.equal(aaa.buy, 0);
  assert.deepEqual(plain(P.overCap.map(o => o.tkr)), ['AAA']);
});

test('orders under the minimum are dropped and their share goes elsewhere', () => {
  const { F, state } = setup({ rules: { finishBy: '2027-01', minOrder: 1500 } });
  const P = F.HardcapEngine.plan(state, { today: TODAY, amount: 2000 });
  for (const r of P.rows) {
    if (r.status === 'buy') assert.ok(r.buy >= 1500);
  }
  assert.ok(P.rows.some(r => r.status === 'small'), 'expected a dropped order');
});

test('a new position opens only in a pinned name, unless the rule says otherwise', () => {
  const zone = { low: 40, fair: 50, high: 60 };
  const manualPrice = { value: 45, at: TODAY };
  const unpinned = setup();
  unpinned.state.universe.CCC = name('Beta', 95, 'Strong Buy', zone, { manualPrice });
  let P = unpinned.F.HardcapEngine.plan(unpinned.state, { today: TODAY });
  let ccc = P.rows.find(r => r.tkr === 'CCC');
  assert.equal(ccc.status, 'bench');
  assert.equal(ccc.buy, 0);

  const pinned = setup();
  pinned.state.universe.CCC = name('Beta', 95, 'Strong Buy', zone, { manualPrice, pinned: true });
  P = pinned.F.HardcapEngine.plan(pinned.state, { today: TODAY });
  ccc = P.rows.find(r => r.tkr === 'CCC');
  assert.equal(ccc.slot, true);
  assert.ok(ccc.buy > 0, 'pinned name should be bought');

  const byConviction = setup({ rules: { finishBy: '2027-01', newNames: 'conviction' } });
  byConviction.state.universe.CCC = name('Beta', 95, 'Strong Buy', zone, { manualPrice });
  P = byConviction.F.HardcapEngine.plan(byConviction.state, { today: TODAY });
  assert.ok(P.rows.find(r => r.tkr === 'CCC').buy > 0);
});

test('Hold, Watch, Sell and never-buy names never receive money', () => {
  for (const [signal, extra, status] of [
    ['Hold', {}, 'hold'], ['Watch', {}, 'watch'], ['Sell', {}, 'sell'], ['Strong Buy', { noBuy: true }, 'nobuy'],
  ]) {
    const { F, state } = setup();
    state.universe.BBB = name('Beta', 70, signal, { low: 180, fair: 210, high: 240 }, extra);
    const bbb = F.HardcapEngine.plan(state, { today: TODAY }).rows.find(r => r.tkr === 'BBB');
    assert.equal(bbb.status, status);
    assert.equal(bbb.buy, 0);
  }
});

test('optional sectors (a 0% floor) receive no new money', () => {
  const { F, state } = setup();
  state.universe.OOO = name('Other', 99, 'Strong Buy', { low: 8, fair: 10, high: 12 }, { pinned: true, manualPrice: { value: 9, at: TODAY } });
  const ooo = F.HardcapEngine.plan(state, { today: TODAY }).rows.find(r => r.tkr === 'OOO');
  assert.equal(ooo.status, 'optional');
  assert.equal(ooo.buy, 0);
});

test('price tilt: a current buy zone scales size; a stale or placeholder zone does nothing', () => {
  const F = loadHardcap();
  const rules = F.HardcapRules.get({});
  const u = (zone) => ({ buyZone: zone, thesis: {} });
  const fresh = { low: 80, fair: 100, high: 120, reviewed: TODAY };
  const mult = (price, zone = fresh, r = rules) => F.HardcapEngine.zoneInfo(u(zone), price, r, TODAY).mult;
  assert.equal(mult(70), 1.5);   // below the zone low
  assert.equal(mult(90), 1);     // in the zone
  assert.equal(mult(110), 0.6);  // above fair value
  assert.equal(mult(130), 0.3);  // above the zone high
  assert.equal(mult(130, { ...fresh, reviewed: '2026-01-01' }), 1);   // stale: no steer
  assert.equal(mult(130, { ...fresh, placeholder: true }), 1);        // placeholder: no steer
  const strict = { ...rules, priceMode: 'strict' };
  assert.equal(mult(110, fresh, strict), 0);                            // strict: nothing above fair
  assert.equal(mult(90, fresh, strict), 1);
  assert.equal(mult(130, { ...fresh, reviewed: '2026-01-01' }, strict), 0);
  const broken = F.HardcapEngine.zoneInfo(u({ low: 120, fair: 100, high: 80 }), 100, rules, TODAY);
  assert.equal(broken.has, false);
});

test('strict mode leaves an expensive name in cash', () => {
  const { F, state } = setup({ rules: { finishBy: '2027-01', priceMode: 'strict' } });
  // AAA trades at 300, fair value 280: above fair
  state.universe.AAA.buyZone = { low: 250, fair: 280, high: 320, reviewed: TODAY };
  const aaa = F.HardcapEngine.plan(state, { today: TODAY }).rows.find(r => r.tkr === 'AAA');
  assert.equal(aaa.status, 'price');
  assert.equal(aaa.buy, 0);
});

test('slots are shared by sector target, at least one each', () => {
  const F = loadHardcap();
  const slots = (core, n) => plain(F.HardcapEngine.allocateSlots(core, n));
  assert.deepEqual(slots([{ name: 'A', targetPct: 50 }, { name: 'B', targetPct: 30 }, { name: 'C', targetPct: 20 }], 10), { A: 5, B: 3, C: 2 });
  assert.deepEqual(slots([{ name: 'A', targetPct: 95 }, { name: 'B', targetPct: 5 }], 3), { A: 2, B: 1 });
  const s = slots([{ name: 'A', targetPct: 40 }, { name: 'B', targetPct: 35 }, { name: 'C', targetPct: 20 }, { name: 'D', targetPct: 5 }], 15);
  assert.equal(Object.values(s).reduce((a, b) => a + b, 0), 15);
  assert.ok(Object.values(s).every(n => n >= 1));
});
