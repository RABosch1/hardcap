# Live data feed

The dashboard works without a data feed: the demo runs on the research snapshot in `src/data/research-snapshot.js`. To pull live quotes and fundamentals, deploy the worker in `worker/` and paste its URL into **Import → Settings → Cloudflare Worker URL**.

## Why a worker

EODHD, the market-data provider, needs an API token on every request. Anything in a web page can be read by anyone who opens it, so the token cannot live in the page. It lives in a Cloudflare Worker as a secret. The page calls the worker, and the worker adds the token and forwards the request.

The worker only forwards the four EODHD routes the dashboard uses, with an allowlist of query parameters, so it cannot be used to spend the token on anything else.

## Deploy it

1. Create an EODHD account and copy your API token.
2. From the `worker/` folder:

   ```bash
   npx wrangler login
   npx wrangler secret put EODHD_TOKEN     # paste the token when asked
   npx wrangler deploy
   ```

3. Copy the URL Wrangler prints (`https://hardcap-data-proxy.<your-subdomain>.workers.dev`), paste it into Import → Settings, click **Save**, then **Test**. A working feed returns a live AAPL quote.
4. Optional: set `ALLOWED_ORIGIN` in `wrangler.toml` to your page's origin (for example `https://you.github.io`) so other websites cannot call the worker from a browser. This is a browser-level guard, not authentication; a script can still call the worker directly, so keep an eye on your EODHD usage.

## What the dashboard requests

All requests are `GET`. Responses are EODHD's JSON, passed through unchanged.

| Route | Used for |
|---|---|
| `/real-time/{SYMBOL}.US?s=A.US,B.US` | Quotes, in batches of eight |
| `/fundamentals/{SYMBOL}.US` | Valuation snapshot, five years of financials, estimates, analyst targets, dividends |
| `/calendar/earnings?from=&to=&symbols=` | Next earnings dates |
| `/eod/SPY.US?from=&period=d` | S&P 500 52-week high, when the fundamentals response lacks it |

Symbols use EODHD's convention: `BRK.B` is requested as `BRK-B.US`.

## Earnings-call transcripts (optional)

The Forensic IC tier can also read the last four earnings calls for each name. It requests:

| Route | Expected response |
|---|---|
| `/transcripts/{TICKER}` | JSON array of `{ year, quarter }` |
| `/transcripts/{TICKER}/{year}/{quarter}` | `{ transcript, summary, guidance, risk_factors, sentiment, date, participants }`, with `sentiment` between -1 and 1 |

The reference worker answers `503` on these routes. The dashboard reports that transcripts are unavailable and runs the IC without them. To enable them, add a transcript provider to the worker that returns the shapes above.

## The Anthropic API key

The Investment Committee and Ask Claude call `api.anthropic.com` directly from the browser with your own key, entered in Import → Settings. The key is stored in that browser's `localStorage` and sent only to Anthropic. Use it on your own device, not a shared one.
