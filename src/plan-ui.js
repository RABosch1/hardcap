// ═══════════════════════════════════════════════════════════════════
// HARDCAP — DEPLOY PLAN UI
// Renders the rules engine's plan, the inputs it reads, the rules
// themselves, the holdings scorecard, the deployment journal and the
// account picker. Uses the helpers defined in the rendering layer.
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const el = (id) => document.getElementById(id);
  const esc = (s) => escapeHtml(s);
  const usd = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');
  const p1 = (n) => (n == null || !isFinite(n) ? '—' : n.toFixed(1) + '%');
  const SIGNALS = ['Strong Buy', 'Accumulate', 'Hold', 'Watch', 'Trim', 'Sell'];
  const monthName = (ym) => {
    const p = String(ym || '').split('-');
    return p[1] ? new Date(+p[0], +p[1] - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : String(ym || '');
  };
  const shortDate = (iso) => {
    if (!iso) return '';
    const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
    return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const note = (kind, html) => `<div class="plan-note ${kind}">${html}</div>`;
  const srcTag = (src) => src === 'snapshot' ? ' <span class="src-tag">snap</span>' : src === 'manual' ? ' <span class="src-tag">typed</span>' : src === 'live' ? ' <span class="src-tag live">live</span>' : '';

  let lastPlan = null;

  // ─── THE PLAN ──────────────────────────────────────────────────────
  // opts.amount — the number typed into "Deploy this run", or null for the rule amount
  function render(state, opts) {
    opts = opts || {};
    if (!el('plan-results')) return null;
    const P = lastPlan = window.HardcapEngine.plan(state, opts.amount != null ? { amount: opts.amount } : {});
    const r = P.rules;

    // hero
    const modeCls = P.mode.key === 'normal' ? 'pill-gain' : P.mode.key === 'correction' ? 'pill-warn' : 'pill-loss';
    const pill = el('plan-mode-pill');
    if (pill) { pill.className = 'pill ' + modeCls; pill.textContent = P.mode.label + (/market/i.test(P.mode.label) ? '' : P.mode.key === 'normal' ? ' market' : '') + ' · S&P ' + P.mode.ddPct.toFixed(1) + '% off high'; }
    setText('plan-hold', usd(P.hold));
    setText('plan-hold-sub', P.holdPct + '% of capital · ' + P.mode.label.toLowerCase());
    setText('plan-excess', usd(P.excess));
    setText('plan-excess-sub', P.excess > 0 ? 'cash above the hold-back' : 'cash is at or under the hold-back');
    setText('deploy-use-rule-amount', usd(P.budgetRule));
    setText('deploy-use-cash-amount', usd(P.excess));
    const input = el('deploy-input');
    if (input && document.activeElement !== input) input.value = Math.round(P.budget);
    const sched = P.mode.key === 'normal'
      ? (P.runsLeft > 1 ? '1 of ' + P.runsLeft + ' runs through ' + monthName(r.finishBy) : 'schedule finished: all dry powder')
      : P.mode.label.toLowerCase() + ' pace: ' + Math.round(P.share * 100) + '% of dry powder';
    setText('plan-budget-sub', P.override ? 'Your amount. The rule says ' + usd(P.budgetRule) + '.' : 'Rule: ' + sched);
    setText('plan-explain', 'Weights are measured against a book of ' + usd(P.book) + ' (capital less the hold-back).');

    el('plan-results').innerHTML = resultsHtml(state, P);
    // A table you are typing in is never rebuilt under you (that would drop the cursor
    // mid-tab): opts.keep names the panel the change came from, and its computed cells
    // are refreshed in place instead.
    const inputsHost = el('plan-inputs');
    if (inputsHost) {
      if (opts.keep === 'inputs' || inputsHost.contains(document.activeElement)) refreshInputStatus(P);
      else inputsHost.innerHTML = inputsHtml(state, P);
    }
    const rulesHost = el('plan-rules');
    if (rulesHost) {
      if (opts.keep === 'rules' || rulesHost.contains(document.activeElement)) refreshRulesStatus(state, P);
      else rulesHost.innerHTML = rulesHtml(state, P);
    }
    return P;
  }

  function resultsHtml(state, P) {
    const r = P.rules;
    if (P.total <= 0) {
      return `<div class="empty" style="padding:28px;"><div class="empty-title" style="font-size:18px;">No portfolio loaded</div><div class="empty-sub">Drop your Fidelity CSV in the Import tab.</div></div>`;
    }
    const notes = [];
    if (P.excess <= 0 && !P.override) notes.push(note('info', `Cash is ${usd(P.cash)}, at or below the ${P.holdPct}% hold-back (${usd(P.hold)}). Nothing to deploy until new cash arrives or the market mode changes.`));
    const stale = P.staleZones;
    if (stale.length) {
      const names = stale.map(s => s.tkr).join(', ');
      notes.push(note('warn', r.priceMode === 'strict'
        ? `<strong>Strict mode is blocking ${stale.length} name${stale.length === 1 ? '' : 's'}.</strong> Their buy zones are placeholders or more than ${r.staleZoneDays} days old: ${esc(names)}. Review them in the table below, or run a Forensic IC and apply its proposals.`
        : `<strong>Price is not steering ${stale.length} name${stale.length === 1 ? '' : 's'}.</strong> Their buy zones are placeholders or more than ${r.staleZoneDays} days old, so they are sized on sector gap and conviction alone: ${esc(names)}. Review the zones below, or run a Forensic IC and apply its proposals.`));
    }
    const snapBuys = P.buys.filter(b => b.priceSrc === 'snapshot').map(b => b.tkr);
    if (snapBuys.length) notes.push(note('info', `${esc(snapBuys.join(', '))} ${snapBuys.length === 1 ? 'is' : 'are'} priced from the ${shortDate(window.RESEARCH_SNAPSHOT.asOf)} snapshot, not a live quote. Refresh quotes (top right) before placing orders.`));
    P.overCap.forEach(o => notes.push(note('warn', `<strong>${esc(o.tkr)}</strong> is ${o.pct.toFixed(1)}% of the book, above the ${r.capPct}% cap by ${usd(o.over)}. The engine will not add to it and never sells.`)));
    if (P.untracked.length) notes.push(note('info', `Not in your universe: ${esc(P.untracked.map(u => u.tkr).join(', '))} (${usd(P.untracked.reduce((a, u) => a + u.value, 0))}). Counted in capital, never bought. Add a thesis in the Universe tab to bring a name in.`));
    if (P.budget - P.spend > Math.max(50, r.minOrder / 2) && P.spend > 0) notes.push(note('info', `${usd(P.budget - P.spend)} of this run's budget stays in cash: no eligible name has room for it. The sector lines below say why.`));

    let table;
    if (!P.buys.length) {
      table = `<div class="empty" style="padding:26px 16px;"><div class="empty-title" style="font-size:17px;">No buys this run</div><div class="empty-sub">${P.budget < r.minOrder ? 'The budget is under the $' + r.minOrder + ' minimum order.' : 'Nothing eligible has room. See the sector lines below for what is holding each one back.'}</div></div>`;
    } else {
      const rows = P.buys.map(b => `<tr>
          <td><div class="tkr-cell">${esc(b.tkr)} ${b.held ? '' : '<span class="pill pill-accent" style="font-size:9px;padding:2px 7px;margin-left:4px;">New</span>'}</div><div class="tkr-sub">${esc(b.name)}</div></td>
          <td style="text-align:left;font-size:13px;color:var(--text-2);">${esc(b.sector)}</td>
          <td><span class="plan-buy">${usd(b.buy)}</span></td>
          <td class="cb-amount" style="font-size:13px;">${b.buyShares != null ? b.buyShares.toFixed(3) + ' sh' : '—'}<div class="tkr-sub">@ ${fmt(b.price)}${srcTag(b.priceSrc)}</div></td>
          <td class="cb-amount" style="font-size:13px;">${b.curPct.toFixed(1)}% → ${b.afterPct.toFixed(1)}%</td>
          <td style="text-align:left;padding-left:14px;"><div class="plan-chips">${b.reasons.map(x => `<span class="plan-chip${/tilt off|No thesis|snapshot|days old/.test(x) ? ' dim' : ''}">${esc(x)}</span>`).join('')}</div></td>
        </tr>`).join('');
      table = `<div style="overflow-x:auto;"><table class="tbl plan-tbl">
        <thead><tr><th>Buy</th><th style="text-align:left;">Sector</th><th>Amount</th><th>About</th><th>Weight of book</th><th style="text-align:left;padding-left:14px;">Why</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="2">Total this run</td><td><span class="plan-buy">${usd(P.spend)}</span></td><td colspan="3" style="text-align:left;padding-left:14px;font-weight:500;color:var(--text-2);">Cash after: ${usd(P.cashAfter)} (${P.cashAfterPct.toFixed(1)}% of capital) · ${P.buys.filter(b => !b.held).length} new position${P.buys.filter(b => !b.held).length === 1 ? '' : 's'}</td></tr></tfoot>
      </table></div>
      <div class="plan-actions">
        <button class="btn ghost sm" id="plan-copy" type="button">Copy buy list</button>
        <button class="btn ghost sm" id="plan-log" type="button">Log plan to journal</button>
        <span style="flex:1"></span>
        <span style="font-size:12px;color:var(--text-3);">Place these at Fidelity as dollar-amount orders. Nothing here trades for you.</span>
      </div>`;
    }

    // sectors after this run
    const maxPct = Math.max(40, Math.ceil(Math.max.apply(null, P.coreSectors.map(s => Math.max(s.curPct || 0, s.afterPct || 0, s.targetPct, s.max))) / 10) * 10);
    const w = (x) => Math.min(100, Math.max(0, x / maxPct * 100));
    const sectors = P.coreSectors.map(s => {
      let line = '';
      const benchOnWatch = s.blockers.filter(b => b.status === 'watch');
      if (s.remaining > 1) {
        const why = (b) => esc(b.tkr) + ' (' + esc(b.reason.charAt(0).toLowerCase() + b.reason.slice(1)) + ')';
        // buy-rated names on your list that would fill an open slot if you pinned them
        const bench = s.bench || [];
        const benchTxt = (s.openSlots > 0 && bench.length)
          ? ` ${s.openSlots} open slot${s.openSlots === 1 ? '' : 's'}: ${esc(bench.slice(0, 4).map(b => b.tkr).join(', '))}${bench.length > 4 ? ' and ' + (bench.length - 4) + ' more' : ''} ${bench.length === 1 ? 'is' : 'are'} rated a buy on your list but not pinned. Tick Pin on a name below to let the engine start a position in it.`
          : '';
        if (!s.fundable) {
          const allWatch = s.blockers.length > 0 && benchOnWatch.length === s.blockers.length;
          line = `<div class="alloc-note warn">Nothing can be bought here yet. ${allWatch
            ? esc(s.blockers.map(b => b.tkr).join(', ')) + (s.blockers.length === 1 ? ' is' : ' are') + ' on Watch. To start one, set its signal to Accumulate and tick Pin in the table below (a conviction and a buy zone sharpen the sizing), or run a Forensic IC for a data-backed view first.'
            : s.blockers.length ? s.blockers.map(why).join('; ') + '.' : (bench.length ? '' : 'No name in your universe sits in this sector.')}${benchTxt}</div>`;
        } else if (s.blockers.length) {
          line = `<div class="alloc-note" style="color:var(--text-3);">${usd(s.remaining)} still to go. Not buying: ${s.blockers.map(b => esc(b.tkr) + ' (' + esc(b.reason.charAt(0).toLowerCase() + b.reason.slice(1)) + ')').join('; ')}.${benchTxt}</div>`;
        } else {
          line = `<div class="alloc-note" style="color:var(--text-3);">${usd(s.remaining)} still to go in later runs.${benchTxt}</div>`;
        }
      } else if (s.cur > s.target + 1) {
        line = `<div class="alloc-note" style="color:var(--text-3);">Above target by ${usd(s.cur - s.target)}. No new money; nothing is sold.</div>`;
      }
      const lo = Math.min(s.curPct, s.afterPct), hi = Math.max(s.curPct, s.afterPct);
      return `<div class="alloc-row">
        <div class="alloc-meta">
          <span class="alloc-name">${esc(s.name)} <span class="mute" style="font-size:11px;">band ${s.min}–${s.max}% · ${s.slots} slot${s.slots === 1 ? '' : 's'}</span></span>
          <span class="alloc-pct" style="font-size:13px;">${(s.curPct || 0).toFixed(1)}%${s.bought > 0 ? ' → ' + s.afterPct.toFixed(1) + '%' : ''} <span style="font-size:11px;color:var(--text-3);font-weight:500;">target ${s.targetPct.toFixed(1)}%</span></span>
        </div>
        <div class="alloc-track" style="overflow:visible;">
          <div class="alloc-fill" style="position:absolute;left:0;top:0;width:${w(hi)}%;background:${s.color};opacity:.38;"></div>
          <div class="alloc-fill" style="position:absolute;left:0;top:0;width:${w(lo)}%;background:${s.color};"></div>
          <div class="alloc-target" style="left:${w(s.targetPct)}%;"></div>
        </div>
        ${line}
      </div>`;
    }).join('');

    return `${notes.length ? '<div class="plan-notes">' + notes.join('') + '</div>' : ''}
      ${table}
      <div class="plan-sub-h">Sectors after this run <span>solid = held now · lighter = this run's buys · mark = engine target</span></div>
      <div class="plan-sectors">${sectors}</div>`;
  }

  // ─── INPUTS THE ENGINE READS ───────────────────────────────────────
  function inputRows(P) {
    const order = {};
    P.sectors.forEach((s, i) => { order[s.name] = (s.core ? 0 : 100) + i; });
    return P.rows.filter(r => r.inUniverse && (r.core || r.held))
      .sort((a, b) => (order[a.sector] - order[b.sector]) || (b.held - a.held) || ((b.conviction || 0) - (a.conviction || 0)));
  }
  function statusText(r) {
    if (r.status === 'buy') return 'Buying ' + usd(r.buy);
    return r.statusText || '';
  }
  function reviewedText(r) {
    const z = r.zone;
    if (!z.has) return 'no zone';
    if (z.placeholder) return 'placeholder';
    if (z.ageDays == null) return 'never';
    return z.ageDays === 0 ? 'today' : z.ageDays + 'd ago';
  }
  function inputsHtml(state, P) {
    const rows = inputRows(P);
    if (!rows.length) return '<div class="mute" style="font-size:13px;padding:8px 0;">No names in your universe yet.</div>';
    let lastSector = null;
    const body = rows.map(r => {
      const u = state.universe[r.tkr] || {};
      const z = u.buyZone || {};
      const head = r.sector !== lastSector ? `<tr class="pi-sec"><td colspan="11">${esc(r.sector)}</td></tr>` : '';
      lastSector = r.sector;
      const manual = !r.held && r.priceSrc !== 'live';
      const priceCell = r.held
        ? `<span class="cb-amount" id="pi-price-${esc(r.tkr)}">${r.price ? fmt(r.price) : '—'}</span>`
        : `<span id="pi-price-${esc(r.tkr)}">${manual
            ? `<input class="input mono pi-in" type="number" step="any" min="0" id="pi-${esc(r.tkr)}-price" data-tkr="${esc(r.tkr)}" data-f="price" value="${r.price && r.priceSrc === 'manual' ? r.price : ''}" placeholder="${r.price ? r.price.toFixed(2) : 'price'}" aria-label="${esc(r.tkr)} price" style="width:86px;">`
            : `<span class="cb-amount">${fmt(r.price)}</span>`}${srcTag(r.priceSrc)}</span>`;
      const zin = (f, v) => `<input class="input mono pi-in" type="number" step="any" min="0" id="pi-${esc(r.tkr)}-${f}" data-tkr="${esc(r.tkr)}" data-f="${f}" value="${v || ''}" aria-label="${esc(r.tkr)} zone ${f}" style="width:74px;">`;
      return head + `<tr>
        <td><span class="tkr-cell">${esc(r.tkr)}</span>${r.held ? ' <span class="pill pill-gain" style="font-size:9px;padding:1px 6px;">Held</span>' : ''}<div class="tkr-sub" style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(r.name)}</div></td>
        <td><select class="input pi-in" id="pi-${esc(r.tkr)}-signal" data-tkr="${esc(r.tkr)}" data-f="signal" aria-label="${esc(r.tkr)} signal" style="width:122px;padding-top:6px;padding-bottom:6px;">${SIGNALS.map(s => `<option${u.signal === s ? ' selected' : ''}>${s}</option>`).join('')}</select></td>
        <td><input class="input mono pi-in" type="number" min="0" max="100" step="1" id="pi-${esc(r.tkr)}-conviction" data-tkr="${esc(r.tkr)}" data-f="conviction" value="${u.conviction != null ? u.conviction : ''}" aria-label="${esc(r.tkr)} conviction" style="width:60px;"></td>
        <td>${priceCell}</td>
        <td>${zin('low', z.low)}</td><td>${zin('fair', z.fair)}</td><td>${zin('high', z.high)}</td>
        <td style="white-space:nowrap;"><span id="pi-rev-${esc(r.tkr)}" class="${r.zone.fresh ? 'gain' : 'warn'}" style="font-size:12px;font-weight:500;">${reviewedText(r)}</span> <button class="btn ghost xs pi-ok" type="button" data-tkr="${esc(r.tkr)}" data-act="reviewed" title="The zone is still right as of today" style="padding:3px 8px;">✓</button></td>
        <td><input type="checkbox" class="pi-in" id="pi-${esc(r.tkr)}-pinned" data-tkr="${esc(r.tkr)}" data-f="pinned" ${u.pinned ? 'checked' : ''} aria-label="Pin ${esc(r.tkr)}"></td>
        <td><input type="checkbox" class="pi-in" id="pi-${esc(r.tkr)}-noBuy" data-tkr="${esc(r.tkr)}" data-f="noBuy" ${u.noBuy ? 'checked' : ''} aria-label="Never buy ${esc(r.tkr)}"></td>
        <td style="text-align:left;padding-left:12px;font-size:12px;color:var(--text-2);min-width:150px;" id="pi-status-${esc(r.tkr)}">${esc(statusText(r))}</td>
      </tr>`;
    }).join('');
    return `<div style="font-size:12px;color:var(--text-2);line-height:1.55;margin:4px 0 12px;max-width:76ch;">
        These are your calls, and the engine follows them exactly. <strong>Signal</strong> decides who can get money (Strong Buy and Accumulate only). <strong>Conviction</strong> sets each name's share of its sector. A <strong>buy zone</strong> reviewed in the last ${P.rules.staleZoneDays} days tilts the size; tick ✓ if a zone is still right today. <strong>Pin</strong> is how you tell the engine it may open a position in a name you do not hold yet${P.rules.newNames === 'conviction' ? ' (your rule also lets any buy-rated name fill an open slot, best conviction first)' : '; without a pin, a name stays on the bench however it is rated'}.
      </div>
      <div style="overflow-x:auto;"><table class="tbl pi-tbl">
        <thead><tr><th>Name</th><th>Signal</th><th>Conv.</th><th>Price</th><th>Zone low</th><th>Fair</th><th>High</th><th>Zone reviewed</th><th>Pin</th><th>Never buy</th><th style="text-align:left;padding-left:12px;">This run</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>`;
  }
  function refreshInputStatus(P) {
    P.rows.forEach(r => {
      const s = el('pi-status-' + r.tkr);
      if (s) s.textContent = statusText(r);
      const v = el('pi-rev-' + r.tkr);
      if (v) { v.textContent = reviewedText(r); v.className = r.zone.fresh ? 'gain' : 'warn'; }
    });
  }

  // ─── RULES ─────────────────────────────────────────────────────────
  const bandTarget = (t, s) => t.min > 0 && s ? s.targetPct.toFixed(1) + '%' : '<span class="mute">optional</span>';
  const bandNow = (s, P) => s ? (s.core ? (s.curPct || 0).toFixed(1) + '%' : (P.book > 0 ? (s.cur / P.book * 100).toFixed(1) + '%' : '—')) : '—';
  const gaugeText = (m) => m && m.asOf ? `${m.manual ? 'Typed in' : (m.source || 'Set')} · ${shortDate(m.asOf)}` : 'Not set: treated as a normal market';
  function refreshRulesStatus(state, P) {
    Object.keys(window.SECTOR_TARGETS).forEach(name => {
      const t = window.SECTOR_TARGETS[name], sid = slug(name);
      const s = P.sectors.filter(x => x.name === name)[0];
      const a = el('band-' + sid + '-target'), b = el('band-' + sid + '-now');
      if (a) a.innerHTML = bandTarget(t, s);
      if (b) b.innerHTML = bandNow(s, P);
      // an edit to one edge can drag the other with it
      const mn = el('band-' + sid + '-min'), mx = el('band-' + sid + '-max');
      if (mn && document.activeElement !== mn) mn.value = t.min;
      if (mx && document.activeElement !== mx) mx.value = t.max;
    });
    const g = el('rule-gauge-src');
    if (g) g.textContent = gaugeText(state.market || {});
    const dd = el('rule-ddPct');
    if (dd && document.activeElement !== dd && state.market && state.market.ddPct != null) dd.value = state.market.ddPct;
  }
  function rulesHtml(state, P) {
    const r = P.rules;
    const m = state.market || {};
    const f = (key, label, extra) => `<label class="rule-f" for="rule-${key}"><span>${label}</span><input class="input mono" id="rule-${key}" data-rule="${key}" ${extra || 'type="number" step="any" min="0"'} value="${esc(r[key])}"></label>`;
    const bands = Object.keys(window.SECTOR_TARGETS).map(name => {
      const t = window.SECTOR_TARGETS[name];
      const s = P.sectors.filter(x => x.name === name)[0];
      const sid = slug(name);
      return `<tr>
        <td>${esc(name)}</td>
        <td><input class="input mono" type="number" min="0" max="100" step="1" id="band-${sid}-min" data-band="${esc(name)}" data-edge="min" value="${t.min}" aria-label="${esc(name)} band floor" style="width:66px;"></td>
        <td><input class="input mono" type="number" min="0" max="100" step="1" id="band-${sid}-max" data-band="${esc(name)}" data-edge="max" value="${t.max}" aria-label="${esc(name)} band ceiling" style="width:66px;"></td>
        <td class="cb-amount" style="font-size:13px;" id="band-${sid}-target">${bandTarget(t, s)}</td>
        <td class="cb-amount" style="font-size:13px;" id="band-${sid}-now">${bandNow(s, P)}</td>
      </tr>`;
    }).join('');
    const gaugeSrc = gaugeText(m);
    return `
      <div class="rule-grid">
        ${f('cashNormal', 'Hold back in a normal market (% of capital)')}
        ${f('cashCorrection', 'Hold back in a correction, 10%+ off high (%)')}
        ${f('cashBear', 'Hold back in a bear market, 20%+ off high (%)')}
        ${f('cashCrash', 'Hold back in a crash, 30%+ off high (%)')}
        ${f('finishBy', 'Have the starting backlog deployed by', 'type="month"')}
        ${f('capPct', 'Most any one stock can be (% of book)')}
        ${f('maxPositions', 'Most positions to hold', 'type="number" step="1" min="1"')}
        ${f('minOrder', 'Smallest single order ($)')}
        ${f('staleZoneDays', 'A buy zone goes stale after (days)', 'type="number" step="1" min="1"')}
        <label class="rule-f" for="rule-priceMode"><span>When a current zone says a name is expensive</span>
          <select class="input" id="rule-priceMode" data-rule="priceMode">
            <option value="tilt"${r.priceMode === 'tilt' ? ' selected' : ''}>Tilt: buy less of it</option>
            <option value="strict"${r.priceMode === 'strict' ? ' selected' : ''}>Strict: buy none above fair</option>
          </select></label>
        <label class="rule-f" for="rule-newNames"><span>New positions may open in</span>
          <select class="input" id="rule-newNames" data-rule="newNames">
            <option value="pinned"${r.newNames === 'pinned' ? ' selected' : ''}>Only names I pin</option>
            <option value="conviction"${r.newNames === 'conviction' ? ' selected' : ''}>Any buy-rated name, by conviction</option>
          </select></label>
        <label class="rule-f" for="rule-ddPct"><span>S&amp;P 500 below its 52-week high (%)</span>
          <input class="input mono" id="rule-ddPct" data-market="ddPct" type="number" step="0.1" min="0" max="100" value="${m.ddPct != null ? m.ddPct : 0}"></label>
        <div class="rule-f"><span>Where that reading comes from</span>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;min-height:40px;">
            <span style="font-size:12px;color:var(--text-2);" id="rule-gauge-src">${esc(gaugeSrc)}</span>
            <button class="btn ghost xs" type="button" id="rule-gauge-refresh">Read from data feed</button>
          </div></div>
      </div>
      <div class="plan-sub-h" style="margin-top:20px;">Sector bands <span>a floor above zero makes a sector core; the engine fills core sectors toward the middle of the band, scaled so they add up to the whole book</span></div>
      <div style="overflow-x:auto;"><table class="tbl pi-tbl" style="max-width:640px;">
        <thead><tr><th>Sector</th><th>Floor %</th><th>Ceiling %</th><th>Engine target</th><th>Now</th></tr></thead>
        <tbody>${bands}</tbody>
      </table></div>
      <details class="plan-how"><summary>How the engine decides</summary>
        <div>
          <p><strong>How much.</strong> Cash above the hold-back is dry powder. In a normal market each monthly run releases dry powder divided by the runs left on your schedule, so new cash you add is spread the same way. Type any amount in "Deploy this run" to override it.</p>
          <p><strong>Falling markets.</strong> The hold-back steps down as the S&amp;P 500 falls further below its 52-week high, which turns more of your cash into dry powder, and each run releases at least a third of it in a correction and at least half in a bear market or crash.</p>
          <p><strong>Where.</strong> Each core sector has a target share of the book. Positions are shared out across sectors in proportion to those targets. Names you already hold keep their slots, and an open slot goes to a name you pinned. A name you have not pinned is never opened, however it is rated, unless you set "New positions may open in" to any buy-rated name. Inside a sector each slot name gets a target weight in proportion to its conviction. The run's budget is then split across every eligible name in proportion to its dollar gap.</p>
          <p><strong>Price.</strong> A buy zone you reviewed recently tilts a name's size: 1.5× below the zone low, 1× in the zone, 0.6× above fair value, 0.3× above the zone high. Money a pricey name gives up is offered to the cheap ones; what is left waits in cash. A stale or placeholder zone does nothing.</p>
          <p><strong>Limits.</strong> Nothing goes above the single-stock cap, no new position opens beyond the position limit, buys under the smallest order are dropped and their share reallocated, and nothing is ever sold.</p>
        </div></details>`;
  }

  // ─── WHERE YOUR HOLDINGS STAND ─────────────────────────────────────
  function cell(x, fmtFn) {
    if (!x || x.v == null) return '<span class="mute">—</span>';
    const t = fmtFn ? fmtFn(x.v) : x.v;
    if (x.src === 'seed') return `<span class="sc-seed" title="Typed in from memory in May 2026 and never verified">${t}<sup>seed</sup></span>`;
    if (x.src === 'snap') return `<span title="Research snapshot ${window.RESEARCH_SNAPSHOT.asOf}, approximate">${t}<sup>snap</sup></span>`;
    return `<span title="Data feed">${t}</span>`;
  }
  function renderScorecard(state) {
    const host = el('score-body');
    if (!host) return;
    const P = lastPlan || window.HardcapEngine.plan(state);
    const cards = window.HardcapScore.forPlan(state, P, r => r.held && r.inUniverse).sort((a, b) => (b.position.value - a.position.value));
    if (!cards.length) {
      host.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:36px;color:var(--mute);">No positions yet</td></tr>';
      setText('score-asof', '—'); setHTML('score-foot', '');
      return;
    }
    host.innerHTML = cards.map(c => {
      const z = c.zone;
      const zoneTxt = z && z.status ? `${z.status}${z.pctVsFair != null ? ' · ' + (z.pctVsFair >= 0 ? '+' : '') + z.pctVsFair.toFixed(0) + '% vs fair' : ''}` : 'No zone';
      const zoneCls = !z || !z.status ? 'mute' : !z.current ? 'mute' : (z.status === 'Below buy zone' || z.status === 'In buy zone') ? 'gain' : 'warn';
      const soft = c.data.softSnap && c.m.fwdPe.src === 'snap';
      const pe = c.m.fwdPe.v != null
        ? cell(c.m.fwdPe, v => (soft ? '~' : '') + v.toFixed(1) + 'x') + (c.d.peVsOwnPct != null ? `<div class="tkr-sub">${Math.round(c.d.peVsOwnPct) > 0 ? '+' : ''}${Math.round(c.d.peVsOwnPct)}% vs 5-yr avg ${c.m.pe5.v.toFixed(1)}x</div>` : '')
        : '<span class="mute">—</span>';
      const yld = c.m.divYield.v != null ? cell(c.m.divYield, v => v.toFixed(1) + '%') : '<span class="mute">—</span>';
      const flags = c.flags.map(f => `<span class="sc-flag ${f.level}">${esc(f.text)}</span>`).join('');
      return `<tr class="sc-main">
          <td><div class="tkr-cell">${esc(c.tkr)}</div><div class="tkr-sub">${p1(c.position.weightOfBookPct)} of book · ${c.position.gainLossPct != null ? '<span class="' + colorClass(c.position.gainLossPct) + '">' + (c.position.gainLossPct >= 0 ? '+' : '') + c.position.gainLossPct.toFixed(1) + '%</span> vs cost' : ''}</div></td>
          <td class="cb-amount">${c.price ? fmt(c.price) : '—'}<div class="tkr-sub ${zoneCls}">${esc(zoneTxt)}${z && z.status && !z.current ? ' (stale)' : ''}</div></td>
          <td class="cb-amount ${c.d.offHighPct != null && c.d.offHighPct <= -20 ? 'warn' : ''}">${c.d.offHighPct != null ? c.d.offHighPct.toFixed(0) + '%' : '<span class="mute">—</span>'}${c.m.hi52.v != null ? `<div class="tkr-sub">high ${fmt(c.m.hi52.v)}</div>` : ''}</td>
          <td class="cb-amount">${pe}</td>
          <td class="cb-amount">${yld}</td>
          <td class="cb-amount">${cell(c.m.revGrowth, v => (v >= 0 ? '+' : '') + v + '%')}${c.m.rev5yCagr.v != null ? `<div class="tkr-sub">5-yr ${c.m.rev5yCagr.v >= 0 ? '+' : ''}${c.m.rev5yCagr.v}%/yr</div>` : ''}</td>
          <td class="cb-amount">${cell(c.m.opMargin, v => v + '%')}${c.m.opMargin5.v != null ? `<div class="tkr-sub">5-yr avg ${c.m.opMargin5.v}%</div>` : ''}</td>
          <td class="cb-amount">${cell(c.m.debtEbitda, v => v + 'x')}</td>
          <td style="font-size:12px;color:var(--text-3);white-space:nowrap;">${c.data.liveAsOf ? 'Live ' + shortDate(c.data.liveAsOf) : c.data.snapAsOf ? 'Snapshot ' + shortDate(c.data.snapAsOf) : 'Seed only'}</td>
        </tr>
        <tr class="sc-flags"><td colspan="9">${flags || '<span class="mute" style="font-size:12px;">Nothing flagged.</span>'}</td></tr>`;
    }).join('');
    const cov = window.HardcapScore.coverage(state, cards.map(c => c.tkr));
    setText('score-asof', cov.live.length + ' of ' + cards.length + ' on live fundamentals');
    const RS = window.RESEARCH_SNAPSHOT || {};
    setHTML('score-foot', `<sup>snap</sup> = research snapshot of ${shortDate(RS.asOf)} (approximate; 5-yr averages are simple means of year-end figures). <sup>seed</sup> = typed in from memory in May 2026 and never verified. ${window.HardcapLive && window.HardcapLive.hasWorkerUrl() ? '"Refresh data" pulls live fundamentals through your data feed and retires both.' : 'Add your worker URL in Import → Settings to pull live fundamentals.'}`);
  }

  // ─── DEPLOYMENT JOURNAL (History tab) ──────────────────────────────
  function renderJournal(state) {
    const host = el('history-content');
    if (!host) return;
    const log = (state.deploymentLog || []).slice().reverse();
    const hist = state.history || [];
    const scopeNote = hist.length && hist[hist.length - 1].scope ? `<div style="font-size:12px;color:var(--text-3);margin:10px 2px 0;">Snapshots now cover: ${esc(hist[hist.length - 1].scope)}. A jump between snapshots taken with different accounts included is a change of scope, not performance.</div>` : '';
    const empty = hist.length === 0 ? `<div class="empty"><div class="empty-title">No history yet</div><div class="empty-sub">Each CSV import creates a snapshot. Come back next month.</div></div>` : '';
    const rows = log.map(e => `<tr>
        <td><strong>${esc(String(e.date || '').slice(0, 10))}</strong><div class="tkr-sub">${esc(e.source || '')}</div></td>
        <td style="text-align:left;"><span class="tkr-cell">${esc(e.ticker || '')}</span> <span class="tkr-sub" style="display:inline;">${esc(e.action || '')}</span></td>
        <td class="cb-amount">${e.amount != null ? usd(e.amount) : '—'}</td>
        <td class="cb-amount" style="font-size:13px;">${e.shares != null ? e.shares + ' sh' : '—'}${e.price ? ' @ ' + fmt(Number(e.price)) : ''}</td>
        <td style="text-align:left;padding-left:12px;font-size:12px;color:var(--text-2);max-width:420px;">${esc(e.rationale || '')}</td>
      </tr>`).join('');
    host.innerHTML = empty + scopeNote + `
      <div class="card" style="margin-top:20px;">
        <div class="card-h"><div class="card-t">Deployment Journal</div><span class="pill pill-neutral">${log.length} entr${log.length === 1 ? 'y' : 'ies'}</span></div>
        <div class="card-b flush" style="padding-top:8px;padding-bottom:8px;overflow-x:auto;">
          ${log.length ? `<table class="tbl"><thead><tr><th>Date</th><th style="text-align:left;">Name</th><th>Amount</th><th>Size</th><th style="text-align:left;padding-left:12px;">Why</th></tr></thead><tbody>${rows}</tbody></table>`
            : '<div style="padding:26px 0;text-align:center;font-size:13px;color:var(--text-3);">Nothing logged yet. "Log plan to journal" on the Deploy tab records what you decided and why. It does not place trades.</div>'}
        </div>
      </div>`;
  }

  // ─── ACCOUNTS (Import tab) ─────────────────────────────────────────
  function renderAccounts(state, canReapply) {
    const host = el('import-accounts');
    if (!host) return;
    const ia = state.importAccounts;
    if (!ia || !ia.all || ia.all.length < 2) { host.innerHTML = ''; return; }
    const inc = ia.included || [];
    host.innerHTML = `<div style="margin-top:16px;padding:14px 16px;background:var(--bg-2);border-radius:var(--r-md);">
        <div class="h-label" style="margin-bottom:8px;">Accounts in the last file</div>
        ${ia.all.map((a, i) => `<label style="display:flex;align-items:center;gap:10px;font-size:13px;padding:5px 0;cursor:${canReapply ? 'pointer' : 'default'};">
            <input type="checkbox" class="acct-pick" id="acct-pick-${i}" value="${esc(a.key)}" ${inc.indexOf(a.key) >= 0 ? 'checked' : ''} ${canReapply ? '' : 'disabled'}>
            <span style="flex:1;"><strong>${esc(a.name)}</strong>${a.number && a.number !== a.name ? ' <span class="mute">' + esc(a.number) + '</span>' : ''} <span class="mute">· ${a.positions} position${a.positions === 1 ? '' : 's'}</span></span>
            <span class="cb-amount">${usd(a.value)}</span>
          </label>`).join('')}
        <div style="display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap;">
          ${canReapply ? '<button class="btn ghost sm" type="button" id="acct-apply">Use the ticked accounts</button>' : ''}
          <span style="font-size:12px;color:var(--text-3);">${canReapply ? 'Your choice is remembered for the next import.' : 'Drop the CSV again to change which accounts count. Your choice is remembered.'}</span>
        </div>
      </div>`;
  }

  window.HardcapPlanUI = {
    render, renderScorecard, renderJournal, renderAccounts,
    inputsHtml, rulesHtml, refreshInputStatus, refreshRulesStatus,
    lastPlan: () => lastPlan,
    buyListText: () => {
      const P = lastPlan;
      if (!P || !P.buys.length) return '';
      return P.buys.map(b => `${b.tkr}  ${usd(b.buy)}${b.buyShares != null ? '  (about ' + b.buyShares.toFixed(3) + ' sh @ ' + fmt(b.price) + ')' : ''}`).join('\n') + `\nTotal  ${usd(P.spend)}`;
    },
  };
})();
