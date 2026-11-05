import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadHardcap, plain } from './helpers/load.mjs';

// The model can only propose changes. These tests cover what is parsed out of
// its reply and what is kept before anything is shown for approval.

test('action blocks are parsed out of a reply; malformed ones are skipped', () => {
  const F = loadHardcap();
  const text = [
    'Lowering conviction on the evidence above.',
    '```action\n{"type":"edit_ticker","params":{"tkr":"NVDA","updates":{"conviction":75}},"summary":"Lower NVDA to 75"}\n```',
    '```action\n{not json}\n```',
    'Done.',
  ].join('\n');
  const actions = F.HardcapChat.parseActions(text);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].type, 'edit_ticker');
  assert.equal(actions[0].params.updates.conviction, 75);
  assert.equal(F.HardcapChat.stripActionBlocks(text).includes('```'), false);
});

test('IC proposals: unsafe or invalid changes are dropped before review', () => {
  const F = loadHardcap();
  const state = F.HardcapState.init();
  state.universe.BTC.noBuy = true;
  const raw = [
    { type: 'update_quarterly_review', params: { tkr: 'XOM', review: 'Oct: FCF yield 9%.', newConviction: 85, newSignal: 'Accumulate', newBuyZone: { low: 140, fair: 165, high: 190 } }, summary: 'ok' },
    { type: 'update_quarterly_review', params: { tkr: 'NVDA', review: 'Cut it.', newSignal: 'Sell', newConviction: 150, newBuyZone: { low: 200, fair: 150, high: 300 } } },
    { type: 'update_quarterly_review', params: { tkr: 'BTC', review: 'Buy bitcoin.', newSignal: 'Strong Buy' } },
    { type: 'update_quarterly_review', params: { tkr: 'NOPE', review: 'Unknown ticker.' } },
    { type: 'remove_ticker', params: { tkr: 'XOM' } },
    { type: 'add_observation', params: { tkr: 'apo', note: '<script>alert(1)</script> Athene flows beat.' } },
  ];
  const kept = plain(F.HardcapIC.sanitizeActions(state, raw));
  assert.deepEqual(kept.map(a => a.params.tkr), ['XOM', 'NVDA', 'APO']);
  const nvda = kept[1].params;
  assert.equal(nvda.newSignal, undefined);      // a Sell signal is never proposed
  assert.equal(nvda.newConviction, undefined);  // out of range
  assert.equal(nvda.newBuyZone, undefined);     // low > fair
  assert.deepEqual(kept[0].params.newBuyZone, { low: 140, fair: 165, high: 190 });
  assert.ok(!/[<>]/.test(kept[2].params.note));
});

test('an approved proposal edits only what it names', () => {
  const F = loadHardcap();
  const state = F.HardcapState.init();
  const before = plain(state.universe.XOM);
  const r = F.HardcapChat.executeAction(state, { type: 'update_quarterly_review', params: { tkr: 'XOM', review: 'Oct review.', newConviction: 80 } });
  assert.equal(r.success, true);
  assert.equal(state.universe.XOM.conviction, 80);
  assert.equal(state.universe.XOM.thesis.quarterlyReview, 'Oct review.');
  assert.equal(state.universe.XOM.thesis.bull, before.thesis.bull);
  assert.equal(state.universe.XOM.signal, before.signal);
  assert.equal(F.HardcapChat.executeAction(state, { type: 'update_position', params: {} }).success, false);
});
