// ═══════════════════════════════════════════════════════════════════
// HARDCAP — RENDERING LAYER
// All DOM updates flow through here.
// ═══════════════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);

// ─── FORMAT HELPERS ────────────────────────────────────────────────
const fmt = v => '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtK = v => Math.abs(v) >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' :
                  Math.abs(v) >= 10000 ? '$' + (v / 1000).toFixed(1) + 'k' :
                  fmt(v);
const fmtPct = (v, signed = true) => (v >= 0 && signed ? '+' : '') + v.toFixed(2) + '%';
const fmtSigned = v => (v >= 0 ? '+' : '−') + fmtK(Math.abs(v));
const colorClass = v => v > 0.01 ? 'gain' : v < -0.01 ? 'loss' : 'mute';
const cvClass = v => v >= 80 ? 'high' : v >= 65 ? 'mid' : 'low';
const slug = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ─── OVERVIEW PAGE ─────────────────────────────────────────────────
function renderOverview(state) {
  // Repurposed: this function now populates the Deploy cockpit (KPIs, cash hero,
  // last-run timestamp, verdict table). Overview as a separate page no longer exists.
  const A = window.HardcapAnalytics;
  const eq = A.totalEquity(state);
  const cash = state.cash || 0;
  const total = eq + cash;
  const gl = A.totalGainLoss(state);
  const glPct = A.totalGainLossPct(state);
  const today = A.todayPnL(state);
  const ic = A.icReadiness(state);

  // KPI strip
  setText('kpi-total', fmtK(total));
  const hasIntraday = state.positions.some(p => p.todayDol != null || p.todayPct != null);
  setHTML('kpi-total-sub', total <= 0 ? '—'
    : hasIntraday ? `<span class="${colorClass(today)}">${fmtSigned(today)} today</span>`
    : `Prices as of ${state.importDate || '—'}`);

  setText('kpi-equity', fmtK(eq));
  setText('kpi-equity-sub', eq > 0
    ? `${state.positions.length} position${state.positions.length === 1 ? '' : 's'} · ${(eq / total * 100).toFixed(0)}% deployed`
    : '—');

  const glEl = document.getElementById('kpi-gl');
  if (glEl) {
    glEl.textContent = (gl >= 0 ? '+' : '−') + fmtK(Math.abs(gl));
    glEl.className = 'kpi-value ' + colorClass(gl);
  }
  setHTML('kpi-gl-sub', `<span class="${colorClass(gl)}">${fmtPct(glPct)} since inception</span>`);

  setText('kpi-ic', ic + '/100');
  const icHint = ic >= 80 ? 'On target — execute deployment plan' :
                 ic >= 60 ? 'Two gaps to close — see Deploy tab' :
                            'Major gaps — energy & alts critical';
  setText('kpi-ic-sub', icHint);

  // Cockpit hero — exact cash amount with comma separators, full precision
  const cockpitCash = document.getElementById('cockpit-cash');
  if (cockpitCash) cockpitCash.textContent = '$' + Math.round(cash).toLocaleString();
  const cashSub = total > 0
    ? `${(cash / total * 100).toFixed(1)}% of capital${state.pendingActivity && Math.abs(state.pendingActivity) > 1 ? ` · includes ${fmtSigned(state.pendingActivity)} pending` : ''}`
    : 'No portfolio data — Import tab to begin';
  setText('cockpit-cash-sub', cashSub);

  // Last IC run timestamp
  const lastRun = (window.HardcapIC && window.HardcapIC.loadLog) ? window.HardcapIC.loadLog().slice(-1)[0] : null;
  if (lastRun) {
    const ago = relTimeShort(lastRun.runAt);
    setText('ic-last-run', `Last IC run: ${ago}`);
  } else {
    setText('ic-last-run', 'No IC runs yet');
  }

  // Holdings verdict table
  const verdicts = window.HardcapDeployment.verdict(state);
  const tbody = document.getElementById('verdict-tbody');
  if (tbody) {
    tbody.innerHTML = verdicts.length === 0
      ? `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--mute);">No positions yet — drop your CSV in the Import tab</td></tr>`
      : verdicts.map(p => {
          const verdictClass = 'verdict-' + slug(p.verdict);
          return `<tr>
            <td>
              <div class="tkr-cell">${p.tkr}</div>
              <div class="tkr-sub">${p.universeName} · ${p.sectorAssigned}</div>
            </td>
            <td><span class="cb-amount">${fmtK(p.value)}</span><div class="tkr-sub">${p.weight.toFixed(1)}%</div></td>
            <td class="${colorClass(p.glPct)} cb-amount">${fmtPct(p.glPct)}<div class="tkr-sub">${fmtSigned(p.gl)}</div></td>
            <td>${p.conviction != null ? `<div class="cv-bar"><div class="cv-track"><div class="cv-fill ${cvClass(p.conviction)}" style="width:${p.conviction}%"></div></div><div class="cv-num ${cvClass(p.conviction)}">${p.conviction}</div></div>` : '<span class="mute">—</span>'}</td>
            <td><span class="verdict ${verdictClass}">${p.verdict}</span></td>
            <td style="font-size:11px;color:var(--mute);max-width:280px;text-align:left;padding-left:12px;">${(p.rationale || []).slice(0, 1).join(' ')}</td>
          </tr>`;
        }).join('');
  }
  setText('verdict-count', verdicts.length === 0 ? '—' : `${verdicts.length} held`);
}

// Safe DOM helpers — won't throw if element doesn't exist (some have moved/been removed)
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setHTML(id, val) { const el = document.getElementById(id); if (el) el.innerHTML = val; }

function composeIcBrief(state) {
  const A = window.HardcapAnalytics;
  const eq = A.totalEquity(state);
  const sw = A.sectorWeights(state);
  const cashPct = (state.cash / (eq + state.cash) * 100) || 0;
  const verdicts = window.HardcapDeployment.verdict(state);

  if (state.positions.length === 0) {
    return 'No portfolio data loaded yet. <em>Drop your Fidelity CSV in the Import tab</em> to begin analysis.';
  }

  const energyPct = sw['Energy'] || 0;
  const altPct = sw['Alt. Managers'] || 0;
  const semiPct = sw['Semiconductors'] || 0;

  const aggressiveAdds = verdicts.filter(v => v.verdict === 'ADD AGGRESSIVELY' || v.verdict === 'ADD').map(v => v.tkr);
  const trims = verdicts.filter(v => v.verdict.includes('TRIM') || v.verdict === 'SELL').map(v => v.tkr);

  let parts = [];
  parts.push(`Portfolio is <strong>${(eq / (eq + state.cash) * 100).toFixed(0)}% deployed</strong> with <strong>${fmtK(state.cash)}</strong> in dry powder.`);

  if (energyPct < 15) {
    parts.push(`<em>Energy critically underweight at ${energyPct.toFixed(1)}%</em> against your 25–30% target — the largest gap in the book.`);
  } else if (energyPct < 25) {
    parts.push(`Energy at ${energyPct.toFixed(1)}% is approaching but below the 25% floor.`);
  }

  if (altPct < 5) {
    parts.push(`<em>Alternative managers at ${altPct.toFixed(1)}%</em> versus a 15–20% target — Apollo carries the highest IC score in your universe at 92.`);
  }

  if (semiPct > 35) {
    parts.push(`Semiconductors at ${semiPct.toFixed(1)}% materially overweight — hold what you have, pause additions until the relative weight falls.`);
  }

  if (aggressiveAdds.length > 0) {
    parts.push(`Active adds this cycle: <em>${aggressiveAdds.slice(0, 3).join(', ')}</em>.`);
  }

  if (cashPct > 40) {
    parts.push(`Cash at ${cashPct.toFixed(0)}% is heavy — deployment plan in the next tab puts roughly 60% of available capital to work without breaching sector caps.`);
  }

  return parts.join(' ');
}

function renderSectorMini(state) {
  const sw = window.HardcapAnalytics.sectorWeights(state);
  const items = [
    { s: 'Energy',         cur: sw['Energy'] || 0,         tgt: window.SECTOR_TARGETS['Energy'] },
    { s: 'Semiconductors', cur: sw['Semiconductors'] || 0, tgt: window.SECTOR_TARGETS['Semiconductors'] },
    { s: 'Alt. Managers',  cur: sw['Alt. Managers'] || 0,  tgt: window.SECTOR_TARGETS['Alt. Managers'] },
    { s: 'Consumer Tech',  cur: sw['Consumer Tech'] || 0,  tgt: window.SECTOR_TARGETS['Consumer Tech'] },
  ];
  const html = items.map(it => {
    const mid = (it.tgt.min + it.tgt.max) / 2;
    const under = it.cur < it.tgt.min;
    const over = it.cur > it.tgt.max;
    const targetPos = Math.min(mid * 2.5, 100);
    return `
      <div class="alloc-row">
        <div class="alloc-meta">
          <span class="alloc-name">${it.s}</span>
          <span class="alloc-pct ${under ? 'loss' : over ? 'warn' : ''}">${it.cur.toFixed(1)}% <span style="font-size:10px;color:var(--mute);">/ ${it.tgt.min}–${it.tgt.max}%</span></span>
        </div>
        <div class="alloc-track">
          <div class="alloc-fill" style="width:${Math.min(it.cur * 2.5, 100)}%; background:${it.tgt.color};"></div>
          <div class="alloc-target" style="left:${targetPos}%;"></div>
        </div>
      </div>`;
  }).join('');
  $('sector-mini').innerHTML = html;
}

// ─── DEPLOY PAGE ───────────────────────────────────────────────────
function renderDeploy(state) {
  // The plan card, the scorecard and the IC estimates are drawn by the app controller,
  // which knows whether you typed your own amount into "Deploy this run".
  if (window.HardcapApp && window.HardcapApp.renderPlanNow) window.HardcapApp.renderPlanNow();
}

function composeAllocRationale(a) {
  const parts = [];
  parts.push(`Conviction <strong>${a.conviction}/100</strong>`);
  parts.push(`zone status <strong>${a.zoneLabel}</strong>`);
  if (a.sectorTarget) {
    const cur = a.currentSectorWeight.toFixed(1);
    parts.push(`${a.sector} at ${cur}% vs ${a.sectorTarget.min}–${a.sectorTarget.max}% target`);
  }
  return parts.join(' · ');
}

// ─── SIMULATOR ─────────────────────────────────────────────────────
// Three-scenario projection (bear/base/bull) with live sliders.
// Return rates are per-ticker, set in the universe based on fundamentals.
function renderSimulator(state) {
  // Build ticker dropdown — all universe entries with returnRates defined
  const tickers = Object.keys(state.universe)
    .filter(t => state.universe[t].returnRates)
    .sort((a, b) => (state.universe[b].conviction || 0) - (state.universe[a].conviction || 0));

  if (tickers.length === 0) {
    $('sim-host').innerHTML = '<div class="mute" style="font-size:13px;">No tickers with return assumptions yet.</div>';
    return;
  }

  // Initial values - default to highest conviction (APO at 92)
  const sel = $('sim-ticker');
  const isFirstRender = !sel || sel.options.length === 0;
  const currentTkr = (sel && sel.value) || tickers[0];
  const amountInput = $('sim-amount');
  const yearsInput = $('sim-years');
  const initialAmount = (amountInput && parseFloat(amountInput.value)) || 1000;
  const initialYears = (yearsInput && parseInt(yearsInput.value)) || 10;

  if (isFirstRender) {
    $('sim-host').innerHTML = `
      <div class="card" style="margin-bottom:24px;">
        <div class="card-h">
          <div class="card-t">Investment Simulator</div>
          <span class="pill pill-accent">Bear · Base · Bull</span>
        </div>
        <div class="card-b">

          <!-- CONTROLS -->
          <div style="display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:24px;align-items:start;margin-bottom:32px;">

            <div>
              <label class="field-label">Ticker</label>
              <select class="input" id="sim-ticker">
                ${tickers.map(t => {
                  const u = state.universe[t];
                  return `<option value="${t}" ${t === currentTkr ? 'selected' : ''}>${t} · ${u.name || ''} · cv ${u.conviction || '—'}</option>`;
                }).join('')}
              </select>
              <div id="sim-rates" style="margin-top:14px;display:flex;gap:14px;font-size:12px;"></div>
            </div>

            <div>
              <label class="field-label">Invested per month · <span id="sim-amount-display" style="color:var(--ink);font-weight:600;">$${initialAmount.toLocaleString()}/mo</span></label>
              <input type="range" id="sim-amount" min="100" max="10000" step="100" value="${initialAmount}" style="width:100%;accent-color:var(--accent);">
              <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-3);margin-top:4px;">
                <span>$100/mo</span><span>$10,000/mo</span>
              </div>
              <input type="number" class="input mono" id="sim-amount-input" value="${initialAmount}" min="50" step="50" style="margin-top:10px;font-size:13px;">
            </div>

            <div>
              <label class="field-label">Time horizon · <span id="sim-years-display" style="color:var(--ink);font-weight:600;">${initialYears} years</span></label>
              <input type="range" id="sim-years" min="1" max="30" step="1" value="${initialYears}" style="width:100%;accent-color:var(--accent);">
              <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-3);margin-top:4px;">
                <span>1 yr</span><span>30 yrs</span>
              </div>
            </div>

          </div>

          <!-- THREE SCENARIO CARDS -->
          <div id="sim-cards" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:24px;"></div>

          <!-- TRAJECTORY CHART -->
          <div id="sim-chart-wrap" style="background:var(--bg-2);border-radius:var(--r-lg);padding:24px 28px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <div style="font-size:13px;font-weight:600;color:var(--ink);">Projection Over Time</div>
              <div style="display:flex;gap:18px;font-size:12px;">
                <span style="display:flex;align-items:center;gap:6px;color:var(--text-2);">
                  <span style="width:12px;height:2px;background:var(--loss);display:inline-block;"></span>Bear
                </span>
                <span style="display:flex;align-items:center;gap:6px;color:var(--text-2);">
                  <span style="width:12px;height:2px;background:var(--accent);display:inline-block;"></span>Base
                </span>
                <span style="display:flex;align-items:center;gap:6px;color:var(--text-2);">
                  <span style="width:12px;height:2px;background:var(--gain);display:inline-block;"></span>Bull
                </span>
              </div>
            </div>
            <div id="sim-chart"></div>
          </div>

          <!-- THESIS RATIONALE -->
          <div id="sim-rationale" style="margin-top:20px;padding:16px 20px;background:var(--accent-soft);border-radius:var(--r-md);border-left:3px solid var(--accent);font-size:13px;color:var(--text);line-height:1.65;"></div>

        </div>
      </div>
    `;

    // Wire sliders + dropdown — these only update the projection display, not the whole page
    document.getElementById('sim-ticker').addEventListener('change', () => updateSimDisplay(state));
    document.getElementById('sim-amount').addEventListener('input', () => {
      const v = parseFloat(document.getElementById('sim-amount').value);
      document.getElementById('sim-amount-input').value = v;
      updateSimDisplay(state);
    });
    document.getElementById('sim-amount-input').addEventListener('input', () => {
      const v = parseFloat(document.getElementById('sim-amount-input').value) || 0;
      const slider = document.getElementById('sim-amount');
      slider.value = Math.min(Math.max(v, slider.min), slider.max);
      updateSimDisplay(state);
    });
    document.getElementById('sim-years').addEventListener('input', () => updateSimDisplay(state));
  }

  updateSimDisplay(state);
}

// Update the simulator output (cards + chart + rationale) based on current control values.
// Called whenever a slider/dropdown changes — does NOT re-render the whole deploy page.
function updateSimDisplay(state) {
  const tkr = document.getElementById('sim-ticker').value;
  const monthly = parseFloat(document.getElementById('sim-amount').value) || 0;
  const years = parseInt(document.getElementById('sim-years').value) || 1;

  document.getElementById('sim-amount-display').textContent = '$' + monthly.toLocaleString() + '/mo';
  document.getElementById('sim-years-display').textContent = years + (years === 1 ? ' year' : ' years');

  const u = state.universe[tkr];
  if (!u || !u.returnRates) return;
  const rates = u.returnRates;

  // Show rate badges
  document.getElementById('sim-rates').innerHTML = `
    <span style="color:var(--loss);font-weight:600;">Bear ${(rates.bear*100).toFixed(0)}%/yr</span>
    <span style="color:var(--accent);font-weight:600;">Base ${(rates.base*100).toFixed(0)}%/yr</span>
    <span style="color:var(--gain);font-weight:600;">Bull ${(rates.bull*100).toFixed(0)}%/yr</span>
  `;

  // Future value of an annuity: monthly contributions compounded monthly.
  // FV = PMT × [((1+r/12)^(12*years) − 1) / (r/12)]
  // Edge case: when annual rate r = 0, FV = PMT × 12 × years.
  const totalContributed = monthly * 12 * years;
  const fvAnnuity = (annualRate) => {
    if (Math.abs(annualRate) < 1e-9) return monthly * 12 * years;
    const m = annualRate / 12;
    const n = 12 * years;
    return monthly * ((Math.pow(1 + m, n) - 1) / m);
  };

  const bear = fvAnnuity(rates.bear);
  const base = fvAnnuity(rates.base);
  const bull = fvAnnuity(rates.bull);

  // Three scenario cards
  document.getElementById('sim-cards').innerHTML = `
    ${simCard('Bear Case', bear, monthly, years, totalContributed, rates.bear, 'loss')}
    ${simCard('Base Case', base, monthly, years, totalContributed, rates.base, 'accent')}
    ${simCard('Bull Case', bull, monthly, years, totalContributed, rates.bull, 'gain')}
  `;

  // Chart
  document.getElementById('sim-chart').innerHTML = simChart(monthly, years, rates);

  // Rationale
  document.getElementById('sim-rationale').innerHTML = `<strong>${tkr} return assumptions:</strong> ${rates.rationale || 'No rationale on file.'}`;
}

function simCard(label, finalValue, monthly, years, totalContributed, rate, colorClass) {
  const totalReturn = totalContributed > 0 ? ((finalValue / totalContributed - 1) * 100) : 0;
  const multiple = totalContributed > 0 ? finalValue / totalContributed : 0;
  const growthOnly = finalValue - totalContributed;
  const colorVar = colorClass === 'loss' ? 'var(--loss)' : colorClass === 'gain' ? 'var(--gain)' : 'var(--accent)';
  const bgVar = colorClass === 'loss' ? 'var(--loss-soft)' : colorClass === 'gain' ? 'var(--gain-soft)' : 'var(--accent-soft)';
  return `
    <div style="background:var(--surface);border:1px solid var(--rule-2);border-top:3px solid ${colorVar};border-radius:var(--r-lg);padding:24px 26px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${colorVar};">${label}</div>
        <div style="font-size:11px;font-weight:600;color:var(--text-3);background:${bgVar};padding:3px 10px;border-radius:100px;">${(rate*100 >= 0 ? '+' : '')}${(rate*100).toFixed(0)}%/yr</div>
      </div>
      <div style="font-size:32px;font-weight:700;color:var(--ink);letter-spacing:-0.024em;line-height:1.05;font-variant-numeric:tabular-nums;">
        ${fmtK(finalValue)}
      </div>
      <div style="font-size:13px;color:var(--text-2);margin-top:8px;font-weight:500;">
        ${fmtK(monthly)}/mo for <span style="color:var(--ink);">${years}yr</span>
      </div>
      <div style="display:flex;gap:16px;margin-top:14px;padding-top:14px;border-top:1px solid var(--rule-2);">
        <div>
          <div style="font-size:10px;color:var(--text-3);font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">Contributed</div>
          <div style="font-size:14px;font-weight:600;color:var(--text-2);margin-top:3px;font-variant-numeric:tabular-nums;">${fmtK(totalContributed)}</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text-3);font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">Growth</div>
          <div style="font-size:14px;font-weight:600;color:${colorVar};margin-top:3px;font-variant-numeric:tabular-nums;">${(growthOnly >= 0 ? '+' : '−')}${fmtK(Math.abs(growthOnly))}</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--text-3);font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">Multiple</div>
          <div style="font-size:14px;font-weight:600;color:${colorVar};margin-top:3px;font-variant-numeric:tabular-nums;">${multiple.toFixed(2)}×</div>
        </div>
      </div>
    </div>
  `;
}

function simChart(monthly, years, rates) {
  const W = 800, H = 220, padL = 60, padR = 24, padT = 16, padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  // Future value of annuity at year y with annual rate r
  const fvAt = (annualRate, y) => {
    if (Math.abs(annualRate) < 1e-9) return monthly * 12 * y;
    const m = annualRate / 12;
    const n = 12 * y;
    return monthly * ((Math.pow(1 + m, n) - 1) / m);
  };

  // Build paths for each scenario, sampling each year
  const buildPath = (rate) => {
    const points = [];
    for (let y = 0; y <= years; y++) {
      points.push({ y, value: fvAt(rate, y) });
    }
    return points;
  };

  const bear = buildPath(rates.bear);
  const base = buildPath(rates.base);
  const bull = buildPath(rates.bull);

  // Y range
  const allValues = [...bear, ...base, ...bull].map(p => p.value);
  const maxV = Math.max(...allValues, monthly * 12);
  const minV = Math.min(...allValues, 0);
  const yMin = Math.max(0, minV * 0.85);
  const yMax = maxV * 1.05;

  const xStep = years > 0 ? chartW / years : 0;
  const xy = (p) => ({
    x: padL + p.y * xStep,
    y: padT + chartH * (1 - (p.value - yMin) / (yMax - yMin || 1)),
  });

  const pathFor = (points) => points.map((p, i) => {
    const c = xy(p);
    return (i === 0 ? 'M' : 'L') + c.x.toFixed(1) + ',' + c.y.toFixed(1);
  }).join(' ');

  // Y-axis grid (4 ticks)
  const yTicks = [0, 0.33, 0.66, 1].map(t => ({
    y: padT + chartH * t,
    val: yMax - (yMax - yMin) * t,
  }));

  // X-axis labels
  const xLabels = [];
  const labelCount = Math.min(years, 6);
  const xStepLabel = labelCount > 0 ? years / labelCount : years;
  for (let i = 0; i <= labelCount; i++) {
    const yr = Math.round(i * xStepLabel);
    if (yr <= years) xLabels.push(yr);
  }

  return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:240px;display:block;">
      <!-- Grid -->
      ${yTicks.map(t => `<line x1="${padL}" y1="${t.y.toFixed(1)}" x2="${W-padR}" y2="${t.y.toFixed(1)}" stroke="#e5e5e7" stroke-width="1"/>`).join('')}
      <!-- Y labels -->
      ${yTicks.map(t => `<text x="${padL - 10}" y="${(t.y + 4).toFixed(1)}" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="10" fill="#6e6e73" text-anchor="end" font-variant-numeric="tabular-nums">${fmtK(t.val)}</text>`).join('')}
      <!-- X labels -->
      ${xLabels.map(yr => {
        const x = padL + yr * xStep;
        return `<text x="${x.toFixed(1)}" y="${(H - 10).toFixed(1)}" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="10" fill="#6e6e73" text-anchor="middle">${yr}y</text>`;
      }).join('')}
      <!-- Bear path -->
      <path d="${pathFor(bear)}" fill="none" stroke="#cf222e" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <!-- Base path -->
      <path d="${pathFor(base)}" fill="none" stroke="#c2410c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      <!-- Bull path -->
      <path d="${pathFor(bull)}" fill="none" stroke="#1a7f37" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <!-- Endpoint dots -->
      ${[
        { p: bear[bear.length-1], c: '#cf222e' },
        { p: base[base.length-1], c: '#c2410c' },
        { p: bull[bull.length-1], c: '#1a7f37' },
      ].map(({p, c}) => {
        const xy_ = xy(p);
        return `<circle cx="${xy_.x.toFixed(1)}" cy="${xy_.y.toFixed(1)}" r="3.5" fill="${c}"/>`;
      }).join('')}
      <!-- Origin dot -->
      <circle cx="${padL}" cy="${(padT + chartH).toFixed(1)}" r="3.5" fill="#1d1d1f"/>
    </svg>
  `;
}

// ─── HOLDINGS PAGE ─────────────────────────────────────────────────
function renderHoldings(state) {
  const verdicts = window.HardcapDeployment.verdict(state);
  const heldTkrs = new Set(verdicts.map(v => v.tkr));

  const watchlistTickers = Object.keys(state.universe || {})
    .filter(t => !heldTkrs.has(t))
    .sort((a, b) => (state.universe[b].conviction || 0) - (state.universe[a].conviction || 0));

  // Build watchlist synthetic positions
  const watchlistEntries = watchlistTickers.map(tkr => {
    const u = state.universe[tkr];
    return {
      tkr,
      universeName: u.name || tkr,
      sectorAssigned: u.sector || 'Other',
      conviction: u.conviction,
      signal: u.signal,
      buyZone: u.buyZone,
      shares: 0, price: u.buyZone?.fair || null, cost: 0, value: 0, weight: 0, gl: 0, glPct: 0,
      verdict: 'WATCHLIST',
      rationale: [],
      zoneStatus: u.buyZone ? window.HardcapAnalytics.buyZoneStatus(u.buyZone.fair, u.buyZone) : null,
    };
  });

  if (verdicts.length === 0 && watchlistEntries.length === 0) {
    $('holdings-list').innerHTML = `<div class="empty">
      <div class="empty-title">No tickers in universe</div>
      <div class="empty-sub">Ask Claude in chat: "Add Apollo to my universe" — or drop your CSV in the Import tab.</div>
    </div>`;
    return;
  }

  // Determine which ticker is selected (preserve selection across re-renders)
  const allEntries = [...verdicts, ...watchlistEntries];
  const previousSelection = window._hardcapSelectedTicker;
  let selectedTkr = previousSelection && allEntries.find(e => e.tkr === previousSelection)
    ? previousSelection
    : (verdicts[0]?.tkr || watchlistEntries[0]?.tkr);
  window._hardcapSelectedTicker = selectedTkr;

  // Sidebar row builder
  const sidebarRow = (entry, isHeld) => {
    const isActive = entry.tkr === selectedTkr;
    const cv = entry.conviction;
    const cvColor = cv >= 80 ? 'var(--gain)' : cv >= 65 ? 'var(--accent)' : 'var(--warn)';
    const signal = entry.signal || '';
    const sigClass = signal ? 'pill-' + slug(signal) : 'pill-neutral';

    let rightStat = '';
    if (isHeld) {
      rightStat = `<span style="font-family:var(--mono);font-variant-numeric:tabular-nums;font-size:11px;color:var(--text-3);">${entry.weight.toFixed(0)}%</span>`;
    }

    return `
      <div class="sidebar-row ${isActive ? 'sidebar-row-active' : ''}"
           data-tkr="${entry.tkr}"
           onclick="window.HardcapApp.selectMemoTicker('${entry.tkr}')"
           style="
             padding:11px 14px;
             border-radius:8px;
             cursor:pointer;
             margin-bottom:2px;
             ${isActive ? 'background:var(--bg-2);' : ''}
             transition:background .12s ease;
           ">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
            <span style="font-family:var(--sans);font-weight:600;font-size:13px;color:var(--ink);letter-spacing:-0.005em;">${entry.tkr}</span>
            ${rightStat}
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            ${cv != null ? `<span style="font-family:var(--mono);font-variant-numeric:tabular-nums;font-size:11px;font-weight:600;color:${cvColor};min-width:20px;text-align:right;">${cv}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:5px;">
          ${signal ? `<span class="pill ${sigClass}" style="font-size:9px;padding:2px 7px;">${signal}</span>` : ''}
          <span style="font-size:11px;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${entry.sectorAssigned}</span>
        </div>
      </div>
    `;
  };

  // Build sidebar HTML
  let sidebarHtml = '';
  if (verdicts.length > 0) {
    sidebarHtml += `
      <div style="font-size:10px;font-weight:700;color:var(--text-3);letter-spacing:0.08em;text-transform:uppercase;padding:0 14px 8px;">
        Held · ${verdicts.length}
      </div>
      ${verdicts.map(p => sidebarRow(p, true)).join('')}
    `;
  }
  if (watchlistEntries.length > 0) {
    sidebarHtml += `
      <div style="font-size:10px;font-weight:700;color:var(--text-3);letter-spacing:0.08em;text-transform:uppercase;padding:18px 14px 8px;">
        Watchlist · ${watchlistEntries.length}
      </div>
      ${watchlistEntries.map(e => sidebarRow(e, false)).join('')}
    `;
  }

  // Selected memo content
  const selectedEntry = allEntries.find(e => e.tkr === selectedTkr);
  const isHeld = selectedEntry && heldTkrs.has(selectedEntry.tkr);
  const memoHtml = selectedEntry ? buildMemoCard(selectedEntry, state, isHeld) : '<div class="empty"><div class="empty-title">Select a ticker</div></div>';

  // Two-column layout: sidebar + memo panel
  $('holdings-list').innerHTML = `
    <div class="memo-layout" style="display:grid;grid-template-columns:280px 1fr;gap:20px;align-items:start;">

      <!-- SIDEBAR -->
      <div class="memo-sidebar" style="
        position:sticky;
        top:140px;
        background:var(--surface);
        border:1px solid var(--rule-2);
        border-radius:var(--r-lg);
        padding:14px 8px;
        max-height:calc(100vh - 160px);
        overflow-y:auto;
      ">
        ${sidebarHtml}
      </div>

      <!-- MEMO PANEL -->
      <div class="memo-panel" id="memo-panel">
        ${memoHtml}
      </div>

    </div>
  `;
}

// Build a single memo card - works for both held positions and watchlist names.
// `held` = true means show position data (shares, value, gain/loss); false means watchlist style.
function buildMemoCard(p, state, held) {
  const u = state.universe[p.tkr];
  const zone = u?.buyZone;
  const verdictClass = 'verdict-' + slug(p.verdict);

  // Single source of truth for current price: held position price, else live price from API,
  // else null (no marker, no zone status).
  const currentPrice = held ? p.price : (u?.livePrice ?? null);
  const liveZoneStatus = (currentPrice != null && zone)
    ? window.HardcapAnalytics.buyZoneStatus(currentPrice, zone)
    : null;
  const liveChangePct = u?.liveChangePct;

  let zoneBar = '';
  if (zone && zone.low != null && zone.fair != null && zone.high != null) {
    const lowPos = 0;
    const fairPos = zone.fair > zone.low ? ((zone.fair - zone.low) / (zone.high * 1.1 - zone.low) * 100) : 50;
    const highPos = ((zone.high - zone.low) / (zone.high * 1.1 - zone.low) * 100);
    const priceForMarker = currentPrice ?? zone.fair ?? 0;
    const pricePos = Math.max(0, Math.min(100, ((priceForMarker - zone.low) / (zone.high * 1.1 - zone.low) * 100)));
    const showMarker = currentPrice != null;
    const statusLabel = held ? (p.zoneStatus?.label || '') : (liveZoneStatus?.label || '');
    const changeStr = (!held && liveChangePct != null)
      ? ` <span style="color:${liveChangePct >= 0 ? 'var(--gain)' : 'var(--loss)'};font-weight:500;">(${liveChangePct >= 0 ? '+' : ''}${liveChangePct.toFixed(2)}% today)</span>`
      : '';
    const markerLabel = currentPrice != null
      ? `Current <strong style="color:var(--ink);font-family:var(--mono);">${fmt(currentPrice)}</strong>${changeStr} — ${statusLabel}`
      : `Buy zone reference · current price not loaded`;
    zoneBar = `
      <div class="memo-section">
        <div class="memo-label">Buy Zone Anchor</div>
        <div class="zone-bar">
          <div class="zone-fill-buy" style="left:${lowPos}%; width:${fairPos}%;"></div>
          <div class="zone-fill-fair" style="left:${fairPos}%; width:${highPos - fairPos}%;"></div>
          ${showMarker ? `<div class="zone-marker" style="left:${pricePos}%;"></div>` : ''}
        </div>
        <div class="zone-labels">
          <span>Low ${fmt(zone.low)}</span>
          <span>Fair ${fmt(zone.fair)}</span>
          <span>High ${fmt(zone.high)}</span>
        </div>
        <div style="font-size:11px;color:var(--text-3);margin-top:6px;">${markerLabel}</div>
      </div>
    `;
  }

  let memoBlocks = '';
  if (u?.thesis) {
    const t = u.thesis;

    // Compute staleness for each layer
    const today = new Date();
    const daysSince = (dateStr) => {
      if (!dateStr) return null;
      const then = new Date(dateStr);
      if (isNaN(then.getTime())) return null;
      return Math.floor((today - then) / 86400000);
    };
    const stalenessClass = (days, thresholdYellow, thresholdRed) => {
      if (days == null) return 'pill-neutral';
      if (days >= thresholdRed) return 'pill-loss';
      if (days >= thresholdYellow) return 'pill-warn';
      return 'pill-gain';
    };
    const stalenessLabel = (days) => {
      if (days == null) return 'never';
      if (days === 0) return 'today';
      if (days === 1) return 'yesterday';
      if (days < 30) return `${days}d ago`;
      if (days < 365) return `${Math.floor(days/30)}mo ago`;
      return `${Math.floor(days/365)}y ago`;
    };

    const anchorDays = daysSince(t.anchorReviewed || t.lastReviewed);
    const quarterlyDays = daysSince(t.quarterlyReviewedAt);

    const observations = (t.recentObservations || []).slice().reverse();
    const observationsHtml = observations.length > 0
      ? observations.map(o => `
          <div style="display:flex;gap:14px;padding:10px 0;border-bottom:1px solid var(--rule-soft);">
            <div style="font-size:11px;color:var(--text-3);font-family:var(--mono);min-width:80px;flex-shrink:0;padding-top:1px;">${o.date || '—'}</div>
            <div style="font-size:13px;color:var(--text);line-height:1.55;">${escapeHtml(o.note || '')}</div>
          </div>`).join('')
      : '<div style="font-size:12px;color:var(--text-3);font-style:italic;padding:8px 0;">No observations logged. Ask Claude to add one as news breaks.</div>';

    memoBlocks = `
      <div class="memo-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div class="memo-label" style="margin-bottom:0;">Anchor Thesis · Foundational</div>
          <span class="pill ${stalenessClass(anchorDays, 365, 730)}" style="font-size:10px;">Reviewed ${stalenessLabel(anchorDays)}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--gain);letter-spacing:0.04em;text-transform:uppercase;margin-bottom:6px;">Bull Case</div>
            <div class="memo-text" style="font-size:14px;">${t.bull || '—'}</div>
          </div>
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--loss);letter-spacing:0.04em;text-transform:uppercase;margin-bottom:6px;">Bear Case</div>
            <div class="memo-text" style="font-size:14px;">${t.bear || '—'}</div>
          </div>
        </div>
      </div>

      ${t.anchor ? `<div class="memo-section">
        <div class="memo-label">Valuation Anchor</div>
        <div class="memo-anchor">${t.anchor}</div>
      </div>` : ''}

      <div class="memo-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div class="memo-label" style="margin-bottom:0;">90-Day Review · Quarterly</div>
          <span class="pill ${stalenessClass(quarterlyDays, 90, 180)}" style="font-size:10px;">${quarterlyDays == null ? 'Not yet reviewed' : 'Updated ' + stalenessLabel(quarterlyDays)}</span>
        </div>
        ${t.quarterlyReview
          ? `<div class="memo-text" style="font-size:14px;background:var(--bg-2);padding:14px 18px;border-radius:var(--r-sm);border-left:2px solid var(--accent);">${t.quarterlyReview}</div>`
          : `<div style="font-size:12px;color:var(--text-3);font-style:italic;padding:14px 18px;background:var(--bg-2);border-radius:var(--r-sm);">No quarterly review yet. Ask Claude in the chat: "Update ${p.tkr} 90-day review" with the latest earnings/news context.</div>`
        }
      </div>

      <div class="memo-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div class="memo-label" style="margin-bottom:0;">Recent Observations · Live Notes</div>
          <span class="pill pill-neutral" style="font-size:10px;">${observations.length} ${observations.length === 1 ? 'note' : 'notes'}</span>
        </div>
        <div style="background:var(--bg-2);border-radius:var(--r-sm);padding:6px 18px;">
          ${observationsHtml}
        </div>
      </div>

      ${t.changeMyMind ? `<div class="memo-section">
        <div class="memo-label">What Would Change My Mind</div>
        <div class="memo-text">${t.changeMyMind}</div>
      </div>` : ''}
      ${t.catalysts?.length ? `<div class="memo-section">
        <div class="memo-label">Catalysts</div>
        <div class="memo-list">${t.catalysts.map(c => `<span class="pill pill-gain">${c}</span>`).join('')}</div>
      </div>` : ''}
      ${t.risks?.length ? `<div class="memo-section">
        <div class="memo-label">Risks</div>
        <div class="memo-list">${t.risks.map(r => `<span class="pill pill-loss">${r}</span>`).join('')}</div>
      </div>` : ''}
    `;
  } else {
    memoBlocks = `<div class="memo-section">
      <div class="memo-text" style="color:var(--mute);font-style:italic;">No thesis on file. Ask Claude in the chat to build one.</div>
    </div>`;
  }

  let fundamentals = '';
  if (u?.fundamentals) {
    const f = u.fundamentals;
    const cells = [
      ['Fwd P/E', f.fwdPe], ['FCF Yld', f.fcfYield != null ? f.fcfYield + '%' : null],
      ['Rev Gr', f.revGrowth != null ? f.revGrowth + '%' : null], ['Op Mgn', f.marginOp != null ? f.marginOp + '%' : null],
      ['ROE', f.roe != null ? f.roe + '%' : null], ['Net Cash', f.netCashB != null ? '$' + f.netCashB + 'B' : null],
      ['Debt/EBITDA', f.debtEbitda], ['PEG', f.peg],
    ].filter(c => c[1] != null);
    if (cells.length > 0) {
      fundamentals = `
        <div class="memo-section">
          <div class="memo-label">Fundamentals <span style="font-weight:500;letter-spacing:0;text-transform:none;color:var(--text-3);margin-left:6px;">${u.liveFundamentalsAt ? 'data feed, ' + new Date(u.liveFundamentalsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'typed in from memory in May 2026, not verified'}</span></div>
          <div class="stat-grid" style="grid-template-columns:repeat(${Math.min(4, cells.length)},1fr);">
            ${cells.map(c => `<div class="stat-cell"><div class="stat-label">${c[0]}</div><div class="stat-val">${c[1]}</div></div>`).join('')}
          </div>
        </div>`;
    }
  }

  // Position stat block - only shown for held positions
  const positionStats = held ? `
    <div class="g32">
      <div>
        <div class="stat-grid">
          <div class="stat-cell"><div class="stat-label">Position</div><div class="stat-val">${fmtK(p.value)}</div></div>
          <div class="stat-cell"><div class="stat-label">Weight</div><div class="stat-val">${p.weight.toFixed(1)}%</div></div>
          <div class="stat-cell"><div class="stat-label">G/L</div><div class="stat-val ${colorClass(p.gl)}">${fmtSigned(p.gl)}</div></div>
          <div class="stat-cell"><div class="stat-label">Return</div><div class="stat-val ${colorClass(p.glPct)}">${fmtPct(p.glPct)}</div></div>
        </div>
      </div>
      <div>${zoneBar}</div>
    </div>
  ` : `
    <div>${zoneBar}</div>
  `;

  // Status badges - different for held vs watchlist
  const statusBadges = held
    ? `<span class="verdict ${verdictClass}">${p.verdict}</span>
       ${u ? `<span class="pill pill-${slug(u.signal)}">${u.signal}</span>` : ''}
       ${p.conviction != null ? `<div class="cv-bar"><div class="cv-track"><div class="cv-fill ${cvClass(p.conviction)}" style="width:${p.conviction}%"></div></div><div class="cv-num ${cvClass(p.conviction)}">${p.conviction}</div></div>` : ''}`
    : `<span class="pill pill-accent" style="font-size:10px;">Watchlist</span>
       ${u?.signal ? `<span class="pill pill-${slug(u.signal)}">${u.signal}</span>` : ''}
       ${p.conviction != null ? `<div class="cv-bar"><div class="cv-track"><div class="cv-fill ${cvClass(p.conviction)}" style="width:${p.conviction}%"></div></div><div class="cv-num ${cvClass(p.conviction)}">${p.conviction}</div></div>` : ''}`;

  const rationaleBlock = (held && p.rationale?.length) ? `<div class="memo-section">
    <div class="memo-label">Verdict Rationale</div>
    <div class="memo-text" style="font-size:13px;">${p.rationale.join(' ')}</div>
  </div>` : '';

  // Plain-English company descriptions — one line that anyone can understand
  const COMPANY_DESCRIPTIONS = {
    NVDA: 'Designs the GPU chips that power virtually all AI training and inference. Sells to every major cloud provider.',
    TSM: 'The world\'s largest chip manufacturer — fabricates the silicon designed by Apple, NVIDIA, AMD, and others.',
    AMZN: 'Runs the largest cloud computing platform (AWS) and the dominant US e-commerce marketplace.',
    CVX: 'Integrated oil major — produces, refines, and sells oil and natural gas globally.',
    BTC: 'The original cryptocurrency. Digital store-of-value with fixed supply, used as a portfolio diversifier.',
    APO: 'One of the largest alternative asset managers. Runs private equity funds, private credit, and the Athene insurance platform.',
    XOM: 'Largest US-listed integrated oil company — exploration, production, refining, and chemicals worldwide.',
    GOOGL: 'Owns Google Search, YouTube, Android, Gmail, and Google Cloud. Earns most revenue from advertising.',
    PLTR: 'Builds data analytics software for governments and enterprises — used by US defense, intelligence, and Fortune 500.',
    EOG: 'A pure-play US oil producer focused on the Permian Basin. Known for the lowest drilling costs in the industry.',
    COP: 'Large diversified oil and gas producer with assets in the US, Norway, and Australia. Acquired Marathon Oil in 2024.',
    CTRA: 'US oil and gas producer with operations split between Permian (oil) and Marcellus (natural gas) basins.',
    KKR: 'Major alternative asset manager — runs private equity, infrastructure, real estate, and credit funds. Owns Global Atlantic insurance.',
    BX: 'The world\'s largest alternative asset manager. Largest landlord on earth via real estate funds; runs private equity and credit.',
    ARES: 'Specialist private credit and direct lending manager — fastest-growing of the major alt managers.',
    MSFT: 'Software giant — runs Office 365, Windows, Azure cloud, GitHub, and the Copilot AI platform. Major OpenAI partner.',
    'BRK.B': 'Warren Buffett\'s holding company — owns insurance (Geico), railroads (BNSF), energy, and a $300B+ stock portfolio.',
    V: 'Operates the largest payment network in the world — earns a small fee on every Visa-branded transaction globally.',
    COST: 'Membership-based warehouse retailer — members pay annual fees to access wholesale prices on bulk goods.',
    RIO: 'Major global mining company — produces iron ore, copper, aluminum, and lithium. Australian/UK dual-listed.',
    BAM: 'Brookfield Asset Management — alternative asset manager focused on real assets (real estate, infrastructure, renewables).',
    WMB: 'Williams Companies — operates the largest natural gas pipeline network in the US, including Transco.',
    TTE: 'TotalEnergies — French integrated oil and gas major. Large LNG business and a growing power-generation arm alongside oil, refining and chemicals.',
    CEG: 'Constellation Energy — operates the largest fleet of nuclear power plants in the US and sells electricity, including long-term contracts with data-center operators.',
    VST: 'Vistra — Texas-based power producer and retailer (TXU Energy). Owns natural gas, nuclear (Comanche Peak) and battery generation.',
    CCJ: 'Cameco — one of the world\'s largest uranium producers (Saskatchewan mines) and 49% owner of Westinghouse, which services and builds nuclear reactors.',
    GEV: 'GE Vernova — the energy business spun out of General Electric in 2024. Makes gas turbines, grid equipment and wind turbines; small modular reactors through GE Hitachi.',
    SPAXX: 'Fidelity Government Money Market Fund — used as cash. Yields ~5% from US Treasury bills.',
    VALE: 'Brazilian mining giant — the world\'s largest iron ore producer (~20% of seaborne supply), plus pellets, nickel and copper. Lowest-cost iron ore on earth; base-metals arm (VBM) is the growth story.',
    GE: 'GE Aerospace — the renamed core of General Electric, now a pure-play jet-engine maker. Builds LEAP (737 MAX / A320neo via CFM), GEnx (787) and GE9X (777X); ~70% of revenue is high-margin aftermarket services.',
  };

  const description = COMPANY_DESCRIPTIONS[p.tkr] || (u?.subsector ? u.subsector + ' company.' : 'Company description not yet documented.');
  // Orientation card price priority: held position → live API price → buy-zone fair (last resort).
  const orientCurrentPrice = held ? p.price : (u?.livePrice ?? null);
  const orientFallbackPrice = orientCurrentPrice == null ? (u?.buyZone?.fair ?? null) : null;
  const orientDisplayPrice = orientCurrentPrice ?? orientFallbackPrice;
  const isLivePrice = orientCurrentPrice != null;
  const priceLabel = isLivePrice ? 'Current price' : 'Buy zone fair value';
  // Today's change: from held position field, or from live universe data
  const todayChange = held
    ? p.todayPct
    : (u?.liveChangePct != null ? u.liveChangePct : null);
  const signalText = u?.signal || 'No signal';
  const signalCls = u?.signal ? 'pill-' + slug(u.signal) : 'pill-neutral';

  // Orientation header — what you see FIRST when clicking any ticker
  const orientationCard = `
    <div style="background:linear-gradient(135deg,var(--bg-2) 0%,var(--surface) 100%);border:1px solid var(--rule-2);border-radius:var(--r-lg);padding:18px 22px;margin-bottom:18px;">
      <div style="display:grid;grid-template-columns:1fr auto;gap:24px;align-items:start;">
        <div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
            <span style="font-size:24px;font-weight:700;color:var(--ink);letter-spacing:-0.022em;line-height:1;">${p.tkr}</span>
            <span style="font-size:14px;color:var(--text-2);font-weight:500;">${p.universeName}</span>
          </div>
          <div style="font-size:13px;color:var(--text-2);line-height:1.55;max-width:580px;">${description}</div>
        </div>
        <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
          ${orientDisplayPrice ? `
            <div>
              <div style="font-size:9px;font-weight:700;color:var(--text-3);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:3px;">${priceLabel}</div>
              <div style="font-family:var(--mono);font-variant-numeric:tabular-nums;font-size:22px;font-weight:700;color:var(--ink);letter-spacing:-0.018em;line-height:1;">${fmt(orientDisplayPrice)}</div>
              ${isLivePrice && todayChange != null ? `<div style="font-size:11px;font-variant-numeric:tabular-nums;color:${todayChange >= 0 ? 'var(--gain)' : 'var(--loss)'};margin-top:2px;font-weight:500;">${todayChange >= 0 ? '+' : ''}${todayChange.toFixed(2)}% today</div>` : ''}
            </div>
          ` : ''}
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="pill ${signalCls}" style="font-size:11px;font-weight:700;padding:5px 12px;letter-spacing:0.04em;">${signalText.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Entry quality: how good is buying right now?
  // Combines buy-zone status with conviction. Computed only when we have a live price.
  let entryStrip = '';
  if (orientCurrentPrice != null && u?.buyZone) {
    const status = window.HardcapAnalytics.buyZoneStatus(orientCurrentPrice, u.buyZone);
    const conv = u.conviction || 0;
    const zone = u.buyZone;
    let entryGrade, entryColor, entryReason;
    if (status.class === 'strong-buy') {
      entryGrade = conv >= 85 ? 'EXCELLENT' : 'STRONG';
      entryColor = 'var(--gain)';
      const upsideToFair = ((zone.fair - orientCurrentPrice) / orientCurrentPrice * 100).toFixed(1);
      entryReason = `${fmt(orientCurrentPrice)} is ${status.distance} below the low end of the zone — ${upsideToFair}% to fair value. Conviction ${conv}/100.`;
    } else if (status.class === 'buy') {
      entryGrade = conv >= 85 ? 'STRONG' : 'GOOD';
      entryColor = 'var(--gain)';
      const upsideToFair = ((zone.fair - orientCurrentPrice) / orientCurrentPrice * 100).toFixed(1);
      entryReason = `In the buy zone with ${upsideToFair}% to fair value. Conviction ${conv}/100. Standard accumulation pace works here.`;
    } else if (status.class === 'hold') {
      entryGrade = 'PATIENT';
      entryColor = 'var(--warn)';
      const downsideToFair = ((orientCurrentPrice - zone.fair) / zone.fair * 100).toFixed(1);
      entryReason = `Trading ${downsideToFair}% above fair value (${fmt(zone.fair)}). Wait for a pullback into the zone, or scale slowly if conviction is high.`;
    } else if (status.class === 'wait') {
      entryGrade = 'WAIT';
      entryColor = 'var(--loss)';
      const downsideToHigh = ((orientCurrentPrice - zone.high) / zone.high * 100).toFixed(1);
      entryReason = `${downsideToHigh}% above the high end of the zone. New capital here pays the multiple expansion you wanted to capture. Hold what you have, deploy elsewhere.`;
    } else {
      entryGrade = 'NO DATA';
      entryColor = 'var(--text-3)';
      entryReason = 'Buy zone not configured for this name.';
    }
    try {
      const zi = window.HardcapEngine.zoneInfo(u, orientCurrentPrice, window.HardcapRules.get(state), window.HardcapRules.todayISO());
      if (zi.has && !zi.fresh) entryReason += ` <span style="color:var(--warn);">This zone is not current (${zi.staleWhy}), so the deploy engine is not sizing on it.</span>`;
    } catch (e) { /* display only */ }
    entryStrip = `
      <div style="background:var(--surface);border:1px solid var(--rule-2);border-left:3px solid ${entryColor};border-radius:8px;padding:12px 16px;margin-bottom:18px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
          <span style="font-size:9px;font-weight:700;color:var(--text-3);letter-spacing:0.1em;text-transform:uppercase;">Entry Quality at ${fmt(orientCurrentPrice)}</span>
          <span style="font-size:11px;font-weight:700;color:${entryColor};letter-spacing:0.06em;">${entryGrade}</span>
        </div>
        <div style="font-size:13px;color:var(--text-2);line-height:1.5;">${entryReason}</div>
      </div>
    `;
  }

  // ─── MANAGEMENT PULSE ─────────────────────────────────────────────
  // 4-quarter earnings call arc, surfaced from API Ninjas via HardcapTranscripts.
  // Shows: sentiment sparkline, tone delta, latest call summary/guidance/risk,
  // and the Q&A risk extracts. Manual refresh button is always present.
  let managementPulseCard = '';
  if (window.HardcapTranscripts) {
    const T = window.HardcapTranscripts.getTranscripts(p.tkr);
    if (T && T.quarters && T.quarters.length > 0) {
      const arc = window.HardcapTranscripts.getSentimentArc(p.tkr) || [];
      const tone = window.HardcapTranscripts.computeToneDelta(T.quarters);
      const sortedQ = [...T.quarters].sort((a, b) =>
        a.year !== b.year ? b.year - a.year : b.quarter - a.quarter
      );
      const latestQ = sortedQ[0];
      const ageDays = Math.round((Date.now() - T.fetchedAt) / 86400000);
      const stale = !T.isFresh;

      // Tone delta color
      const toneColor = !tone || tone.direction === 'stable' ? 'var(--text-2)' :
                        tone.direction === 'tone improving' ? 'var(--gain)' : 'var(--loss)';

      // Sparkline SVG: maps sentiment range [-1, 1] onto a 100x28 box
      const sparkW = 140, sparkH = 32, sparkPadX = 4;
      let sparklineSvg = '';
      if (arc.length >= 2) {
        const xs = arc.map((_, i) => sparkPadX + (i * (sparkW - sparkPadX * 2)) / (arc.length - 1));
        const ys = arc.map(q => {
          // Sentiment in [-1, 1] → invert to SVG (top is min y)
          const norm = Math.max(-1, Math.min(1, q.sentiment));
          return sparkH - 4 - ((norm + 1) / 2) * (sparkH - 8);
        });
        const linePath = xs.map((x, i) => (i === 0 ? `M${x},${ys[i]}` : `L${x},${ys[i]}`)).join(' ');
        const dots = xs.map((x, i) => `<circle cx="${x}" cy="${ys[i]}" r="2.5" fill="${arc[i].sentiment >= 0 ? 'var(--gain)' : 'var(--loss)'}"/>`).join('');
        // Zero-line (neutral sentiment reference)
        const zeroY = sparkH - 4 - 0.5 * (sparkH - 8);
        sparklineSvg = `<svg width="${sparkW}" height="${sparkH}" viewBox="0 0 ${sparkW} ${sparkH}" style="display:block;">
          <line x1="${sparkPadX}" y1="${zeroY}" x2="${sparkW - sparkPadX}" y2="${zeroY}" stroke="var(--rule-2)" stroke-width="1" stroke-dasharray="2,2"/>
          <path d="${linePath}" stroke="var(--ink)" stroke-width="1.5" fill="none"/>
          ${dots}
        </svg>`;
      }

      // Period labels under sparkline
      const periodLabels = arc.map(q => `${String(q.year).slice(-2)}Q${q.quarter}`).join(' · ');

      // Q&A risk extract pills
      const qaPills = (latestQ?.qa_risk_extracts || []).map((ex, i) => {
        const safeExcerpt = (ex.excerpt || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        return `<span style="display:inline-block;font-size:10px;font-weight:600;color:var(--text-2);background:var(--bg-2);border:1px solid var(--rule);border-radius:10px;padding:3px 9px;margin:0 4px 4px 0;letter-spacing:0.02em;cursor:help;" title="${safeExcerpt}">${ex.topic}</span>`;
      }).join('');

      // Section helper for collapsed text fields
      const section = (label, text) => {
        if (!text || !text.trim()) return '';
        return `<details style="margin-top:10px;"><summary style="cursor:pointer;font-size:10px;font-weight:700;color:var(--text-3);letter-spacing:0.1em;text-transform:uppercase;list-style:none;outline:none;user-select:none;">▸ ${label}</summary><div style="font-size:13px;color:var(--text-2);line-height:1.55;margin-top:8px;padding-left:2px;">${text.replace(/</g, '&lt;')}</div></details>`;
      };

      managementPulseCard = `
        <div style="background:var(--surface);border:1px solid var(--rule-2);border-radius:var(--r-lg);padding:14px 18px;margin-bottom:18px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:10px;font-weight:700;color:var(--text-3);letter-spacing:0.1em;text-transform:uppercase;">Management Pulse</span>
              <span style="font-size:10px;color:var(--text-3);">${T.quarters.length} quarter${T.quarters.length === 1 ? '' : 's'} · pulled ${ageDays}d ago${stale ? ' · stale' : ''}</span>
            </div>
            <button class="btn ghost sm" onclick="window.HardcapApp.refreshTranscript('${p.tkr}')" style="font-size:11px;padding:4px 10px;">↻ Refresh</button>
          </div>
          <div style="display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:center;margin-bottom:8px;">
            <div>
              ${sparklineSvg}
              <div style="font-family:var(--mono);font-size:9px;color:var(--text-3);margin-top:2px;letter-spacing:0.04em;">${periodLabels}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;">
              ${tone ? `<div style="font-size:13px;color:${toneColor};font-weight:600;">${tone.direction.charAt(0).toUpperCase() + tone.direction.slice(1)}</div>
              <div style="font-size:11px;color:var(--text-3);">Recent ${tone.recentAvg >= 0 ? '+' : ''}${tone.recentAvg} vs prior ${tone.olderAvg >= 0 ? '+' : ''}${tone.olderAvg} (Δ ${tone.delta >= 0 ? '+' : ''}${tone.delta})</div>` : ''}
              ${latestQ ? `<div style="font-size:11px;color:var(--text-3);">Latest: ${latestQ.year}Q${latestQ.quarter}${latestQ.date ? ' · ' + latestQ.date : ''} · sentiment ${latestQ.sentiment >= 0 ? '+' : ''}${latestQ.sentiment}</div>` : ''}
            </div>
          </div>
          ${qaPills ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--rule);"><div style="font-size:9px;font-weight:700;color:var(--text-3);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">Analyst Q&amp;A Topics (latest call · hover for excerpt)</div>${qaPills}</div>` : ''}
          ${section('Summary', latestQ?.summary)}
          ${section('Guidance', latestQ?.guidance)}
          ${section('Risk Factors (Management-Acknowledged)', latestQ?.risk_factors)}
        </div>
      `;
    } else {
      // Empty state — show a button to fetch
      managementPulseCard = `
        <div style="background:var(--surface);border:1px dashed var(--rule-2);border-radius:var(--r-lg);padding:14px 18px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--text-3);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:3px;">Management Pulse</div>
            <div style="font-size:12px;color:var(--text-2);line-height:1.5;">No earnings call transcripts cached for this name. Pull the last 4 quarters to enable Apollo-grade variant perception in IC underwriting.</div>
          </div>
          <button class="btn ghost sm" onclick="window.HardcapApp.refreshTranscript('${p.tkr}')" style="font-size:11px;padding:5px 12px;">Pull transcripts</button>
        </div>
      `;
    }
  }

  return `
    <div class="memo">
      ${orientationCard}
      ${entryStrip}
      ${managementPulseCard}

      <div class="memo-header">
        <div>
          <div class="memo-tkr">${p.tkr}</div>
          <div class="memo-name">${p.universeName} · ${p.sectorAssigned}</div>
        </div>
        <div class="memo-meta">
          ${statusBadges}
        </div>
      </div>

      ${positionStats}

      ${rationaleBlock}

      ${memoBlocks}
      ${fundamentals}

      ${u?.notes ? `<div class="memo-section" style="border-top:1px solid var(--rule);padding-top:14px;margin-top:6px;">
        <div class="memo-label">Position Notes</div>
        <div class="memo-text" style="font-size:13px;">${u.notes}</div>
      </div>` : ''}

      <!-- Contextual Ask Claude action -->
      <div style="margin-top:18px;padding:14px 18px;background:var(--bg-2);border-radius:var(--r-md);display:flex;justify-content:space-between;align-items:center;gap:14px;">
        <div style="font-size:13px;color:var(--text-2);">
          <strong style="color:var(--ink);">Ask Claude about ${p.tkr}</strong> — refresh thesis, log news, update conviction
        </div>
        <button class="btn sm" onclick="window.HardcapApp.askAboutTicker('${p.tkr}')">Ask Claude →</button>
      </div>
    </div>
  `;
}

// ─── EXPOSURE PAGE ─────────────────────────────────────────────────
function renderExposure(state) {
  const A = window.HardcapAnalytics;
  const sw = A.sectorWeights(state);
  const eq = A.totalEquity(state);
  const enriched = A.enrichPositions(state);
  const gaps = A.sectorGaps(state);
  const capNow = A.capPct(state);
  const bookNow = A.bookValue(state);
  setText('cap-pill', capNow + '% cap');
  const bookNote = `<div style="font-size:12px;color:var(--text-3);margin-bottom:16px;">Measured against a book of ${fmtK(bookNow)}: total capital less the cash hold-back. While cash is still being deployed, the bars do not add up to 100%.</div>`;

  // Sector bars
  $('sector-bars').innerHTML = bookNote + Object.keys(window.SECTOR_TARGETS).map(s => {
    const cur = sw[s] || 0;
    const tgt = window.SECTOR_TARGETS[s];
    const mid = (tgt.min + tgt.max) / 2;
    const under = cur < tgt.min && tgt.min > 0;
    const over = cur > tgt.max;
    const dollarGap = ((mid - cur) / 100 * bookNow);
    const targetPos = Math.min(mid * 2.5, 100);
    return `
      <div class="alloc-row">
        <div class="alloc-meta">
          <span class="alloc-name">${s} <span class="mute" style="font-size:11px;">${tgt.min}–${tgt.max}%</span></span>
          <span class="alloc-pct ${under ? 'loss' : over ? 'warn' : ''}">${cur.toFixed(1)}%</span>
        </div>
        <div class="alloc-track">
          <div class="alloc-fill" style="width:${Math.min(cur * 2.5, 100)}%; background:${tgt.color};"></div>
          <div class="alloc-target" style="left:${targetPos}%;"></div>
        </div>
        ${under ? `<div class="alloc-note loss">↑ Underweight by ${(tgt.min - cur).toFixed(1)}% · ~${fmtK(Math.abs(dollarGap))} to reach midpoint</div>` :
           over ? `<div class="alloc-note warn">↓ Overweight by ${(cur - tgt.max).toFixed(1)}% · pause additions</div>` : ''}
      </div>`;
  }).join('');

  // Concentration
  $('concentration-bars').innerHTML = enriched.length === 0
    ? '<div class="mute" style="font-size:13px;">No positions</div>'
    : enriched.map(p => {
        const warn = p.weight > capNow;
        return `
          <div class="alloc-row">
            <div class="alloc-meta">
              <span class="alloc-name"><span class="tkr-cell" style="color:var(--ink);">${p.tkr}</span></span>
              <span class="alloc-pct ${warn ? 'warn' : ''}">${p.weight.toFixed(1)}%</span>
            </div>
            <div class="alloc-track">
              <div class="alloc-fill" style="width:${Math.min(p.weight * 4, 100)}%; background:var(--accent);"></div>
              <div class="alloc-target" style="left:${Math.min(capNow * 4, 100)}%;"></div>
            </div>
            ${warn ? `<div class="alloc-note warn">Position over the ${capNow}% concentration limit</div>` : ''}
          </div>`;
      }).join('');

  // Gap table
  $('gap-tbody').innerHTML = gaps.map(g => `
    <tr>
      <td><strong>${g.sector}</strong></td>
      <td class="cb-amount">${g.current.toFixed(1)}%</td>
      <td class="cb-amount mute">${g.target.min}–${g.target.max}%</td>
      <td class="cb-amount ${g.status === 'underweight' ? 'loss' : g.status === 'overweight' ? 'warn' : ''}">${g.gapPct >= 0 ? '+' : ''}${g.gapPct.toFixed(1)}%</td>
      <td><span class="pill pill-${g.status === 'underweight' ? 'loss' : g.status === 'overweight' ? 'warn' : 'gain'}">${g.status.replace('-', ' ')}</span></td>
      <td style="text-align:left;padding-left:12px;font-size:12px;color:var(--mute);">${g.status === 'underweight' ? `Add ~${fmtK(Math.abs(g.dollarGap))} <a href="javascript:void(0)" onclick="window.HardcapApp.askAboutSector('${g.sector}')" style="color:var(--accent);text-decoration:none;font-weight:500;margin-left:8px;">Ask →</a>` : g.status === 'overweight' ? 'Pause additions' : 'Maintain'}</td>
    </tr>
  `).join('');

  // Render the interactive allocator
  renderExposureAllocator(state);
}

// ─── INTERACTIVE EXPOSURE ALLOCATOR ─────────────────────────────────
// Mark Rowan-style: hybrid scoring across sector gap urgency + conviction +
// buy zone discipline + concentration caps. Shows explicit reasoning per pick.
function renderExposureAllocator(state) {
  const host = $('exposure-allocator');
  if (!host) return;

  const isFirstRender = !document.getElementById('expalloc-amount');
  const previousAmount = isFirstRender ? null : parseFloat(document.getElementById('expalloc-amount').value);
  const initialAmount = previousAmount || 2000;

  if (isFirstRender) {
    host.innerHTML = `
      <div class="card" style="margin-bottom:20px;">
        <div class="card-h">
          <div class="card-t">What If I Deployed This Much?</div>
          <span class="pill pill-accent">Same rules engine as the Deploy tab</span>
        </div>
        <div class="card-b">

          <!-- CONTROLS -->
          <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:14px;align-items:end;margin-bottom:24px;">
            <div>
              <label class="field-label">Amount available · <span id="expalloc-amount-display" style="color:var(--ink);font-weight:600;">$${initialAmount.toLocaleString()}</span></label>
              <input type="range" id="expalloc-amount" min="500" max="50000" step="500" value="${initialAmount}" style="width:100%;accent-color:var(--accent);">
              <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-3);margin-top:4px;">
                <span>$500</span><span>$50,000</span>
              </div>
            </div>
            <div>
              <input type="number" class="input mono" id="expalloc-amount-input" value="${initialAmount}" min="100" step="100" style="width:130px;font-size:14px;">
            </div>
            <button class="btn ghost sm" id="expalloc-use-cash">Use cash</button>
            <button class="btn ghost sm" id="expalloc-use-monthly">Monthly</button>
          </div>

          <!-- HEALTH SUMMARY -->
          <div id="expalloc-summary" style="background:var(--bg-2);border-radius:var(--r-md);padding:14px 18px;margin-bottom:18px;font-size:13px;color:var(--text-2);line-height:1.6;"></div>

          <!-- ALLOCATION LIST -->
          <div id="expalloc-list"></div>

          <!-- METHODOLOGY -->
          <details style="margin-top:18px;">
            <summary style="font-size:12px;color:var(--text-3);cursor:pointer;font-weight:500;">Methodology — how this is scored</summary>
            <div style="font-size:12px;color:var(--text-2);line-height:1.7;margin-top:10px;padding:12px 16px;background:var(--bg-2);border-radius:var(--r-sm);">
This runs the same rules engine as the Deploy tab, with the amount on the slider in place of this month's rule amount. Core sectors are filled toward their targets; names you hold keep their sector slots and an open slot goes only to a name you pinned (unless your rule lets any buy-rated name fill it); the money is split by each name's gap to its conviction-weighted target; a current buy zone tilts the size; nothing passes the single-name cap. Whatever no eligible name has room for is left in cash. The rules themselves are on the Deploy tab under "Rules".
            </div>
          </details>

          <!-- CONTEXTUAL ASK CLAUDE -->
          <div style="margin-top:18px;padding:14px 18px;background:var(--bg-2);border-radius:var(--r-md);display:flex;justify-content:space-between;align-items:center;gap:14px;">
            <div style="font-size:13px;color:var(--text-2);">
              <strong style="color:var(--ink);">Need a deeper take?</strong> Ask Claude to walk through this allocation, suggest alternatives, or stress-test the picks.
            </div>
            <button class="btn sm" onclick="window.HardcapApp.askAboutDeployment(parseFloat(document.getElementById('expalloc-amount').value))">Ask Claude →</button>
          </div>

        </div>
      </div>
    `;

    // Wire interactions — update display only, no full page re-render
    document.getElementById('expalloc-amount').addEventListener('input', () => {
      const v = parseFloat(document.getElementById('expalloc-amount').value);
      document.getElementById('expalloc-amount-input').value = v;
      updateExposureAllocator(state);
    });
    document.getElementById('expalloc-amount-input').addEventListener('input', () => {
      const v = parseFloat(document.getElementById('expalloc-amount-input').value) || 0;
      const slider = document.getElementById('expalloc-amount');
      slider.value = Math.min(Math.max(v, slider.min), slider.max);
      updateExposureAllocator(state);
    });
    document.getElementById('expalloc-use-cash').addEventListener('click', () => {
      const cash = state.cash || 0;
      document.getElementById('expalloc-amount').value = cash;
      document.getElementById('expalloc-amount-input').value = cash;
      updateExposureAllocator(state);
    });
    document.getElementById('expalloc-use-monthly').addEventListener('click', () => {
      const m = state.monthlyDeposit || 2000;
      document.getElementById('expalloc-amount').value = m;
      document.getElementById('expalloc-amount-input').value = m;
      updateExposureAllocator(state);
    });
  }

  updateExposureAllocator(state);
}

function updateExposureAllocator(state) {
  const amountInput = document.getElementById('expalloc-amount');
  if (!amountInput) return;
  const amount = parseFloat(amountInput.value) || 0;
  document.getElementById('expalloc-amount-display').textContent = '$' + amount.toLocaleString();

  const plan = window.HardcapDeployment.generate(state, amount);
  const A = window.HardcapAnalytics;
  const sw = A.sectorWeights(state);
  const eq = A.totalEquity(state);

  // Health summary
  const energyPct = (sw['Energy'] || 0).toFixed(1);
  const altPct = (sw['Alt. Managers'] || 0).toFixed(1);
  const semiPct = (sw['Semiconductors'] || 0).toFixed(1);
  const energyTgt = window.SECTOR_TARGETS['Energy'];
  const altTgt = window.SECTOR_TARGETS['Alt. Managers'];

  let summaryParts = [];
  summaryParts.push(`<strong>Capital:</strong> ${fmtK(amount)} \u2192 buys ${fmtK(plan.cashDeployed)}, leaves ${fmtK(plan.cashReserved)} in cash`);
  if ((sw['Energy'] || 0) < energyTgt.min) {
    summaryParts.push(`<strong style="color:var(--loss);">Energy gap:</strong> ${energyPct}% of book vs ${energyTgt.min}-${energyTgt.max}% band`);
  }
  if ((sw['Alt. Managers'] || 0) < altTgt.min) {
    summaryParts.push(`<strong style="color:var(--loss);">Alt managers gap:</strong> ${altPct}% of book vs ${altTgt.min}-${altTgt.max}% band`);
  }
  if ((sw['Semiconductors'] || 0) > 30) {
    summaryParts.push(`<strong style="color:var(--warn);">Semis at ${semiPct}%</strong> of book — above the band, so no new money goes there`);
  }
  document.getElementById('expalloc-summary').innerHTML = summaryParts.join(' · ');

  // Allocations
  if (plan.allocations.length === 0) {
    document.getElementById('expalloc-list').innerHTML = `<div class="empty" style="padding:32px;">
      <div class="empty-title" style="font-size:18px;">Nothing to buy at this amount</div>
      <div class="empty-sub">No eligible name has room: sectors are at target, signals are on Hold or Watch, or the amount is under the smallest order. The Deploy tab lists what is holding each sector back.</div>
    </div>`;
    return;
  }

  document.getElementById('expalloc-list').innerHTML = plan.allocations.map((a, i) => {
    const isHeld = a.held;
    const sectorPct = a.currentSectorWeight.toFixed(1);
    const sectorTgt = a.sectorTarget;
    const fillsGap = sectorTgt && a.currentSectorWeight < sectorTgt.min;

    // Build reasoning trail
    const reasons = [];
    if (fillsGap) {
      reasons.push(`<span class="pill pill-loss" style="font-size:10px;">Fills sector gap</span> ${a.sector} at ${sectorPct}% \u2192 target ${sectorTgt.min}-${sectorTgt.max}%`);
    } else if (sectorTgt) {
      reasons.push(`<span class="pill pill-neutral" style="font-size:10px;">Sector on track</span> ${a.sector} at ${sectorPct}% within ${sectorTgt.min}-${sectorTgt.max}%`);
    }
    const cvLabel = a.conviction >= 85 ? 'Top-tier' : a.conviction >= 75 ? 'High' : a.conviction >= 65 ? 'Quality' : 'Low';
    reasons.push(`<span class="pill pill-accent" style="font-size:10px;">Conviction ${a.conviction}</span> ${cvLabel}`);
    const zoneClass = a.zoneLabel === 'In buy zone' ? 'pill-gain' : a.zoneLabel === 'Below buy zone' ? 'pill-strong-buy' : a.zoneLabel === 'Above fair' ? 'pill-warn' : 'pill-neutral';
    reasons.push(`<span class="pill ${zoneClass}" style="font-size:10px;">${a.zoneLabel}</span>`);

    return `
      <div style="background:var(--surface);border:1px solid var(--rule-2);border-left:3px solid var(--accent);border-radius:var(--r-md);padding:18px 22px;margin-bottom:10px;display:grid;grid-template-columns:auto 1fr auto;gap:20px;align-items:center;">
        <div style="font-family:var(--sans);font-size:30px;font-weight:700;color:var(--accent);opacity:0.3;line-height:1;width:34px;text-align:center;font-variant-numeric:tabular-nums;">${String(i+1).padStart(2,'0')}</div>
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
            <span style="font-size:18px;font-weight:700;color:var(--ink);letter-spacing:-0.018em;">${a.tkr}</span>
            <span style="font-size:13px;color:var(--text-2);">${a.name || ''}</span>
            ${isHeld ? '<span class="pill pill-hold" style="font-size:9px;">Held · add</span>' : '<span class="pill pill-accent" style="font-size:9px;">Initiate</span>'}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px;">
            ${reasons.join(' ')}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:22px;font-weight:700;color:var(--ink);letter-spacing:-0.018em;font-variant-numeric:tabular-nums;line-height:1;">${fmtK(a.dollarAmount)}</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:5px;font-variant-numeric:tabular-nums;">${a.shares} sh @ ${fmt(a.price)}</div>
          <div style="font-size:10px;color:var(--text-3);margin-top:2px;">${(a.dollarAmount/amount*100).toFixed(0)}% of capital</div>
        </div>
      </div>
    `;
  }).join('');

  // Append reserve note
  if (plan.cashReserved > 0) {
    document.getElementById('expalloc-list').innerHTML += `
      <div style="background:var(--bg-2);border:1px dashed var(--rule);border-radius:var(--r-md);padding:14px 22px;margin-top:6px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--ink);">Left in cash</div>
          <div style="font-size:12px;color:var(--text-2);margin-top:3px;">No eligible name has room for it at this amount</div>
        </div>
        <div style="font-family:var(--sans);font-size:18px;font-weight:600;color:var(--text-2);font-variant-numeric:tabular-nums;">${fmtK(plan.cashReserved)}</div>
      </div>
    `;
  }
}

// ─── UNIVERSE PAGE ─────────────────────────────────────────────────
function renderUniverse(state) {
  const tickers = Object.keys(state.universe).sort();
  const heldSet = new Set(state.positions.map(p => p.tkr));

  $('universe-count').textContent = tickers.length + ' tickers';

  $('universe-list').innerHTML = tickers.length === 0
    ? `<div class="empty"><div class="empty-title">No tickers in universe</div><div class="empty-sub">Add one to enable analysis.</div></div>`
    : tickers.map(tkr => {
        const u = state.universe[tkr];
        const held = heldSet.has(tkr);
        return `
          <div class="memo" style="margin-bottom:10px;padding:16px 20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;">
              <div style="flex:1;min-width:200px;">
                <div style="display:flex;align-items:center;gap:10px;">
                  <span style="font-family:var(--mono);font-size:15px;font-weight:600;color:var(--accent);">${tkr}</span>
                  <span style="font-size:12px;color:var(--mute);">${u.name || ''}</span>
                </div>
                <div style="font-size:11px;color:var(--mute);margin-top:3px;">${u.sector || 'Other'}${u.subsector ? ' · ' + u.subsector : ''}</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px 12px;flex-wrap:wrap;">
                ${held ? '<span class="pill pill-gain">Held</span>' : ''}
                ${u.noBuy ? '<span class="pill pill-loss">Never buy</span>' : ''}
                ${u.pinned ? '<span class="pill pill-neutral">Pinned</span>' : ''}
                ${u.signal ? `<span class="pill pill-${slug(u.signal)}">${u.signal}</span>` : ''}
                ${u.conviction != null ? `<div class="cv-bar"><div class="cv-track"><div class="cv-fill ${cvClass(u.conviction)}" style="width:${u.conviction}%"></div></div><div class="cv-num ${cvClass(u.conviction)}">${u.conviction}</div></div>` : ''}
                <button class="btn ghost xs" onclick="window.HardcapApp.editTicker('${tkr}')">Edit</button>
                <button class="btn danger xs" onclick="window.HardcapApp.removeTicker('${tkr}')">×</button>
              </div>
            </div>
          </div>`;
      }).join('');
}

// ─── HISTORY PAGE ─────────────────────────────────────────────────
function renderHistory(state) {
  const hist = state.history || [];
  if (window.HardcapPlanUI) window.HardcapPlanUI.renderJournal(state);
  if (hist.length === 0) {
    $('history-chart').innerHTML = '';
    $('history-tbody').innerHTML = '';
    return;
  }

  // Chart
  const w = 1100, h = 220, pad = { l: 50, r: 20, t: 20, b: 30 };
  const chartW = w - pad.l - pad.r;
  const chartH = h - pad.t - pad.b;
  const values = hist.map(s => s.totalValue);
  const minV = Math.min(...values) * 0.95;
  const maxV = Math.max(...values) * 1.05;
  const xStep = hist.length > 1 ? chartW / (hist.length - 1) : 0;
  const points = hist.map((s, i) => ({
    x: pad.l + i * xStep,
    y: pad.t + chartH * (1 - (s.totalValue - minV) / (maxV - minV)),
    val: s.totalValue,
    date: s.date,
  }));

  const linePath = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ');
  const areaPath = linePath + ` L ${points[points.length - 1].x},${pad.t + chartH} L ${points[0].x},${pad.t + chartH} Z`;

  // Y-axis labels (3 ticks)
  const ticks = [0, 0.5, 1].map(t => ({
    y: pad.t + chartH * t,
    val: maxV - (maxV - minV) * t,
  }));

  $('history-chart').innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <g class="chart-grid">
        ${ticks.map(t => `<line x1="${pad.l}" y1="${t.y}" x2="${w - pad.r}" y2="${t.y}" />`).join('')}
      </g>
      <path class="chart-area" d="${areaPath}" />
      <path class="chart-line" d="${linePath}" />
      ${points.map(p => `<circle class="chart-dot" cx="${p.x}" cy="${p.y}" r="3" />`).join('')}
      ${ticks.map(t => `<text class="chart-label" x="${pad.l - 8}" y="${t.y + 3}" text-anchor="end">${fmtK(t.val)}</text>`).join('')}
      ${points.filter((_, i) => i === 0 || i === points.length - 1 || i % Math.max(1, Math.floor(points.length / 6)) === 0).map(p => `<text class="chart-label" x="${p.x}" y="${h - 8}" text-anchor="middle">${p.date.slice(5)}</text>`).join('')}
    </svg>
  `;

  // Snapshot table
  $('history-tbody').innerHTML = [...hist].reverse().map((s, idx, arr) => {
    const prev = arr[idx + 1];
    const delta = prev ? s.totalValue - prev.totalValue : null;
    const deltaPct = prev && prev.totalValue > 0 ? (s.totalValue / prev.totalValue - 1) * 100 : null;
    return `<tr>
      <td><strong>${s.date}</strong>${s.scope ? `<div class="tkr-sub">${escapeHtml(s.scope)}</div>` : ''}</td>
      <td class="cb-amount">${fmtK(s.totalValue)}</td>
      <td class="cb-amount">${fmtK(s.equityValue)}</td>
      <td class="cb-amount mute">${fmtK(s.cash)}</td>
      <td class="mute">${s.positionCount}</td>
      <td class="cb-amount ${delta != null ? colorClass(delta) : ''}">${delta != null ? fmtSigned(delta) : '—'}</td>
      <td class="cb-amount ${deltaPct != null ? colorClass(deltaPct) : ''}">${deltaPct != null ? fmtPct(deltaPct) : '—'}</td>
    </tr>`;
  }).join('');
}

// ─── IMPORT PAGE ──────────────────────────────────────────────────
function renderImport(state) {
  $('import-last').textContent = state.seedSource === 'sample'
    ? 'No CSV yet (sample portfolio)'
    : state.lastImport
    ? new Date(state.lastImport).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Never';
  $('import-positions').textContent = state.positions.length;
  $('import-cash').textContent = fmtK(state.cash);
  $('import-snapshots').textContent = (state.history || []).length;
  if (window.HardcapPlanUI) window.HardcapPlanUI.renderAccounts(state, !!(window.HardcapApp && window.HardcapApp.hasCsvInMemory && window.HardcapApp.hasCsvInMemory()));
}

// ─── EDITOR MODAL FOR TICKERS ─────────────────────────────────────
function openTickerEditor(tkr, state, onSave) {
  const u = state.universe[tkr] || {
    name: '', sector: 'Other', conviction: 65, signal: 'Hold',
    buyZone: { low: 0, fair: 0, high: 0 },
    thesis: { bull: '', bear: '', anchor: '', changeMyMind: '', catalysts: [], risks: [] },
    fundamentals: {},
    notes: '',
  };

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(24,18,8,0.45);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto;';
  modal.innerHTML = `
    <div style="background:var(--paper);border-radius:8px;max-width:780px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);">
      <div style="padding:20px 28px;border-bottom:1px solid var(--rule);display:flex;justify-content:space-between;align-items:center;">
        <div style="font-family:var(--serif);font-size:22px;font-weight:500;">${tkr ? 'Edit ' + tkr : 'New Ticker'}</div>
        <button class="btn ghost sm" id="modal-close">×</button>
      </div>
      <div style="padding:24px 28px;display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        <div><label class="field-label">Ticker</label><input class="input mono" id="m-tkr" value="${tkr || ''}" ${tkr ? 'disabled' : ''}></div>
        <div><label class="field-label">Name</label><input class="input" id="m-name" value="${(u.name || '').replace(/"/g,'&quot;')}"></div>
        <div><label class="field-label">Sector</label><select class="input" id="m-sector">
          ${Object.keys(window.SECTOR_TARGETS).map(s => `<option ${u.sector === s ? 'selected' : ''}>${s}</option>`).join('')}
          <option ${!Object.keys(window.SECTOR_TARGETS).includes(u.sector) ? 'selected' : ''}>Other</option>
        </select></div>
        <div><label class="field-label">Subsector</label><input class="input" id="m-sub" value="${u.subsector || ''}"></div>
        <div><label class="field-label">Conviction (0-100)</label><input class="input mono" id="m-cv" type="number" min="0" max="100" value="${u.conviction || 65}"></div>
        <div><label class="field-label">Signal</label><select class="input" id="m-signal">
          ${['Strong Buy','Accumulate','Hold','Watch','Trim','Sell'].map(s => `<option ${u.signal === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select></div>
        <div><label class="field-label">Buy Zone Low ($)</label><input class="input mono" id="m-zone-low" type="number" step="any" value="${u.buyZone?.low || ''}"></div>
        <div><label class="field-label">Fair Value ($)</label><input class="input mono" id="m-zone-fair" type="number" step="any" value="${u.buyZone?.fair || ''}"></div>
        <div><label class="field-label">Buy Zone High ($)</label><input class="input mono" id="m-zone-high" type="number" step="any" value="${u.buyZone?.high || ''}"></div>
        <div style="display:flex;flex-direction:column;gap:8px;justify-content:flex-end;">
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" id="m-pinned" ${u.pinned ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--accent);"> Pin: the engine may open a position in this name</label>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" id="m-nobuy" ${u.noBuy ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--accent);"> Never buy: the engine and the IC skip it</label>
        </div>
        <div style="grid-column:1/-1;"><label class="field-label">Bull Case</label><textarea class="input" id="m-bull" rows="3">${u.thesis?.bull || ''}</textarea></div>
        <div style="grid-column:1/-1;"><label class="field-label">Bear Case</label><textarea class="input" id="m-bear" rows="3">${u.thesis?.bear || ''}</textarea></div>
        <div style="grid-column:1/-1;"><label class="field-label">Valuation Anchor</label><textarea class="input" id="m-anchor" rows="2">${u.thesis?.anchor || ''}</textarea></div>
        <div style="grid-column:1/-1;"><label class="field-label">What Would Change My Mind</label><textarea class="input" id="m-change" rows="2">${u.thesis?.changeMyMind || ''}</textarea></div>
        <div style="grid-column:1/-1;"><label class="field-label">Catalysts (comma-separated)</label><input class="input" id="m-cat" value="${(u.thesis?.catalysts || []).join(', ').replace(/"/g,'&quot;')}"></div>
        <div style="grid-column:1/-1;"><label class="field-label">Risks (comma-separated)</label><input class="input" id="m-risk" value="${(u.thesis?.risks || []).join(', ').replace(/"/g,'&quot;')}"></div>
        <div style="grid-column:1/-1;"><label class="field-label">Position Notes</label><textarea class="input" id="m-notes" rows="2">${u.notes || ''}</textarea></div>
      </div>
      <div style="padding:16px 28px;border-top:1px solid var(--rule);display:flex;justify-content:flex-end;gap:8px;">
        <button class="btn ghost sm" id="modal-cancel">Cancel</button>
        <button class="btn sm" id="modal-save">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  $('modal-close').onclick = close;
  $('modal-cancel').onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };

  $('modal-save').onclick = () => {
    const newTkr = ($('m-tkr').value || tkr).trim().toUpperCase();
    if (!newTkr) { alert('Ticker required'); return; }
    const today = new Date().toISOString().slice(0, 10);
    const prevZone = u.buyZone || {};
    const zone = {
      low: parseFloat($('m-zone-low').value) || null,
      fair: parseFloat($('m-zone-fair').value) || null,
      high: parseFloat($('m-zone-high').value) || null,
    };
    const zoneChanged = zone.low !== (prevZone.low || null) || zone.fair !== (prevZone.fair || null) || zone.high !== (prevZone.high || null);
    if (zoneChanged) {
      // new numbers count as a review today, once they form a complete ordered zone
      if (zone.low > 0 && zone.fair > zone.low && zone.high > zone.fair) zone.reviewed = today;
    } else {
      if (prevZone.reviewed) zone.reviewed = prevZone.reviewed;
      if (prevZone.placeholder) zone.placeholder = true;
    }
    const prevThesis = u.thesis || {};
    const thesisFields = {
      bull: $('m-bull').value.trim(),
      bear: $('m-bear').value.trim(),
      anchor: $('m-anchor').value.trim(),
      changeMyMind: $('m-change').value.trim(),
      catalysts: $('m-cat').value.split(',').map(s => s.trim()).filter(Boolean),
      risks: $('m-risk').value.split(',').map(s => s.trim()).filter(Boolean),
    };
    const thesisChanged = ['bull', 'bear', 'anchor', 'changeMyMind'].some(k => (thesisFields[k] || '') !== (prevThesis[k] || '').trim())
      || thesisFields.catalysts.join('|') !== (prevThesis.catalysts || []).join('|')
      || thesisFields.risks.join('|') !== (prevThesis.risks || []).join('|');
    // Start from the existing entry so return scenarios, live data, reviews and
    // observations survive an edit. (The old save rebuilt the entry and dropped them.)
    const updated = Object.assign({}, u, {
      name: $('m-name').value.trim(),
      sector: $('m-sector').value,
      subsector: $('m-sub').value.trim(),
      conviction: parseInt($('m-cv').value) || 65,
      signal: $('m-signal').value,
      buyZone: zone,
      thesis: Object.assign({}, prevThesis, thesisFields, thesisChanged || !prevThesis.lastReviewed
        ? { lastReviewed: today, anchorReviewed: today } : {}),
      fundamentals: u.fundamentals || {},
      notes: $('m-notes').value.trim(),
    });
    if ($('m-pinned').checked) updated.pinned = true; else delete updated.pinned;
    if ($('m-nobuy').checked) updated.noBuy = true; else delete updated.noBuy;
    onSave(newTkr, updated);
    close();
  };
}

// ═══════════════════════════════════════════════════════════════════
// LIVE DATA PAGE RENDER
// ═══════════════════════════════════════════════════════════════════
function renderLiveData(state) {
  const live = state.live || {};
  const hasKey = window.HardcapLive && window.HardcapLive.hasKey();

  // Key pill
  const keyPill = $('live-key-pill');
  if (keyPill) {
    keyPill.textContent = hasKey ? 'Configured' : 'Not configured';
    keyPill.className = 'pill ' + (hasKey ? 'pill-gain' : 'pill-warn');
  }

  // Last refresh stat
  const lastQ = live.lastQuoteRefresh;
  const lastQEl = $('live-last-quote');
  const lastQSub = $('live-last-quote-sub');
  if (lastQEl) {
    if (lastQ) {
      lastQEl.textContent = relativeTime(lastQ);
      const r = live.lastQuoteResult || {};
      lastQSub.textContent = `${r.updated || 0} updated, ${r.failed || 0} failed · ${new Date(lastQ).toLocaleString()}`;
    } else {
      lastQEl.textContent = '—';
      lastQSub.textContent = 'No data pulled yet';
    }
  }

  const lastF = live.lastFundamentalsRefresh;
  const lastFEl = $('live-last-fund');
  const lastFSub = $('live-last-fund-sub');
  if (lastFEl) {
    if (lastF) {
      lastFEl.textContent = relativeTime(lastF);
      lastFSub.textContent = new Date(lastF).toLocaleString();
    } else {
      lastFEl.textContent = '—';
      lastFSub.textContent = 'Hand-entered seed data in use';
    }
  }

  // Per-ticker status table
  const tbody = $('live-status-tbody');
  if (tbody) {
    const tickers = Object.keys(state.universe || {}).sort();
    if (tickers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:32px;">No universe loaded.</td></tr>';
    } else {
      tbody.innerHTML = tickers.map(tkr => {
        const u = state.universe[tkr] || {};
        const livePrice = u.livePrice;
        const liveAt = u.liveQuoteAt;
        const fundAt = u.liveFundamentalsAt;
        const earnings = u.nextEarnings;
        const changePct = u.liveChangePct;
        const today = changePct != null
          ? `<span class="${changePct >= 0 ? 'gain' : 'loss'}" style="color:${changePct >= 0 ? 'var(--gain)' : 'var(--loss)'};">${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%</span>`
          : '<span style="color:var(--text-3);">—</span>';
        return `<tr>
          <td><span class="tkr">${tkr}</span></td>
          <td style="color:var(--text-2);">${u.name || '—'}</td>
          <td class="right">${livePrice != null ? '$' + livePrice.toFixed(2) : '<span style="color:var(--text-3);">—</span>'}</td>
          <td class="right">${today}</td>
          <td>${ageBadge(liveAt, 30 * 60 * 1000, 6 * 3600 * 1000)}</td>
          <td>${ageBadge(fundAt, 7 * 24 * 3600 * 1000, 30 * 24 * 3600 * 1000)}</td>
          <td>${formatNextEarnings(earnings)}</td>
        </tr>`;
      }).join('');
    }
  }

  // Summary pill
  const summary = $('live-tbl-summary');
  if (summary) {
    const tickers = Object.keys(state.universe || {});
    const withQuotes = tickers.filter(t => state.universe[t]?.livePrice != null).length;
    summary.textContent = `${withQuotes}/${tickers.length} priced live`;
    summary.className = 'pill ' + (withQuotes === tickers.length && tickers.length > 0 ? 'pill-gain' : (withQuotes === 0 ? 'pill-warn' : 'pill-accent'));
  }

  // Earnings strip
  const strip = $('live-earnings-strip');
  const ecount = $('live-earnings-count');
  if (strip) {
    const tickers = Object.keys(state.universe || {});
    const upcoming = tickers
      .map(t => ({ tkr: t, e: state.universe[t]?.nextEarnings }))
      .filter(x => x.e && x.e.date)
      .sort((a, b) => a.e.date.localeCompare(b.e.date));
    if (upcoming.length === 0) {
      strip.innerHTML = '<div style="color:var(--text-3);font-size:13px;padding:8px 0;">No earnings calendar loaded. Click "Refresh earnings calendar" above.</div>';
      if (ecount) ecount.textContent = '—';
    } else {
      const today = new Date(); today.setHours(0,0,0,0);
      strip.innerHTML = upcoming.map(({ tkr, e }) => {
        const d = new Date(e.date + 'T12:00:00');
        const days = Math.round((d - today) / (1000 * 3600 * 24));
        const imminent = days <= 7;
        const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const dayStr = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
        const est = e.epsEstimate != null ? `Est. EPS $${e.epsEstimate.toFixed(2)}` : '';
        return `<div class="live-earnings-chip ${imminent ? 'imminent' : ''}">
          <div class="live-earnings-chip-tkr">${tkr}</div>
          <div class="live-earnings-chip-date">${dateStr} · ${dayStr}</div>
          ${est ? `<div class="live-earnings-chip-est">${est}</div>` : ''}
        </div>`;
      }).join('');
      if (ecount) {
        ecount.textContent = `${upcoming.length} reporting`;
        ecount.className = 'pill pill-accent';
      }
    }
  }
}

// Relative time helper — "3 min ago", "2 hours ago", "yesterday"
function relativeTime(ts) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const d = Math.floor(hr / 24);
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  return new Date(ts).toLocaleDateString();
}

// Age badge — fresh if under warmThreshold, warm if under staleThreshold, stale beyond.
function ageBadge(ts, warmMs, staleMs) {
  if (!ts) return '<span class="live-age none">never</span>';
  const diff = Date.now() - ts;
  const cls = diff < warmMs ? 'fresh' : (diff < staleMs ? 'warm' : 'stale');
  return `<span class="live-age ${cls}">${relativeTime(ts)}</span>`;
}

function formatNextEarnings(e) {
  if (!e || !e.date) return '<span style="color:var(--text-3);">—</span>';
  const d = new Date(e.date + 'T12:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((d - today) / (1000 * 3600 * 24));
  const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (days < 0) return `<span style="color:var(--text-3);">${dateStr} (past)</span>`;
  const dayStr = days === 0 ? 'today' : days === 1 ? 'tmrw' : `${days}d`;
  const color = days <= 7 ? 'var(--accent)' : 'var(--text-2)';
  return `<span style="color:${color};">${dateStr} · ${dayStr}</span>`;
}

window.HardcapRender = {
  overview: renderOverview,
  deploy: renderDeploy,
  holdings: renderHoldings,
  exposure: renderExposure,
  universe: renderUniverse,
  history: renderHistory,
  import: renderImport,
  risk: renderRisk,
  alerts: renderAlerts,
  chat: renderChat,
  openTickerEditor,
  buildMemoCard,
  fmt, fmtK, fmtPct, fmtSigned, colorClass, cvClass, slug,
};

// ─── CHAT (Ask Claude) PAGE ────────────────────────────────────────
function renderChat(state) {
  const hasKey = window.HardcapChat.hasApiKey();
  const chat = window.HardcapChat.loadChat();
  const currentModel = window.HardcapChat.getModel();
  const models = window.HardcapChat.AVAILABLE_MODELS;

  // Only build the shell once
  if (!document.getElementById('chat-messages')) {
    $('chat-host').innerHTML = `
      <div class="card" style="margin-bottom:20px;">
        <div class="card-h">
          <div class="card-t">Settings</div>
          <span class="pill pill-${hasKey ? 'gain' : 'warn'}" id="chat-key-status">${hasKey ? 'API key set' : 'No API key'}</span>
        </div>
        <div class="card-b">
          <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;align-items:end;margin-bottom:14px;">
            <div>
              <label class="field-label">Anthropic API Key</label>
              <div style="display:flex;gap:8px;">
                <input class="input mono" type="password" id="chat-key-input" placeholder="sk-ant-..." value="${hasKey ? '••••••••••••••••••' : ''}" style="flex:1;">
                <button class="btn sm" id="chat-key-save">Save</button>
              </div>
              <div style="font-size:11px;color:var(--text-3);margin-top:6px;">Create one at <strong>platform.claude.com</strong> → Settings → API keys. The full key is shown once. Stored only in your browser.</div>
            </div>
            <div>
              <label class="field-label">Model</label>
              <select class="input" id="chat-model-select">
                ${models.map(m => `<option value="${m.id}" ${m.id === currentModel ? 'selected' : ''}>${m.label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="font-size:12px;color:var(--text-2);background:var(--bg-2);padding:12px 14px;border-radius:var(--r-sm);line-height:1.55;">
            <strong>What Claude knows:</strong> your full portfolio state — positions, conviction scores, theses, sector targets, alerts — is sent on every message so answers are specific to your dashboard. <strong>What Claude can do:</strong> read & analyze freely; for changes (add ticker, edit conviction, etc.) Claude proposes actions you confirm with one click.
          </div>
        </div>
      </div>

      <div class="card chat-card" style="display:flex;flex-direction:column;height:680px;">
        <div class="card-h">
          <div class="card-t">Conversation</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="font-size:11px;color:var(--text-3);" id="chat-msg-count">${chat.messages.length} messages</span>
            <button class="btn ghost xs" id="chat-clear">Clear</button>
          </div>
        </div>

        <div id="chat-messages" style="flex:1;overflow-y:auto;padding:24px 28px;display:flex;flex-direction:column;gap:18px;"></div>

        <div style="border-top:1px solid var(--rule-2);padding:18px 24px;background:var(--bg-2);">
          <div style="display:flex;gap:10px;align-items:flex-end;">
            <textarea
              id="chat-input"
              class="input"
              placeholder="${hasKey ? 'Ask anything about your portfolio...' : 'Set your API key first'}"
              ${hasKey ? '' : 'disabled'}
              rows="2"
              style="flex:1;resize:none;background:var(--surface);border:1px solid var(--rule-2);"
            ></textarea>
            <button class="btn" id="chat-send" ${hasKey ? '' : 'disabled'}>Send →</button>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
            ${[
              'Why is cash waiting this month?',
              'Add Coterra Energy with full thesis',
              'Refresh APO 90-day review',
              'Project $2k/mo into APO over 20 years',
              'Which holdings have the stalest theses?',
            ].map(s => `<button class="btn ghost xs chat-suggest" data-prompt="${s.replace(/"/g, '&quot;')}">${s}</button>`).join('')}
          </div>
        </div>
      </div>
    `;

    // Wire interactions (only once)
    document.getElementById('chat-key-save').addEventListener('click', () => {
      const input = document.getElementById('chat-key-input');
      const val = input.value.trim();
      if (val && val !== '••••••••••••••••••') {
        window.HardcapChat.setApiKey(val);
        input.value = '••••••••••••••••••';
        document.getElementById('chat-key-status').textContent = 'API key set';
        document.getElementById('chat-key-status').className = 'pill pill-gain';
        document.getElementById('chat-input').disabled = false;
        document.getElementById('chat-input').placeholder = 'Ask anything about your portfolio...';
        document.getElementById('chat-send').disabled = false;
      } else if (val === '') {
        window.HardcapChat.setApiKey('');
        document.getElementById('chat-key-status').textContent = 'No API key';
        document.getElementById('chat-key-status').className = 'pill pill-warn';
        document.getElementById('chat-input').disabled = true;
        document.getElementById('chat-send').disabled = true;
      }
    });

    document.getElementById('chat-model-select').addEventListener('change', (e) => {
      window.HardcapChat.setModel(e.target.value);
    });

    document.getElementById('chat-clear').addEventListener('click', () => {
      if (window.HardcapChat.clearChat()) {
        renderChatMessages([]);
        document.getElementById('chat-msg-count').textContent = '0 messages';
      }
    });

    document.getElementById('chat-send').addEventListener('click', () => sendChatMessage(state));
    document.getElementById('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage(state);
      }
    });

    document.querySelectorAll('.chat-suggest').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('chat-input').value = btn.dataset.prompt;
        sendChatMessage(state);
      });
    });
  }

  // Render the message list
  renderChatMessages(chat.messages);
}

function renderChatMessages(messages) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  if (messages.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px 24px;color:var(--text-3);">
        <div style="font-size:22px;font-weight:600;color:var(--ink);margin-bottom:10px;letter-spacing:-0.018em;">Ask Claude about your portfolio</div>
        <div style="font-size:14px;line-height:1.6;max-width:420px;margin:0 auto;">Claude has full visibility into your positions, theses, conviction scores, and alerts. Try one of the suggestions below or type your own question.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = messages.map((m, idx) => renderChatMessage(m, idx)).join('');
  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function renderChatMessage(m, idx) {
  if (m.role === 'user') {
    return `
      <div style="display:flex;justify-content:flex-end;">
        <div style="max-width:75%;background:var(--ink);color:#fff;padding:12px 16px;border-radius:18px 18px 4px 18px;font-size:14px;line-height:1.5;">
          ${escapeHtml(m.content)}
        </div>
      </div>
    `;
  }

  // Assistant message — separate proposed actions from prose
  const actions = m.actions || [];
  const cleanText = m.displayText || m.content;

  let actionBlocks = '';
  if (actions.length > 0) {
    actionBlocks = actions.map((a, i) => {
      const id = `action-${idx}-${i}`;
      const status = a.status || 'pending';
      if (status === 'confirmed') {
        return `<div style="background:var(--gain-soft);border:1px solid rgba(26,127,55,.2);border-left:3px solid var(--gain);padding:14px 18px;border-radius:var(--r-md);margin-top:10px;">
          <div style="font-size:11px;font-weight:700;color:var(--gain);letter-spacing:0.04em;text-transform:uppercase;margin-bottom:6px;">✓ Applied</div>
          <div style="font-size:13px;color:var(--ink);font-weight:500;">${escapeHtml(a.summary || '')}</div>
          ${a.result ? `<div style="font-size:12px;color:var(--text-2);margin-top:4px;">${escapeHtml(a.result)}</div>` : ''}
        </div>`;
      }
      if (status === 'rejected') {
        return `<div style="background:var(--bg-2);border:1px solid var(--rule-2);border-left:3px solid var(--text-3);padding:14px 18px;border-radius:var(--r-md);margin-top:10px;opacity:0.7;">
          <div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:0.04em;text-transform:uppercase;margin-bottom:6px;">Rejected</div>
          <div style="font-size:13px;color:var(--text-2);">${escapeHtml(a.summary || '')}</div>
        </div>`;
      }
      return `<div id="${id}" style="background:var(--accent-soft);border:1px solid var(--accent-line);border-left:3px solid var(--accent);padding:16px 20px;border-radius:var(--r-md);margin-top:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:10px;">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--accent);letter-spacing:0.04em;text-transform:uppercase;margin-bottom:4px;">Proposed Action · ${escapeHtml(a.type)}</div>
            <div style="font-size:14px;color:var(--ink);font-weight:600;line-height:1.4;">${escapeHtml(a.summary || '')}</div>
          </div>
        </div>
        <details style="margin-top:8px;">
          <summary style="font-size:11px;color:var(--text-3);cursor:pointer;">View details</summary>
          <pre style="font-family:var(--mono);font-size:11px;background:var(--bg);padding:10px 12px;border-radius:6px;margin-top:6px;overflow-x:auto;color:var(--text-2);max-height:240px;overflow-y:auto;">${escapeHtml(JSON.stringify(a.params, null, 2))}</pre>
        </details>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button class="btn sm" onclick="window.HardcapApp.confirmAction(${idx}, ${i})">Confirm</button>
          <button class="btn ghost sm" onclick="window.HardcapApp.rejectAction(${idx}, ${i})">Reject</button>
        </div>
      </div>`;
    }).join('');
  }

  return `
    <div style="display:flex;justify-content:flex-start;">
      <div style="max-width:88%;">
        <div style="background:var(--bg-2);color:var(--text);padding:14px 18px;border-radius:18px 18px 18px 4px;font-size:14px;line-height:1.6;white-space:pre-wrap;">
          ${cleanText ? formatChatText(cleanText) : '<em style="color:var(--text-3);">(no text)</em>'}
        </div>
        ${actionBlocks}
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Light formatting: bold for **text**, code spans for `text`, preserve newlines
function formatChatText(text) {
  let out = escapeHtml(text);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/`([^`]+)`/g, '<code style="font-family:var(--mono);background:var(--surface);padding:1px 5px;border-radius:3px;font-size:12px;">$1</code>');
  return out;
}

async function sendChatMessage(state) {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const userMessage = input.value.trim();
  if (!userMessage) return;

  const chat = window.HardcapChat.loadChat();

  // Add user message
  chat.messages.push({ role: 'user', content: userMessage, timestamp: new Date().toISOString() });
  window.HardcapChat.saveChat(chat);
  renderChatMessages(chat.messages);
  input.value = '';
  input.disabled = true;
  sendBtn.disabled = true;
  sendBtn.textContent = 'Thinking…';

  // Show typing indicator
  const container = document.getElementById('chat-messages');
  const typingEl = document.createElement('div');
  typingEl.id = 'chat-typing';
  typingEl.style.cssText = 'display:flex;justify-content:flex-start;';
  typingEl.innerHTML = `<div style="background:var(--bg-2);padding:14px 18px;border-radius:18px 18px 18px 4px;color:var(--text-3);font-size:13px;font-style:italic;">Claude is thinking…</div>`;
  container.appendChild(typingEl);
  container.scrollTop = container.scrollHeight;

  try {
    const result = await window.HardcapChat.sendMessage(state, userMessage, chat.messages.slice(0, -1));
    document.getElementById('chat-typing')?.remove();

    if (result.error) {
      chat.messages.push({
        role: 'assistant',
        content: `⚠ Error: ${result.error}`,
        displayText: `⚠ Error: ${result.error}`,
        timestamp: new Date().toISOString(),
      });
    } else {
      const actions = window.HardcapChat.parseActions(result.text);
      const displayText = window.HardcapChat.stripActionBlocks(result.text);
      chat.messages.push({
        role: 'assistant',
        content: result.text,
        displayText,
        actions: actions.map(a => ({ ...a, status: 'pending' })),
        usage: result.usage,
        timestamp: new Date().toISOString(),
      });
    }
    window.HardcapChat.saveChat(chat);
    renderChatMessages(chat.messages);
    document.getElementById('chat-msg-count').textContent = chat.messages.length + ' messages';
  } catch (e) {
    document.getElementById('chat-typing')?.remove();
    chat.messages.push({
      role: 'assistant',
      content: `⚠ Unexpected error: ${e.message}`,
      displayText: `⚠ Unexpected error: ${e.message}`,
      timestamp: new Date().toISOString(),
    });
    window.HardcapChat.saveChat(chat);
    renderChatMessages(chat.messages);
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send →';
    input.focus();
  }
}

// ─── RISK PAGE ─────────────────────────────────────────────────────
function renderRisk(state) {
  if (state.positions.length === 0) {
    $('risk-content').innerHTML = `<div class="empty">
      <div class="empty-title">No positions to stress test</div>
      <div class="empty-sub">Drop your CSV in the Import tab.</div>
    </div>`;
    return;
  }

  const stresses = window.HardcapRisk.runAllStressTests(state);
  const factors = window.HardcapRisk.factorExposure(state);
  const downsides = window.HardcapRisk.positionDownside(state);
  const trims = window.HardcapRisk.requiredTrims(state);
  const totalEq = window.HardcapAnalytics.totalEquity(state);
  const totalPort = totalEq + state.cash;

  // Header summary
  const worstStress = stresses[0];
  $('risk-summary').innerHTML = `
    <div class="kpi-row">
      <div class="kpi">
        <div class="kpi-label">Portfolio Value</div>
        <div class="kpi-value">${fmtK(totalPort)}</div>
        <div class="kpi-sub">Equity + cash</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Worst-Case Drawdown</div>
        <div class="kpi-value loss">${fmtPct(worstStress.totalImpactPct)}</div>
        <div class="kpi-sub">${worstStress.scenario.name} · on invested equity (${fmtPct(worstStress.portfolioImpactPct)} of total capital)</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Largest Factor Exposure</div>
        <div class="kpi-value">${factors[0]?.factor || '—'}</div>
        <div class="kpi-sub">${factors[0] ? fmtK(factors[0].dollarExposure) + ' · ' + factors[0].pctOfPortfolio.toFixed(0) + '% of equity' : ''}</div>
      </div>
      <div class="kpi accent">
        <div class="kpi-label">Required Trims</div>
        <div class="kpi-value">${trims.length}</div>
        <div class="kpi-sub">${trims.length === 0 ? 'No caps breached' : trims.filter(t => t.urgency === 'critical').length + ' critical'}</div>
      </div>
    </div>
  `;

  // Stress test table
  $('stress-tbody').innerHTML = stresses.map(s => {
    const sevClass = s.scenario.severity === 'extreme' ? 'loss' :
                     s.scenario.severity === 'high' ? 'loss' :
                     s.scenario.severity === 'medium' ? 'warn' : 'mute';
    return `<tr>
      <td><strong>${s.scenario.name}</strong><div class="tkr-sub">${s.scenario.description}</div></td>
      <td class="cb-amount loss">${fmtSigned(s.totalImpact)}</td>
      <td class="cb-amount loss">${fmtPct(s.totalImpactPct)}</td>
      <td class="cb-amount">${fmtK(s.portfolioAfter)}</td>
      <td><span class="pill pill-${sevClass === 'loss' ? 'loss' : sevClass === 'warn' ? 'warn' : 'neutral'}">${s.scenario.severity}</span></td>
    </tr>`;
  }).join('');

  // Factor exposure
  const maxFactor = Math.max(...factors.map(f => f.pctOfPortfolio));
  $('factor-bars').innerHTML = factors.length === 0
    ? '<div class="mute" style="font-size:13px;">No factor exposures mapped</div>'
    : factors.map(f => {
        const barWidth = maxFactor > 0 ? (f.pctOfPortfolio / maxFactor * 100) : 0;
        const heavy = f.pctOfPortfolio > 50;
        return `<div class="alloc-row">
          <div class="alloc-meta">
            <span class="alloc-name">${f.factor}</span>
            <span class="alloc-pct ${heavy ? 'warn' : ''}">${fmtK(f.dollarExposure)} <span style="font-size:11px;color:var(--text-3);">${f.pctOfPortfolio.toFixed(0)}%</span></span>
          </div>
          <div class="alloc-track">
            <div class="alloc-fill" style="width:${barWidth}%;background:${heavy ? 'var(--loss)' : 'var(--accent)'};"></div>
          </div>
        </div>`;
      }).join('');

  // Position downside table
  $('downside-tbody').innerHTML = downsides.map(d => {
    return `<tr>
      <td><span class="tkr-cell">${d.tkr}</span><div class="tkr-sub">${d.weight.toFixed(1)}% of equity</div></td>
      <td class="cb-amount">${fmtK(d.value)}</td>
      <td class="cb-amount loss">${fmtPct(d.ifZeroPctPortfolio)}</td>
      <td class="cb-amount loss">${fmtSigned(d.worstStressDollar)}</td>
      <td class="cb-amount loss">${fmtPct(d.worstStressPct)}</td>
      <td style="text-align:left;padding-left:12px;font-size:12px;color:var(--text-2);">${d.worstStressScenario?.name || '—'}</td>
    </tr>`;
  }).join('');

  // Required trims
  if (trims.length === 0) {
    $('trim-list').innerHTML = `<div class="empty" style="padding:32px;">
      <div class="empty-title" style="font-size:18px;">No required trims</div>
      <div class="empty-sub">All positions and sectors within caps.</div>
    </div>`;
  } else {
    $('trim-list').innerHTML = trims.map(t => {
      const urgencyClass = t.urgency === 'critical' ? 'loss' : t.urgency === 'high' ? 'warn' : 'neutral';
      return `<div class="deploy-card" style="border-left:3px solid ${t.urgency === 'critical' ? 'var(--loss)' : 'var(--warn)'};">
        <div class="deploy-tier" style="color:${t.urgency === 'critical' ? 'var(--loss)' : 'var(--warn)'};opacity:.4;">!</div>
        <div>
          <div class="row" style="gap:10px;">
            <span class="deploy-tkr">${t.type === 'position' ? t.tkr : t.sector}</span>
            <span class="pill pill-${urgencyClass}">${t.urgency}</span>
            <span class="pill pill-neutral">${t.type === 'position' ? 'Position cap' : 'Sector cap'}</span>
          </div>
          <div class="deploy-name">${t.reason}</div>
          <div class="deploy-rationale">Currently <strong>${t.currentWeight.toFixed(1)}%</strong> · cap is <strong>${t.capWeight}%</strong>${t.trimShares ? ' · trim approximately ' + t.trimShares + ' shares' : ''}</div>
        </div>
        <div class="deploy-amount">
          <div class="deploy-amount-big loss">${fmtK(t.trimDollar)}</div>
          <div class="deploy-amount-shares">over the cap</div>
        </div>
      </div>`;
    }).join('') + `<div style="font-size:12px;color:var(--text-3);line-height:1.6;margin:10px 2px 0;">Measured against the book (capital less the hold-back), the same yardstick as the Deploy tab. The Deploy plan only buys: it stops adding to a name or sector that is over its cap, and new deposits grow the book, which shrinks the overage. Selling is your decision; nothing here does it for you.</div>`;
  }
}

// ─── ALERTS RENDERING ──────────────────────────────────────────────
// Compact alert strip on the overview that surfaces critical issues
// before any other content.
function renderAlerts(state) {
  const alerts = [];
  const trims = window.HardcapRisk.requiredTrims(state);
  const drift = window.HardcapRisk.detectDrift(state);
  const sw = window.HardcapAnalytics.sectorWeights(state);
  const totalEq = window.HardcapAnalytics.totalEquity(state);

  // Required trims
  trims.forEach(t => {
    alerts.push({
      severity: t.urgency,
      title: t.type === 'position' ? `${t.tkr} concentration ${t.currentWeight.toFixed(1)}%` : `${t.sector} sector ${t.currentWeight.toFixed(1)}%`,
      detail: `Trim ${fmtK(t.trimDollar)} to return below ${t.capWeight}% cap`,
      action: 'See Risk tab',
    });
  });

  // Drift detection
  if (drift && drift.sectorDrifts.length > 0) {
    drift.sectorDrifts.forEach(d => {
      if (d.direction === 'diverging' && Math.abs(d.delta) >= 2) {
        alerts.push({
          severity: 'medium',
          title: `${d.sector} drifting ${d.delta > 0 ? 'higher' : 'lower'}`,
          detail: `Moved ${fmtPct(d.delta)} since ${d.fromDate} — diverging from ${d.target?.min}–${d.target?.max}% target`,
          action: 'Rebalance',
        });
      }
    });
  }

  // Sector underweight alerts
  Object.keys(window.SECTOR_TARGETS).forEach(sector => {
    const tgt = window.SECTOR_TARGETS[sector];
    const cur = sw[sector] || 0;
    if (tgt.priority === 1 && cur < tgt.min * 0.4) {
      alerts.push({
        severity: 'high',
        title: `${sector} critically underweight at ${cur.toFixed(1)}%`,
        detail: `Strategic target ${tgt.min}–${tgt.max}% — gap of ${fmtK((tgt.min - cur) / 100 * totalEq)} to floor`,
        action: 'See Deploy',
      });
    }
  });

  // Stale thesis alerts — flag tickers held with reviews >120 days old
  const today = new Date();
  const daysAgo = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return Math.floor((today - d) / 86400000);
  };
  const heldTkrs = new Set((state.positions || []).map(p => p.tkr));
  const staleHoldings = [];
  Object.keys(state.universe || {}).forEach(tkr => {
    if (!heldTkrs.has(tkr)) return;
    const u = state.universe[tkr];
    const t = u?.thesis;
    if (!t) return;
    const qAge = daysAgo(t.quarterlyReviewedAt);
    const aAge = daysAgo(t.anchorReviewed || t.lastReviewed);
    // Treat as stale if no quarterly review and anchor >180d old, OR if quarterly is >120d old
    if ((qAge == null && aAge != null && aAge > 180) || (qAge != null && qAge > 120)) {
      staleHoldings.push({ tkr, qAge, aAge });
    }
  });
  if (staleHoldings.length > 0) {
    const tkrList = staleHoldings.slice(0, 3).map(s => s.tkr).join(', ');
    const more = staleHoldings.length > 3 ? ` +${staleHoldings.length - 3} more` : '';
    alerts.push({
      severity: 'medium',
      title: `${staleHoldings.length} thesis${staleHoldings.length === 1 ? '' : 'es'} stale`,
      detail: `${tkrList}${more} — ask Claude to refresh the 90-day review`,
      action: 'Ask Claude',
    });
  }

  if (alerts.length === 0) {
    $('alerts-strip').innerHTML = '';
    return;
  }

  // Sort by severity
  const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  alerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

  const sevColor = (s) => s === 'critical' ? 'var(--loss)' : s === 'high' ? 'var(--loss)' : s === 'medium' ? 'var(--warn)' : 'var(--text-3)';
  const sevBg = (s) => s === 'critical' ? 'var(--loss-soft)' : s === 'high' ? 'var(--loss-soft)' : s === 'medium' ? 'var(--warn-soft)' : 'var(--bg-2)';

  $('alerts-strip').innerHTML = `
    <div style="margin-bottom:32px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <span class="h-eyebrow" style="color:var(--loss);">⚠ ${alerts.length} Active Alert${alerts.length === 1 ? '' : 's'}</span>
        <div style="flex:1;height:1px;background:var(--rule-2);"></div>
      </div>
      ${alerts.slice(0, 4).map(a => `
        <div style="display:flex;align-items:center;gap:16px;padding:14px 18px;background:${sevBg(a.severity)};border-radius:var(--r-md);margin-bottom:8px;border-left:3px solid ${sevColor(a.severity)};">
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:600;color:var(--ink);">${a.title}</div>
            <div style="font-size:13px;color:var(--text-2);margin-top:3px;">${a.detail}</div>
          </div>
          <div style="font-size:12px;color:${sevColor(a.severity)};font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">${a.severity}</div>
        </div>
      `).join('')}
      ${alerts.length > 4 ? `<div style="font-size:12px;color:var(--text-3);text-align:right;margin-top:6px;">+ ${alerts.length - 4} more — see Risk tab</div>` : ''}
    </div>
  `;
}
