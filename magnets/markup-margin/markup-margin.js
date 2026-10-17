/*
 * Craftsman Digital free tool: Markup vs. Margin + true hourly rate.
 * Spec: ICM-WORKSPACE/workspaces/craftsman-digital/offers/mini-lead-magnets.md (tool 3)
 * Pure math on the contractor's own numbers. No outside figures.
 *
 * Embed:
 * <div data-cd-magnet="markup-margin" data-webhook-url="..."></div>
 * <script src="https://abegley5781.github.io/craftsman-digital-calculators/magnets/markup-margin/markup-margin.js"></script>
 * data-mode="mock" posts nothing (previews).
 *
 * Math:
 *   price from cost + margin:  price = cost / (1 - margin)
 *   margin from cost + price:  margin = (price - cost) / price
 *   markup (either way):       markup = (price - cost) / cost
 *   hourly rate:  (overhead + pay) / (weeks x billable hours a week), then / (1 - profit)
 */
(function () {
  'use strict';

  var TOOL = 'markup-margin';
  var CONSENT_TEXT = 'I agree that Craftsman Digital LLC may send me marketing texts and calls at this number, ' +
    'including automated texts and prerecorded voicemails. Agreeing is not required to buy anything. ' +
    'Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.';

  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[$,%\s]/g, '')); return isFinite(n) && n >= 0 ? n : null; }
  function money(n, cents) { return n === null ? '' : '$' + (cents ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(n).toLocaleString('en-US')); }
  function pct(n) { return (Math.round(n * 1000) / 10).toLocaleString('en-US') + '%'; }

  function priceFromMargin(cost, marginPct) {
    if (cost === null || marginPct === null || marginPct >= 100) return null;
    var price = cost / (1 - marginPct / 100);
    return { price: price, profit: price - cost, markup: cost > 0 ? (price - cost) / cost : null, margin: marginPct / 100 };
  }
  function marginFromPrice(cost, price) {
    if (cost === null || price === null || price <= 0) return null;
    return { price: price, profit: price - cost, markup: cost > 0 ? (price - cost) / cost : null, margin: (price - cost) / price };
  }
  function hourly(s) {
    var oh = num(s.overhead), pay = num(s.pay), wk = num(s.weeks), hrs = num(s.hours), prof = num(s.profit), now = num(s.now);
    if (oh === null || pay === null || !wk || !hrs || wk > 52 || hrs > 100) return null;
    var billable = wk * hrs;
    var base = (oh + pay) / billable;
    var p = prof !== null && prof < 100 ? prof / 100 : 0;
    var rate = base / (1 - p);
    var out = { billable: billable, base: base, rate: rate, profitPct: p };
    if (now !== null && now > 0) out.shortYear = (rate - now) * billable;
    return out;
  }

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  var CSS = [
    '.cdk{--cdm-ink:#1f2328;--cdm-navy:#2d3646;--cdm-muted:#4c5564;--cdm-steel:#4e7c91;--cdm-steel-2:#5f8fa6;--cdm-gold:#c2a26d;',
    '--cdm-paper:#ffffff;--cdm-wash:#f3f6f8;--cdm-line:#d5dde3;--cdm-good:#2f7a4f;--cdm-fix:#a8571c;--cdm-on-steel:#ffffff;',
    '--cdm-head:"Libre Baskerville",Georgia,"Times New Roman",serif;--cdm-body:"Source Sans 3","Source Sans Pro",Arial,Helvetica,sans-serif;',
    'font-family:var(--cdm-body);color:var(--cdm-ink);font-size:17px;line-height:1.5;max-width:760px;margin:0 auto;}',
    '.cdk *{box-sizing:border-box;}',
    '.cdk-card{background:var(--cdm-paper);border:1px solid var(--cdm-line);border-radius:10px;padding:clamp(18px,4vw,30px);display:grid;gap:18px;}',
    '.cdk h3{font-family:var(--cdm-head);font-weight:700;font-size:clamp(1.25rem,3.2vw,1.6rem);line-height:1.25;margin:0;color:var(--cdm-navy);text-wrap:balance;}',
    '.cdk h4{font-family:var(--cdm-head);font-weight:700;font-size:1.1rem;margin:0;color:var(--cdm-navy);}',
    '.cdk p{margin:0;}',
    '.cdk-lede,.cdk-fine{color:var(--cdm-muted);}',
    '.cdk-fine{font-size:.88rem;}',
    '.cdk-tabs{display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid var(--cdm-line);}',
    '.cdk-tab{font:inherit;font-weight:600;font-size:16px;background:none;border:0;border-bottom:3px solid transparent;padding:10px 12px;color:var(--cdm-muted);cursor:pointer;margin-bottom:-1px;}',
    '.cdk-tab[aria-selected=true]{color:var(--cdm-navy);border-bottom-color:var(--cdm-steel);}',
    '.cdk-seg{display:inline-flex;flex-wrap:wrap;gap:6px;}',
    '.cdk-seg button{font:inherit;font-size:15px;padding:8px 14px;border:1px solid var(--cdm-line);border-radius:999px;background:var(--cdm-paper);color:var(--cdm-ink);cursor:pointer;min-height:40px;}',
    '.cdk-seg button[aria-pressed=true]{background:var(--cdm-steel);border-color:var(--cdm-steel);color:var(--cdm-on-steel);font-weight:600;}',
    '.cdk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;}',
    '.cdk-field{display:grid;gap:6px;min-width:0;align-content:start;}',
    '.cdk-field label{font-weight:600;font-size:.95rem;}',
    '.cdk-field small{color:var(--cdm-muted);font-size:.85rem;}',
    '.cdk input[type=text],.cdk input[type=email],.cdk input[type=tel]{width:100%;font:inherit;font-size:17px;padding:12px 14px;border:1px solid var(--cdm-line);border-radius:8px;background:var(--cdm-paper);color:var(--cdm-ink);font-variant-numeric:tabular-nums;}',
    '.cdk input:focus-visible,.cdk button:focus-visible{outline:3px solid var(--cdm-steel-2);outline-offset:2px;}',
    '.cdk-out{display:grid;gap:12px;background:var(--cdm-wash);border-radius:10px;padding:clamp(16px,3.5vw,24px);}',
    '.cdk-big{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;}',
    '.cdk-stat{display:grid;gap:2px;min-width:0;}',
    '.cdk-stat b{font-family:var(--cdm-head);font-size:clamp(1.5rem,4.5vw,2rem);line-height:1.1;color:var(--cdm-navy);font-variant-numeric:tabular-nums;}',
    '.cdk-stat span{color:var(--cdm-muted);font-size:.92rem;}',
    '.cdk-wait{color:var(--cdm-muted);font-style:italic;}',
    '.cdk-tbl{overflow-x:auto;}',
    '.cdk table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;font-size:.95rem;}',
    '.cdk th,.cdk td{text-align:right;padding:6px 10px;border-bottom:1px solid var(--cdm-line);}',
    '.cdk th:first-child,.cdk td:first-child{text-align:left;}',
    '.cdk th{color:var(--cdm-muted);font-weight:600;}',
    '.cdk tr.hl td{font-weight:700;color:var(--cdm-navy);}',
    '.cdk a{color:var(--cdm-steel);}',
    '.cdk-btn{font:inherit;font-weight:700;font-size:17px;border:0;border-radius:8px;padding:14px 22px;background:var(--cdm-steel);color:var(--cdm-on-steel);cursor:pointer;justify-self:start;min-height:48px;}',
    '.cdk-btn[disabled]{opacity:.55;cursor:default;}',
    '.cdk-msg{font-size:.95rem;color:var(--cdm-fix);}',
    '.cdk-optin{background:var(--cdm-wash);border-radius:10px;padding:clamp(16px,3.5vw,24px);display:grid;gap:14px;}',
    '.cdk-consent{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;font-size:.92rem;}',
    '.cdk-consent input{width:20px;height:20px;margin-top:2px;}',
    '.cdk-err{border-color:var(--cdm-fix)!important;}',
    '.cdk-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0;}',
    '.cdk-done{font-weight:600;color:var(--cdm-good);}'
  ].join('');

  function injectCss() {
    if (document.getElementById('cdk-css')) return;
    var s = document.createElement('style'); s.id = 'cdk-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  function init(root) {
    var cfg = {
      webhook: root.getAttribute('data-webhook-url') || '',
      terms: root.getAttribute('data-terms-url') || 'https://craftsman-digital.com/terms',
      privacy: root.getAttribute('data-privacy-url') || 'https://craftsman-digital.com/privacy',
      mock: String(root.getAttribute('data-mode') || '').toLowerCase() === 'mock'
    };
    // Starts on a worked example (the classic $10,000 cost, 1.5x markup case) so the page shows a result at rest.
    var st = { mode: 'margin', cost: '10000', margin: '35', price: '15000', overhead: '', pay: '', weeks: '', hours: '', profit: '', now: '' };
    var inputs = {};
    function field(key, label, hint, ph) {
      var input = el('input', { type: 'text', id: 'cdk-' + key, inputmode: 'decimal', placeholder: ph || '', autocomplete: 'off' });
      input.value = st[key];
      input.addEventListener('input', function () { st[key] = input.value; update(); });
      inputs[key] = input;
      return el('div', { class: 'cdk-field' }, [el('label', { for: 'cdk-' + key, text: label }), input, hint ? el('small', { text: hint }) : null]);
    }

    var wrap = el('div', { class: 'cdk' });
    var card = el('div', { class: 'cdk-card' });
    card.appendChild(el('h3', { text: 'Markup or margin? Price your jobs on the right one.' }));
    card.appendChild(el('p', { class: 'cdk-lede', text: 'A 50% markup is not a 50% margin. Put in your own numbers and see both, plus the hourly rate your business really needs.' }));

    var tabs = [{ k: 'mm', label: 'Markup vs. margin' }, { k: 'hr', label: 'True hourly rate' }];
    var tabBar = el('div', { class: 'cdk-tabs', role: 'tablist' });
    var panels = {};
    tabs.forEach(function (t, i) {
      var b = el('button', { type: 'button', class: 'cdk-tab', role: 'tab', id: 'cdk-tab-' + t.k, 'aria-controls': 'cdk-panel-' + t.k, 'aria-selected': i === 0 ? 'true' : 'false', text: t.label });
      b.addEventListener('click', function () {
        tabs.forEach(function (u) { document.getElementById('cdk-tab-' + u.k).setAttribute('aria-selected', u.k === t.k ? 'true' : 'false'); panels[u.k].hidden = u.k !== t.k; });
      });
      tabBar.appendChild(b);
    });

    // Markup vs margin
    var segPrice = el('button', { type: 'button', 'aria-pressed': 'true', text: 'I know the margin I want' });
    var segMargin = el('button', { type: 'button', 'aria-pressed': 'false', text: 'I know my price' });
    var fMargin = field('margin', 'Margin you want (%)', 'Share of the price that\'s left after job costs.', '35');
    var fPrice = field('price', 'Your price ($)', null, '15,000');
    fPrice.hidden = true;
    function setMode(m) { st.mode = m; segPrice.setAttribute('aria-pressed', m === 'price' ? 'true' : 'false'); segMargin.setAttribute('aria-pressed', m === 'margin' ? 'true' : 'false'); fMargin.hidden = m !== 'price'; fPrice.hidden = m !== 'margin'; update(); }
    segPrice.addEventListener('click', function () { setMode('price'); });
    segMargin.addEventListener('click', function () { setMode('margin'); });
    var outMM = el('div', { class: 'cdk-out', 'aria-live': 'polite' });
    var table = el('div', { class: 'cdk-tbl' });
    panels.mm = el('div', { id: 'cdk-panel-mm', role: 'tabpanel', 'aria-labelledby': 'cdk-tab-mm', style: 'display:grid;gap:14px' }, [
      el('div', { class: 'cdk-seg' }, [segPrice, segMargin]),
      el('div', { class: 'cdk-grid' }, [field('cost', 'Job cost ($)', 'Materials, labor and subs for this job.', '10,000'), fMargin, fPrice]),
      outMM,
      // Teaser on screen; the full multiplier table at their own cost goes in the emailed report.
      el('p', { class: 'cdk-wait', text: 'In your full report: a table of common markups (1.20 to 2.00) and the margin each one really gives at your job cost.' })
    ]);

    // Hourly rate
    var outHR = el('div', { class: 'cdk-out', 'aria-live': 'polite' });
    panels.hr = el('div', { id: 'cdk-panel-hr', role: 'tabpanel', 'aria-labelledby': 'cdk-tab-hr', style: 'display:grid;gap:14px' }, [
      el('p', { class: 'cdk-fine', text: 'For the time you bill out yourself. Use last year\'s real numbers if you have them.' }),
      el('div', { class: 'cdk-grid' }, [
        field('overhead', 'Yearly overhead ($)', 'Truck, insurance, tools, phone, software, office: everything that runs whether or not you\'re on a job.', '30,000'),
        field('pay', 'What you want to pay yourself a year ($)', null, '70,000'),
        field('weeks', 'Weeks you work a year', 'Leave out holidays, weather and slow weeks.', '46'),
        field('hours', 'Billable hours a week', 'Hours on a job, not driving, bidding or office work.', '30'),
        field('profit', 'Profit on top (%)', 'Optional. For the business, after your pay.', '10'),
        field('now', 'What you charge an hour now ($)', 'Optional. To compare.', '65')
      ]),
      outHR
    ]);
    panels.hr.hidden = true;

    [tabBar, panels.mm, panels.hr].forEach(function (n) { card.appendChild(n); });
    var optinSlot = el('div'); card.appendChild(optinSlot);
    wrap.appendChild(card); root.innerHTML = ''; root.appendChild(wrap);

    function stat(big, label) { return el('div', { class: 'cdk-stat' }, [el('b', { text: big }), el('span', { text: label })]); }

    // Reference table: same cost, common markups.
    function renderTable() {
      var cost = num(st.cost); var c = cost && cost > 0 ? cost : 10000;
      var rows = [1.2, 1.25, 1.33, 1.5, 1.67, 2.0];
      var t = el('table', {}, [el('thead', {}, [el('tr', {}, [el('th', { text: 'Multiply cost by' }), el('th', { text: 'Markup' }), el('th', { text: 'Margin' }), el('th', { text: 'Price on ' + money(c) })])])]);
      var tb = el('tbody');
      rows.forEach(function (m) {
        var price = c * m;
        tb.appendChild(el('tr', { class: m === 1.5 ? 'hl' : '' }, [
          el('td', { text: m.toFixed(2) }), el('td', { text: pct(m - 1) }), el('td', { text: pct((price - c) / price) }), el('td', { text: money(price) })
        ]));
      });
      t.appendChild(tb);
      table.innerHTML = ''; table.appendChild(t);
    }

    var last = { mm: null, hr: null };
    function update() {
      var cost = num(st.cost);
      var r = st.mode === 'price' ? priceFromMargin(cost, num(st.margin)) : marginFromPrice(cost, num(st.price));
      last.mm = r;
      outMM.innerHTML = '';
      if (!r) outMM.appendChild(el('p', { class: 'cdk-wait', text: st.mode === 'price' ? 'Put in a job cost and the margin you want (under 100%).' : 'Put in a job cost and your price.' }));
      else {
        outMM.appendChild(el('div', { class: 'cdk-big' }, [
          stat(money(r.price), st.mode === 'price' ? 'price to charge' : 'your price'),
          stat(r.markup === null ? 'n/a' : pct(r.markup), 'markup on cost'),
          stat(pct(r.margin), 'margin on price'),
          stat(money(r.profit), 'left over to cover overhead and profit')
        ]));
        if (r.markup !== null) outMM.appendChild(el('p', { text: r.margin < 0
          ? 'This price is below your cost. You lose ' + money(-r.profit) + ' on this job before overhead.'
          : 'Adding ' + pct(r.markup) + ' to your cost leaves you a ' + pct(r.margin) + ' margin. That ' + money(r.profit) + ' still has to pay for your overhead before any of it is profit.' }));
      }
      var h = hourly(st); last.hr = h;
      outHR.innerHTML = '';
      if (!h) outHR.appendChild(el('p', { class: 'cdk-wait', text: 'Fill in overhead, your pay, weeks a year and billable hours a week.' }));
      else {
        outHR.appendChild(el('div', { class: 'cdk-big' }, [
          stat(money(h.rate, true), 'per billable hour you need to charge'),
          stat(Math.round(h.billable).toLocaleString('en-US'), 'billable hours a year')
        ]));
        outHR.appendChild(el('p', { class: 'cdk-wait', text: 'In your full report: the math behind your rate' + (h.shortYear !== undefined ? ', and how much a year your current rate leaves on the table' : '') + '.' }));
      }
      optinSlot.hidden = !r && !h;
      if (!optinSlot.firstChild) optinSlot.appendChild(buildOptin());
    }

    // The emailed full report (teaser on screen, full report by email: Andrew 2026-10-17).
    function resultsSentence() {
      var L = ['Markup vs. margin: your full report', ''];
      var r = last.mm, h = last.hr;
      var cost = num(st.cost);
      if (r && r.markup !== null) {
        L.push('YOUR JOB');
        L.push('On a ' + money(cost) + ' job cost, a ' + money(r.price) + ' price is a ' + pct(r.markup) + ' markup and a ' + pct(r.margin) + ' margin. That leaves ' + money(r.profit) + ' to pay your overhead before any of it is profit.');
        L.push('');
      }
      var c = cost && cost > 0 ? cost : 10000;
      L.push('COMMON MARKUPS ON A ' + money(c) + ' JOB');
      [1.2, 1.25, 1.33, 1.5, 1.67, 2.0].forEach(function (m) {
        var price = c * m;
        L.push('Cost x ' + m.toFixed(2) + ' = ' + money(price) + '. Markup ' + pct(m - 1) + ', margin ' + pct((price - c) / price) + '.');
      });
      L.push('A 50% markup is only a 33% margin. Price from the margin you need, not the markup.');
      if (h) {
        L.push('', 'YOUR TRUE HOURLY RATE');
        L.push('(' + money(num(st.overhead)) + ' overhead + ' + money(num(st.pay)) + ' pay) / ' + Math.round(h.billable).toLocaleString('en-US') + ' billable hours = ' + money(h.base, true) + ' an hour' + (h.profitPct ? '. With ' + pct(h.profitPct) + ' profit on top, ' + money(h.rate, true) + ' an hour.' : '.'));
        if (h.shortYear !== undefined) L.push(h.shortYear > 0
          ? 'At ' + money(num(st.now)) + ' an hour you come up about ' + money(h.shortYear) + ' a year short.'
          : 'At ' + money(num(st.now)) + ' an hour your rate covers it.');
      }
      return L.join('\n');
    }

    function buildOptin() {
      var first = el('input', { type: 'text', id: 'cdk-first', autocomplete: 'given-name', placeholder: 'First name' });
      var email = el('input', { type: 'email', id: 'cdk-email', autocomplete: 'email', placeholder: 'Email' });
      var phone = el('input', { type: 'tel', id: 'cdk-phone', autocomplete: 'tel', placeholder: 'Phone' });
      var hp = el('input', { type: 'text', class: 'cdk-hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', name: 'website' });
      var box = el('input', { type: 'checkbox', id: 'cdk-consent' });
      var consent = el('div', { class: 'cdk-consent' }, [box, el('label', { for: 'cdk-consent' }, [CONSENT_TEXT + ' ',
        el('a', { href: cfg.terms, target: '_blank', rel: 'noopener', text: 'Terms of Service' }), ' and ',
        el('a', { href: cfg.privacy, target: '_blank', rel: 'noopener', text: 'Privacy Policy' }), '.'])]);
      var send = el('button', { type: 'button', class: 'cdk-btn', text: 'Email me my full report' });
      var m = el('p', { class: 'cdk-msg', role: 'alert' }); m.hidden = true;
      var b = el('div', { class: 'cdk-optin' }, [
        el('h4', { text: 'Email me my full report + the Bottleneck Guide' }),
        el('div', { class: 'cdk-grid' }, [
          el('div', { class: 'cdk-field' }, [el('label', { for: 'cdk-first', text: 'First name' }), first]),
          el('div', { class: 'cdk-field' }, [el('label', { for: 'cdk-email', text: 'Email *' }), email]),
          el('div', { class: 'cdk-field' }, [el('label', { for: 'cdk-phone', text: 'Phone *' }), phone])
        ]), consent, send, m, hp]);
      send.addEventListener('click', function () {
        var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()); var dg = phone.value.replace(/\D/g, '');
        email.classList.toggle('cdk-err', !ok); phone.classList.toggle('cdk-err', dg.length < 10); consent.classList.toggle('cdk-err', !box.checked);
        if (!ok || dg.length < 10) { m.hidden = false; m.textContent = 'Add a valid email and phone number.'; return; }
        if (!box.checked) { m.hidden = false; m.textContent = 'Check the box to get your full report by email.'; return; }
        m.hidden = true;
        function done(t) { b.innerHTML = ''; b.appendChild(el('h4', { text: 'Sent.' })); b.appendChild(el('p', { class: 'cdk-done', text: t })); }
        if (hp.value) { done('Check your inbox for your full report and the guide.'); return; }
        var now = new Date();
        var payload = {
          tool: TOOL, first_name: first.value.trim(), email: email.value.trim(), phone: dg,
          results: resultsSentence(), last_date: now.toISOString().slice(0, 10),
          consent_proof: 'Box checked. Wording shown: ' + CONSENT_TEXT + ' Page: ' + location.href.split('#')[0] + '. Time: ' + now.toISOString(),
          place_id: '', gbp_score: '', gbp_gaps: '', gbp_rank: '', lead_value: '', yearly_loss: '', bottleneck: '', site_url: '', site_mobile_score: ''
        };
        if (cfg.mock || !cfg.webhook) {
          root.setAttribute('data-last-payload', JSON.stringify(payload));
          done(cfg.mock ? 'Preview only: nothing was sent. On the live page this emails the full report and the guide.' : 'Check your inbox for your full report and the guide.');
          return;
        }
        send.disabled = true; send.textContent = 'Sending...';
        fetch(cfg.webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          .then(function (res) { if (!res.ok) throw new Error(String(res.status)); done('Check your inbox for your full report and the guide. It can take a few minutes.'); })
          .catch(function () { send.disabled = false; send.textContent = 'Email me my full report'; m.hidden = false; m.textContent = 'That did not go through. Try again, or call or text (877) 560-0450.'; });
      });
      return b;
    }

    var fill = root.getAttribute('data-preview-fill');
    if (cfg.mock && fill) { try { var f = JSON.parse(fill); Object.keys(f).forEach(function (k) { if (inputs[k]) { st[k] = String(f[k]); inputs[k].value = String(f[k]); } }); } catch (e) {} }
    setMode(st.mode);
  }

  window.CDMagnetMarkup = { priceFromMargin: priceFromMargin, marginFromPrice: marginFromPrice, hourly: hourly };

  function boot() { injectCss(); Array.prototype.forEach.call(document.querySelectorAll('[data-cd-magnet="markup-margin"]'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
