/*
 * Craftsman Digital free tool: Google profile check vs. the top 3.
 * Spec: ICM-WORKSPACE/workspaces/craftsman-digital/offers/mini-lead-magnets.md (tool 4)
 * Plumbing: ICM-WORKSPACE/workspaces/craftsman-digital/sprints/2026-10-15-close-path-clean/cd-sprint6-d-plumbing.md
 *
 * Embed (GHL Custom Code on a CD page):
 *
 * <div data-cd-magnet="gbp-check"
 *   data-api-url="https://cd-magnets.<account>.workers.dev"
 *   data-webhook-url="<Magnet - Opt-in inbound webhook URL>"
 *   data-terms-url="https://craftsman-digital.com/terms"
 *   data-privacy-url="https://craftsman-digital.com/privacy"
 * ></div>
 * <script src="https://abegley5781.github.io/craftsman-digital-calculators/magnets/gbp-check/gbp-check.js"></script>
 *
 * data-mode="mock" runs on built-in sample data: no Google calls, no webhook
 * post, and a "sample data" label on screen. Used for previews.
 *
 * The page never talks to Google directly and never holds a key. It talks to
 * the cd-magnets Worker (magnets/worker/), which holds the key, stops at its
 * monthly cap, and returns only what this file needs:
 *   GET  {api}/autocomplete?input=...&session=...
 *        -> { suggestions: [{ placeId, main, secondary }] }
 *   POST {api}/gbp-check  { placeId, session, trade, area }   (area = the town box)
 *        -> { you: { name, address, town, mapsUri, rating, reviews, website,
 *                    hasHours, phone, photos, status, category },
 *             search: { query, rank, checked, top: [{ name, reviews, rating }] } }
 *        or { error: "..." }
 *
 * Google's rules this file follows (Places API policies page, read 2026-10-16):
 * - "When displaying Places API data without a Google Map, you must include
 *   the Google logo": the results carry Google Maps attribution.
 * - Only the place ID is stored (sent to GHL). Rating, review counts, hours
 *   and phone are shown on screen and never sent to GHL; the opt-in sends this
 *   tool's own score, gaps and rank.
 * - No review text or photos are shown, so no author credits are needed.
 *
 * The score is CD's own checklist (weights below), not a Google number, and
 * the page says so. The only comparison is the real top 3 for the search the
 * contractor picked. No industry averages.
 */
(function () {
  'use strict';

  var TOOL = 'gbp-check';
  var CONSENT_TEXT = 'I agree that Craftsman Digital LLC may send me marketing texts and calls at this number, ' +
    'including automated texts and prerecorded voicemails. Agreeing is not required to buy anything. ' +
    'Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.';

  var TRADES = [
    { value: 'bathroom remodeler', label: 'Bathroom remodeler' },
    { value: 'kitchen remodeler', label: 'Kitchen remodeler' },
    { value: 'kitchen and bath remodeler', label: 'Kitchen and bath remodeler' },
    { value: 'remodeling contractor', label: 'Remodeling contractor' },
    { value: 'basement finishing', label: 'Basement finishing' },
    { value: 'handyman', label: 'Handyman' }
  ];

  // ---- Sample data for data-mode="mock". Every name and number is made up. ----
  var MOCK_SUGGESTIONS = [
    { placeId: 'mock-1', main: 'Sample Remodeling Co.', secondary: 'Main Ave, Durango, CO' },
    { placeId: 'mock-2', main: 'Sample Kitchen & Bath', secondary: 'Camino del Rio, Durango, CO' },
    { placeId: 'mock-3', main: 'Sample Home Repair', secondary: 'Florida Rd, Durango, CO' }
  ];
  function mockCheck(pick, trade, town) {
    town = town || 'Durango, CO';
    return {
      you: {
        name: pick.main, address: pick.secondary, town: 'Durango, CO',
        mapsUri: 'https://maps.google.com/?cid=0', rating: 4.8, reviews: 9,
        website: 'https://example.com', hasHours: false, phone: '(970) 555-0123',
        photos: 4, status: 'OPERATIONAL', category: 'General contractor'
      },
      search: {
        query: trade + ' near ' + town, rank: 7, checked: 20,
        top: [
          { name: 'Sample Co. A (top result)', reviews: 84, rating: 4.9 },
          { name: 'Sample Co. B', reviews: 61, rating: 4.7 },
          { name: 'Sample Co. C', reviews: 40, rating: 4.8 }
        ]
      }
    };
  }

  // ---- Scoring: CD's own checklist, 100 points. Pure function. ----
  // Reviews are scored against the third-place count for the same search, so
  // the bar is set by real local competitors, not by an invented average.
  function scoreProfile(you, top) {
    var rows = [];
    var third = top.length ? top[top.length - 1].reviews || 0 : 0;
    var reviewRatio = third > 0 ? Math.min(1, (you.reviews || 0) / third) : ((you.reviews || 0) > 0 ? 1 : 0);
    var topCounts = top.map(function (t) { return fmtInt(t.reviews || 0); });
    rows.push({
      key: 'reviews', label: 'Reviews', max: 25, pts: Math.round(25 * reviewRatio),
      found: fmtInt(you.reviews || 0) + ' review' + ((you.reviews === 1) ? '' : 's'),
      // Fix lines only appear in the emailed report, which GHL stores, so no Google numbers here.
      fix: top.length
        ? 'You have fewer reviews than the businesses ranking above you for this search. Ask every customer for a review the week you finish their job; a text with the review link works best.'
        : 'Ask every customer for a review the week you finish their job.',
      ok: reviewRatio >= 1
    });
    var r = typeof you.rating === 'number' ? you.rating : null;
    var rPts = r === null ? 0 : r >= 4.5 ? 10 : r >= 4.0 ? 7 : r >= 3.5 ? 4 : 0;
    rows.push({
      key: 'rating', label: 'Star rating', max: 10, pts: rPts,
      found: r === null ? 'No rating yet' : r.toFixed(1) + ' stars',
      fix: r === null ? 'Your first few reviews set your rating.' : 'Reply to every review, good or bad. People read the replies.',
      ok: rPts === 10
    });
    rows.push({
      key: 'website', label: 'Website link', max: 15, pts: you.website ? 15 : 0,
      found: you.website ? 'Listed' : 'Missing',
      fix: 'Add your website in your Google profile. Without it, people who want to see your work have nowhere to go.',
      ok: !!you.website
    });
    rows.push({
      key: 'hours', label: 'Business hours', max: 10, pts: you.hasHours ? 10 : 0,
      found: you.hasHours ? 'Listed' : 'Missing',
      fix: 'Add your hours. If you work by appointment, list the hours you answer the phone.',
      ok: !!you.hasHours
    });
    rows.push({
      key: 'phone', label: 'Phone number', max: 10, pts: you.phone ? 10 : 0,
      found: you.phone ? 'Listed' : 'Missing',
      fix: 'Add a phone number people can tap to call you.',
      ok: !!you.phone
    });
    var photos = Math.min(10, you.photos || 0);
    rows.push({
      key: 'photos', label: 'Photos', max: 15, pts: Math.round(15 * photos / 10),
      found: photos >= 10 ? '10+ (Google only shows us 10)' : photos + ' of 10',
      fix: 'Add real photos of your finished jobs. Google shares up to 10 with this check, so 10 is full marks.',
      ok: photos >= 10
    });
    // Main category. Google's public place data shows a placeholder like "Services" when the real
    // category has no matching place type: CKB's profile is set to Remodeler (+ Kitchen remodeler,
    // Bathroom remodeler) but the API returns "Services" (Lane C, 2026-10-17). So a placeholder is
    // never called a problem: full points and a soft "check it" note. Only a category that clearly
    // names something else (not the trade, not a placeholder) gets the fix line.
    var cat = you.category || '';
    var placeholder = /^(services?|point of interest|establishment|business|store|local business)$/i.test(cat.trim());
    var tradeCat = /remodel|contractor|construct|builder|handyman|carpent|cabinet|kitchen|bath|basement|tile|floor|paint|renovat|countertop/i.test(cat);
    var catOk = !!cat && (tradeCat || placeholder);
    rows.push({
      key: 'category', label: 'Main category', max: 10, pts: !cat ? 0 : catOk ? 10 : 5,
      found: !cat ? 'Not set' : placeholder ? 'Not shown in Google\'s public data' : cat,
      fix: !cat ? 'Pick a main category that names your trade, like Kitchen remodeler or General contractor.'
        : placeholder ? 'Google\'s public data doesn\'t show your exact category. Check it\'s set to your trade in your Google Business Profile.'
        : tradeCat ? 'Make sure this matches the work you want most.'
        : 'Your main category doesn\'t name your trade. If remodeling is your main work, pick a category like Kitchen remodeler, Bathroom remodeler or General contractor.',
      ok: catOk, soft: catOk
    });
    var open = you.status === 'OPERATIONAL';
    rows.push({
      key: 'status', label: 'Google shows you as open', max: 5, pts: open ? 5 : 0,
      found: open ? 'Open' : (you.status === 'CLOSED_TEMPORARILY' ? 'Temporarily closed' : 'Not open'),
      fix: 'Google shows you as closed. Fix this first in your Google profile.',
      ok: open
    });
    var total = rows.reduce(function (s, row) { return s + row.pts; }, 0);
    return { total: total, rows: rows };
  }

  function rankText(search) {
    if (search.rank) return '#' + search.rank + ' for "' + search.query + '"';
    return 'not in the first ' + search.checked + ' for "' + search.query + '"';
  }

  // The emailed full report (teaser on screen, full report by email: Andrew 2026-10-17).
  // It goes into the GHL field magnet_results, so it carries CD's own findings only: score,
  // rank and advice. No Google review counts, rating, hours or phone (Places storage rule).
  function gbpReport(you, search, scored) {
    var fix = scored.rows.filter(function (r) { return !r.ok; }).sort(function (a, b) { return (b.max - b.pts) - (a.max - a.pts); });
    var check = scored.rows.filter(function (r) { return r.ok && r.soft; });
    var good = scored.rows.filter(function (r) { return r.ok && !r.soft; });
    var lines = [
      'Google profile check',
      'Score: ' + scored.total + ' of 100 on our checklist.',
      'Rank: ' + rankText(search) + '.',
      ''
    ];
    if (fix.length) {
      lines.push('What to fix, biggest first:');
      fix.forEach(function (r, i) { lines.push((i + 1) + '. ' + r.label + ' (' + r.pts + ' of ' + r.max + '): ' + (r.reportFix || r.fix)); });
      lines.push('');
    }
    if (check.length) {
      lines.push('Worth a quick check:');
      check.forEach(function (r) { lines.push('- ' + r.label + ': ' + (r.reportFix || r.fix)); });
      lines.push('');
    }
    if (good.length) lines.push('Already good:', good.map(function (r) { return '- ' + r.label; }).join('\n'));
    lines.push('Not scored: your Google posts and review replies. Google doesn\'t share those.');
    return lines.join('\n');
  }

  function resultsSentence(you, search, scored) {
    var gaps = scored.rows.filter(function (row) { return !row.ok && !row.soft; }).map(function (row) { return row.label.toLowerCase(); });
    return 'Your Google profile scored ' + scored.total + ' of 100 on our checklist. ' +
      'You rank ' + rankText(search) + '. ' +
      (gaps.length ? 'Biggest gaps: ' + listJoin(gaps) + '.' : 'No big gaps found.');
  }

  // ---- Small helpers ----
  function fmtInt(n) { return Number(n || 0).toLocaleString('en-US'); }
  function listJoin(a) {
    if (a.length <= 1) return a.join('');
    if (a.length === 2) return a[0] + ' and ' + a[1];
    return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  }
  function newSession() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  var CSS = [
    '.cdm{--cdm-ink:#1f2328;--cdm-navy:#2d3646;--cdm-muted:#4c5564;--cdm-steel:#4e7c91;--cdm-steel-2:#5f8fa6;--cdm-gold:#c2a26d;',
    '--cdm-paper:#ffffff;--cdm-wash:#f3f6f8;--cdm-line:#d5dde3;--cdm-good:#2f7a4f;--cdm-fix:#a8571c;--cdm-on-steel:#ffffff;',
    '--cdm-head:"Libre Baskerville",Georgia,"Times New Roman",serif;--cdm-body:"Source Sans 3","Source Sans Pro",Arial,Helvetica,sans-serif;',
    'font-family:var(--cdm-body);color:var(--cdm-ink);font-size:17px;line-height:1.5;max-width:760px;margin:0 auto;}',
    '.cdm *{box-sizing:border-box;}',
    '.cdm-card{background:var(--cdm-paper);border:1px solid var(--cdm-line);border-radius:10px;padding:clamp(18px,4vw,30px);display:grid;gap:18px;}',
    '.cdm-sample{background:var(--cdm-gold);color:#1f2328;font-weight:700;font-size:.82rem;letter-spacing:.06em;text-transform:uppercase;padding:6px 12px;border-radius:6px;justify-self:start;}',
    '.cdm h3{font-family:var(--cdm-head);font-weight:700;font-size:clamp(1.25rem,3.2vw,1.6rem);line-height:1.25;margin:0;color:var(--cdm-navy);text-wrap:balance;}',
    '.cdm h4{font-family:var(--cdm-head);font-weight:700;font-size:1.1rem;margin:0;color:var(--cdm-navy);}',
    '.cdm p{margin:0;}',
    '.cdm-lede{color:var(--cdm-muted);}',
    '.cdm-field{display:grid;gap:6px;position:relative;min-width:0;}',
    '.cdm-field label{font-weight:600;font-size:.95rem;}',
    '.cdm input[type=text],.cdm input[type=email],.cdm input[type=tel],.cdm select{width:100%;font:inherit;font-size:17px;padding:12px 14px;border:1px solid var(--cdm-line);border-radius:8px;background:var(--cdm-paper);color:var(--cdm-ink);}',
    '.cdm input:focus-visible,.cdm select:focus-visible,.cdm button:focus-visible{outline:3px solid var(--cdm-steel-2);outline-offset:2px;}',
    '.cdm-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;}',
    '.cdm-list{position:absolute;top:100%;left:0;right:0;z-index:20;margin:4px 0 0;padding:4px;list-style:none;background:var(--cdm-paper);border:1px solid var(--cdm-line);border-radius:8px;box-shadow:0 8px 24px rgba(20,30,40,.14);}',
    '.cdm-list li{padding:10px 12px;border-radius:6px;cursor:pointer;display:grid;gap:2px;}',
    '.cdm-list li[aria-selected=true],.cdm-list li:hover{background:var(--cdm-wash);}',
    '.cdm-list small{color:var(--cdm-muted);font-size:.85rem;}',
    '.cdm-btn{font:inherit;font-weight:700;font-size:17px;border:0;border-radius:8px;padding:14px 22px;background:var(--cdm-steel);color:var(--cdm-on-steel);cursor:pointer;justify-self:start;min-height:48px;}',
    '.cdm-btn[disabled]{opacity:.55;cursor:default;}',
    '.cdm-msg{font-size:.95rem;color:var(--cdm-fix);}',
    '.cdm-top{display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:center;}',
    '@media (max-width:520px){.cdm-top{grid-template-columns:1fr;}}',
    '.cdm-score{width:132px;height:132px;border-radius:50%;display:grid;place-items:center;text-align:center;background:conic-gradient(var(--cdm-steel) calc(var(--p)*1%),var(--cdm-wash) 0);}',
    '.cdm-score>div{width:104px;height:104px;border-radius:50%;background:var(--cdm-paper);display:grid;place-content:center;}',
    '.cdm-score b{font-family:var(--cdm-head);font-size:2.2rem;line-height:1;color:var(--cdm-navy);font-variant-numeric:tabular-nums;}',
    '.cdm-score span{font-size:.8rem;color:var(--cdm-muted);}',
    '.cdm-rank{font-family:var(--cdm-head);font-size:clamp(1.15rem,3vw,1.4rem);color:var(--cdm-navy);line-height:1.3;}',
    '.cdm-fine{font-size:.85rem;color:var(--cdm-muted);}',
    '.cdm-bars{display:grid;gap:8px;}',
    '.cdm-bar{display:grid;grid-template-columns:minmax(0,11em) 1fr auto;gap:10px;align-items:center;font-size:.95rem;}',
    '.cdm-bar .n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.cdm-bar .t{height:14px;background:var(--cdm-wash);border-radius:4px;overflow:hidden;}',
    '.cdm-bar .f{height:100%;background:var(--cdm-steel-2);}',
    '.cdm-bar.you .f{background:var(--cdm-gold);}',
    '.cdm-bar.you .n{font-weight:700;}',
    '.cdm-bar .c{font-variant-numeric:tabular-nums;min-width:3ch;text-align:right;}',
    '.cdm-checks{display:grid;gap:0;border-top:1px solid var(--cdm-line);}',
    '.cdm-check{display:grid;grid-template-columns:auto 1fr auto;gap:4px 12px;padding:12px 0;border-bottom:1px solid var(--cdm-line);align-items:start;}',
    '.cdm-pill{font-size:.75rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:3px 8px;border-radius:999px;margin-top:2px;}',
    '.cdm-pill.ok{background:color-mix(in srgb,var(--cdm-good) 14%,transparent);color:var(--cdm-good);}',
    '.cdm-pill.fix{background:color-mix(in srgb,var(--cdm-fix) 14%,transparent);color:var(--cdm-fix);}',
    '.cdm-pill.look{background:var(--cdm-wash);color:var(--cdm-muted);}',
    '.cdm-check>span{min-width:0;overflow-wrap:anywhere;}',
    '.cdm-check .lbl{font-weight:700;}',
    '.cdm-check .pts{font-variant-numeric:tabular-nums;color:var(--cdm-muted);font-size:.9rem;white-space:nowrap;}',
    '.cdm-check .tip{grid-column:2 / 4;color:var(--cdm-muted);font-size:.95rem;}',
    '.cdm-attr{display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:space-between;font-size:.85rem;color:var(--cdm-muted);}',
    '.cdm-attr strong{color:var(--cdm-ink);font-weight:600;}',
    '.cdm-optin{background:var(--cdm-wash);border-radius:10px;padding:clamp(16px,3.5vw,24px);display:grid;gap:14px;}',
    '.cdm-consent{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;font-size:.92rem;}',
    '.cdm-consent input{width:20px;height:20px;margin-top:2px;}',
    '.cdm-consent a{color:var(--cdm-steel);}',
    '.cdm-err{border-color:var(--cdm-fix)!important;}',
    '.cdm-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0;}',
    '.cdm-done{font-weight:600;color:var(--cdm-good);}'
  ].join('');

  function injectCss() {
    if (document.getElementById('cdm-css')) return;
    var s = document.createElement('style'); s.id = 'cdm-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function init(root) {
    var cfg = {
      api: (root.getAttribute('data-api-url') || '').replace(/\/+$/, ''),
      webhook: root.getAttribute('data-webhook-url') || '',
      terms: root.getAttribute('data-terms-url') || 'https://craftsman-digital.com/terms',
      privacy: root.getAttribute('data-privacy-url') || 'https://craftsman-digital.com/privacy',
      mock: String(root.getAttribute('data-mode') || '').toLowerCase() === 'mock'
    };
    var session = newSession();
    var picked = null;
    var last = null;

    var wrap = el('div', { class: 'cdm' });
    var card = el('div', { class: 'cdm-card' });
    if (cfg.mock) card.appendChild(el('div', { class: 'cdm-sample', text: 'Preview with sample data. Not a real business.' }));

    // ---- Step 1: find the profile ----
    var nameInput = el('input', { type: 'text', id: 'cdm-name', autocomplete: 'off', placeholder: 'Start typing your business name',
      role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': 'cdm-list' });
    var list = el('ul', { class: 'cdm-list', id: 'cdm-list', role: 'listbox' }); list.hidden = true;
    var tradeSel = el('select', { id: 'cdm-trade' }, [el('option', { value: '', text: 'Pick one' })]
      .concat(TRADES.map(function (t) { return el('option', { value: t.value, text: t.label }); })));
    // Town for the rank search. Filled from the dropdown when Google shows one; required when it isn't
    // (service-area listings hide the address, so Google has no town for them).
    var townInput = el('input', { type: 'text', id: 'cdm-town', autocomplete: 'address-level2', placeholder: 'Cortez, CO' });
    var townAuto = false;
    townInput.addEventListener('input', function () { townAuto = false; });
    var checkBtn = el('button', { type: 'button', class: 'cdm-btn', text: 'Check my Google profile' });
    var formMsg = el('p', { class: 'cdm-msg', role: 'alert' }); formMsg.hidden = true;

    var step1 = el('div', { class: 'cdm-card', style: 'border:0;padding:0' }, [
      el('h3', { text: 'How does your Google profile stack up against the top 3 near you?' }),
      el('p', { class: 'cdm-lede', text: 'Find your business, pick what people search for and your town, and see your score in about 10 seconds. No email needed to see your score.' }),
      el('div', { class: 'cdm-row' }, [
        el('div', { class: 'cdm-field' }, [el('label', { for: 'cdm-name', text: 'Your business on Google' }), nameInput, list]),
        el('div', { class: 'cdm-field' }, [el('label', { for: 'cdm-trade', text: 'What people search to find you' }), tradeSel]),
        el('div', { class: 'cdm-field' }, [el('label', { for: 'cdm-town', text: 'Town you want to show up in' }), townInput])
      ]),
      checkBtn, formMsg
    ]);
    card.appendChild(step1);

    var results = el('div', { class: 'cdm-card', style: 'border:0;padding:0' }); results.hidden = true;
    card.appendChild(results);
    wrap.appendChild(card);
    root.innerHTML = '';
    root.appendChild(wrap);

    // ---- Autocomplete ----
    var timer = null, items = [], active = -1;
    function closeList() { list.hidden = true; nameInput.setAttribute('aria-expanded', 'false'); active = -1; }
    function renderList() {
      list.innerHTML = '';
      items.forEach(function (s, i) {
        var li = el('li', { role: 'option', id: 'cdm-opt-' + i, 'aria-selected': i === active ? 'true' : 'false' },
          [el('span', { text: s.main }), el('small', { text: s.secondary || '' })]);
        li.addEventListener('mousedown', function (e) { e.preventDefault(); choose(i); });
        list.appendChild(li);
      });
      list.hidden = !items.length;
      nameInput.setAttribute('aria-expanded', items.length ? 'true' : 'false');
    }
    function choose(i) {
      picked = items[i];
      nameInput.value = picked.main;
      // 'W Main St, Cortez, CO, USA' -> 'Cortez, CO'. 'Colorado, USA' has no town, so leave the box for them.
      var parts = String(picked.secondary || '').split(',').map(function (p) { return p.trim(); }).filter(Boolean);
      if (parts.length && /^usa$/i.test(parts[parts.length - 1])) parts.pop();
      var guess = parts.length >= 2 ? parts[parts.length - 2] + ', ' + parts[parts.length - 1] : '';
      if (!townInput.value.trim() || townAuto) { townInput.value = guess; townAuto = !!guess; }
      closeList();
      if (!townInput.value.trim()) townInput.focus();
    }
    function fetchSuggestions(q) {
      if (cfg.mock) {
        var ql = q.toLowerCase();
        return Promise.resolve(MOCK_SUGGESTIONS.filter(function (s) { return s.main.toLowerCase().indexOf(ql) !== -1 || ql.length < 3; }));
      }
      return fetch(cfg.api + '/autocomplete?input=' + encodeURIComponent(q) + '&session=' + encodeURIComponent(session))
        .then(function (r) { return r.json(); })
        .then(function (d) { return d.suggestions || []; });
    }
    nameInput.addEventListener('input', function () {
      picked = null;
      var q = nameInput.value.trim();
      clearTimeout(timer);
      if (q.length < 2) { items = []; renderList(); return; }
      timer = setTimeout(function () {
        fetchSuggestions(q).then(function (s) { items = s.slice(0, 5); active = -1; renderList(); })
          .catch(function () { items = []; renderList(); });
      }, 250);
    });
    nameInput.addEventListener('keydown', function (e) {
      if (list.hidden) return;
      if (e.key === 'ArrowDown') { active = Math.min(items.length - 1, active + 1); renderList(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); renderList(); e.preventDefault(); }
      else if (e.key === 'Enter' && active >= 0) { choose(active); e.preventDefault(); }
      else if (e.key === 'Escape') { closeList(); }
    });
    nameInput.addEventListener('blur', function () { setTimeout(closeList, 120); });

    // Preview only: data-autorun="<trade>" opens the mock with the first sample business already checked.
    if (cfg.mock && root.getAttribute('data-autorun')) {
      picked = MOCK_SUGGESTIONS[0];
      nameInput.value = picked.main;
      tradeSel.value = root.getAttribute('data-autorun');
      townInput.value = 'Durango, CO';
      var d0 = mockCheck(picked, tradeSel.value);
      last = { you: d0.you, search: d0.search, scored: scoreProfile(d0.you, d0.search.top) };
      setTimeout(function () { renderResults(true); }, 0);
    }

    function showMsg(t) { formMsg.hidden = !t; formMsg.textContent = t || ''; }

    checkBtn.addEventListener('click', function () {
      nameInput.classList.toggle('cdm-err', !picked);
      tradeSel.classList.toggle('cdm-err', !tradeSel.value);
      townInput.classList.toggle('cdm-err', !townInput.value.trim());
      if (!picked) { showMsg('Pick your business from the list that shows up as you type.'); return; }
      if (!tradeSel.value) { showMsg('Pick what people search for to find you.'); return; }
      if (!townInput.value.trim()) { showMsg('Add the town you want to show up in, like Cortez, CO.'); return; }
      showMsg('');
      checkBtn.disabled = true; checkBtn.textContent = 'Checking...';
      var run = cfg.mock
        ? new Promise(function (res) { setTimeout(function () { res(mockCheck(picked, tradeSel.value, townInput.value.trim())); }, 500); })
        : fetch(cfg.api + '/gbp-check', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ placeId: picked.placeId, session: session, trade: tradeSel.value, area: townInput.value.trim() })
          }).then(function (r) { return r.json(); });
      run.then(function (d) {
        checkBtn.disabled = false; checkBtn.textContent = 'Check my Google profile';
        session = newSession(); // a session ends with the details call
        if (!d || d.error || !d.you) { showMsg((d && d.error) || 'The check did not finish. Try again in a minute.'); return; }
        last = { you: d.you, search: d.search, scored: scoreProfile(d.you, d.search.top || []) };
        renderResults();
      }).catch(function () {
        checkBtn.disabled = false; checkBtn.textContent = 'Check my Google profile';
        showMsg('The check did not finish. Try again in a minute.');
      });
    });

    // ---- Results ----
    function renderResults(noScroll) {
      var you = last.you, search = last.search, scored = last.scored;
      results.innerHTML = '';

      var scoreDial = el('div', { class: 'cdm-score', style: '--p:' + scored.total, role: 'img', 'aria-label': 'Score ' + scored.total + ' of 100' },
        [el('div', {}, [el('b', { text: String(scored.total) }), el('span', { text: 'of 100' })])]);
      results.appendChild(el('div', { class: 'cdm-top' }, [
        scoreDial,
        el('div', { style: 'display:grid;gap:6px;min-width:0' }, [
          el('p', { class: 'cdm-fine', text: you.name + ', ' + (you.address || '') }),
          el('p', { class: 'cdm-rank', text: search.rank ? 'You show up #' + search.rank + ' when people search "' + search.query + '".' : 'You are not in the first ' + search.checked + ' results when people search "' + search.query + '".' }),
          el('p', { class: 'cdm-fine', text: 'Score is our checklist below, not a Google number. Rank is one search; results shift with where the person searching is standing.' })
        ])
      ]));

      // Review counts vs the top 3, one scale for all bars.
      var top = search.top || [];
      if (top.length) {
        // Already in the top 3: highlight that row instead of adding a second "You" row.
        var inTop = search.rank && search.rank <= top.length;
        var rowsData = top.map(function (t, i) {
          var isYou = inTop && i === search.rank - 1;
          return { name: (i + 1) + '. ' + (isYou ? 'You' : t.name), n: t.reviews || 0, you: isYou };
        });
        if (!inTop) rowsData.push({ name: 'You' + (search.rank ? ' (#' + search.rank + ')' : ''), n: you.reviews || 0, you: true });
        var max = Math.max.apply(null, rowsData.map(function (r) { return r.n; }).concat([1]));
        results.appendChild(el('div', { style: 'display:grid;gap:10px' }, [
          el('h4', { text: 'Reviews: you vs. the top ' + top.length }),
          el('div', { class: 'cdm-bars' }, rowsData.map(function (r) {
            return el('div', { class: 'cdm-bar' + (r.you ? ' you' : '') }, [
              el('span', { class: 'n', text: r.name, title: r.name }),
              el('span', { class: 't' }, [el('span', { class: 'f', style: 'display:block;width:' + (100 * r.n / max).toFixed(1) + '%' })]),
              el('span', { class: 'c', text: fmtInt(r.n) })
            ]);
          }))
        ]));
      }

      results.appendChild(el('h4', { text: 'Your checklist' }));
      results.appendChild(el('div', { class: 'cdm-checks' }, scored.rows.map(function (row) {
        var cls = row.ok ? (row.soft ? 'look' : 'ok') : 'fix';
        var word = row.ok ? (row.soft ? 'Check' : 'Good') : 'Fix';
        return el('div', { class: 'cdm-check' }, [
          el('span', { class: 'cdm-pill ' + cls, text: word }),
          el('span', {}, [el('span', { class: 'lbl', text: row.label + ': ' }), el('span', { text: row.found })]),
          el('span', { class: 'pts', text: row.pts + ' / ' + row.max }),
          null // how to fix each one goes in the emailed report
        ]);
      })));
      results.appendChild(el('div', { class: 'cdm-optin', style: 'gap:6px' }, [
        el('p', { style: 'font-weight:700', text: 'Your full report: how to fix each one, biggest first, by email' }),
        el('p', { class: 'cdm-lede', text: 'Plain steps for every item marked Fix or Check, in the order that matters most for your score.' })
      ]));

      results.appendChild(el('p', { class: 'cdm-fine', text: 'This check can\'t see your Google posts or whether you reply to reviews. Google doesn\'t share those, so they aren\'t scored.' }));
      results.appendChild(el('div', { class: 'cdm-attr' }, [
        el('span', {}, ['Profile data from ', el('strong', { text: 'Google Maps' })]),
        el('a', { href: you.mapsUri || '#', target: '_blank', rel: 'noopener', style: 'color:var(--cdm-steel)', text: 'Open your profile on Google Maps' })
      ]));

      results.appendChild(buildOptin());
      results.hidden = false;
      if (!noScroll) { try { results.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }
    }

    // ---- Opt-in (after the result, same fields and wording as the guide form) ----
    function buildOptin() {
      var first = el('input', { type: 'text', id: 'cdm-first', autocomplete: 'given-name', placeholder: 'First name' });
      var email = el('input', { type: 'email', id: 'cdm-email', autocomplete: 'email', placeholder: 'Email' });
      var phone = el('input', { type: 'tel', id: 'cdm-phone', autocomplete: 'tel', placeholder: 'Phone' });
      var hp = el('input', { type: 'text', class: 'cdm-hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', name: 'website' });
      var box = el('input', { type: 'checkbox', id: 'cdm-consent' });
      var consent = el('div', { class: 'cdm-consent' }, [box, el('label', { for: 'cdm-consent' }, [
        CONSENT_TEXT + ' ',
        el('a', { href: cfg.terms, target: '_blank', rel: 'noopener', text: 'Terms of Service' }), ' and ',
        el('a', { href: cfg.privacy, target: '_blank', rel: 'noopener', text: 'Privacy Policy' }), '.'
      ])]);
      var send = el('button', { type: 'button', class: 'cdm-btn', text: 'Email me my full report' });
      var msg = el('p', { class: 'cdm-msg', role: 'alert' }); msg.hidden = true;
      var box1 = el('div', { class: 'cdm-optin' }, [
        el('h4', { text: 'Email me my full report + the Bottleneck Guide' }),
        el('p', { class: 'cdm-lede', text: 'Get the full report: how to fix each item, biggest first. Plus The Remodeler\'s Bottleneck Guide: a short read on whether leads, sales, production or operations is holding you back.' }),
        el('div', { class: 'cdm-row' }, [
          el('div', { class: 'cdm-field' }, [el('label', { for: 'cdm-first', text: 'First name' }), first]),
          el('div', { class: 'cdm-field' }, [el('label', { for: 'cdm-email', text: 'Email *' }), email]),
          el('div', { class: 'cdm-field' }, [el('label', { for: 'cdm-phone', text: 'Phone *' }), phone])
        ]),
        consent, send, msg, hp
      ]);
      send.addEventListener('click', function () {
        var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
        var phoneDigits = phone.value.replace(/\D/g, '');
        var phoneOk = phoneDigits.length >= 10;
        email.classList.toggle('cdm-err', !emailOk);
        phone.classList.toggle('cdm-err', !phoneOk);
        consent.classList.toggle('cdm-err', !box.checked);
        if (!emailOk || !phoneOk) { msg.hidden = false; msg.textContent = 'Add a valid email and phone number.'; return; }
        if (!box.checked) { msg.hidden = false; msg.textContent = 'Check the box to get your full report by email.'; return; }
        msg.hidden = true;
        var done = function (text) {
          box1.innerHTML = '';
          box1.appendChild(el('h4', { text: 'Sent.' }));
          box1.appendChild(el('p', { class: 'cdm-done', text: text }));
        };
        if (hp.value) { done('Check your inbox for your full report and the guide.'); return; }
        var scored = last.scored;
        var now = new Date();
        var payload = {
          tool: TOOL,
          first_name: first.value.trim(),
          email: email.value.trim(),
          phone: phoneDigits,
          results: gbpReport(last.you, last.search, scored),
          last_date: now.toISOString().slice(0, 10),
          consent_proof: 'Box checked. Wording shown: ' + CONSENT_TEXT + ' Page: ' + location.href.split('#')[0] + '. Time: ' + now.toISOString(),
          place_id: (picked && picked.placeId) || '',
          gbp_score: String(scored.total),
          // Labels only: the "found" text can hold Google's own numbers, which GHL must not store.
          gbp_gaps: scored.rows.filter(function (r) { return !r.ok; }).map(function (r) { return r.label; }).join('; '),
          gbp_rank: rankText(last.search),
          lead_value: '', yearly_loss: '', bottleneck: '', site_url: '', site_mobile_score: ''
        };
        if (cfg.mock || !cfg.webhook) {
          root.setAttribute('data-last-payload', JSON.stringify(payload));
          done(cfg.mock ? 'Preview only: nothing was sent. On the live page this emails the full report and the guide.' : 'Check your inbox for your full report and the guide.');
          return;
        }
        send.disabled = true; send.textContent = 'Sending...';
        fetch(cfg.webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          .then(function (r) { if (!r.ok) throw new Error('status ' + r.status); done('Check your inbox for your full report and the guide. It can take a few minutes.'); })
          .catch(function () {
            send.disabled = false; send.textContent = 'Email me my full report';
            msg.hidden = false; msg.textContent = 'That did not go through. Try again, or call or text (877) 560-0450.';
          });
      });
      return box1;
    }
  }

  // Exposed for tests and the preview page.
  window.CDMagnetGbp = { scoreProfile: scoreProfile, resultsSentence: resultsSentence, mockCheck: mockCheck };

  function boot() {
    injectCss();
    Array.prototype.forEach.call(document.querySelectorAll('[data-cd-magnet="gbp-check"]'), init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
