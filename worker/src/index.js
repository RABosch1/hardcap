// Cloudflare Worker: a narrow proxy between the dashboard and EODHD.
//
// The browser never sees the market-data token. It lives here as a Worker
// secret and is added to each request on the way out. Only the four EODHD
// routes the dashboard uses are forwarded, with an allowlist of query
// parameters, so the worker cannot be used as an open relay for the token.
//
//   npx wrangler secret put EODHD_TOKEN
//   npx wrangler deploy
//
// Optional: set ALLOWED_ORIGIN to your page's origin (for example
// https://you.github.io) so other websites cannot call it from a browser.
// That is a browser-level guard, not authentication: a script can still
// call the worker directly, so keep an eye on your EODHD usage.

const EODHD = 'https://eodhd.com/api';

const ROUTES = [
  /^\/real-time\/[A-Z0-9.\-]+$/i,     // quotes; ?s=OTHER1.US,OTHER2.US for a batch
  /^\/fundamentals\/[A-Z0-9.\-]+$/i,  // fundamentals snapshot and 5-year history
  /^\/eod\/[A-Z0-9.\-]+$/i,           // daily prices (S&P 500 gauge fallback)
  /^\/calendar\/earnings$/,           // upcoming earnings dates
];
const PARAMS = new Set(['s', 'from', 'to', 'symbols', 'period', 'fmt']);

export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN || '*';
    const origin = request.headers.get('Origin');
    const cors = {
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return json({ error: 'GET only' }, 405, cors);
    if (allowed !== '*' && origin && origin !== allowed) return json({ error: 'Origin not allowed' }, 403, cors);

    const url = new URL(request.url);

    // The dashboard asks for earnings-call transcripts on /transcripts/...
    // This reference worker does not include them; a 503 tells the app so.
    if (url.pathname.startsWith('/transcripts/')) {
      return json({ error: 'Transcripts are not configured on this worker' }, 503, cors);
    }
    if (!ROUTES.some((r) => r.test(url.pathname))) return json({ error: 'Not found' }, 404, cors);
    if (!env.EODHD_TOKEN) return json({ error: 'EODHD_TOKEN secret is not set' }, 500, cors);

    const upstream = new URL(EODHD + url.pathname);
    for (const [k, v] of url.searchParams) if (PARAMS.has(k)) upstream.searchParams.set(k, v);
    if (!upstream.searchParams.has('fmt')) upstream.searchParams.set('fmt', 'json');
    upstream.searchParams.set('api_token', env.EODHD_TOKEN);

    let res;
    try {
      res = await fetch(upstream.toString());
    } catch (e) {
      return json({ error: 'Could not reach EODHD' }, 502, cors);
    }
    return new Response(await res.text(), {
      status: res.status,
      headers: { ...cors, 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  },
};

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}
