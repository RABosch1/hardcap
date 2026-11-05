// ═══════════════════════════════════════════════════════════════════
// HARDCAP — TRANSCRIPTS LAYER
// Earnings call transcripts via API Ninjas (proxied through the same
// Cloudflare Worker as EODHD). Cached aggressively in localStorage.
//
// The 4-quarter arc per ticker is what makes this Apollo-grade ammunition:
// management's tone shift, guidance evolution, and the questions analysts
// keep asking. Pre-extracted structured fields (summary, guidance,
// risk_factors, sentiment) compress the raw transcript into ~3-5k tokens
// of signal we feed to Forensic IC and surface on the memo tab.
// ═══════════════════════════════════════════════════════════════════

const STORAGE_KEY_TRANSCRIPTS = 'hardcap_transcripts_v1';
const TRANSCRIPT_CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const TRANSCRIPT_QUARTERS_TO_FETCH = 4; // last 4 quarters per ticker

// ─── CACHE STORAGE ─────────────────────────────────────────────────
function loadTranscriptCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TRANSCRIPTS);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('Transcript cache read failed; resetting.', e);
    return {};
  }
}

function saveTranscriptCache(cache) {
  try {
    localStorage.setItem(STORAGE_KEY_TRANSCRIPTS, JSON.stringify(cache));
  } catch (e) {
    // Quota exceeded — drop the oldest tickers and retry once
    console.warn('Transcript cache write failed; pruning.', e);
    const tickers = Object.keys(cache).sort((a, b) => {
      const at = cache[a]?.fetchedAt || 0;
      const bt = cache[b]?.fetchedAt || 0;
      return at - bt;
    });
    while (tickers.length > 5) {
      delete cache[tickers.shift()];
    }
    try { localStorage.setItem(STORAGE_KEY_TRANSCRIPTS, JSON.stringify(cache)); }
    catch (_) { /* give up silently */ }
  }
}

function isTranscriptCacheFresh(entry) {
  if (!entry || !entry.fetchedAt) return false;
  return (Date.now() - entry.fetchedAt) < TRANSCRIPT_CACHE_TTL_MS;
}

// ─── COMPRESSION ───────────────────────────────────────────────────
// Compress a raw transcript into tokens-efficient signal:
//   - summary, guidance, risk_factors (already pre-extracted by API Ninjas)
//   - sentiment score
//   - first 1500 chars of prepared remarks (where guidance gets locked in)
//   - Q&A risk extracts (analyst questions on margins, demand, capex, competition)
function compressTranscript(raw) {
  if (!raw) return null;

  // Pre-extracted structured fields — these are gold from API Ninjas
  const out = {
    year: raw.year || null,
    quarter: raw.quarter || null,
    date: raw.date || null,
    summary: (raw.summary || '').slice(0, 1200),
    guidance: (raw.guidance || '').slice(0, 800),
    risk_factors: (raw.risk_factors || '').slice(0, 800),
    sentiment: typeof raw.sentiment === 'number' ? Math.round(raw.sentiment * 100) / 100 : null,
    participants: Array.isArray(raw.participants) ? raw.participants.slice(0, 8) : [],
  };

  const fullText = raw.transcript || '';
  if (!fullText) return out;

  // Prepared remarks: first 1500 chars (management opens with the most important guidance)
  // Heuristic: text before the first "Question-and-Answer" or "Q&A" marker
  const qaMarkers = /(question[s]?\s*[-&]\s*and\s*[-&]\s*answer|q\s*&\s*a\s+session|operator.*first question)/i;
  const qaMatch = fullText.match(qaMarkers);
  const remarksEnd = qaMatch ? qaMatch.index : Math.min(fullText.length, 6000);
  out.prepared_remarks = fullText.slice(0, Math.min(remarksEnd, 1500)).trim();

  // Q&A risk extracts: scan for analyst questions on key risk topics, grab the next ~400 chars
  const riskKeywords = [
    /\b(margin|gross\s*margin|operating\s*margin)\b/i,
    /\b(demand|order|backlog|book(ing)?|pipeline)\b/i,
    /\b(capex|capital\s*expenditure|capacity|investment)\b/i,
    /\b(guid(ance|e)|outlook|forecast)\b/i,
    /\b(competit|competitor|market\s*share|pricing)\b/i,
    /\b(china|tariff|geopolit|export\s*control)\b/i,
  ];
  const labels = ['Margins', 'Demand', 'Capex', 'Guidance', 'Competition', 'China/Tariffs'];

  const qaSection = qaMatch ? fullText.slice(qaMatch.index) : '';
  const extracts = [];
  if (qaSection) {
    // Split into rough Q&A turns by looking for analyst-question patterns
    const turns = qaSection.split(/(?=\b[A-Z][a-z]+\s+[A-Z][a-z]+\s*[-:—]\s*[A-Z][a-zA-Z\s]+(?:Bank|Capital|Securities|Research|Partners|Markets|Group)\b)/);
    for (const turn of turns.slice(0, 30)) {
      if (turn.length < 80) continue;
      for (let i = 0; i < riskKeywords.length; i++) {
        if (riskKeywords[i].test(turn)) {
          // Already covered this topic? Skip duplicates.
          if (extracts.find(e => e.topic === labels[i])) break;
          extracts.push({
            topic: labels[i],
            excerpt: turn.slice(0, 600).trim().replace(/\s+/g, ' '),
          });
          break;
        }
      }
      if (extracts.length >= 5) break;
    }
  }
  out.qa_risk_extracts = extracts;

  return out;
}

// ─── FETCH HELPERS (via the Worker) ────────────────────────────────
async function fetchTranscriptList(tkr) {
  const base = window.HardcapLive?.getWorkerUrl();
  if (!base) throw new Error('No worker URL configured');
  const url = `${base}/transcripts/${encodeURIComponent(tkr.toUpperCase())}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.status === 503) throw new Error('Worker has no APININJAS_TOKEN — see docs/data-feed.md');
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`Transcript list HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    clearTimeout(t);
    if (err.name === 'AbortError') throw new Error('Transcript list timed out');
    throw err;
  }
}

async function fetchSingleTranscript(tkr, year, quarter) {
  const base = window.HardcapLive?.getWorkerUrl();
  if (!base) throw new Error('No worker URL configured');
  const url = `${base}/transcripts/${encodeURIComponent(tkr.toUpperCase())}/${year}/${quarter}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.status === 503) throw new Error('Worker has no APININJAS_TOKEN — see docs/data-feed.md');
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Transcript HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(t);
    if (err.name === 'AbortError') throw new Error('Transcript fetch timed out');
    throw err;
  }
}

// ─── HIGH-LEVEL: ENSURE FRESH DATA FOR A LIST OF TICKERS ───────────
// On a cache miss or stale entry, pulls list of available quarters + the
// last 4 transcripts. Returns { fetched, skipped, errors } for status reporting.
async function ensureTranscripts(tickers, options = {}) {
  const force = !!options.force;
  const cache = loadTranscriptCache();
  const result = { fetched: [], skipped: [], errors: [] };

  for (const tkrRaw of tickers) {
    const tkr = String(tkrRaw).toUpperCase();
    const existing = cache[tkr];

    // Fresh cache → skip unless forced
    if (!force && isTranscriptCacheFresh(existing) && existing.quarters?.length > 0) {
      result.skipped.push(tkr);
      continue;
    }

    try {
      // 1) Get list of available quarters
      const list = await fetchTranscriptList(tkr);
      if (!list || list.length === 0) {
        cache[tkr] = { fetchedAt: Date.now(), quarters: [], note: 'No transcripts available' };
        result.errors.push({ tkr, msg: 'No transcripts found' });
        continue;
      }

      // 2) Sort newest-first, take last N quarters
      const sorted = [...list].sort((a, b) => {
        const ay = parseInt(a.year, 10), by = parseInt(b.year, 10);
        const aq = parseInt(a.quarter, 10), bq = parseInt(b.quarter, 10);
        if (by !== ay) return by - ay;
        return bq - aq;
      }).slice(0, TRANSCRIPT_QUARTERS_TO_FETCH);

      // 3) Fetch each transcript
      const quarters = [];
      for (const item of sorted) {
        try {
          const raw = await fetchSingleTranscript(tkr, item.year, item.quarter);
          if (raw) {
            const compressed = compressTranscript({ ...raw, year: item.year, quarter: item.quarter });
            if (compressed) quarters.push(compressed);
          }
        } catch (e) {
          // Per-quarter failure — keep going for the rest
          console.warn(`Transcript ${tkr} ${item.year}Q${item.quarter} failed: ${e.message}`);
        }
      }

      cache[tkr] = { fetchedAt: Date.now(), quarters };
      result.fetched.push({ tkr, count: quarters.length });
    } catch (err) {
      result.errors.push({ tkr, msg: err.message });
    }
  }

  saveTranscriptCache(cache);
  return result;
}

// ─── READ HELPERS ──────────────────────────────────────────────────
function getTranscripts(tkr) {
  const cache = loadTranscriptCache();
  const e = cache[tkr.toUpperCase()];
  if (!e || !e.quarters || e.quarters.length === 0) return null;
  return {
    fetchedAt: e.fetchedAt,
    isFresh: isTranscriptCacheFresh(e),
    quarters: e.quarters,
  };
}

// Sentiment arc: array of {year, quarter, sentiment} ordered oldest → newest
function getSentimentArc(tkr) {
  const t = getTranscripts(tkr);
  if (!t) return null;
  return [...t.quarters]
    .filter(q => q.sentiment != null)
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.quarter - b.quarter)
    .map(q => ({ year: q.year, quarter: q.quarter, sentiment: q.sentiment, date: q.date }));
}

// Computes a tone delta for the prompt: did sentiment shift recently?
function computeToneDelta(quarters) {
  if (!quarters || quarters.length < 2) return null;
  const sorted = [...quarters].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.quarter - b.quarter
  );
  const recent = sorted.slice(-2);
  const older = sorted.slice(0, -2);
  const recentAvg = recent.reduce((s, q) => s + (q.sentiment ?? 0), 0) / recent.length;
  const olderAvg = older.length > 0
    ? older.reduce((s, q) => s + (q.sentiment ?? 0), 0) / older.length
    : recentAvg;
  const delta = recentAvg - olderAvg;
  let direction;
  if (Math.abs(delta) < 0.10) direction = 'stable';
  else if (delta > 0) direction = 'tone improving';
  else direction = 'tone softening';
  return { recentAvg: Math.round(recentAvg * 100) / 100, olderAvg: Math.round(olderAvg * 100) / 100, delta: Math.round(delta * 100) / 100, direction };
}

// ─── CLEAR ─────────────────────────────────────────────────────────
function clearTranscriptCache(tkr) {
  const cache = loadTranscriptCache();
  if (tkr) delete cache[tkr.toUpperCase()];
  else Object.keys(cache).forEach(k => delete cache[k]);
  saveTranscriptCache(cache);
}

// ─── PUBLIC API ────────────────────────────────────────────────────
window.HardcapTranscripts = {
  ensureTranscripts,
  getTranscripts,
  getSentimentArc,
  computeToneDelta,
  clearTranscriptCache,
  isTranscriptCacheFresh,
  // low-level (testing)
  fetchTranscriptList, fetchSingleTranscript, compressTranscript,
};
