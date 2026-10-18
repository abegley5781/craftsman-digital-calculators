/*
 * Craftsman Digital free tool: What's a Lead Worth? (lead value, missed calls, leads you need)
 * Spec: ICM-WORKSPACE/workspaces/craftsman-digital/offers/mini-lead-magnets.md (tool 2)
 *
 * Embed (GHL Custom Code on a CD page):
 *
 * <div data-cd-magnet="lead-worth"
 *   data-webhook-url="<Magnet - Opt-in inbound webhook URL>"
 *   data-terms-url="https://craftsman-digital.com/terms"
 *   data-privacy-url="https://craftsman-digital.com/privacy"
 * ></div>
 * <script src="https://abegley5781.github.io/craftsman-digital-calculators/magnets/lead-worth/lead-worth.js"></script>
 *
 * data-mode="mock" posts nothing (previews). No API key, no outside calls.
 *
 * Rules (spec): the math runs on the contractor's own numbers only. The
 * starting numbers are Andrew's own CKB numbers, labeled as his, from
 * offers/case-study-craftsman-kitchen-bath.md (jobs $5,000-$10,000, ~75% of
 * leads to an in-home visit, ~60% of visits hired him). The only outside stat
 * is HBR 2011 (Oldroyd, McElheran, Elkington), shown as labeled context and
 * never used in the math; wording checked against hbr.org 2026-10-16.
 * Core price: $299 setup + $97/mo (offers/websites.md, 2026-09-27).
 */
(function () {
  'use strict';

  var TOOL = 'lead-worth';
  var CORE_SETUP = 299, CORE_MONTH = 97;
  var CONSENT_TEXT = 'I agree that Craftsman Digital LLC may send me marketing texts and calls at this number, ' +
    'including automated texts and prerecorded voicemails. Agreeing is not required to buy anything. ' +
    'Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.';
  var ANDREW = { job: 5000, visits: 7.5, sells: 6 };
  // Sample margin (Andrew 2026-10-17: "use an ideal margin based on hormozi or michael stone").
  // Stone, not Hormozi: Hormozi's 80% gross-margin rule is for low-material services
  // (research/active-hormozi-gross-vs-net-margin). Stone's own example, quoted from his site:
  // "if the estimated cost for a job is $10,000, they'll multiply the $10,000 x 1.50 and arrive
  // at a $15,000 sales price" = a 33% gross margin. Same article: overhead runs "25% to 54% of
  // their revenue", so the result is gross profit before overhead, never net.
  var STONE = { margin: 33, url: 'https://www.markupandprofit.com/articles/how-much-should-a-contractor-charge/' };
  var HBR_URL = 'https://hbr.org/2011/03/the-short-life-of-online-sales-leads';

  // ---- Math. Pure functions; every input is the contractor's own number. ----
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[$,%\s]/g, '')); return isFinite(n) && n >= 0 ? n : null; }
  function compute(s) {
    var out = {};
    var job = num(s.job), v = num(s.visits), k = num(s.sells), m = num(s.margin), leads = num(s.leads);
    var haveRates = job !== null && v !== null && k !== null && v <= 10 && k <= 10;
    out.leadSales = haveRates ? job * (v / 10) * (k / 10) : null;
    out.leadProfit = out.leadSales !== null && m !== null && m <= 100 ? out.leadSales * m / 100 : null;
    out.monthSales = out.leadSales !== null && leads !== null ? out.leadSales * leads : null;
    // Compare Core's cost with profit only. Comparing it with sales would flatter it.
    var per = out.leadProfit;
    out.coreYear1 = CORE_SETUP + 12 * CORE_MONTH;
    out.breakEven = per ? Math.max(1, Math.ceil(out.coreYear1 / per)) : null;

    var calls = num(s.calls), miss = num(s.miss), lost = num(s.lost);
    out.missedYear = calls !== null && miss !== null && miss <= 10 ? calls * 52 * miss / 10 : null;
    out.lostLeads = out.missedYear !== null && lost !== null && lost <= 10 ? out.missedYear * lost / 10 : null;
    out.lostSales = out.lostLeads !== null && out.leadSales !== null ? out.lostLeads * out.leadSales : null;
    out.lostProfit = out.lostSales !== null && m !== null && m <= 100 ? out.lostSales * m / 100 : null;

    var goal = num(s.goal);
    if (goal !== null && haveRates && job > 0 && v > 0 && k > 0) {
      out.jobsYear = goal / job;
      out.estYear = out.jobsYear / (k / 10);
      out.leadsYear = out.estYear / (v / 10);
      out.jobsMonth = out.jobsYear / 12; out.estMonth = out.estYear / 12; out.leadsMonth = out.leadsYear / 12;
      out.leadsNow = leads;
    }
    return out;
  }

  function money(n) { return n === null || n === undefined ? '' : '$' + Math.round(n).toLocaleString('en-US'); }
  function one(n) { return (Math.round(n * 10) / 10).toLocaleString('en-US'); }
  function up(n) { return Math.ceil(n - 1e-9).toLocaleString('en-US'); }

  // The emailed full report (teaser on screen, full report by email: Andrew 2026-10-17).
  // Plain text; the email keeps its line breaks. Their own numbers only, plus the labeled HBR line.
  function leadReport(s, o) {
    var L = ['What\'s a Lead Worth: your full report', ''];
    if (o.leadSales !== null) {
      L.push('ONE LEAD');
      L.push('One lead is worth about ' + money(o.leadSales) + ' in sales' + (o.leadProfit !== null ? ' and ' + money(o.leadProfit) + ' in gross profit (before overhead), at a ' + one(num(s.margin)) + '% margin.' : '. Add your margin to see the gross profit.'));
      L.push('The math is ' + money(num(s.job)) + ' job x ' + one(num(s.visits)) + ' of 10 leads become visits x ' + one(num(s.sells)) + ' of 10 visits hire you. Every lead you lose or let go cold costs about that much.');
      if (o.monthSales !== null) L.push('A month of leads (' + one(num(s.leads)) + ') is worth about ' + money(o.monthSales) + ' in sales.');
      L.push(o.breakEven
        ? 'Our Core plan (website + price calculator) is $' + CORE_SETUP + ' to set up and $' + CORE_MONTH + ' a month, ' + money(o.coreYear1) + ' the first year. At your numbers, that\'s the gross profit from ' + o.breakEven + ' lead' + (o.breakEven === 1 ? '' : 's') + ' a year.'
        : 'Our Core plan (website + price calculator) is $' + CORE_SETUP + ' to set up and $' + CORE_MONTH + ' a month. With your margin, the tool shows how many leads a year cover it.');
      if (o.leadProfit !== null) {
        L.push('Gross profit is what\'s left after the job\'s costs, before overhead. Michael Stone (Markup & Profit) puts a typical remodeler\'s overhead at 25% to 54% of revenue, so gross profit isn\'t take-home pay.');
        if (s.marginSample) L.push('The 33% margin is a sample. It\'s a 1.5 markup, Michael Stone\'s example in Markup & Profit (' + STONE.url + '). Put in your own margin for your own numbers.');
      }
      L.push('');
    }
    if (o.missedYear !== null) {
      L.push('MISSED CALLS');
      L.push('You miss about ' + up(o.missedYear) + ' new-customer calls a year (' + one(num(s.calls)) + ' a week, ' + one(num(s.miss)) + ' of 10 missed).');
      if (o.lostLeads !== null) L.push('By your guess, ' + up(o.lostLeads) + ' of them hire someone else before you call back' + (o.lostSales !== null ? ': about ' + money(o.lostSales) + ' of work a year' + (o.lostProfit !== null ? ', ' + money(o.lostProfit) + ' of it gross profit (before overhead).' : '.') : '.'));
      if (s.callback) L.push('You said you usually call back ' + ({ 'Within an hour': 'within an hour', 'Same day': 'the same day', 'Next day or later': 'the next day or later' }[s.callback] || s.callback.toLowerCase()) + '.');
      L.push('For context (this isn\'t from your numbers), a 2011 Harvard Business Review study of 1.25 million web leads at 42 US companies found that firms that tried to reach a lead within an hour were nearly 7 times as likely to have a real conversation with the decision maker as firms that waited even one more hour, and more than 60 times as likely as firms that waited 24 hours or longer. Those were web leads, not homeowners calling a remodeler. ' + HBR_URL);
      L.push('');
    }
    if (o.leadsMonth !== undefined) {
      L.push('LEADS YOU NEED');
      L.push('To reach ' + money(num(s.goal)) + ' a year you need ' + up(o.jobsYear) + ' jobs at ' + money(num(s.job)) + ' each. Each month that\'s about ' + up(o.leadsMonth) + ' leads, ' + up(o.estMonth) + ' estimate visits and ' + up(o.jobsMonth) + ' jobs sold.');
      if (o.leadsNow !== null && o.leadsNow !== undefined) L.push('You get ' + one(o.leadsNow) + ' leads a month now, so you need ' + (o.leadsNow >= o.leadsMonth ? 'no more than you have.' : 'about ' + up(o.leadsMonth - o.leadsNow) + ' more a month.'));
    }
    return L.join('\n').trim();
  }

  function resultsSentence(s, o) {
    var parts = [];
    if (o.leadSales !== null) parts.push('At your numbers, one lead is worth about ' + money(o.leadSales) + ' in sales' + (o.leadProfit !== null ? ' and ' + money(o.leadProfit) + ' in profit.' : '.'));
    if (o.lostSales !== null) parts.push('Missed calls cost you about ' + money(o.lostSales) + ' of work a year (' + up(o.lostLeads) + ' leads).');
    if (o.leadsMonth !== undefined) parts.push('To reach ' + money(num(s.goal)) + ' a year you need about ' + up(o.leadsMonth) + ' leads a month, ' + up(o.estMonth) + ' estimate visits and ' + up(o.jobsMonth) + ' jobs.');
    return parts.join(' ');
  }

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  var CSS = [
    '.cdl{--cdm-ink:#1f2328;--cdm-navy:#2d3646;--cdm-muted:#4c5564;--cdm-steel:#4e7c91;--cdm-steel-2:#5f8fa6;--cdm-gold:#c2a26d;',
    '--cdm-paper:#ffffff;--cdm-wash:#f3f6f8;--cdm-line:#d5dde3;--cdm-good:#2f7a4f;--cdm-fix:#a8571c;--cdm-on-steel:#ffffff;',
    '--cdm-head:"Libre Baskerville",Georgia,"Times New Roman",serif;--cdm-body:"Source Sans 3","Source Sans Pro",Arial,Helvetica,sans-serif;',
    'font-family:var(--cdm-body);color:var(--cdm-ink);font-size:17px;line-height:1.5;max-width:760px;margin:0 auto;}',
    '.cdl *{box-sizing:border-box;}',
    '.cdl-card{background:var(--cdm-paper);border:1px solid var(--cdm-line);border-radius:10px;padding:clamp(18px,4vw,30px);display:grid;gap:18px;}',
    '.cdl h3{font-family:var(--cdm-head);font-weight:700;font-size:clamp(1.25rem,3.2vw,1.6rem);line-height:1.25;margin:0;color:var(--cdm-navy);text-wrap:balance;}',
    '.cdl h4{font-family:var(--cdm-head);font-weight:700;font-size:1.1rem;margin:0;color:var(--cdm-navy);}',
    '.cdl p{margin:0;}',
    '.cdl-lede{color:var(--cdm-muted);}',
    '.cdl-tabs{display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid var(--cdm-line);}',
    '.cdl-tab{font:inherit;font-weight:600;font-size:16px;background:none;border:0;border-bottom:3px solid transparent;padding:10px 12px;color:var(--cdm-muted);cursor:pointer;margin-bottom:-1px;}',
    '.cdl-tab[aria-selected=true]{color:var(--cdm-navy);border-bottom-color:var(--cdm-steel);}',
    '.cdl-ex{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;background:color-mix(in srgb,var(--cdm-gold) 18%,var(--cdm-paper));border-radius:8px;padding:10px 14px;font-size:.95rem;}',
    '.cdl-link{font:inherit;font-weight:600;background:none;border:0;color:var(--cdm-steel);text-decoration:underline;cursor:pointer;padding:4px 0;}',
    '.cdl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;}',
    '.cdl-field{display:grid;gap:6px;min-width:0;align-content:start;}',
    '.cdl-field label{font-weight:600;font-size:.95rem;}',
    '.cdl-field small{color:var(--cdm-muted);font-size:.85rem;}',
    '.cdl input[type=text],.cdl input[type=email],.cdl input[type=tel],.cdl select{width:100%;font:inherit;font-size:17px;padding:12px 14px;border:1px solid var(--cdm-line);border-radius:8px;background:var(--cdm-paper);color:var(--cdm-ink);font-variant-numeric:tabular-nums;}',
    '.cdl input:focus-visible,.cdl select:focus-visible,.cdl button:focus-visible{outline:3px solid var(--cdm-steel-2);outline-offset:2px;}',
    '.cdl-out{display:grid;gap:12px;background:var(--cdm-wash);border-radius:10px;padding:clamp(16px,3.5vw,24px);}',
    '.cdl-big{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;}',
    '.cdl-stat{display:grid;gap:2px;min-width:0;}',
    '.cdl-stat b{font-family:var(--cdm-head);font-size:clamp(1.6rem,5vw,2.2rem);line-height:1.1;color:var(--cdm-navy);font-variant-numeric:tabular-nums;}',
    '.cdl-stat span{color:var(--cdm-muted);font-size:.92rem;}',
    '.cdl-line{max-width:62ch;}',
    '.cdl-wait{color:var(--cdm-muted);font-style:italic;}',
    '.cdl-ctx{font-size:.88rem;color:var(--cdm-muted);border-left:3px solid var(--cdm-line);padding-left:12px;max-width:66ch;}',
    '.cdl-ctx a,.cdl-consent a{color:var(--cdm-steel);}',
    '.cdl-funnel{display:grid;gap:8px;}',
    '.cdl-step{display:grid;grid-template-columns:minmax(0,9em) 1fr auto;gap:10px;align-items:center;font-size:.95rem;}',
    '.cdl-step .t{height:14px;background:var(--cdm-paper);border-radius:4px;overflow:hidden;}',
    '.cdl-step .f{display:block;height:100%;background:var(--cdm-steel-2);}',
    '.cdl-step.jobs .f{background:var(--cdm-gold);}',
    '.cdl-step .c{font-variant-numeric:tabular-nums;font-weight:700;min-width:3ch;text-align:right;}',
    '.cdl-optin{background:var(--cdm-wash);border-radius:10px;padding:clamp(16px,3.5vw,24px);display:grid;gap:14px;}',
    '.cdl-consent{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;font-size:.92rem;}',
    '.cdl-consent input{width:20px;height:20px;margin-top:2px;}',
    '.cdl-btn{font:inherit;font-weight:700;font-size:17px;border:0;border-radius:8px;padding:14px 22px;background:var(--cdm-steel);color:var(--cdm-on-steel);cursor:pointer;justify-self:start;min-height:48px;}',
    '.cdl-btn[disabled]{opacity:.55;cursor:default;}',
    '.cdl-msg{font-size:.95rem;color:var(--cdm-fix);}',
    '.cdl-err{border-color:var(--cdm-fix)!important;}',
    '.cdl-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0;}',
    '.cdl-done{font-weight:600;color:var(--cdm-good);}'
  ].join('');

  function injectCss() {
    if (document.getElementById('cdl-css')) return;
    var s = document.createElement('style'); s.id = 'cdl-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function init(root) {
    var cfg = {
      webhook: root.getAttribute('data-webhook-url') || '',
      terms: root.getAttribute('data-terms-url') || 'https://craftsman-digital.com/terms',
      privacy: root.getAttribute('data-privacy-url') || 'https://craftsman-digital.com/privacy',
      mock: String(root.getAttribute('data-mode') || '').toLowerCase() === 'mock'
    };
    var state = { job: ANDREW.job, visits: ANDREW.visits, sells: ANDREW.sells, margin: STONE.margin, marginSample: true, leads: '', calls: '', miss: '', lost: '', callback: '', goal: '' };
    var usingExample = true;
    var inputs = {};

    function field(key, label, hint, opts) {
      opts = opts || {};
      var input;
      if (opts.options) {
        input = el('select', { id: 'cdl-' + key }, [el('option', { value: '', text: 'Pick one' })]
          .concat(opts.options.map(function (o) { return el('option', { value: o, text: o }); })));
      } else {
        input = el('input', { type: 'text', id: 'cdl-' + key, inputmode: 'decimal', placeholder: opts.ph || '', autocomplete: 'off' });
      }
      input.value = state[key] === '' ? '' : String(state[key]);
      input.addEventListener('input', function () {
        state[key] = input.value;
        if (key === 'margin' && state.marginSample) { state.marginSample = false; marginNote.hidden = true; }
        if (usingExample && (key === 'job' || key === 'visits' || key === 'sells')) { usingExample = false; andrewNote.hidden = true; }
        exBar.hidden = andrewNote.hidden && marginNote.hidden;
        update();
      });
      inputs[key] = input;
      return el('div', { class: 'cdl-field' }, [el('label', { for: 'cdl-' + key, text: label }), input, hint ? el('small', { text: hint }) : null]);
    }

    var wrap = el('div', { class: 'cdl' });
    var card = el('div', { class: 'cdl-card' });
    card.appendChild(el('h3', { text: 'What is one lead worth to your business?' }));
    card.appendChild(el('p', { class: 'cdl-lede', text: 'Put in your own numbers. The main numbers update as you type. No email needed to see them.' }));

    var andrewNote = el('span', { text: 'Job size and the two out-of-10 numbers are Andrew\'s own, from his kitchen and bath business (jobs ran $5,000 to $10,000; this uses the low end).' });
    var marginNote = el('span', {}, ['Sample margin: 33% (a 1.5 markup, ',
      el('a', { href: STONE.url, target: '_blank', rel: 'noopener', style: 'color:var(--cdm-steel)', text: 'Michael Stone\'s example in Markup & Profit' }), ').']);
    var exBar = el('div', { class: 'cdl-ex' }, [
      el('span', { style: 'display:grid;gap:4px;min-width:0' }, [andrewNote, marginNote, el('span', { text: 'Put in yours.' })])
    ]);
    var clearBtn = el('button', { type: 'button', class: 'cdl-link', text: 'Clear the sample numbers' });
    clearBtn.addEventListener('click', function () {
      ['job', 'visits', 'sells', 'margin'].forEach(function (k) { state[k] = ''; inputs[k].value = ''; });
      state.marginSample = false; usingExample = false; andrewNote.hidden = true; marginNote.hidden = true; exBar.hidden = true;
      update(); inputs.job.focus();
    });
    exBar.appendChild(clearBtn);

    // Tabs
    var TABS = [
      { key: 'value', label: 'Lead value' },
      { key: 'missed', label: 'Missed calls' },
      { key: 'need', label: 'Leads you need' }
    ];
    var tabBar = el('div', { class: 'cdl-tabs', role: 'tablist' });
    var panels = {};
    TABS.forEach(function (t, i) {
      var b = el('button', { type: 'button', class: 'cdl-tab', role: 'tab', id: 'cdl-tab-' + t.key, 'aria-controls': 'cdl-panel-' + t.key, 'aria-selected': i === 0 ? 'true' : 'false', text: t.label });
      b.addEventListener('click', function () { show(t.key); });
      tabBar.appendChild(b);
    });
    function show(key) {
      TABS.forEach(function (t) {
        document.getElementById('cdl-tab-' + t.key).setAttribute('aria-selected', t.key === key ? 'true' : 'false');
        panels[t.key].hidden = t.key !== key;
      });
    }

    // Shared numbers (used by every tab)
    var shared = el('div', { class: 'cdl-grid' }, [
      field('job', 'Average job size ($)', null, { ph: '12,000' }),
      field('visits', 'Of 10 leads, how many become estimate visits?', 'Out of 10. Halves are fine.', { ph: '7' }),
      field('sells', 'Of 10 estimates, how many hire you?', 'Out of 10.', { ph: '4' }),
      field('margin', 'Gross margin (%)', 'What\'s left after materials, labor and subs, before overhead.', { ph: '33' })
    ]);

    // Panel: lead value
    var outValue = el('div', { class: 'cdl-out', 'aria-live': 'polite' });
    panels.value = el('div', { id: 'cdl-panel-value', role: 'tabpanel', 'aria-labelledby': 'cdl-tab-value', style: 'display:grid;gap:14px' }, [
      el('div', { class: 'cdl-grid' }, [field('leads', 'Leads a month', 'Calls, forms and messages from new customers.', { ph: '10' })]),
      outValue
    ]);

    // Panel: missed calls
    var outMissed = el('div', { class: 'cdl-out', 'aria-live': 'polite' });
    panels.missed = el('div', { id: 'cdl-panel-missed', role: 'tabpanel', 'aria-labelledby': 'cdl-tab-missed', style: 'display:grid;gap:14px' }, [
      el('div', { class: 'cdl-grid' }, [
        field('calls', 'New-customer calls a week', null, { ph: '6' }),
        field('miss', 'Of 10 of those calls, how many do you miss while working?', 'Out of 10.', { ph: '4' }),
        field('lost', 'Of 10 people you miss, how many hire someone else before you call back?', 'Your best guess, out of 10.', { ph: '3' }),
        field('callback', 'When you miss one, how long until you call back?', null, { options: ['Within an hour', 'Same day', 'Next day or later'] })
      ]),
      outMissed
    ]);
    panels.missed.hidden = true;

    // Panel: leads you need
    var outNeed = el('div', { class: 'cdl-out', 'aria-live': 'polite' });
    panels.need = el('div', { id: 'cdl-panel-need', role: 'tabpanel', 'aria-labelledby': 'cdl-tab-need', style: 'display:grid;gap:14px' }, [
      el('div', { class: 'cdl-grid' }, [field('goal', 'Sales goal for the year ($)', null, { ph: '400,000' })]),
      outNeed
    ]);
    panels.need.hidden = true;

    [exBar, shared, tabBar, panels.value, panels.missed, panels.need].forEach(function (n) { card.appendChild(n); });
    var optinSlot = el('div');
    card.appendChild(optinSlot);
    wrap.appendChild(card);
    root.innerHTML = '';
    root.appendChild(wrap);

    function stat(big, label) { return el('div', { class: 'cdl-stat' }, [el('b', { text: big }), el('span', { text: label })]); }
    function wait(t) { return el('p', { class: 'cdl-wait', text: t }); }

    var last = null;
    function update() {
      var o = compute(state); last = o;

      outValue.innerHTML = '';
      if (o.leadSales === null) {
        outValue.appendChild(wait('Fill in job size and the two "out of 10" numbers to see what one lead is worth.'));
      } else {
        // Teaser: the headline numbers. The math, profit and the Core comparison go in the emailed report.
        outValue.appendChild(el('div', { class: 'cdl-big' }, [
          stat(money(o.leadSales), 'one lead is worth in sales'),
          o.monthSales !== null ? stat(money(o.monthSales), 'in sales from a month of leads') : null
        ]));
        outValue.appendChild(el('p', { class: 'cdl-wait', text: 'In your full report: ' + (o.leadProfit !== null ? 'what one lead is worth in gross profit, ' : '') + 'the math behind it, and what our Core plan costs next to one lead.' }));
      }

      outMissed.innerHTML = '';
      if (o.missedYear === null) {
        outMissed.appendChild(wait('Fill in calls a week and how many you miss to see what missed calls cost.'));
      } else {
        outMissed.appendChild(el('div', { class: 'cdl-big' }, [
          stat(up(o.missedYear), 'new-customer calls missed a year'),
          o.lostSales !== null ? stat(money(o.lostSales), 'of work lost a year') : (o.lostLeads !== null ? stat('?', 'fill in the lead value numbers above') : stat('?', 'add how many hire someone else'))
        ]));
        outMissed.appendChild(el('p', { class: 'cdl-wait', text: 'In your full report: how many of those people hire someone else' + (o.lostProfit !== null ? ', the gross profit you lose' : '') + ', and what a study found about how fast you call back.' }));
      }

      outNeed.innerHTML = '';
      if (o.leadsMonth === undefined) {
        outNeed.appendChild(wait(o.leadSales === null ? 'Fill in job size and the two "out of 10" numbers above, then your sales goal.' : 'Put in your sales goal for the year.'));
      } else {
        var steps = [
          { k: 'leads', label: 'Leads', n: o.leadsMonth },
          { k: 'est', label: 'Estimate visits', n: o.estMonth },
          { k: 'jobs', label: 'Jobs sold', n: o.jobsMonth }
        ];
        var max = Math.max(o.leadsMonth, 1);
        outNeed.appendChild(el('h4', { text: 'What it takes each month to reach ' + money(num(state.goal)) + ' a year' }));
        outNeed.appendChild(el('div', { class: 'cdl-funnel' }, steps.map(function (s) {
          return el('div', { class: 'cdl-step ' + s.k }, [
            el('span', { text: s.label }),
            el('span', { class: 't' }, [el('span', { class: 'f', style: 'width:' + (100 * s.n / max).toFixed(1) + '%' })]),
            el('span', { class: 'c', text: up(s.n) })
          ]);
        })));
        outNeed.appendChild(el('p', { class: 'cdl-wait', text: 'In your full report: the jobs you need a year' + (o.leadsNow !== null && o.leadsNow !== undefined ? ' and how far your leads today are from the goal.' : '. Put your leads a month in the Lead value tab to compare them with the goal.') }));
      }

      optinSlot.hidden = o.leadSales === null;
      if (!optinSlot.firstChild) optinSlot.appendChild(buildOptin());
    }

    function buildOptin() {
      var first = el('input', { type: 'text', id: 'cdl-first', autocomplete: 'given-name', placeholder: 'First name' });
      var email = el('input', { type: 'email', id: 'cdl-email', autocomplete: 'email', placeholder: 'Email' });
      var phone = el('input', { type: 'tel', id: 'cdl-phone', autocomplete: 'tel', placeholder: 'Phone' });
      var hp = el('input', { type: 'text', class: 'cdl-hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', name: 'website' });
      var box = el('input', { type: 'checkbox', id: 'cdl-consent' });
      var consent = el('div', { class: 'cdl-consent' }, [box, el('label', { for: 'cdl-consent' }, [
        CONSENT_TEXT + ' ',
        el('a', { href: cfg.terms, target: '_blank', rel: 'noopener', text: 'Terms of Service' }), ' and ',
        el('a', { href: cfg.privacy, target: '_blank', rel: 'noopener', text: 'Privacy Policy' }), '.'
      ])]);
      var send = el('button', { type: 'button', class: 'cdl-btn', text: 'Email me my full report' });
      var msg = el('p', { class: 'cdl-msg', role: 'alert' }); msg.hidden = true;
      var box1 = el('div', { class: 'cdl-optin' }, [
        el('h4', { text: 'Email me my full report + the Bottleneck Guide' }),
        el('p', { class: 'cdl-lede', text: 'Get the full report: the math behind each number, what missed calls cost you in gross profit, and what Core costs next to one lead. Plus The Remodeler\'s Bottleneck Guide: a short read on whether leads, sales, production or operations is holding you back.' }),
        el('div', { class: 'cdl-grid' }, [
          el('div', { class: 'cdl-field' }, [el('label', { for: 'cdl-first', text: 'First name' }), first]),
          el('div', { class: 'cdl-field' }, [el('label', { for: 'cdl-email', text: 'Email *' }), email]),
          el('div', { class: 'cdl-field' }, [el('label', { for: 'cdl-phone', text: 'Phone *' }), phone])
        ]),
        consent, send, msg, hp
      ]);
      send.addEventListener('click', function () {
        var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
        var digits = phone.value.replace(/\D/g, '');
        email.classList.toggle('cdl-err', !emailOk);
        phone.classList.toggle('cdl-err', digits.length < 10);
        consent.classList.toggle('cdl-err', !box.checked);
        if (!emailOk || digits.length < 10) { msg.hidden = false; msg.textContent = 'Add a valid email and phone number.'; return; }
        if (!box.checked) { msg.hidden = false; msg.textContent = 'Check the box to get your full report by email.'; return; }
        msg.hidden = true;
        function done(t) { box1.innerHTML = ''; box1.appendChild(el('h4', { text: 'Sent.' })); box1.appendChild(el('p', { class: 'cdl-done', text: t })); }
        if (hp.value) { done('Check your inbox for your full report and the guide.'); return; }
        var now = new Date();
        var o = compute(state);
        var payload = {
          tool: TOOL, first_name: first.value.trim(), email: email.value.trim(), phone: digits,
          results: leadReport(state, o) + (usingExample ? '\n\n(Ran on Andrew\'s example numbers. Put in yours for your own report.)' : ''),
          last_date: now.toISOString().slice(0, 10),
          consent_proof: 'Box checked. Wording shown: ' + CONSENT_TEXT + ' Page: ' + location.href.split('#')[0] + '. Time: ' + now.toISOString(),
          place_id: '', gbp_score: '', gbp_gaps: '', gbp_rank: '',
          lead_value: o.leadSales !== null ? String(Math.round(o.leadSales)) : '',
          yearly_loss: o.lostSales !== null ? String(Math.round(o.lostSales)) : '',
          bottleneck: '', site_url: '', site_mobile_score: ''
        };
        if (cfg.mock || !cfg.webhook) {
          root.setAttribute('data-last-payload', JSON.stringify(payload));
          done(cfg.mock ? 'Preview only: nothing was sent. On the live page this emails the full report and the guide.' : 'Check your inbox for your full report and the guide.');
          return;
        }
        send.disabled = true; send.textContent = 'Sending...';
        fetch(cfg.webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          .then(function (r) { if (!r.ok) throw new Error('status ' + r.status); done('Check your inbox for your full report and the guide. It can take a few minutes.'); })
          .catch(function () { send.disabled = false; send.textContent = 'Email me my full report'; msg.hidden = false; msg.textContent = 'That did not go through. Try again, or call or text (877) 560-0450.'; });
      });
      return box1;
    }

    // Preview only: data-preview-fill fills the other tabs with sample numbers so every tab shows results.
    var fill = root.getAttribute('data-preview-fill');
    if (cfg.mock && fill) {
      try {
        var f = JSON.parse(fill);
        Object.keys(f).forEach(function (k) { if (inputs[k]) { state[k] = f[k]; inputs[k].value = String(f[k]); } });
      } catch (e) {}
    }
    update();
  }

  window.CDMagnetLeadWorth = { compute: compute, resultsSentence: resultsSentence };

  function boot() {
    injectCss();
    Array.prototype.forEach.call(document.querySelectorAll('[data-cd-magnet="lead-worth"]'), init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
