/*
 * Craftsman Digital / Channel B -- countertop price calculator, for
 * countertop-only shops (stone and quartz fabricators).
 * Sibling to kitchen-engine.js -- same widget shell, form fields, consent,
 * honeypot, webhook posting, results screen, Powered-by line, price setting
 * and preview mode (copied deliberately, not re-derived). What is new: the
 * price is measured (square feet x the shop's price per square foot for the
 * stone level, plus line items), not score bands.
 * Plan (Andrew OK'd 2026-10-20): ICM-WORKSPACE/workspaces/craftsman-digital/
 * sprints/2026-10-20-first-yes/cd-sprint7-d-countertop-plan.md
 *
 * Per-client Custom Code snippet:
 *
 * <div id="cewRoot" data-calc="countertop"
 *   data-business-name="{{ custom_values.locationname }}"
 *   data-phone="{{ custom_values.location_phone }}"
 *   data-webhook-url="{{ custom_values.calculator__webhook_url }}"
 *   data-terms-url="{{ custom_values.calculator__terms_url }}"
 *   data-privacy-url="{{ custom_values.calculator__privacy_url }}"
 *   data-service-area="{{ custom_values.calculator__service_area }}"
 *   data-color-primary="{{ custom_values.calculator__brand_color_primary }}"
 *   data-color-dark="{{ custom_values.calculator__brand_color_dark }}"
 *   data-color-accent="{{ custom_values.calculator__brand_color_accent }}"
 *   data-countertop-rates='{"levels":{"l1":{"low":45,"high":70}}, ...}'
 *   data-price-adjustment="0"
 *   data-response-time="{{ custom_values.response_time_commitment }}"
 *   data-booking-status="{{ custom_values.booking__status }}"
 * ></div>
 * <script src="https://abegley5781.github.io/craftsman-digital-calculators/countertop-engine.js"></script>
 *
 * The engine boots ONLY on data-calc="countertop". It never reads data-tiers
 * (kitchen, bathroom) or data-rates (general), so it can't collide with them.
 *
 * data-countertop-rates holds every price number in ONE object (shape:
 * DEFAULT_RATES below), deep-merged over the defaults: a page passes only what
 * it changes (arrays such as [low, high] are replaced, not merged). A shop
 * renames its stone levels with levels.lN.label / .examples. Missing means the
 * defaults; invalid JSON logs an error and uses the defaults. The defaults are
 * CD's demo numbers, every one sourced in the plan file above (Colorado shop
 * pages first, national guides as the cross-check).
 *
 * The math, in one place (price() below):
 *   square feet  = kitchen shape [low, high] (or the typed number, island
 *                  included) + island [low, high] + each vanity [low, high]
 *   billed sq ft = max(square feet, minSqft)  (low and high each)
 *   stone        = billed sq ft x level $/sq ft [low, high]
 *   edge         = front-edge feet x edge $/ft; front-edge feet = counter run
 *                  (kitchen sq ft / depthFt, typed sq ft included) + island
 *                  perimeter + vanity fronts
 *   cutouts      = main kitchen sink + second sink + cooktop + each vanity sink
 *   tear-out     = square feet (not billed) x removal $/sq ft
 *   backsplash   = 4-inch: wall run feet x $/ft; full height: wall run feet x
 *                  fullHeightFt x the level's $/sq ft (same slab). Wall run =
 *                  kitchen counter run + vanity backs (islands have no wall)
 *   waterfall    = flat add
 *   then x (1 + client adjustment/100), round to the nearest $100.
 *
 * data-mode="preview": contractor-only page, no contact form, a -50%..+50%
 * slider, price updates live (as kitchen). data-mode="mock": the full homeowner
 * flow on a demo page; the result shows after the form, nothing is posted, and
 * the payload is kept on the root as data-last-payload (for tests).
 *
 * data-expectation-note replaces the line under the range ("Your exact price
 * comes from our measure..."); data-expectation-note="" hides it.
 * data-powered-by="text" shows the Powered-by line without a link.
 *
 * Webhook payload: the kitchen engine's keys (trade_config "countertop",
 * tier_label = the stone level's label, score "" since there is no score) plus
 * sqft_low, sqft_high and stone_level.
 *
 * For tests, the pricing is a pure function: CountertopCalc.price(rates,
 * answers, opts) -- on window.CountertopCalc in a browser, module.exports in
 * node.
 */
(function () {
  var DEFAULT_EXPECTATION_NOTE = 'Your exact price comes from our measure at your home. This range is for planning.';
  var POWERED_BY_URL = 'https://craftsman-digital.com/how-it-works?ref=calculator';

  var DEFAULT_RATES = {
    levels: {
      l1: { label: 'Level 1', examples: 'entry granite, budget quartz', low: 45, high: 70 },
      l2: { label: 'Level 2', examples: 'most quartz and granite', low: 65, high: 95 },
      l3: { label: 'Level 3', examples: 'premium quartz, exotic granite, marble', low: 90, high: 150 },
      l4: { label: 'Level 4', examples: 'quartzite, rare stone', low: 110, high: 200 }
    },
    notSureLevel: 'l2',
    shapes: { galley: [20, 30], l: [30, 40], u: [40, 55] },
    islands: { small: { sqft: [10, 14], edgeFt: 14 }, medium: { sqft: [16, 22], edgeFt: 17 }, large: { sqft: [24, 32], edgeFt: 22 } },
    waterfall: [1500, 3000],
    vanities: { single: { sqft: [4, 7.5], edgeFt: [3, 4], sinks: 1 }, double: { sqft: [9, 15], edgeFt: [5, 6], sinks: 2 } },
    depthFt: 2.125,
    edges: { standard: [0, 0], decorative: [15, 25], mitered: [35, 55] },
    sinks: { kitchenFirst: [0, 300], kitchenExtra: [100, 300], vanity: [0, 175] },
    cooktop: [100, 200],
    removal: { none: [0, 0], laminate: [5, 10], tile: [5, 15], stone: [10, 20] },
    splash4: [10, 15],
    fullHeightFt: 1.5,
    minSqft: 30,
    maxTypedSqft: 500
  };

  var VANITY_SETS = { single: ['single'], double: ['double'], mixed: ['single', 'double'], twoDouble: ['double', 'double'] };

  function isPlainObject(o) { return o && typeof o === 'object' && !Array.isArray(o); }
  function mergeRates(base, over) {
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = isPlainObject(base[k]) ? mergeRates(base[k], {}) : base[k]; });
    if (!isPlainObject(over)) return out;
    Object.keys(over).forEach(function (k) {
      out[k] = isPlainObject(over[k]) && isPlainObject(out[k]) ? mergeRates(out[k], over[k]) : over[k];
    });
    return out;
  }
  function pair(a) { return Array.isArray(a) && a.length === 2 && isFinite(Number(a[0])) && isFinite(Number(a[1])) ? [Number(a[0]), Number(a[1])] : null; }

  // Pure pricing. rates = a full rates object (DEFAULT_RATES or a merge over
  // it). a = { project: 'kitchen'|'bath'|'both', shape: 'galley'|'l'|'u'|'known',
  // sqft (when shape is 'known'), island: 'none'|'small'|'medium'|'large',
  // waterfall: bool, vanities: 'single'|'double'|'mixed'|'twoDouble',
  // level: 'l1'..'l4'|'notsure', edge, cooktop: bool, prepSink: bool, removal,
  // splash: 'none'|'four'|'full' }. opts = { adjustmentPct }.
  // Returns null if the answers or rates don't add up, else { low, high,
  // sqftLow, sqftHigh, billedLow, billedHigh, minApplied, level } with low/high
  // in whole dollars rounded to $100.
  function price(rates, a, opts) {
    opts = opts || {};
    var kitchen = a.project === 'kitchen' || a.project === 'both';
    var bath = a.project === 'bath' || a.project === 'both';
    if (!kitchen && !bath) return null;
    var levelKey = a.level === 'notsure' ? rates.notSureLevel : a.level;
    var lv = (rates.levels || {})[levelKey];
    var lvP = lv ? pair([lv.low, lv.high]) : null;
    var edge = pair((rates.edges || {})[a.edge]);
    var rem = pair((rates.removal || {})[a.removal]);
    var depth = Number(rates.depthFt);
    if (!lvP || !edge || !rem || !(depth > 0)) return null;
    if (['none', 'four', 'full'].indexOf(a.splash) < 0) return null;

    var lo = 0, hi = 0, sqLo = 0, sqHi = 0, edgeLo = 0, edgeHi = 0, wallLo = 0, wallHi = 0;
    function add(p, n) { n = n == null ? 1 : n; lo += p[0] * n; hi += p[1] * n; }

    if (kitchen) {
      var s;
      if (a.shape === 'known') {
        var n = Number(a.sqft);
        if (!(n > 0) || n > Number(rates.maxTypedSqft || Infinity)) return null;
        s = [n, n];
      } else {
        s = pair((rates.shapes || {})[a.shape]);
        if (!s) return null;
      }
      sqLo += s[0]; sqHi += s[1];
      wallLo += s[0] / depth; wallHi += s[1] / depth;
      edgeLo += s[0] / depth; edgeHi += s[1] / depth;
      if (a.shape !== 'known' && a.island && a.island !== 'none') {
        var isl = (rates.islands || {})[a.island];
        var islSq = isl ? pair(isl.sqft) : null;
        if (!islSq) return null;
        sqLo += islSq[0]; sqHi += islSq[1];
        edgeLo += Number(isl.edgeFt) || 0; edgeHi += Number(isl.edgeFt) || 0;
        if (a.waterfall) { var wf = pair(rates.waterfall); if (wf) add(wf); }
      }
      add(pair(rates.sinks.kitchenFirst));
      if (a.prepSink) add(pair(rates.sinks.kitchenExtra));
      if (a.cooktop) add(pair(rates.cooktop));
    }
    if (bath) {
      var set = VANITY_SETS[a.vanities];
      if (!set) return null;
      for (var i = 0; i < set.length; i++) {
        var v = (rates.vanities || {})[set[i]];
        var vSq = v ? pair(v.sqft) : null, vEdge = v ? pair(v.edgeFt) : null;
        if (!vSq || !vEdge) return null;
        sqLo += vSq[0]; sqHi += vSq[1];
        edgeLo += vEdge[0]; edgeHi += vEdge[1];
        wallLo += vEdge[0]; wallHi += vEdge[1];
        add(pair(rates.sinks.vanity), Number(v.sinks) || 1);
      }
    }

    var min = Number(rates.minSqft) || 0;
    var bLo = Math.max(sqLo, min), bHi = Math.max(sqHi, min);
    lo += bLo * lvP[0]; hi += bHi * lvP[1];
    lo += edgeLo * edge[0]; hi += edgeHi * edge[1];
    lo += sqLo * rem[0]; hi += sqHi * rem[1];
    if (a.splash === 'four') { var s4 = pair(rates.splash4); if (s4) { lo += wallLo * s4[0]; hi += wallHi * s4[1]; } }
    if (a.splash === 'full') { var fh = Number(rates.fullHeightFt) || 0; lo += wallLo * fh * lvP[0]; hi += wallHi * fh * lvP[1]; }

    var f = 1 + (Number(opts.adjustmentPct) || 0) / 100;
    lo *= f; hi *= f;
    return {
      low: Math.round(lo / 100) * 100, high: Math.round(hi / 100) * 100,
      sqftLow: Math.round(sqLo * 10) / 10, sqftHigh: Math.round(sqHi * 10) / 10,
      billedLow: bLo, billedHigh: bHi, minApplied: sqLo < min, level: levelKey
    };
  }

  var api = { price: price, DEFAULT_RATES: DEFAULT_RATES, mergeRates: mergeRates };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  window.CountertopCalc = api;

  function fmt(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function fmtSq(n) { return (Math.round(n * 10) / 10).toLocaleString('en-US'); }

  // data-price-adjustment -> a number of percent, clamped to -50..50.
  // Missing, empty, or non-numeric (e.g. an unfilled GHL custom value) is 0.
  function parseAdjustment(raw) {
    var n = Number(String(raw == null ? '' : raw).trim().replace(/%$/, ''));
    if (!isFinite(n)) return 0;
    return Math.max(-50, Math.min(50, n)) || 0; // "|| 0" turns -0 into 0
  }
  function fmtPct(n) { return (n > 0 ? '+' : '') + n + '%'; }

  // Lead source tag, e.g. ?ref=demo (same as the kitchen engine).
  function leadRef() {
    function pick(url) {
      var m = /[?&]ref=([^&#]*)/.exec(url || '');
      if (!m) return '';
      var v = m[1];
      try { v = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) {}
      return v.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
    }
    var ref = pick(window.location.search);
    if (!ref) {
      var from = document.referrer || '';
      var site = window.location.protocol + '//' + window.location.host + '/';
      if (from.indexOf(site) === 0) ref = pick(from);
    }
    try {
      if (ref) window.sessionStorage.setItem('cd_ref', ref);
      else ref = window.sessionStorage.getItem('cd_ref') || '';
    } catch (e) {}
    return ref;
  }

  // Same rules as the kitchen engine's styles (shared look); kept under its own
  // id so this file works alone, and so a page with both engines styles once each.
  function injectStyles() {
    if (document.getElementById('cew-countertop-styles')) return;
    var style = document.createElement('style');
    style.id = 'cew-countertop-styles';
    style.textContent = [
      '.cew-wrap [hidden]{display:none!important;}',
      '.cew-wrap{max-width:36rem;margin:0 auto;padding:1.5rem 1rem;font-family:"Lato",-apple-system,"Segoe UI",sans-serif;--cew-tint:#f3f8fb;--cew-line:#d7e8f5;}',
      '.cew-powered{text-align:center;font-size:.78rem;line-height:1.4;color:#6b7785;margin:.75rem 0 0;}',
      '.cew-powered a{color:inherit;text-decoration:underline;text-underline-offset:2px;}',
      '.cew-powered a:hover{color:var(--cew-primary,#188bf6);}',
      '@supports (color:color-mix(in srgb,red,blue)){.cew-wrap{--cew-tint:color-mix(in srgb,var(--cew-primary,#188bf6) 6%,#fff);--cew-line:color-mix(in srgb,var(--cew-primary,#188bf6) 14%,#fff);}}',
      '.cew{background:#ffffff;color:#101828;border-radius:12px;padding:1.9rem 1.7rem 1.7rem;box-shadow:0 12px 32px -20px rgba(16,24,40,.35);border:1px solid #EAEAEA;}',
      '.cew *{box-sizing:border-box;}',
      '.cew-top{margin-bottom:1.2rem;}',
      '.cew-brand{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;font-weight:700;}',
      '.cew-name{font-family:"Montserrat",sans-serif;font-size:1.35rem;font-weight:700;margin-top:.2rem;}',
      '.cew-promise{font-size:.82rem;font-weight:700;text-align:center;background:var(--cew-tint);border:1px solid var(--cew-line);border-radius:8px;padding:.6rem .8rem;margin:0 0 1.2rem;}',
      '.cew-qgrid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin:1.1rem 0 1.3rem;}',
      '.cew-qgrid .cew-wide{grid-column:1 / -1;}',
      '@media (max-width:420px){.cew-qgrid{grid-template-columns:1fr;}.cew-lead-fields{grid-template-columns:1fr;}}',
      '.cew-field label,.cew-field-wrap label{display:block;font-size:.78rem;font-weight:700;margin-bottom:.35rem;line-height:1.3;}',
      '.cew-field select,.cew-field input{width:100%;font:inherit;font-size:.9rem;color:#101828;background:#fff;border:1px solid #cbd5e0;border-radius:8px;padding:.6rem .65rem;}',
      '.cew-field select.cew-err,.cew-field input.cew-err{border-color:#e25950;}',
      '.cew-section-label{font-size:.85rem;font-weight:700;margin:0 0 .8rem;padding-top:1.1rem;border-top:1px solid #EAEAEA;}',
      '.cew-lead-fields{display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin-bottom:.7rem;}',
      '.cew-lead-input{font:inherit;font-size:.9rem;color:#101828;width:100%;background:#fff;border:1px solid #cbd5e0;border-radius:8px;padding:.6rem .65rem;}',
      '.cew-lead-input::placeholder{color:#9aa5b1;}',
      '.cew-lead-input.cew-err{border-color:#e25950;}',
      '.cew-est-row{display:flex;align-items:flex-start;gap:.65rem;background:#f5f5f5;border:1px solid #EAEAEA;border-radius:8px;padding:.75rem .85rem;margin-bottom:.7rem;}',
      '.cew-est-row input[type=checkbox]{margin-top:.2rem;width:16px;height:16px;flex-shrink:0;}',
      '.cew-est-row label{font-size:.85rem;line-height:1.4;color:#334155;cursor:pointer;}',
      '.cew-phone-wrap{margin-bottom:.7rem;}',
      '.cew-consent-row{display:flex;align-items:flex-start;gap:.65rem;margin-bottom:.3rem;}',
      '.cew-consent-row input[type=checkbox]{margin-top:.25rem;width:16px;height:16px;flex-shrink:0;}',
      '.cew-consent-row label{font-size:.78rem;line-height:1.5;color:#4a5568;}',
      '.cew-consent-row.cew-err label{color:#c0392b;}',
      '.cew-cta-row{margin-top:1.1rem;}',
      '.cew-cta{font:inherit;font-weight:700;font-size:.95rem;color:#ffffff;border:none;border-radius:8px;padding:.85rem 1.3rem;cursor:pointer;width:100%;}',
      '.cew-cta-outline{font:inherit;font-weight:700;font-size:.9rem;background:#fff;border-width:2px;border-style:solid;border-radius:8px;padding:.75rem 1.3rem;cursor:pointer;width:100%;text-align:center;text-decoration:none;display:block;}',
      '.cew-cta-outline:hover{background:var(--cew-tint);}',
      '.cew-result{display:grid;gap:1.1rem;container-type:inline-size;}',
      '.cew-band-label{font-size:.75rem;letter-spacing:.06em;text-transform:uppercase;font-weight:700;margin-bottom:.3rem;}',
      '.cew-price{font-family:"Montserrat",sans-serif;font-size:clamp(1.8rem,1.3rem + 2vw,2.3rem);margin:0;font-weight:700;font-variant-numeric:tabular-nums;}',
      '@supports (font-size:1cqi){.cew-price{font-size:clamp(1.4rem,9.4cqi,2.3rem);}}',
      '.cew-nw{white-space:nowrap;}',
      '.cew-result .cew-answers{font-size:.88rem;line-height:1.5;color:#4a5568;margin:.4rem 0 .6rem;}',
      '.cew-answers strong{font-weight:700;}',
      '.cew-tier-heading{font-size:1rem;font-weight:700;margin:.9rem 0 0;}',
      '.cew-tier-bullets{margin:.6rem 0 0;padding-left:1.2rem;font-size:.9rem;line-height:1.6;color:#4a5568;}',
      '.cew-tier-bullets li{margin-bottom:.2rem;}',
      '.cew-expect{margin:.9rem 0 0;padding:.1rem 0 .1rem .75rem;border-left:3px solid #188bf6;font-size:1rem;line-height:1.6;color:#4a5568;}',
      '.cew-callback-msg{font-size:.9rem;line-height:1.5;color:#1f5c33;background:#eafaf0;border:1px solid #b7e4c7;border-radius:8px;padding:.75rem .85rem;}',
      '.cew-next{font-size:.9rem;line-height:1.5;color:#4a5568;margin:0;}',
      '.cew-notes{resize:vertical;min-height:4.5rem;}',
      '.cew-msg{font-size:.85rem;line-height:1.5;border-radius:8px;padding:.65rem .8rem;}',
      '.cew-msg.cew-error{background:#fdecea;color:#a1362a;border:1px solid #f3c6c1;}',
      '.cew-msg.cew-ok{background:#eafaf0;color:#1f5c33;border:1px solid #b7e4c7;}',
      '.cew-preview-controls{display:grid;gap:1rem;margin:0 0 1.3rem;padding-top:1.1rem;border-top:1px solid #EAEAEA;}',
      '.cew-slider-head{display:flex;justify-content:space-between;align-items:baseline;gap:.6rem;}',
      '.cew-slider-readout{font-family:"Montserrat",sans-serif;font-size:1.1rem;font-weight:700;font-variant-numeric:tabular-nums;}',
      '.cew-range{display:block;width:100%;margin:.3rem 0 0;}',
      '.cew-range-ends{display:flex;justify-content:space-between;font-size:.72rem;color:#6b7785;}',
      '.cew-hint{font-size:.78rem;line-height:1.4;color:#6b7785;margin:.35rem 0 0;}',
      '.cew-preview-empty{font-size:.92rem;color:#4a5568;margin:0;}',
      '.cew-setting{font-size:.9rem;font-weight:700;background:var(--cew-tint);border:1px solid var(--cew-line);border-radius:8px;padding:.6rem .8rem;margin:0;}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  function poweredBy(root) {
    var line = el('p', { class: 'cew-powered' });
    var name = 'Craftsman Digital';
    if (String(root.getAttribute('data-powered-by') || '').trim().toLowerCase() === 'text') {
      line.textContent = 'Powered by ' + name;
    } else {
      line.appendChild(document.createTextNode('Powered by '));
      var a = el('a', { href: POWERED_BY_URL, target: '_blank', rel: 'noopener' });
      a.textContent = name;
      line.appendChild(a);
    }
    return line;
  }

  // The questions. `show` says when a question applies; hidden questions are
  // not asked, not required and not priced. Every shown question starts blank
  // and must be answered (Andrew, 2026-10-06). `say` is the plain-words
  // version used in the "Based on: ..." line and answers_summary.
  function buildQuestions(rates) {
    var L = rates.levels;
    function levelOpt(k) { var l = L[k] || {}; return { value: k, label: (l.label || k) + (l.examples ? ' (' + l.examples + ')' : ''), say: (l.label || k) + ' stone' + (l.examples ? ' (' + l.examples + ')' : '') }; }
    var notSure = L[rates.notSureLevel] || {};
    var isKitchen = function (s) { return s.project === 'kitchen' || s.project === 'both'; };
    var isBath = function (s) { return s.project === 'bath' || s.project === 'both'; };
    return [
      { key: 'project', label: 'What are you replacing?', wide: true, options: [
        { value: 'kitchen', label: 'Kitchen countertops' },
        { value: 'bath', label: 'Bathroom vanity tops' },
        { value: 'both', label: 'Both' }
      ]},
      { key: 'shape', label: 'Kitchen shape', show: isKitchen, options: [
        { value: 'galley', label: 'One wall or galley', say: 'a one-wall or galley kitchen' },
        { value: 'l', label: 'L-shaped', say: 'an L-shaped kitchen' },
        { value: 'u', label: 'U-shaped', say: 'a U-shaped kitchen' },
        { value: 'known', label: 'I know my square feet', say: 'kitchen counters' }
      ]},
      { key: 'sqft', label: 'Square feet of counter (island included)', input: 'number', show: function (s) { return isKitchen(s) && s.shape === 'known'; } },
      { key: 'island', label: 'Island', show: function (s) { return isKitchen(s) && s.shape !== 'known'; }, options: [
        { value: 'none', label: 'No island', say: '' },
        { value: 'small', label: 'Small (about 3 x 4 ft)', say: 'a small island' },
        { value: 'medium', label: 'Medium (about 3.5 x 5 ft)', say: 'a medium island' },
        { value: 'large', label: 'Large (about 4 x 7 ft)', say: 'a large island' },
        { value: 'largeWaterfall', label: 'Large, with waterfall sides', say: 'a large island with waterfall sides' }
      ]},
      { key: 'vanities', label: 'Vanity tops', show: isBath, options: [
        { value: 'single', label: 'One single-sink vanity', say: 'one single-sink vanity' },
        { value: 'double', label: 'One double-sink vanity', say: 'one double-sink vanity' },
        { value: 'mixed', label: 'Two vanities (one single, one double)', say: 'two vanities (one single, one double)' },
        { value: 'twoDouble', label: 'Two double-sink vanities', say: 'two double-sink vanities' }
      ]},
      { key: 'level', label: 'Stone level', wide: true, options: ['l1', 'l2', 'l3', 'l4'].filter(function (k) { return L[k]; }).map(levelOpt).concat([
        { value: 'notsure', label: 'Not sure yet', say: 'stone not picked yet (priced as ' + (notSure.label || 'the middle level') + ')' }
      ])},
      { key: 'edge', label: 'Edge', options: [
        { value: 'standard', label: 'Standard (eased, included)', say: 'standard edge' },
        { value: 'decorative', label: 'Rounded or decorative (bullnose, ogee)', say: 'a rounded or decorative edge' },
        { value: 'mitered', label: 'Thick mitered look', say: 'a thick mitered edge' }
      ]},
      { key: 'cooktop', label: 'Cooktop cutout?', show: isKitchen, options: [
        { value: 'yes', label: 'Yes, a cooktop drops into the counter', say: 'a cooktop cutout' },
        { value: 'no', label: 'No (slide-in range or none)', say: '' }
      ]},
      { key: 'prepSink', label: 'A second kitchen sink?', show: isKitchen, options: [
        { value: 'no', label: 'No, one sink', say: '' },
        { value: 'yes', label: 'Yes, a second sink (prep or bar)', say: 'a second sink' }
      ]},
      { key: 'removal', label: 'Old countertops coming out?', options: [
        { value: 'none', label: 'No, it’s a new space', say: 'nothing to tear out' },
        { value: 'laminate', label: 'Yes, laminate or solid surface', say: 'laminate tops coming out' },
        { value: 'tile', label: 'Yes, tile', say: 'tile tops coming out' },
        { value: 'stone', label: 'Yes, stone or quartz', say: 'stone tops coming out' }
      ]},
      { key: 'splash', label: 'Backsplash', options: [
        { value: 'none', label: 'None', say: 'no stone backsplash' },
        { value: 'four', label: '4-inch stone strip', say: 'a 4-inch backsplash' },
        { value: 'full', label: 'Full height (18 in) in the same stone', say: 'a full-height stone backsplash' }
      ]},
      { key: 'start', label: 'When are you hoping to start?', wide: true, price: false, options: [
        { value: 'asap', label: 'As soon as possible' },
        { value: '1-3', label: 'In the next 1 to 3 months' },
        { value: '3-6', label: '3 to 6 months out' },
        { value: 'planning', label: 'Just planning for now' }
      ]}
    ];
  }

  // GA4 conversion (Lane C, C13 "website best practices", 2026-10-20): after the lead is saved,
  // send generate_lead if the page has Google Analytics (gtag). A no-op without gtag; never in
  // preview or demo mode, since those never post.
  function trackLead(trade, ref) {
    try { if (typeof window.gtag === 'function') window.gtag('event', 'generate_lead', { trade: trade, ref: ref || 'none' }); } catch (e) {}
  }

  function init(root) {
    var cfg = {
      businessName: root.getAttribute('data-business-name') || '',
      phone: root.getAttribute('data-phone') || '',
      webhookUrl: root.getAttribute('data-webhook-url') || '',
      termsUrl: root.getAttribute('data-terms-url') || '#',
      privacyUrl: root.getAttribute('data-privacy-url') || '#',
      serviceArea: root.getAttribute('data-service-area') || 'your area',
      colorPrimary: root.getAttribute('data-color-primary') || '#188bf6',
      colorDark: root.getAttribute('data-color-dark') || '#101828',
      colorAccent: root.getAttribute('data-color-accent') || '#3581ac',
      priceAdjustment: parseAdjustment(root.getAttribute('data-price-adjustment')),
      preview: String(root.getAttribute('data-mode') || '').trim().toLowerCase() === 'preview',
      mock: String(root.getAttribute('data-mode') || '').trim().toLowerCase() === 'mock',
      ref: leadRef(),
      responseTime: String(root.getAttribute('data-response-time') || '').trim(),
      bookingClosed: String(root.getAttribute('data-booking-status') || '').trim().toLowerCase() === 'closed',
      expectationNote: root.hasAttribute('data-expectation-note') ? root.getAttribute('data-expectation-note') : DEFAULT_EXPECTATION_NOTE
    };
    // Belt and braces: preview and mock never post.
    if (cfg.preview || cfg.mock) cfg.webhookUrl = '';
    var over = {};
    var rawRates = root.getAttribute('data-countertop-rates');
    if (rawRates) {
      try { over = JSON.parse(rawRates); }
      catch (e) { console.error('countertop-engine: invalid data-countertop-rates JSON, using defaults', e); over = {}; }
    }
    var rates = mergeRates(DEFAULT_RATES, over);
    var QUESTIONS = buildQuestions(rates);

    injectStyles();

    var state = {};   // question key -> chosen value ('' = not picked)
    var picked = {};  // question key -> chosen option (for say text)
    QUESTIONS.forEach(function (q) { state[q.key] = ''; picked[q.key] = null; });

    function shown(q) { return !q.show || q.show(state); }
    function sqftValid() {
      var n = Number(state.sqft);
      return state.sqft !== '' && n > 0 && n <= Number(rates.maxTypedSqft || Infinity);
    }
    function unanswered() {
      return QUESTIONS.filter(function (q) {
        if (!shown(q)) return false;
        if (q.input === 'number') return !sqftValid();
        return state[q.key] === '';
      });
    }
    function answers() {
      return {
        project: state.project, shape: state.shape, sqft: Number(state.sqft),
        island: state.island === 'largeWaterfall' ? 'large' : state.island, waterfall: state.island === 'largeWaterfall',
        vanities: state.vanities, level: state.level, edge: state.edge,
        cooktop: state.cooktop === 'yes', prepSink: state.prepSink === 'yes',
        removal: state.removal, splash: state.splash
      };
    }
    function answersList(p) {
      var parts = [];
      var kitchen = state.project === 'kitchen' || state.project === 'both';
      if (kitchen) {
        var k = (picked.shape || {}).say || 'kitchen counters';
        if (state.shape === 'known') k = Number(state.sqft).toLocaleString('en-US') + ' sq ft of kitchen counters';
        else if ((picked.island || {}).say) k += ' with ' + picked.island.say;
        parts.push(k);
      }
      if (state.project === 'bath' || state.project === 'both') parts.push((picked.vanities || {}).say);
      if (p && p.sqftLow !== p.sqftHigh) parts.push('about ' + fmtSq(p.sqftLow) + ' to ' + fmtSq(p.sqftHigh) + ' sq ft in all');
      else if (p && state.project === 'both') parts.push(fmtSq(p.sqftLow) + ' sq ft in all');
      ['level', 'edge', 'cooktop', 'prepSink', 'removal', 'splash'].forEach(function (key) {
        var q = QUESTIONS.filter(function (x) { return x.key === key; })[0];
        if (q && shown(q) && picked[key] && picked[key].say) parts.push(picked[key].say);
      });
      return parts.filter(Boolean).join(', ');
    }
    function startTimeframe() { return picked.start ? picked.start.label : ''; }
    // Owner's alert only, never shown: a guess from the stone and edge picks.
    function priorityLean() {
      var pr = [], qu = [];
      if (state.level === 'l1') pr.push('Level 1 stone');
      if (state.level === 'l3' || state.level === 'l4') qu.push((rates.levels[state.level] || {}).label + ' stone');
      if (state.edge === 'mitered') qu.push('mitered edge');
      if (pr.length > qu.length) return 'Leans price (' + pr.join(', ') + ')';
      if (qu.length > pr.length) return 'Leans quality (' + qu.join(', ') + ')';
      return 'No clear lean';
    }

    var adjustmentPct = cfg.priceAdjustment;
    function currentPrice() { return price(rates, answers(), { adjustmentPct: adjustmentPct }); }

    var tintOk = window.CSS && CSS.supports && CSS.supports('color', cfg.colorPrimary);
    var wrap = el('div', { class: 'cew-wrap', style: tintOk ? '--cew-primary:' + cfg.colorPrimary : '' });
    var card = el('div', { class: 'cew' }, [
      el('div', { class: 'cew-top' }, [
        el('div', { class: 'cew-brand', style: 'color:' + cfg.colorAccent, html: cfg.businessName }),
        el('div', { class: 'cew-name', style: 'color:' + cfg.colorDark, html: 'Countertop Price Calculator' })
      ]),
      el('p', { class: 'cew-promise', style: 'color:' + cfg.colorPrimary, html: cfg.preview
        ? 'Preview only. Try answers and price settings here. Nothing is sent or saved.'
        : 'See your price range right here, instantly. We&rsquo;ll also email you a copy with your answers, so you can come back to it.' })
    ]);

    var qgrid = el('div', { class: 'cew-qgrid' });
    var fields = {}, controlsByKey = {};
    QUESTIONS.forEach(function (q) {
      var ctl;
      if (q.input === 'number') {
        ctl = el('input', { type: 'number', inputmode: 'decimal', min: '1', max: String(rates.maxTypedSqft), step: 'any', placeholder: 'e.g. 45' });
        ctl.addEventListener('input', function () { state[q.key] = ctl.value.trim(); ctl.classList.remove('cew-err'); onChange(); });
      } else {
        ctl = el('select');
        var blank = el('option', { value: '', html: 'Pick one' });
        blank.disabled = true; blank.selected = true;
        ctl.appendChild(blank);
        q.options.forEach(function (o) { ctl.appendChild(el('option', { value: o.value, html: o.label })); });
        ctl.addEventListener('change', function () {
          state[q.key] = ctl.value;
          picked[q.key] = q.options[ctl.selectedIndex - 1] || null;
          ctl.classList.remove('cew-err');
          onChange();
        });
      }
      controlsByKey[q.key] = ctl;
      var f = el('div', { class: q.wide ? 'cew-field cew-wide' : 'cew-field' }, [
        el('label', { style: 'color:' + cfg.colorDark, html: q.label }), ctl
      ]);
      fields[q.key] = f;
      qgrid.appendChild(f);
    });
    var afterChange = null;
    function onChange() {
      QUESTIONS.forEach(function (q) { fields[q.key].hidden = !shown(q); });
      if (afterChange) afterChange();
    }
    onChange();

    var bandLabel = el('div', { class: 'cew-band-label', style: 'color:' + cfg.colorAccent, html: 'Your price range' });
    var priceRange = el('p', { class: 'cew-price', style: 'color:' + cfg.colorDark, html: '$0 &ndash; $0' });
    var answersLine = el('p', { class: 'cew-answers' }); answersLine.hidden = true;
    var inHeading = el('p', { class: 'cew-tier-heading', style: 'color:' + cfg.colorDark, html: 'What this price covers' });
    var inBullets = el('ul', { class: 'cew-tier-bullets' });
    var expectNote = el('p', { class: 'cew-expect', style: 'border-left-color:' + cfg.colorPrimary });
    expectNote.textContent = cfg.expectationNote || '';
    expectNote.hidden = !String(cfg.expectationNote || '').trim();

    // Fills the price display for the current answers and returns what it
    // showed, so normal mode sends exactly that.
    function showPrice() {
      var p = currentPrice();
      if (!p) return null;
      priceRange.innerHTML = '<span class="cew-nw">' + fmt(p.low) + '</span> &ndash; <span class="cew-nw">' + fmt(p.high) + '</span>';
      var list = answersList(p);
      answersLine.innerHTML = '';
      answersLine.appendChild(el('strong', { style: 'color:' + cfg.colorDark, html: 'Based on:' }));
      answersLine.appendChild(document.createTextNode(' ' + list + '.'));
      answersLine.hidden = !list;
      var lv = rates.levels[p.level] || {};
      var items = [(lv.label || 'Stone') + ' stone, cut, edged and installed'];
      var kit = state.project === 'kitchen' || state.project === 'both';
      if (kit) items.push(state.prepSink === 'yes' ? 'Two kitchen sink cutouts' : 'The kitchen sink cutout');
      if (kit && state.cooktop === 'yes') items.push('The cooktop cutout');
      if (state.project === 'bath' || state.project === 'both') items.push('Vanity sink cutouts');
      if (state.edge === 'decorative') items.push('A rounded or decorative edge');
      if (state.edge === 'mitered') items.push('A thick mitered edge');
      if (state.island === 'largeWaterfall') items.push('Waterfall sides on the island');
      if (state.removal && state.removal !== 'none') items.push('Tearing out and hauling off the old tops');
      if (state.splash === 'four') items.push('A 4-inch backsplash in the same stone');
      if (state.splash === 'full') items.push('A full-height backsplash in the same stone');
      if (p.minApplied) items.push('Small jobs are priced at our ' + fmtSq(Number(rates.minSqft)) + ' sq ft minimum');
      inBullets.innerHTML = '';
      items.forEach(function (t) { var li = el('li'); li.textContent = t; inBullets.appendChild(li); });
      return { p: p, answersSummary: list ? 'Based on: ' + list + '.' : '' };
    }

    if (cfg.preview) {
      var slider = el('input', {
        class: 'cew-range', type: 'range', min: '-50', max: '50', step: '5',
        style: 'accent-color:' + cfg.colorPrimary, 'aria-label': 'Your price setting'
      });
      slider.value = String(Math.round(adjustmentPct / 5) * 5);
      adjustmentPct = Number(slider.value);
      var readout = el('span', { class: 'cew-slider-readout', style: 'color:' + cfg.colorDark });
      var settingLine = el('p', { class: 'cew-setting', style: 'color:' + cfg.colorDark });
      var emptyMsg = el('p', { class: 'cew-preview-empty', html: 'Pick your answers to see the price.' });
      var previewResult = el('div', { class: 'cew-result' }, [
        el('div', {}, [bandLabel, priceRange, answersLine, inHeading, inBullets, expectNote]),
        settingLine
      ]);
      var controls = el('div', { class: 'cew-preview-controls' }, [
        el('div', { class: 'cew-field-wrap' }, [
          el('div', { class: 'cew-slider-head' }, [el('label', { style: 'color:' + cfg.colorDark, html: 'Your price setting' }), readout]),
          slider,
          el('div', { class: 'cew-range-ends' }, [el('span', { html: '-50%' }), el('span', { html: '+50%' })]),
          el('p', { class: 'cew-hint', html: 'Moves every price up or down by this percent.' })
        ])
      ]);
      afterChange = function () {
        readout.textContent = fmtPct(adjustmentPct);
        settingLine.textContent = 'Your price setting: ' + fmtPct(adjustmentPct);
        var ready = !unanswered().filter(function (q) { return q.price !== false; }).length;
        var shownP = ready ? showPrice() : null;
        emptyMsg.hidden = !!shownP;
        previewResult.hidden = !shownP;
      };
      var onSlide = function () { adjustmentPct = Number(slider.value); afterChange(); };
      slider.addEventListener('input', onSlide);
      slider.addEventListener('change', onSlide);
      card.appendChild(qgrid);
      card.appendChild(controls);
      card.appendChild(emptyMsg);
      card.appendChild(previewResult);
      wrap.appendChild(card);
      wrap.appendChild(poweredBy(root));
      root.innerHTML = '';
      root.appendChild(wrap);
      afterChange();
      return;
    }

    var firstName = el('input', { class: 'cew-lead-input', type: 'text', placeholder: 'First Name' });
    var lastName = el('input', { class: 'cew-lead-input', type: 'text', placeholder: 'Last Name' });
    var email = el('input', { class: 'cew-lead-input', type: 'email', placeholder: 'Email' });
    var zip = el('input', { class: 'cew-lead-input', type: 'text', inputmode: 'numeric', maxlength: '5', placeholder: 'Postal Code' });
    var phoneInput = el('input', { class: 'cew-lead-input', type: 'tel', placeholder: 'Phone Number' });
    // Honeypot: invisible to a real visitor, no label, no focus stop.
    var honeypot = el('input', {
      type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true',
      style: 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;'
    });
    var wantsCallBox = el('input', { type: 'checkbox' });
    var consentBox = el('input', { type: 'checkbox' });
    var notesInput = el('textarea', { class: 'cew-lead-input cew-notes', rows: '3', maxlength: '500', placeholder: 'Optional' });
    var consentRow = el('div', { class: 'cew-consent-row' }, [
      consentBox,
      el('label', { html:
        'I consent to ' + cfg.businessName + ' contacting me about my project, including estimates, scheduling, and ' +
        'relevant updates by email, phone, or text message. Message and data rates may apply. I can unsubscribe or ' +
        'opt out at any time. By submitting this form, you agree to our <a href="' + cfg.termsUrl + '" target="_blank" ' +
        'rel="noopener" style="color:' + cfg.colorPrimary + '">Terms of Service</a> and <a href="' + cfg.privacyUrl +
        '" target="_blank" rel="noopener" style="color:' + cfg.colorPrimary + '">Privacy Policy</a>.'
      })
    ]);
    var phoneWrap = el('div', { class: 'cew-phone-wrap' }, [
      el('div', { class: 'cew-field-wrap' }, [el('label', { style: 'color:' + cfg.colorDark, html: 'Phone Number *' }), phoneInput])
    ]);
    phoneWrap.hidden = true;
    wantsCallBox.addEventListener('change', function (e) { phoneWrap.hidden = !e.target.checked; });

    var formMsg = el('div', { class: 'cew-msg' });
    formMsg.hidden = true;
    function setFormMsg(text) { formMsg.hidden = false; formMsg.className = 'cew-msg cew-error'; formMsg.textContent = text; }

    var submitBtn = el('button', {
      type: 'button', class: 'cew-cta', style: 'background:' + cfg.colorPrimary,
      html: 'See What New Countertops Cost in ' + cfg.serviceArea
    });

    var form = el('div', {}, [
      qgrid,
      el('p', { class: 'cew-section-label', style: 'color:' + cfg.colorDark, html: 'Your Info' }),
      el('div', { class: 'cew-lead-fields' }, [
        el('div', { class: 'cew-field-wrap' }, [el('label', { style: 'color:' + cfg.colorDark, html: 'First Name *' }), firstName]),
        el('div', { class: 'cew-field-wrap' }, [el('label', { style: 'color:' + cfg.colorDark, html: 'Last Name *' }), lastName])
      ]),
      el('div', { class: 'cew-lead-fields' }, [
        el('div', { class: 'cew-field-wrap' }, [el('label', { style: 'color:' + cfg.colorDark, html: 'Email *' }), email]),
        el('div', { class: 'cew-field-wrap' }, [el('label', { style: 'color:' + cfg.colorDark, html: 'Postal Code *' }), zip])
      ]),
      el('div', { class: 'cew-est-row' }, [wantsCallBox, el('label', { html: 'I&rsquo;d also like a call to talk through my project' })]),
      phoneWrap,
      el('div', { class: 'cew-field-wrap cew-notes-wrap' }, [el('label', { style: 'color:' + cfg.colorDark, html: 'Anything else we should know about your project?' }), notesInput]),
      honeypot,
      consentRow,
      el('div', { class: 'cew-cta-row' }, [submitBtn]),
      formMsg
    ]);

    var callbackMsg = el('div', { class: 'cew-callback-msg' }); callbackMsg.hidden = true;
    var nextMsg = el('p', { class: 'cew-next' });
    var callNowLink = el('a', {
      class: 'cew-cta-outline', href: '#',
      style: 'color:' + cfg.colorPrimary + ';border-color:' + cfg.colorPrimary,
      html: 'Call Us Now: ' + cfg.phone
    });
    var rawPhone = cfg.phone.replace(/\D/g, '');
    if (rawPhone) callNowLink.href = 'tel:+1' + rawPhone.slice(-10);
    callNowLink.hidden = !rawPhone;
    var resultMsg = el('div', { class: 'cew-msg' }); resultMsg.hidden = true;

    var result = el('div', { class: 'cew-result' }, [
      el('div', {}, [bandLabel, priceRange, answersLine, inHeading, inBullets, expectNote]),
      callbackMsg, nextMsg, callNowLink, resultMsg
    ]);
    result.hidden = true;

    submitBtn.addEventListener('click', function () {
      if (honeypot.value) { form.hidden = true; result.hidden = false; return; }
      var firstVal = firstName.value.trim();
      var lastVal = lastName.value.trim();
      var emailVal = email.value.trim();
      var zipVal = zip.value.trim();
      var phoneVal = phoneInput.value.trim();
      var wantsCall = wantsCallBox.checked;
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);
      var zipOk = /^\d{5}$/.test(zipVal);

      firstName.classList.toggle('cew-err', !firstVal);
      lastName.classList.toggle('cew-err', !lastVal);
      email.classList.toggle('cew-err', !emailOk);
      zip.classList.toggle('cew-err', !zipOk);
      phoneInput.classList.toggle('cew-err', wantsCall && !phoneVal);
      consentRow.classList.toggle('cew-err', !consentBox.checked);
      var missing = unanswered();
      QUESTIONS.forEach(function (q) { controlsByKey[q.key].classList.toggle('cew-err', missing.indexOf(q) >= 0); });
      if (missing.length) {
        var typed = missing.filter(function (q) { return q.input === 'number'; }).length && state.sqft !== '';
        setFormMsg(typed ? 'Enter your square feet as a number from 1 to ' + rates.maxTypedSqft + '. For a bigger job, call us for a measure.'
          : 'Please answer every question above so we can price your project.');
        return;
      }
      if (!firstVal || !lastVal || !emailOk || !zipOk) {
        setFormMsg('Please fill in your first name, last name, a valid email, and your postal code.');
        return;
      }
      if (wantsCall && !phoneVal) { setFormMsg('Please add a phone number so we can call you back.'); return; }
      if (!consentBox.checked) { setFormMsg('Please check the consent box so we can follow up with you.'); return; }

      var shown2 = showPrice();
      if (!shown2) { setFormMsg('Something in those answers didn’t add up. Please check them, or call us at ' + cfg.phone + '.'); return; }
      var p = shown2.p;
      formMsg.hidden = true;
      if (wantsCall) {
        callbackMsg.hidden = false;
        callbackMsg.textContent = cfg.bookingClosed
          ? 'Thanks, ' + firstVal + '. We’re not taking on new projects right now, so we’ve added you to our wait list. We’ll call you as soon as we’re able.'
          : 'Thanks, ' + firstVal + '! We’ll call you ' + (cfg.responseTime || 'soon') + ' at ' + phoneVal + ' to talk through your project.';
      } else {
        callbackMsg.hidden = true;
      }
      nextMsg.textContent = 'Your price range and answers are on their way to ' + emailVal + '. If you don’t see the email in a few minutes, check your Promotions or spam folder.';
      if (cfg.bookingClosed) callNowLink.hidden = true;
      form.hidden = true;
      result.hidden = false;
      // The form is long on a phone; once it hides, bring the result into view.
      try { if (card.getBoundingClientRect().top < 0) card.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}

      var lv = rates.levels[p.level] || {};
      var payload = {
        first_name: firstVal, last_name: lastVal, email: emailVal, phone: phoneVal,
        trade_config: 'countertop', score: '', estimate_low: p.low, estimate_high: p.high,
        price_range: fmt(p.low) + ' – ' + fmt(p.high),
        tier_label: lv.label || p.level, zip: zipVal, price_adjustment_pct: 0,
        wants_call: wantsCall ? 'Yes' : 'No',
        answers_summary: shown2.answersSummary,
        project_notes: notesInput.value.trim(),
        priority_lean: priorityLean(),
        start_timeframe: startTimeframe(),
        client_adjustment_pct: adjustmentPct,
        ref: cfg.ref,
        sqft_low: p.sqftLow, sqft_high: p.sqftHigh, stone_level: lv.label || p.level
      };

      if (cfg.mock) {
        root.setAttribute('data-last-payload', JSON.stringify(payload));
        resultMsg.hidden = false;
        resultMsg.className = 'cew-msg cew-ok';
        resultMsg.textContent = 'Demo: nothing was sent. On a shop’s real site this saves the lead and emails the homeowner a copy.';
        return;
      }
      if (cfg.webhookUrl) {
        fetch(cfg.webhookUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        }).then(function (res) {
          if (!res.ok) throw new Error('bad status ' + res.status);
          trackLead('countertop', cfg.ref);
        }).catch(function () {
          resultMsg.hidden = false;
          resultMsg.className = 'cew-msg cew-error';
          resultMsg.textContent = 'We had trouble saving your info just now. If you don’t hear from us, please call ' + cfg.phone + ' directly.';
        });
      }
    });

    card.appendChild(form);
    card.appendChild(result);
    wrap.appendChild(card);
    wrap.appendChild(poweredBy(root));
    root.innerHTML = '';
    root.appendChild(wrap);
  }

  function boot() {
    var roots = document.querySelectorAll('[data-calc="countertop"]');
    Array.prototype.forEach.call(roots, init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
