/*
 * Homeowner style quiz (Complete tier piece 7; CKB first). Bathroom and kitchen.
 * Plan + spec: ICM-WORKSPACE/workspaces/craftsman-digital/sprints/2026-10-23-channel-b-finish/cd-sprint8-c-style-quiz-spec.md
 *
 * DRAFT: copy is for Andrew to edit. Not wired to any GHL account.
 *
 * Embed:
 * <div data-cd-magnet="style-quiz" data-trade="bathroom"
 *   data-business-name="{{ custom_values.locationname }}"
 *   data-webhook-url="..." data-calc-url="https://.../bathroom-calculator"
 *   data-guide-url="https://.../bathroom-planning-guide"
 *   data-terms-url="{{ custom_values.calculator__terms_url }}" data-privacy-url="{{ custom_values.calculator__privacy_url }}"
 *   data-color-primary="{{ custom_values.calculator__brand_color_primary }}" data-color-dark="{{ custom_values.calculator__brand_color_dark }}"
 *   data-photos='{"classic":"https://...jpg"}'></div>
 * <script src="https://abegley5781.github.io/craftsman-digital-calculators/magnets/style-quiz/style-quiz.js"></script>
 * data-mode="mock" posts nothing and shows photo placeholders. data-preview-answers="0,1,1,..." pre-picks answers (mock only).
 *
 * Scoring: every answer belongs to one style; most picks wins. A tie goes to the style
 * listed first in `styles`. A second style with 2+ picks is named as "you also leaned".
 *
 * Cost: no dollar amounts. Each style says which answers it usually means in the trade's
 * calculator, and where that sits against the calculator's middle picks, using the
 * engines' own point values (bathroom-engine.js / kitchen-engine.js, read 2026-10-27):
 *   bathroom tile: none -1, basic 0, full tile shower +2, extensive +4; finish: basic -1, mid 0, high-end +3
 *   kitchen cabinets: reface -2, stock/semi-custom 0, full custom +6; counters: laminate/butcher block -2, quartz/granite 0, premium +5
 * Size and scope move the price more than any style answer (bath size 10-18, scope 0-9;
 * kitchen size 8-18, scope 0-14), which the result says plainly.
 */
(function () {
  'use strict';

  var TOOL = 'style-quiz';

  var TRADES = {
    bathroom: {
      title: 'What\'s your bathroom style?',
      lede: 'Six quick picks. Go with your first reaction. Your style shows on the next screen, no email needed.',
      calcName: 'bathroom calculator',
      styles: ['classic', 'modern', 'farmhouse', 'spa', 'practical'],
      questions: [
        { q: 'Which vanity would you pick?', a: [
          ['Wood cabinet with framed doors', 'classic'],
          ['Floating vanity with flat doors', 'modern'],
          ['A furniture-style piece or open console', 'farmhouse'],
          ['A double vanity with lots of counter', 'spa'],
          ['A simple vanity with a one-piece top', 'practical']] },
        { q: 'Shower or tub?', a: [
          ['Tub and shower together, with a nice tile surround', 'classic'],
          ['Walk-in shower with glass', 'modern'],
          ['A tub you can soak in, with a curtain', 'farmhouse'],
          ['A big tiled shower with a bench', 'spa'],
          ['Wall panels you wipe down, no grout lines', 'practical']] },
        { q: 'How much tile?', a: [
          ['White subway tile, maybe a pattern on the floor', 'classic'],
          ['Large tiles with thin grout lines', 'modern'],
          ['Wood-look floor tile, painted walls or shiplap', 'farmhouse'],
          ['Tile floor to ceiling, with a niche or two', 'spa'],
          ['As little as possible', 'practical']] },
        { q: 'Faucets and fixtures?', a: [
          ['Polished chrome or nickel', 'classic'],
          ['Matte black', 'modern'],
          ['Bronze or brass', 'farmhouse'],
          ['Brushed finish with a rain shower head', 'spa'],
          ['Whatever lasts and is easy to replace', 'practical']] },
        { q: 'Colors?', a: [
          ['White and soft gray', 'classic'],
          ['Black and white, high contrast', 'modern'],
          ['Warm wood and cream', 'farmhouse'],
          ['Soft neutrals and stone', 'spa'],
          ['Light and bright, easy to keep clean', 'practical']] },
        { q: 'When you walk in, you want it to feel...', a: [
          ['Like it always belonged in the house', 'classic'],
          ['Clean and uncluttered', 'modern'],
          ['Warm and lived-in', 'farmhouse'],
          ['Like a hotel or a day spa', 'spa'],
          ['Easy: quick to clean, built to last', 'practical']] }
      ],
      results: {
        classic: {
          name: 'Classic', short: 'classic bathroom',
          about: 'You like a bathroom that looks right in your house for a long time: white tile, a framed wood vanity, polished fixtures. It doesn\'t chase trends, so it doesn\'t date fast.',
          picks: [['Tile', 'Basic (tile surround or floor only)'], ['Finish level', 'Mid-range']],
          level: 'middle',
          up: 'Patterned floor tile, tile on more walls, a higher finish level.',
          down: 'Keep the tub where it is and use a standard tub-shower surround.'
        },
        modern: {
          name: 'Modern', short: 'modern bathroom',
          about: 'You like clean lines and nothing extra: a floating vanity, large tile, glass instead of a curtain, matte black fixtures.',
          picks: [['Tile', 'Full tile shower (walls + pan)'], ['Finish level', 'Mid-range']],
          level: 'above',
          up: 'Tile on every wall, a higher finish level, moving the shower or the drain.',
          down: 'Keep the shower where it is, and keep the large tile to the shower walls and floor.'
        },
        farmhouse: {
          name: 'Farmhouse', short: 'farmhouse bathroom',
          about: 'You like warm and lived-in: wood tones, a furniture-style vanity, bronze or brass fixtures, painted walls instead of tile everywhere.',
          picks: [['Tile', 'Basic (tile surround or floor only)'], ['Finish level', 'Mid-range']],
          level: 'middle',
          up: 'A tile shower instead of a surround, a higher finish level, moving the tub.',
          down: 'Painted walls or shiplap in place of wall tile, and keep the fixtures where they are.'
        },
        spa: {
          name: 'Spa', short: 'spa bathroom',
          about: 'You want a bathroom that feels like a retreat: a big tiled shower with a bench, maybe a soaking tub, stone colors, a rain head.',
          picks: [['Tile', 'Extensive tile (shower, floor, walls, niches)'], ['Finish level', 'High-end / custom']],
          level: 'higher',
          up: 'Moving plumbing or walls to fit a bigger shower or a separate tub.',
          down: 'Put the tile and the budget into the shower, keep the rest of the room simpler, and keep the layout.'
        },
        practical: {
          name: 'Simple and Practical', short: 'simple, practical bathroom',
          about: 'You want it to work and to stay easy: wall panels instead of grout, a one-piece vanity top, fixtures that last.',
          picks: [['Tile', 'No tile (acrylic, solid surface panels)'], ['Finish level', 'Basic or Mid-range']],
          level: 'lower',
          up: 'Adding a tile floor or a tile shower, or moving fixtures.',
          down: 'Keep everything where it is. This is the style the calculator prices lowest.'
        }
      }
    },
    kitchen: {
      title: 'What\'s your kitchen style?',
      lede: 'Six quick picks. Go with your first reaction. Your style shows on the next screen, no email needed.',
      calcName: 'kitchen calculator',
      styles: ['classic', 'modern', 'farmhouse', 'transitional', 'practical'],
      questions: [
        { q: 'Which cabinets would you pick?', a: [
          ['Raised-panel wood doors', 'classic'],
          ['Flat slab doors, no hardware showing', 'modern'],
          ['Painted shaker doors, maybe some open shelves', 'farmhouse'],
          ['Simple shaker doors in a soft color', 'transitional'],
          ['Keep my cabinets and give them a new finish', 'practical']] },
        { q: 'Countertops?', a: [
          ['Granite with some movement in it', 'classic'],
          ['Solid quartz, one color', 'modern'],
          ['Butcher block, at least on the island', 'farmhouse'],
          ['White or light quartz with a soft vein', 'transitional'],
          ['Something durable that fits the budget', 'practical']] },
        { q: 'Backsplash?', a: [
          ['Tile with a pattern or a border', 'classic'],
          ['One big slab or no backsplash at all', 'modern'],
          ['White subway tile', 'farmhouse'],
          ['Simple tile in a soft color', 'transitional'],
          ['Easy to wipe, nothing fussy', 'practical']] },
        { q: 'Hardware and faucet?', a: [
          ['Brushed nickel or bronze with some detail', 'classic'],
          ['Matte black or no visible pulls', 'modern'],
          ['Black iron or brass, cup pulls', 'farmhouse'],
          ['Brushed gold or nickel, simple shapes', 'transitional'],
          ['Whatever lasts', 'practical']] },
        { q: 'Colors?', a: [
          ['Warm wood tones', 'classic'],
          ['White, black and gray', 'modern'],
          ['White cabinets and natural wood', 'farmhouse'],
          ['Soft colors: greige, sage, light blue', 'transitional'],
          ['Light and easy to keep clean', 'practical']] },
        { q: 'When people walk in, you want it to feel...', a: [
          ['Warm and traditional', 'classic'],
          ['Sleek and uncluttered', 'modern'],
          ['Cozy, like a country kitchen', 'farmhouse'],
          ['Fresh but not trendy', 'transitional'],
          ['Easy: it works and it holds up', 'practical']] }
      ],
      results: {
        classic: {
          name: 'Classic', short: 'classic kitchen',
          about: 'You like a traditional kitchen: wood cabinets with some detail, granite, a patterned backsplash, warm finishes.',
          picks: [['Cabinets', 'New stock or semi-custom cabinets'], ['Countertops', 'Quartz or granite (mid-range)']],
          level: 'middle',
          up: 'Full custom cabinets, premium stone, moving walls or plumbing.',
          down: 'Keep the layout and pick from a stock or semi-custom cabinet line.'
        },
        modern: {
          name: 'Modern', short: 'modern kitchen',
          about: 'You like it sleek: flat-door cabinets, solid quartz, very little on display, black or hidden hardware.',
          picks: [['Cabinets', 'New stock or semi-custom cabinets'], ['Countertops', 'Quartz or granite (mid-range)']],
          level: 'middle',
          up: 'Full custom cabinets, a full-height slab backsplash in premium stone, a new layout.',
          down: 'Keep the layout. Flat doors come in stock lines too.'
        },
        farmhouse: {
          name: 'Farmhouse', short: 'farmhouse kitchen',
          about: 'You like a cozy, country kitchen: painted shaker cabinets, butcher block, subway tile, black or brass hardware.',
          picks: [['Cabinets', 'New stock or semi-custom cabinets'], ['Countertops', 'Laminate or butcher block']],
          level: 'below',
          up: 'Custom cabinets, an island added where there wasn\'t one, moving plumbing.',
          down: 'Butcher block counters, and keep the sink where it is.'
        },
        transitional: {
          name: 'Transitional', short: 'transitional kitchen',
          about: 'You like it fresh but not trendy: simple shaker doors in a soft color, light quartz, simple tile, brushed hardware.',
          picks: [['Cabinets', 'New stock or semi-custom cabinets'], ['Countertops', 'Quartz or granite (mid-range)']],
          level: 'middle',
          up: 'Full custom cabinets, premium stone, a new layout.',
          down: 'Keep the layout and use a semi-custom line for the color.'
        },
        practical: {
          name: 'Simple and Practical', short: 'simple, practical kitchen',
          about: 'You want a kitchen that works and holds up: keep what\'s good, refresh the rest, durable surfaces.',
          picks: [['Cabinets', 'Refinish or reface existing cabinet boxes'], ['Countertops', 'Laminate or butcher block']],
          level: 'lower',
          up: 'New cabinets, stone counters, moving plumbing or wiring.',
          down: 'Reface the cabinets you have and keep the layout. This is the style the calculator prices lowest.'
        }
      }
    }
  };

  var LEVEL = {
    lower: { label: 'Lower end of the range', bar: 1 },
    below: { label: 'A little below the middle', bar: 2 },
    middle: { label: 'Middle of the range', bar: 3 },
    above: { label: 'A little above the middle', bar: 4 },
    higher: { label: 'Higher end of the range', bar: 5 }
  };

  function score(trade, answers) {
    var t = TRADES[trade], n = {};
    t.styles.forEach(function (s) { n[s] = 0; });
    answers.forEach(function (a, i) { if (a !== null) n[t.questions[i].a[a][1]] += 1; });
    var top = t.styles.reduce(function (b, s) { return n[s] > n[b] ? s : b; }, t.styles[0]);
    var rest = t.styles.filter(function (s) { return s !== top; });
    var second = rest.reduce(function (b, s) { return n[s] > n[b] ? s : b; }, rest[0]);
    return { counts: n, top: top, second: second && n[second] >= 2 ? second : null };
  }

  function report(trade, s) {
    var t = TRADES[trade], r = t.results[s.top];
    return [
      'Your style: ' + r.name,
      r.about,
      '',
      'In the ' + t.calcName + ', this style usually means: ' + r.picks.map(function (p) { return p[0] + ' = ' + p[1]; }).join('; ') + '.',
      'Where it usually lands: ' + LEVEL[r.level].label + '.',
      'What pushes it up: ' + r.up,
      'What keeps it down: ' + r.down,
      s.second ? '\nYou also leaned ' + t.results[s.second].name + '.' : ''
    ].join('\n').trim();
  }

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  var CSS = [
    '.csq{--csq-p:#1d5d85;--csq-d:#25425d;--csq-ink:#22303c;--csq-muted:#5b6b78;--csq-line:#d9e2ea;--csq-wash:#eef4f8;--csq-fix:#a8571c;--csq-good:#2f7a4f;',
    'font-family:Lato,Arial,Helvetica,sans-serif;color:var(--csq-ink);font-size:17px;line-height:1.5;max-width:760px;margin:0 auto;color-scheme:light;}',
    '.csq *{box-sizing:border-box;}',
    '.csq [hidden]{display:none!important;}',
    '.csq-card{background:#fff;border:1px solid var(--csq-line);border-radius:10px;padding:clamp(18px,4vw,30px);display:grid;gap:18px;}',
    '.csq h3{font-family:Montserrat,Arial,sans-serif;font-weight:800;font-size:clamp(1.3rem,3.4vw,1.7rem);line-height:1.2;margin:0;color:var(--csq-d);text-wrap:balance;}',
    '.csq h4{font-family:Montserrat,Arial,sans-serif;font-weight:700;font-size:1.08rem;margin:0;color:var(--csq-d);}',
    '.csq p{margin:0;}',
    '.csq-lede{color:var(--csq-muted);}',
    '.csq-q{border:0;border-top:1px solid var(--csq-line);padding:16px 0 0;margin:0;min-width:0;display:grid;gap:10px;}',
    '.csq-q legend{font-weight:700;padding:0;margin-bottom:10px;}',
    '.csq-q .n{color:var(--csq-muted);margin-right:6px;}',
    '.csq-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,13rem),1fr));gap:8px;}',
    '.csq-opt{position:relative;display:block;}',
    '.csq-opt input{position:absolute;opacity:0;width:1px;height:1px;}',
    '.csq-opt span{display:flex;align-items:center;height:100%;padding:11px 14px;border:1.5px solid var(--csq-line);border-radius:8px;cursor:pointer;min-height:48px;line-height:1.35;}',
    '.csq-opt input:checked+span{border-color:var(--csq-p);background:var(--csq-wash);font-weight:700;box-shadow:inset 0 0 0 1px var(--csq-p);}',
    '.csq-opt input:focus-visible+span{outline:3px solid var(--csq-d);outline-offset:2px;}',
    '.csq-q.csq-miss legend{color:var(--csq-fix);}',
    '.csq-btn{font:700 17px Montserrat,Arial,sans-serif;border:0;border-radius:6px;padding:14px 22px;background:var(--csq-p);color:#fff;cursor:pointer;justify-self:start;min-height:48px;text-decoration:none;display:inline-block;}',
    '.csq-btn:focus-visible,.csq input:focus-visible{outline:3px solid var(--csq-d);outline-offset:2px;}',
    '.csq-link{font:inherit;background:none;border:0;color:var(--csq-p);text-decoration:underline;padding:4px 0;cursor:pointer;justify-self:start;}',
    '.csq-msg{font-size:.95rem;color:var(--csq-fix);}',
    '.csq-result{display:grid;gap:16px;}',
    '.csq-k{font:700 13px Montserrat,Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--csq-p);margin:0;}',
    '.csq-photo{border-radius:8px;overflow:hidden;aspect-ratio:16/9;background:var(--csq-wash);}',
    '.csq-photo img{width:100%;height:100%;object-fit:cover;display:block;}',
    '.csq-ph{display:grid;place-items:center;text-align:center;padding:16px;border:2px dashed #b9c8d4;color:var(--csq-muted);font-size:.95rem;height:100%;}',
    '.csq-cost{background:var(--csq-wash);border-radius:8px;padding:16px;display:grid;gap:10px;}',
    '.csq-scale{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;}',
    '.csq-scale i{height:10px;border-radius:3px;background:#d3dee7;}',
    '.csq-scale i.on{background:var(--csq-p);}',
    '.csq-scale-l{display:flex;justify-content:space-between;font-size:.82rem;color:var(--csq-muted);}',
    '.csq ul.csq-picks{margin:0;padding:0;list-style:none;display:grid;gap:6px;}',
    '.csq-picks li{display:grid;grid-template-columns:minmax(0,8.5em) 1fr;gap:10px;}',
    '.csq-picks b{color:var(--csq-d);}',
    '.csq-ud{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr));gap:12px;}',
    '.csq-ud div{border-left:3px solid var(--csq-line);padding-left:12px;}',
    '.csq-fine{font-size:.88rem;color:var(--csq-muted);}',
    '.csq-next{border:1px solid var(--csq-line);border-top:4px solid var(--csq-p);border-radius:8px;padding:16px;display:grid;gap:10px;}',
    '.csq-optin{background:var(--csq-wash);border-radius:10px;padding:clamp(16px,3.5vw,22px);display:grid;gap:12px;}',
    '.csq-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr));gap:12px;}',
    '.csq-field{display:grid;gap:5px;min-width:0;}',
    '.csq-field label{font-weight:700;font-size:.92rem;}',
    '.csq input[type=text],.csq input[type=email],.csq input[type=tel]{width:100%;font:inherit;font-size:16px;padding:11px 12px;border:1.5px solid #b9c8d4;border-radius:6px;background:#fff;color:var(--csq-ink);}',
    '.csq-consent{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;font-size:.82rem;line-height:1.45;color:var(--csq-muted);}',
    '.csq-consent input{width:18px;height:18px;margin-top:2px;}',
    '.csq-consent a{color:var(--csq-p);}',
    '.csq-err{border-color:var(--csq-fix)!important;}',
    '.csq-consent.csq-err label{color:var(--csq-fix);}',
    '.csq-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0;}',
    '.csq-done{font-weight:700;color:var(--csq-good);}'
  ].join('');

  function injectCss() {
    if (document.getElementById('csq-css')) return;
    var s = document.createElement('style'); s.id = 'csq-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  function leadRef() {
    try { var m = /[?&]ref=([A-Za-z0-9_-]{1,40})/.exec(window.location.search); return m ? m[1] : ''; } catch (e) { return ''; }
  }

  function withRef(url) {
    if (!url) return '';
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'ref=style-quiz';
  }

  var uid = 0;
  function init(root) {
    var trade = TRADES[root.getAttribute('data-trade')] ? root.getAttribute('data-trade') : 'bathroom';
    var T = TRADES[trade];
    var id = 'csq' + (uid++);
    var photos = {};
    try { photos = JSON.parse(root.getAttribute('data-photos') || '{}'); } catch (e) { photos = {}; }
    var cfg = {
      business: root.getAttribute('data-business-name') || 'our team',
      webhook: root.getAttribute('data-webhook-url') || '',
      calc: root.getAttribute('data-calc-url') || '',
      guide: root.getAttribute('data-guide-url') || '',
      terms: root.getAttribute('data-terms-url') || '#',
      privacy: root.getAttribute('data-privacy-url') || '#',
      mock: String(root.getAttribute('data-mode') || '').toLowerCase() === 'mock'
    };
    var wrap = el('div', { class: 'csq' });
    var cp = root.getAttribute('data-color-primary'), cd = root.getAttribute('data-color-dark');
    if (cp && /^#[0-9a-fA-F]{3,8}$/.test(cp)) wrap.style.setProperty('--csq-p', cp);
    if (cd && /^#[0-9a-fA-F]{3,8}$/.test(cd)) wrap.style.setProperty('--csq-d', cd);

    var answers = T.questions.map(function () { return null; });
    var card = el('div', { class: 'csq-card' });
    var quiz = el('div', { style: 'display:grid;gap:18px' });
    var result = el('div', { class: 'csq-result' }); result.hidden = true;
    quiz.appendChild(el('h3', { text: T.title }));
    quiz.appendChild(el('p', { class: 'csq-lede', text: T.lede }));
    var sets = T.questions.map(function (q, i) {
      var fs = el('fieldset', { class: 'csq-q' }, [el('legend', {}, [el('span', { class: 'n', text: (i + 1) + '.' }), q.q])]);
      var opts = el('div', { class: 'csq-opts' });
      q.a.forEach(function (a, j) {
        var iid = id + '-' + i + '-' + j;
        var input = el('input', { type: 'radio', name: id + '-' + i, id: iid, value: String(j) });
        input.addEventListener('change', function () { answers[i] = j; fs.classList.remove('csq-miss'); });
        opts.appendChild(el('label', { class: 'csq-opt', for: iid }, [input, el('span', { text: a[0] })]));
      });
      fs.appendChild(opts);
      quiz.appendChild(fs);
      return fs;
    });
    var go = el('button', { type: 'button', class: 'csq-btn', text: 'Show my style' });
    var msg = el('p', { class: 'csq-msg', role: 'alert' }); msg.hidden = true;
    quiz.appendChild(go); quiz.appendChild(msg);
    card.appendChild(quiz); card.appendChild(result);
    wrap.appendChild(card); root.innerHTML = ''; root.appendChild(wrap);

    var last = null;
    go.addEventListener('click', function () {
      var miss = answers.map(function (a, i) { return a === null ? i : -1; }).filter(function (i) { return i >= 0; });
      sets.forEach(function (fs, i) { fs.classList.toggle('csq-miss', answers[i] === null); });
      if (miss.length) { msg.hidden = false; msg.textContent = 'Pick one for each question. Number ' + (miss[0] + 1) + ' is still blank.'; return; }
      msg.hidden = true; last = score(trade, answers); render();
    });

    function render(noScroll) {
      var r = T.results[last.top], lv = LEVEL[r.level];
      result.innerHTML = '';
      result.appendChild(el('p', { class: 'csq-k', text: 'Your style' }));
      result.appendChild(el('h3', { text: r.name }));
      if (photos[last.top]) {
        result.appendChild(el('div', { class: 'csq-photo' }, [el('img', { src: photos[last.top], alt: 'A ' + r.short + ' by ' + cfg.business, loading: 'lazy' })]));
      } else if (cfg.mock) {
        result.appendChild(el('div', { class: 'csq-photo' }, [el('div', { class: 'csq-ph', text: 'PHOTO PLACEHOLDER: a real ' + r.short + ' from ' + cfg.business + '\'s own jobs. No stock photos. Hidden on the live page until a photo is set.' })]));
      }
      result.appendChild(el('p', { text: r.about }));
      if (last.second) result.appendChild(el('p', { class: 'csq-fine', text: 'You also leaned ' + T.results[last.second].name + '. Plenty of rooms mix two styles.' }));

      var scale = el('div', { class: 'csq-scale', 'aria-hidden': 'true' });
      for (var i = 1; i <= 5; i++) scale.appendChild(el('i', { class: i === lv.bar ? 'on' : '' }));
      result.appendChild(el('div', { class: 'csq-cost' }, [
        el('h4', { text: 'What it usually costs: ' + lv.label.toLowerCase() }),
        scale,
        el('div', { class: 'csq-scale-l', 'aria-hidden': 'true' }, [el('span', { text: 'Costs less' }), el('span', { text: 'Costs more' })]),
        el('p', { text: 'In our ' + T.calcName + ', this style usually means:' }),
        el('ul', { class: 'csq-picks' }, r.picks.map(function (p) { return el('li', {}, [el('b', { text: p[0] }), el('span', { text: p[1] })]); })),
        el('div', { class: 'csq-ud' }, [
          el('div', {}, [el('b', { text: 'What pushes it up' }), el('p', { text: r.up })]),
          el('div', {}, [el('b', { text: 'What keeps it down' }), el('p', { text: r.down })])
        ]),
        el('p', { class: 'csq-fine', text: 'Style is only part of the price. The size of the room and how much gets rebuilt move it more than any style choice.' })
      ]));

      var next = el('div', { class: 'csq-next' }, [
        el('h4', { text: 'See your price range' }),
        el('p', { text: 'Answer a few questions about your room and get a price range in about two minutes. Use the picks above for the style questions.' })
      ]);
      if (cfg.calc) next.appendChild(el('a', { class: 'csq-btn', href: withRef(cfg.calc), text: 'See my price range' }));
      result.appendChild(next);

      var again = el('button', { type: 'button', class: 'csq-link', text: 'Change my answers' });
      again.addEventListener('click', function () { result.hidden = true; quiz.hidden = false; });
      result.appendChild(again);
      result.appendChild(optin());
      quiz.hidden = true; result.hidden = false;
      if (!noScroll) { try { if (root.getBoundingClientRect().top < 0) root.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }
    }

    function optin() {
      var f = id + '-f';
      var first = el('input', { type: 'text', id: f + 'n', autocomplete: 'given-name' });
      var email = el('input', { type: 'email', id: f + 'e', autocomplete: 'email' });
      var phone = el('input', { type: 'tel', id: f + 'p', autocomplete: 'tel' });
      var hp = el('input', { type: 'text', class: 'csq-hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', name: 'website' });
      var box = el('input', { type: 'checkbox', id: f + 'c' });
      var label = el('label', { for: f + 'c' }, [
        'I consent to ' + cfg.business + ' contacting me about my project, including estimates, scheduling, and relevant updates by email, phone, or text message. Message and data rates may apply. I can unsubscribe or opt out at any time. By submitting this form, you agree to our ',
        el('a', { href: cfg.terms, target: '_blank', rel: 'noopener', text: 'Terms of Service' }), ' and ',
        el('a', { href: cfg.privacy, target: '_blank', rel: 'noopener', text: 'Privacy Policy' }), '.']);
      var consent = el('div', { class: 'csq-consent' }, [box, label]);
      var send = el('button', { type: 'button', class: 'csq-btn', text: 'Email me my style sheet' });
      var m = el('p', { class: 'csq-msg', role: 'alert' }); m.hidden = true;
      var b = el('div', { class: 'csq-optin' }, [
        el('h4', { text: 'Want this by email?' }),
        el('p', { text: 'Your style, the calculator picks that go with it, and what pushes the cost up or down' + (cfg.guide ? ', plus our free planning guide.' : '.') }),
        el('div', { class: 'csq-grid' }, [
          el('div', { class: 'csq-field' }, [el('label', { for: f + 'n', text: 'First name' }), first]),
          el('div', { class: 'csq-field' }, [el('label', { for: f + 'e', text: 'Email *' }), email]),
          el('div', { class: 'csq-field' }, [el('label', { for: f + 'p', text: 'Phone (optional)' }), phone])
        ]), consent, send, m, hp]);
      send.addEventListener('click', function () {
        var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
        var d = phone.value.replace(/\D/g, '');
        var phoneOk = !d || d.length >= 10;
        email.classList.toggle('csq-err', !ok); phone.classList.toggle('csq-err', !phoneOk); consent.classList.toggle('csq-err', !box.checked);
        if (!ok) { m.hidden = false; m.textContent = 'Add a valid email.'; return; }
        if (!phoneOk) { m.hidden = false; m.textContent = 'Check the phone number, or leave it blank.'; return; }
        if (!box.checked) { m.hidden = false; m.textContent = 'Check the box so we can email you.'; return; }
        m.hidden = true;
        function done(t) { b.innerHTML = ''; b.appendChild(el('h4', { text: 'Sent.' })); b.appendChild(el('p', { class: 'csq-done', text: t })); }
        if (hp.value) { done('Check your inbox. It can take a few minutes.'); return; }
        var now = new Date(), r = T.results[last.top];
        var payload = {
          tool: TOOL, trade_config: trade,
          first_name: first.value.trim(), email: email.value.trim(), phone: d,
          style: r.name, style_second: last.second ? T.results[last.second].name : '',
          style_cost_level: LEVEL[r.level].label,
          results: report(trade, last),
          answers_summary: T.questions.map(function (q, i) { return q.a[answers[i]][0]; }).join('; '),
          ref: leadRef(),
          last_date: now.toISOString().slice(0, 10),
          consent_proof: 'Box checked. Wording shown: ' + label.textContent + ' Page: ' + location.href.split('#')[0] + '. Time: ' + now.toISOString()
        };
        if (cfg.mock || !cfg.webhook) {
          root.setAttribute('data-last-payload', JSON.stringify(payload));
          done(cfg.mock ? 'Preview only: nothing was sent. On the live page this emails the style sheet.' : 'Check your inbox. It can take a few minutes.');
          return;
        }
        send.disabled = true; send.textContent = 'Sending...';
        fetch(cfg.webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          .then(function (res) { if (!res.ok) throw new Error(String(res.status)); done('Check your inbox. It can take a few minutes.'); })
          .catch(function () { send.disabled = false; send.textContent = 'Email me my style sheet'; m.hidden = false; m.textContent = 'That did not go through. Please try again.'; });
      });
      return b;
    }

    var pre = root.getAttribute('data-preview-answers');
    if (cfg.mock && pre) {
      pre.split(',').forEach(function (v, i) {
        var j = parseInt(v, 10); if (isNaN(j) || i >= T.questions.length || !T.questions[i].a[j]) return;
        answers[i] = j; var inp = document.getElementById(id + '-' + i + '-' + j); if (inp) inp.checked = true;
      });
      if (answers.every(function (a) { return a !== null; })) { last = score(trade, answers); render(true); }
    }
  }

  // mount(el) starts one quiz on an element added after page load (review pages).
  window.CDMagnetStyleQuiz = { score: score, report: report, TRADES: TRADES, LEVEL: LEVEL, mount: function (root) { injectCss(); init(root); } };

  function boot() { injectCss(); Array.prototype.forEach.call(document.querySelectorAll('[data-cd-magnet="style-quiz"]'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
