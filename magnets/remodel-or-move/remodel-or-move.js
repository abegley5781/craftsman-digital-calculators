/*
 * Homeowner tool: Remodel or Move? (Complete tier piece 8; CKB first).
 * Plan + spec: ICM-WORKSPACE/workspaces/craftsman-digital/sprints/2026-10-23-channel-b-finish/cd-sprint8-c-remodel-or-move-spec.md
 * 10/1 decision: offers/websites.md ("Remodel or Move?" calculator, modeled on Fin Home's).
 *
 * DRAFT: copy is for Andrew to edit. Not wired to any GHL account.
 *
 * Shows the math side by side, never a verdict. Every default is either the homeowner's own
 * number or a sourced public figure shown in the tool with its source and date (SOURCES below).
 * Where a source gives a range, the tool carries the low and high through the math.
 *
 * Embed:
 * <div data-cd-magnet="remodel-or-move"
 *   data-business-name="{{ custom_values.locationname }}" data-webhook-url="..."
 *   data-calc-url="https://.../cost-calculators"
 *   data-rate="7.32" data-rate-date="Oct 22, 2026"
 *   data-commission-pct="5.47" data-commission-area="Colorado"
 *   data-terms-url="..." data-privacy-url="..." data-color-primary="#1d5d85" data-color-dark="#25425d"></div>
 * <script src="https://abegley5781.github.io/craftsman-digital-calculators/magnets/remodel-or-move/remodel-or-move.js"></script>
 * data-mode="mock" posts nothing. data-preview='{"value":420000,...}' fills the inputs (mock only).
 *
 * Math (principal and interest only; taxes and insurance left out and said so):
 *   selling costs   = value x commission% + value x seller closing% (1-3%)
 *   cash from sale  = value - mortgage balance - selling costs
 *   buying costs    = new price x buyer closing% (2-5%) + moving ($1,200-$2,800)
 *   down payment    = max(0, cash from sale - buying costs)
 *   new loan        = max(0, new price - down payment), 30 years at today's rate
 *   current payment = mortgage balance over the years left at the current rate
 * "Low" uses the low end of every range, "high" the high end.
 */
(function () {
  'use strict';

  var TOOL = 'remodel-or-move';

  // Defaults and their sources (fetched 2026-10-27). Rate and commission can be set per page.
  var SOURCES = {
    commission: { pct: 5.47, area: 'Colorado', text: 'Clever Real Estate, "Average Real Estate Agent Commission Rates (2026 Survey)", updated Oct 1, 2026: average total commission (listing agent + buyer\'s agent) 5.47% in Colorado, 5.46% nationally.', url: 'https://listwithclever.com/average-real-estate-commission-rate/' },
    sellerClosing: { low: 1, high: 3, text: 'Redfin, "Closing Costs for Sellers", May 26, 2026: seller closing costs typically 1% to 3% of the sale price before agent compensation.', url: 'https://www.redfin.com/blog/closing-costs-for-sellers/' },
    buyerClosing: { low: 2, high: 5, text: 'The Mortgage Reports, "Average closing costs", Jan 16, 2026: buyer closing costs usually 2% to 5% (the page gives this as a share of both the loan and the purchase price; this tool uses the purchase price).', url: 'https://themortgagereports.com/35800/guide-to-mortgage-closing-costs-what-average-mortgage-costs-are-and-how-to-keep-yours-low' },
    moving: { low: 1200, high: 2800, text: 'Bellhop, "Average Cost of Local Movers in 2026", July 18, 2026: $1,200 to $2,800 for a local move of a 3-bedroom home. A long-distance move costs more.', url: 'https://www.getbellhops.com/blog/?p=103073' },
    rate: { pct: 7.32, date: 'Oct 22, 2026', text: 'Freddie Mac Primary Mortgage Market Survey, 30-year fixed average, week of Oct 22, 2026: 7.32% (via FRED, series MORTGAGE30US). Your own rate depends on your credit and loan.', url: 'https://fred.stlouisfed.org/series/MORTGAGE30US' }
  };

  var FIELDS = [
    { key: 'value', label: 'What your home would sell for', hint: 'Your best guess, or a recent estimate.', money: true, req: true },
    { key: 'balance', label: 'What you still owe on your mortgage', hint: 'Enter 0 if it\'s paid off.', money: true, req: true },
    { key: 'curRate', label: 'Your current mortgage rate (%)', hint: 'From your mortgage statement.', pct: true, needsLoan: true },
    { key: 'years', label: 'Years left on your mortgage', hint: 'For example, 22.', num: true, needsLoan: true },
    { key: 'newPrice', label: 'Price of a home you\'d move to', hint: 'A home you\'d actually want, in the area you\'d want.', money: true, req: true },
    { key: 'remLow', label: 'Your remodel range: low', hint: 'From our cost calculator, or a quote.', money: true, group: 'rem' },
    { key: 'remHigh', label: 'Your remodel range: high', hint: '', money: true, group: 'rem' }
  ];

  function num(s) { var v = parseFloat(String(s == null ? '' : s).replace(/[^0-9.]/g, '')); return isNaN(v) ? null : v; }
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function range(a, b) { a = Math.round(a); b = Math.round(b); return a === b ? money(a) : money(Math.min(a, b)) + ' to ' + money(Math.max(a, b)); }
  function payment(loan, ratePct, years) {
    if (loan <= 0 || years <= 0) return 0;
    var r = ratePct / 100 / 12, n = Math.round(years * 12);
    return r === 0 ? loan / n : loan * r / (1 - Math.pow(1 + r, -n));
  }

  // One side of the range: 'low' or 'high'.
  function side(i, a, end) {
    var sc = end === 'low' ? a.sellerLow : a.sellerHigh;
    var bc = end === 'low' ? a.buyerLow : a.buyerHigh;
    var mv = end === 'low' ? a.moveLow : a.moveHigh;
    var commission = i.value * a.commission / 100;
    var sellerClosing = i.value * sc / 100;
    var buyerClosing = i.newPrice * bc / 100;
    var cashFromSale = i.value - i.balance - commission - sellerClosing;
    var down = Math.max(0, cashFromSale - buyerClosing - mv);
    var loan = Math.max(0, i.newPrice - down);
    return {
      commission: commission, sellerClosing: sellerClosing, buyerClosing: buyerClosing, moving: mv,
      fees: commission + sellerClosing + buyerClosing + mv,
      cashFromSale: cashFromSale, down: down, loan: loan,
      newPay: payment(loan, a.rate, 30)
    };
  }

  function compute(i, a) {
    var cur = i.balance > 0 ? payment(i.balance, i.curRate || 0, i.years || 0) : 0;
    return { low: side(i, a, 'low'), high: side(i, a, 'high'), curPay: cur };
  }

  function summary(i, a, r) {
    var lines = [
      'Moving: fees ' + range(r.low.fees, r.high.fees) + ' (agent commission ' + money(r.low.commission) + ', seller closing ' + range(r.low.sellerClosing, r.high.sellerClosing) + ', buyer closing ' + range(r.low.buyerClosing, r.high.buyerClosing) + ', movers ' + range(r.low.moving, r.high.moving) + ').',
      'New loan ' + range(r.low.loan, r.high.loan) + ' at ' + a.rate + '% for 30 years: ' + range(r.low.newPay, r.high.newPay) + ' a month (principal and interest).',
      'Current mortgage: ' + (r.curPay ? money(r.curPay) + ' a month (principal and interest).' : 'paid off.'),
      i.remLow ? 'Remodel: ' + range(i.remLow, i.remHigh || i.remLow) + '.' : 'Remodel: no range entered.'
    ];
    return lines.join('\n');
  }

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  var CSS = [
    '.crm{--crm-p:#1d5d85;--crm-d:#25425d;--crm-ink:#22303c;--crm-muted:#5b6b78;--crm-line:#d9e2ea;--crm-wash:#eef4f8;--crm-fix:#a8571c;--crm-good:#2f7a4f;',
    'font-family:Lato,Arial,Helvetica,sans-serif;color:var(--crm-ink);font-size:17px;line-height:1.5;max-width:860px;margin:0 auto;color-scheme:light;}',
    '.crm *{box-sizing:border-box;}',
    '.crm [hidden]{display:none!important;}',
    '.crm-card{background:#fff;border:1px solid var(--crm-line);border-radius:10px;padding:clamp(18px,4vw,30px);display:grid;gap:18px;}',
    '.crm h3{font-family:Montserrat,Arial,sans-serif;font-weight:800;font-size:clamp(1.3rem,3.4vw,1.7rem);line-height:1.2;margin:0;color:var(--crm-d);text-wrap:balance;}',
    '.crm h4{font-family:Montserrat,Arial,sans-serif;font-weight:700;font-size:1.08rem;margin:0;color:var(--crm-d);}',
    '.crm p{margin:0;}',
    '.crm-lede{color:var(--crm-muted);}',
    '.crm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr));gap:14px;}',
    '.crm-field{display:grid;gap:4px;align-content:start;min-width:0;}',
    '.crm-field label{font-weight:700;font-size:.95rem;}',
    '.crm-hint{font-size:.85rem;color:var(--crm-muted);}',
    '.crm input[type=text],.crm input[type=email],.crm input[type=tel]{width:100%;font:inherit;font-size:16px;padding:11px 12px;border:1.5px solid #b9c8d4;border-radius:6px;background:#fff;color:var(--crm-ink);}',
    '.crm input:focus-visible,.crm-btn:focus-visible,.crm-link:focus-visible,.crm summary:focus-visible{outline:3px solid var(--crm-d);outline-offset:2px;}',
    '.crm-err{border-color:var(--crm-fix)!important;}',
    '.crm-btn{font:700 17px Montserrat,Arial,sans-serif;border:0;border-radius:6px;padding:14px 22px;background:var(--crm-p);color:#fff;cursor:pointer;justify-self:start;min-height:48px;text-decoration:none;display:inline-block;}',
    '.crm-link{font:inherit;background:none;border:0;color:var(--crm-p);text-decoration:underline;padding:4px 0;cursor:pointer;justify-self:start;}',
    '.crm-msg{font-size:.95rem;color:var(--crm-fix);}',
    '.crm details{border:1px solid var(--crm-line);border-radius:8px;padding:10px 14px;}',
    '.crm summary{cursor:pointer;font-weight:700;color:var(--crm-d);}',
    '.crm-assume{display:grid;gap:12px;margin-top:12px;}',
    '.crm-assume .crm-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,11rem),1fr));}',
    '.crm-sides{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,19rem),1fr));gap:14px;}',
    '.crm-side{border:1px solid var(--crm-line);border-top:4px solid var(--crm-p);border-radius:8px;padding:16px;display:grid;gap:10px;align-content:start;}',
    '.crm-side.mv{border-top-color:var(--crm-d);}',
    '.crm-big{font:800 clamp(1.25rem,3.2vw,1.55rem) Montserrat,Arial,sans-serif;color:var(--crm-d);line-height:1.2;}',
    '.crm ul.crm-rows{margin:0;padding:0;list-style:none;display:grid;gap:6px;font-size:.95rem;}',
    '.crm-rows li{display:flex;justify-content:space-between;gap:12px;border-bottom:1px dotted var(--crm-line);padding-bottom:4px;}',
    '.crm-rows li span:last-child{font-variant-numeric:tabular-nums;text-align:right;}',
    '.crm-rows li.t{font-weight:700;border-bottom:0;}',
    '.crm-fine{font-size:.86rem;color:var(--crm-muted);}',
    '.crm-src{margin:0;padding-left:1.1rem;display:grid;gap:6px;font-size:.86rem;color:var(--crm-muted);}',
    '.crm-src a{color:var(--crm-p);overflow-wrap:anywhere;}',
    '.crm-note{background:var(--crm-wash);border-radius:8px;padding:12px 14px;font-size:.92rem;}',
    '.crm-optin{background:var(--crm-wash);border-radius:10px;padding:clamp(16px,3.5vw,22px);display:grid;gap:12px;}',
    '.crm-consent{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;font-size:.82rem;line-height:1.45;color:var(--crm-muted);}',
    '.crm-consent input{width:18px;height:18px;margin-top:2px;}',
    '.crm-consent a{color:var(--crm-p);}',
    '.crm-consent.crm-err label{color:var(--crm-fix);}',
    '.crm-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0;}',
    '.crm-done{font-weight:700;color:var(--crm-good);}'
  ].join('');

  function injectCss() {
    if (document.getElementById('crm-css')) return;
    var s = document.createElement('style'); s.id = 'crm-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  function leadRef() {
    try { var m = /[?&]ref=([A-Za-z0-9_-]{1,40})/.exec(window.location.search); return m ? m[1] : ''; } catch (e) { return ''; }
  }

  var uid = 0;
  function init(root) {
    var id = 'crm' + (uid++);
    var attrNum = function (k, d) { var v = num(root.getAttribute(k)); return v === null ? d : v; };
    var cfg = {
      business: root.getAttribute('data-business-name') || 'our team',
      webhook: root.getAttribute('data-webhook-url') || '',
      calc: root.getAttribute('data-calc-url') || '',
      terms: root.getAttribute('data-terms-url') || '#',
      privacy: root.getAttribute('data-privacy-url') || '#',
      mock: String(root.getAttribute('data-mode') || '').toLowerCase() === 'mock',
      rate: attrNum('data-rate', SOURCES.rate.pct),
      rateDate: root.getAttribute('data-rate-date') || SOURCES.rate.date,
      commission: attrNum('data-commission-pct', SOURCES.commission.pct),
      commissionArea: root.getAttribute('data-commission-area') || SOURCES.commission.area
    };
    var wrap = el('div', { class: 'crm' });
    var cp = root.getAttribute('data-color-primary'), cd = root.getAttribute('data-color-dark');
    if (cp && /^#[0-9a-fA-F]{3,8}$/.test(cp)) wrap.style.setProperty('--crm-p', cp);
    if (cd && /^#[0-9a-fA-F]{3,8}$/.test(cd)) wrap.style.setProperty('--crm-d', cd);

    var card = el('div', { class: 'crm-card' });
    var form = el('div', { style: 'display:grid;gap:18px' });
    var result = el('div', { style: 'display:grid;gap:16px' }); result.hidden = true;
    form.appendChild(el('h3', { text: 'Remodel or move? See the math.' }));
    form.appendChild(el('p', { class: 'crm-lede', text: 'Put in your own numbers. The tool shows what moving would cost in fees and in your monthly payment, next to what your remodel would cost. It doesn\'t pick for you, and no email is needed to see it.' }));

    var inputs = {};
    var grid = el('div', { class: 'crm-grid' });
    FIELDS.forEach(function (f) {
      var iid = id + '-' + f.key;
      var input = el('input', { type: 'text', id: iid, inputmode: 'decimal', autocomplete: 'off' });
      if (f.money) input.setAttribute('placeholder', '$');
      input.addEventListener('blur', function () { var v = num(input.value); if (f.money && v !== null) input.value = Math.round(v).toLocaleString('en-US'); });
      inputs[f.key] = input;
      grid.appendChild(el('div', { class: 'crm-field' }, [el('label', { for: iid, text: f.label }), input, f.hint ? el('span', { class: 'crm-hint', text: f.hint }) : null]));
    });
    form.appendChild(grid);
    if (cfg.calc) form.appendChild(el('p', { class: 'crm-fine' }, ['No remodel range yet? ', el('a', { href: cfg.calc + (cfg.calc.indexOf('?') >= 0 ? '&' : '?') + 'ref=remodel-or-move', text: 'Get one from our cost calculator' }), ' in about two minutes, then come back.']));

    // Assumptions, each with its source. Editable.
    var A = {};
    function aField(key, label, val, src) {
      var iid = id + '-a-' + key;
      var input = el('input', { type: 'text', id: iid, inputmode: 'decimal', value: String(val) });
      A[key] = input;
      return el('div', { class: 'crm-field' }, [el('label', { for: iid, text: label }), input, src ? el('span', { class: 'crm-hint', text: src }) : null]);
    }
    var det = el('details', {}, [el('summary', { text: 'The assumptions (sourced; change any of them)' }), el('div', { class: 'crm-assume' }, [
      el('div', { class: 'crm-grid' }, [
        aField('rate', 'Today\'s 30-year rate (%)', cfg.rate, 'Freddie Mac average, ' + cfg.rateDate),
        aField('commission', 'Agent commission, total (%)', cfg.commission, 'Average in ' + cfg.commissionArea + ' (Clever, 2026)'),
        aField('sellerLow', 'Seller closing, low (%)', SOURCES.sellerClosing.low, 'Redfin, 2026'),
        aField('sellerHigh', 'Seller closing, high (%)', SOURCES.sellerClosing.high, ''),
        aField('buyerLow', 'Buyer closing, low (%)', SOURCES.buyerClosing.low, 'The Mortgage Reports, 2026'),
        aField('buyerHigh', 'Buyer closing, high (%)', SOURCES.buyerClosing.high, ''),
        aField('moveLow', 'Movers, low ($)', SOURCES.moving.low, 'Bellhop, 2026, local 3-bedroom'),
        aField('moveHigh', 'Movers, high ($)', SOURCES.moving.high, '')
      ]),
      el('p', { class: 'crm-fine', text: 'Sources are listed under the results.' })
    ])]);
    form.appendChild(det);

    var go = el('button', { type: 'button', class: 'crm-btn', text: 'Show me the math' });
    var msg = el('p', { class: 'crm-msg', role: 'alert' }); msg.hidden = true;
    form.appendChild(go); form.appendChild(msg);
    card.appendChild(form); card.appendChild(result);
    wrap.appendChild(card); root.innerHTML = ''; root.appendChild(wrap);

    var last = null;
    function read() {
      var i = {}; FIELDS.forEach(function (f) { i[f.key] = num(inputs[f.key].value); });
      var a = {}; Object.keys(A).forEach(function (k) { a[k] = num(A[k].value); });
      return { i: i, a: a };
    }
    go.addEventListener('click', function () {
      var d = read(), i = d.i, a = d.a, bad = [];
      FIELDS.forEach(function (f) {
        var miss = (f.req && i[f.key] === null) || (f.needsLoan && (i.balance || 0) > 0 && !i[f.key]);
        inputs[f.key].classList.toggle('crm-err', !!miss); if (miss) bad.push(f.label);
      });
      Object.keys(A).forEach(function (k) { var miss = a[k] === null; A[k].classList.toggle('crm-err', miss); if (miss) bad.push('an assumption'); });
      if (bad.length) { msg.hidden = false; msg.textContent = 'Fill in: ' + bad[0].toLowerCase() + '.'; if (/assumption/.test(bad[0])) det.open = true; return; }
      if (i.remLow !== null && i.remHigh === null) i.remHigh = i.remLow;
      msg.hidden = true;
      last = { i: i, a: a, r: compute(i, a) };
      render();
    });

    function rows(list) {
      return el('ul', { class: 'crm-rows' }, list.map(function (x) { return el('li', { class: x[2] ? 't' : '' }, [el('span', { text: x[0] }), el('span', { text: x[1] })]); }));
    }

    function render(noScroll) {
      var i = last.i, a = last.a, r = last.r;
      result.innerHTML = '';
      result.appendChild(el('h3', { text: 'The math, side by side' }));
      result.appendChild(el('p', { class: 'crm-lede', text: 'Where a source gives a range, you see the low and the high. Payments are principal and interest only.' }));

      var mv = el('div', { class: 'crm-side mv' }, [
        el('h4', { text: 'If you move' }),
        el('p', {}, ['Fees to sell, buy and move: ', el('br'), el('span', { class: 'crm-big', text: range(r.low.fees, r.high.fees) })]),
        el('p', { class: 'crm-fine', text: 'Money that goes to the sale, the purchase and the move, not into either home.' }),
        rows([
          ['Agent commission (' + a.commission + '%)', money(r.low.commission)],
          ['Seller closing costs', range(r.low.sellerClosing, r.high.sellerClosing)],
          ['Buyer closing costs', range(r.low.buyerClosing, r.high.buyerClosing)],
          ['Movers', range(r.low.moving, r.high.moving)],
          ['Left for a down payment', range(r.high.down, r.low.down), true],
          ['New loan', range(r.low.loan, r.high.loan), true],
          ['New monthly payment (' + a.rate + '%, 30 yr)', range(r.low.newPay, r.high.newPay), true]
        ].concat(r.high.down > i.newPrice ? [['Cash left after buying', range(r.high.down - i.newPrice, r.low.down - i.newPrice), true]] : []))
      ]);
      var curTxt = r.curPay ? money(r.curPay) + ' a month' : 'Paid off';
      var diffLow = r.low.newPay - r.curPay, diffHigh = r.high.newPay - r.curPay;
      var rem = el('div', { class: 'crm-side' }, [
        el('h4', { text: 'If you remodel' }),
        el('p', {}, ['Your remodel range: ', el('br'), el('span', { class: 'crm-big', text: i.remLow !== null ? range(i.remLow, i.remHigh) : 'Not entered' })]),
        el('p', { class: 'crm-fine', text: 'This money goes into the home you keep.' }),
        rows([
          ['Your mortgage stays', curTxt, true],
          ['Your rate stays', i.balance > 0 ? i.curRate + '%' : 'No mortgage']
        ]),
        el('p', { class: 'crm-fine', text: 'If you borrow for the remodel, that loan\'s payment adds to this. A lender can tell you what it would be.' })
      ]);
      result.appendChild(el('div', { class: 'crm-sides' }, [mv, rem]));

      diffLow = Math.round(diffLow); diffHigh = Math.round(diffHigh);
      var diffTxt = diffLow === 0 && diffHigh === 0 ? 'Your monthly payment would stay the same.'
        : diffHigh <= 0 && diffLow <= 0 ? 'Moving would lower your monthly payment by ' + range(-diffHigh, -diffLow) + '.'
        : diffLow >= 0 ? 'Moving would raise your monthly payment by ' + range(diffLow, diffHigh) + '.'
          : 'Depending on the costs, moving would change your monthly payment from ' + money(-diffLow) + ' lower to ' + money(diffHigh) + ' higher.';
      result.appendChild(el('div', { class: 'crm-note' }, [el('p', { style: 'font-weight:700', text: 'Monthly payment: now ' + curTxt.toLowerCase() + ', after a move ' + range(r.low.newPay, r.high.newPay) + '.' }), el('p', { text: diffTxt })]));

      result.appendChild(el('p', { class: 'crm-fine', text: 'Not in this math: property taxes and insurance on either home, repairs to get your home ready to sell, and what either home is worth later. This is a planning tool, not financial advice. For your real numbers, talk with a lender and a real estate agent.' }));

      if (cfg.calc && i.remLow === null) result.appendChild(el('a', { class: 'crm-btn', href: cfg.calc + (cfg.calc.indexOf('?') >= 0 ? '&' : '?') + 'ref=remodel-or-move', text: 'Get my remodel range' }));

      result.appendChild(el('details', {}, [el('summary', { text: 'Sources' }), el('ol', { class: 'crm-src' },
        ['rate', 'commission', 'sellerClosing', 'buyerClosing', 'moving'].map(function (k) { return el('li', {}, [SOURCES[k].text + ' ', el('a', { href: SOURCES[k].url, target: '_blank', rel: 'noopener', text: 'Source' })]); }))]));

      var again = el('button', { type: 'button', class: 'crm-link', text: 'Change my numbers' });
      again.addEventListener('click', function () { result.hidden = true; form.hidden = false; });
      result.appendChild(again);
      result.appendChild(optin());
      form.hidden = true; result.hidden = false;
      if (!noScroll) { try { if (root.getBoundingClientRect().top < 0) root.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }
    }

    function optin() {
      var f = id + '-f';
      var first = el('input', { type: 'text', id: f + 'n', autocomplete: 'given-name' });
      var email = el('input', { type: 'email', id: f + 'e', autocomplete: 'email' });
      var phone = el('input', { type: 'tel', id: f + 'p', autocomplete: 'tel' });
      var hp = el('input', { type: 'text', class: 'crm-hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', name: 'website' });
      var box = el('input', { type: 'checkbox', id: f + 'c' });
      var label = el('label', { for: f + 'c' }, [
        'I consent to ' + cfg.business + ' contacting me about my project, including estimates, scheduling, and relevant updates by email, phone, or text message. Message and data rates may apply. I can unsubscribe or opt out at any time. By submitting this form, you agree to our ',
        el('a', { href: cfg.terms, target: '_blank', rel: 'noopener', text: 'Terms of Service' }), ' and ',
        el('a', { href: cfg.privacy, target: '_blank', rel: 'noopener', text: 'Privacy Policy' }), '.']);
      var consent = el('div', { class: 'crm-consent' }, [box, label]);
      var send = el('button', { type: 'button', class: 'crm-btn', text: 'Email me this comparison' });
      var m = el('p', { class: 'crm-msg', role: 'alert' }); m.hidden = true;
      var b = el('div', { class: 'crm-optin' }, [
        el('h4', { text: 'Want a copy?' }),
        el('p', { text: 'We\'ll email you these numbers so you can look at them again or show them to someone.' }),
        el('div', { class: 'crm-grid' }, [
          el('div', { class: 'crm-field' }, [el('label', { for: f + 'n', text: 'First name' }), first]),
          el('div', { class: 'crm-field' }, [el('label', { for: f + 'e', text: 'Email *' }), email]),
          el('div', { class: 'crm-field' }, [el('label', { for: f + 'p', text: 'Phone (optional)' }), phone])
        ]), consent, send, m, hp]);
      send.addEventListener('click', function () {
        var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
        var d = phone.value.replace(/\D/g, '');
        var phoneOk = !d || d.length >= 10;
        email.classList.toggle('crm-err', !ok); phone.classList.toggle('crm-err', !phoneOk); consent.classList.toggle('crm-err', !box.checked);
        if (!ok) { m.hidden = false; m.textContent = 'Add a valid email.'; return; }
        if (!phoneOk) { m.hidden = false; m.textContent = 'Check the phone number, or leave it blank.'; return; }
        if (!box.checked) { m.hidden = false; m.textContent = 'Check the box so we can email you.'; return; }
        m.hidden = true;
        function done(t) { b.innerHTML = ''; b.appendChild(el('h4', { text: 'Sent.' })); b.appendChild(el('p', { class: 'crm-done', text: t })); }
        if (hp.value) { done('Check your inbox. It can take a few minutes.'); return; }
        var now = new Date(), i = last.i, r = last.r;
        var payload = {
          tool: TOOL, first_name: first.value.trim(), email: email.value.trim(), phone: d,
          results: summary(i, last.a, r),
          remodel_range: i.remLow !== null ? range(i.remLow, i.remHigh) : '',
          move_fees: range(r.low.fees, r.high.fees),
          payment_now: r.curPay ? money(r.curPay) : 'paid off',
          payment_after_move: range(r.low.newPay, r.high.newPay),
          ref: leadRef(),
          last_date: now.toISOString().slice(0, 10),
          consent_proof: 'Box checked. Wording shown: ' + label.textContent + ' Page: ' + location.href.split('#')[0] + '. Time: ' + now.toISOString()
        };
        if (cfg.mock || !cfg.webhook) {
          root.setAttribute('data-last-payload', JSON.stringify(payload));
          done(cfg.mock ? 'Preview only: nothing was sent. On the live page this emails the comparison.' : 'Check your inbox. It can take a few minutes.');
          return;
        }
        send.disabled = true; send.textContent = 'Sending...';
        fetch(cfg.webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          .then(function (res) { if (!res.ok) throw new Error(String(res.status)); done('Check your inbox. It can take a few minutes.'); })
          .catch(function () { send.disabled = false; send.textContent = 'Email me this comparison'; m.hidden = false; m.textContent = 'That did not go through. Please try again.'; });
      });
      return b;
    }

    var pre = root.getAttribute('data-preview');
    if (cfg.mock && pre) {
      try {
        var p = JSON.parse(pre);
        Object.keys(p).forEach(function (k) { if (inputs[k]) inputs[k].value = k === 'curRate' || k === 'years' ? String(p[k]) : Math.round(p[k]).toLocaleString('en-US'); });
        if (p.show) go.click();
      } catch (e) {}
    }
  }

  // mount(el) starts one tool on an element added after page load (review pages).
  window.CDMagnetRemodelOrMove = { compute: compute, payment: payment, SOURCES: SOURCES, mount: function (root) { injectCss(); init(root); } };

  function boot() { injectCss(); Array.prototype.forEach.call(document.querySelectorAll('[data-cd-magnet="remodel-or-move"]'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
