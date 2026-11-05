// ═══════════════════════════════════════════════════════════════════
// HARDCAP — CLAUDE API CLIENT
// One place that talks to the Messages API, for both the IC and the chat.
// Streams the reply so a long memo cannot time out, reads text blocks by
// type (newer models put thinking blocks first), and falls back to the
// previous model generation if a model name is not recognised.
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const API_URL = 'https://api.anthropic.com/v1/messages';
  const KEY_STORE = 'hardcap_api_key';

  // Prices are USD per million tokens (platform.claude.com/docs/en/about-claude/pricing, Oct 2026).
  const MODELS = {
    'claude-opus-5-5':   { label: 'Opus 5.5',   inRate: 4,    outRate: 20,  legacy: 'claude-opus-4-7' },
    'claude-sonnet-5-5': { label: 'Sonnet 5.5', inRate: 2,    outRate: 10,  legacy: 'claude-sonnet-4-6' },
    'claude-haiku-5-5':  { label: 'Haiku 5.5',  inRate: 0.10, outRate: 0.50, legacy: 'claude-haiku-4-5' },
    'claude-opus-4-7':   { label: 'Opus 4.7',   inRate: 5,    outRate: 25 },
    'claude-sonnet-4-6': { label: 'Sonnet 4.6', inRate: 3,    outRate: 15 },
    'claude-haiku-4-5':  { label: 'Haiku 4.5',  inRate: 1,    outRate: 5 },
  };

  function getKey() { try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; } }
  function label(model) { return (MODELS[model] && MODELS[model].label) || model; }

  function estimateCost(model, inputTokens, outputTokens) {
    const m = MODELS[model] || MODELS['claude-sonnet-5-5'];
    let inRate = m.inRate, outRate = m.outRate;
    if (model === 'claude-haiku-5-5' && inputTokens > 100000) { inRate = 0.50; outRate = 2.50; }
    return (inputTokens / 1e6) * inRate + (outputTokens / 1e6) * outRate;
  }
  // Rough size of a prompt before it is sent. About 3.3 characters per token for this kind of text.
  function estimateTokens(text) { return Math.ceil(String(text || '').length / 3.3); }

  function friendly(status, message) {
    const m = String(message || '');
    if (status === 401) return 'The API key was rejected. Check it in Import → Settings (it may have been deleted or mistyped).';
    if (status === 402 || /credit balance/i.test(m)) return 'Your API account has no credit. Add credits at platform.claude.com → Settings → Billing.';
    if (status === 403) return 'This API key is not allowed to use that model or workspace. ' + m;
    if (status === 429) return 'Rate limit reached. Wait a minute and run it again. If it keeps happening on a Forensic run, your API account may be on a tier too small for that much data: use Deep, which sends less. ' + m;
    if (status === 529 || /overloaded/i.test(m)) return 'The API is overloaded right now. Try again in a minute.';
    return m || ('API error ' + status);
  }

  async function post(body, key, signal) {
    return fetch(API_URL, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
  }

  // Reads a server-sent-event stream. Returns { text, usage, stopReason, model }.
  async function readStream(res, onText) {
    const out = { text: '', usage: { input_tokens: 0, output_tokens: 0 }, stopReason: null, model: null };
    const handle = (evt) => {
      if (!evt || !evt.type) return;
      if (evt.type === 'message_start' && evt.message) {
        out.model = evt.message.model || null;
        if (evt.message.usage) Object.assign(out.usage, evt.message.usage);
      } else if (evt.type === 'content_block_delta' && evt.delta) {
        if (evt.delta.type === 'text_delta' && evt.delta.text) {
          out.text += evt.delta.text;
          if (onText) { try { onText(out.text, evt.delta.text); } catch (e) { /* display only */ } }
        }
      } else if (evt.type === 'message_delta') {
        if (evt.usage) Object.assign(out.usage, evt.usage);
        if (evt.delta && evt.delta.stop_reason) out.stopReason = evt.delta.stop_reason;
      } else if (evt.type === 'error') {
        const e = new Error(friendly(0, evt.error && evt.error.message));
        e.partial = out.text;
        throw e;
      }
    };
    const parseChunk = (chunk) => {
      // one SSE event = lines up to a blank line; we only need the data: lines
      chunk.split(/\r?\n/).forEach(line => {
        if (line.indexOf('data:') !== 0) return;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') return;
        let evt = null;
        try { evt = JSON.parse(payload); } catch (e) { return; }
        handle(evt);
      });
    };
    if (res.body && res.body.getReader) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const r = await reader.read();
        if (r.done) break;
        buf += dec.decode(r.value, { stream: true });
        let idx;
        while ((idx = buf.search(/\r?\n\r?\n/)) >= 0) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx).replace(/^\r?\n\r?\n/, '');
          parseChunk(chunk);
        }
      }
      buf += dec.decode();
      if (buf.trim()) parseChunk(buf);
    } else {
      parseChunk(await res.text());
    }
    return out;
  }

  // opts: { model, system, messages, maxTokens, effort, onText, signal }
  async function call(opts) {
    const key = getKey();
    if (!key) throw new Error('No Anthropic API key set. Add one in Import → Settings.');
    let model = opts.model;
    let effort = opts.effort || null;
    const started = Date.now();
    for (let attempt = 0; attempt < 3; attempt++) {
      const body = {
        model,
        max_tokens: opts.maxTokens || 4096,
        system: opts.system,
        messages: opts.messages,
        stream: true,
      };
      if (effort) body.output_config = { effort };
      let res;
      try { res = await post(body, key, opts.signal); }
      catch (e) {
        if (e && e.name === 'AbortError') throw new Error('Cancelled.');
        throw new Error('Could not reach api.anthropic.com. Check your connection. (' + (e && e.message) + ')');
      }
      if (!res.ok) {
        const txt = await res.text();
        let msg = '';
        try { const j = JSON.parse(txt); msg = (j.error && j.error.message) || ''; } catch (e) { msg = txt.slice(0, 200); }
        // unknown model name → previous generation, once
        if ((res.status === 404 || (res.status === 400 && /model/i.test(msg))) && MODELS[model] && MODELS[model].legacy) {
          model = MODELS[model].legacy; continue;
        }
        // effort setting not accepted → retry without it, once
        if (res.status === 400 && effort && /output_config|effort/i.test(msg)) { effort = null; continue; }
        throw new Error(friendly(res.status, msg));
      }
      const out = await readStream(res, opts.onText);
      out.model = model;
      out.requestedModel = opts.model;
      out.elapsedMs = Date.now() - started;
      out.truncated = out.stopReason === 'max_tokens';
      out.cost = estimateCost(model, out.usage.input_tokens || 0, out.usage.output_tokens || 0);
      return out;
    }
    throw new Error('The API rejected the request after retries.');
  }

  window.HardcapClaude = { call, estimateCost, estimateTokens, label, MODELS, hasKey: () => !!getKey() };
})();
