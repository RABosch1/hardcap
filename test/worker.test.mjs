import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/src/index.js';

// Runs the Cloudflare Worker handler with a stubbed upstream fetch.
async function call(path, env = { EODHD_TOKEN: 'secret' }, init = {}) {
  const seen = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (u) => {
    seen.push(new URL(String(u)));
    if (env.upstreamDown) throw new TypeError('network');
    return new Response('{"close":1}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const res = await worker.fetch(new Request('https://proxy.example' + path, init), env);
    return { res, seen };
  } finally {
    globalThis.fetch = original;
  }
}

test('worker: adds the secret token and forwards only allowed parameters', async () => {
  const { res, seen } = await call('/real-time/XOM.US?s=CVX.US&api_token=from-the-browser&other=1');
  assert.equal(res.status, 200);
  assert.equal(seen.length, 1);
  const u = seen[0];
  assert.equal(u.origin + u.pathname, 'https://eodhd.com/api/real-time/XOM.US');
  assert.equal(u.searchParams.get('api_token'), 'secret');
  assert.equal(u.searchParams.get('s'), 'CVX.US');
  assert.equal(u.searchParams.get('fmt'), 'json');
  assert.equal(u.searchParams.has('other'), false);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
});

test('worker: refuses routes the dashboard does not use', async () => {
  const { res, seen } = await call('/user?x=1');
  assert.equal(res.status, 404);
  assert.equal(seen.length, 0);
});

test('worker: transcripts are reported as not configured', async () => {
  const { res, seen } = await call('/transcripts/XOM');
  assert.equal(res.status, 503);
  assert.equal(seen.length, 0);
});

test('worker: a missing secret, a blocked origin and an unreachable upstream fail clearly', async () => {
  assert.equal((await call('/fundamentals/XOM.US', {})).res.status, 500);
  const locked = { EODHD_TOKEN: 'secret', ALLOWED_ORIGIN: 'https://me.github.io' };
  assert.equal((await call('/fundamentals/XOM.US', locked, { headers: { Origin: 'https://elsewhere.example' } })).res.status, 403);
  assert.equal((await call('/fundamentals/XOM.US', locked, { headers: { Origin: 'https://me.github.io' } })).res.status, 200);
  assert.equal((await call('/eod/SPY.US', { EODHD_TOKEN: 'secret', upstreamDown: true })).res.status, 502);
  assert.equal((await call('/calendar/earnings', undefined, { method: 'OPTIONS' })).res.status, 204);
});
