/*
 * Craftsman Digital / Channel B -- shared bathroom calculator engine.
 * One file, referenced via <script src> from every client's GHL page.
 * Per-client data (colors, phone, webhook URL, pricing tiers) is read
 * from data-* attributes on the container element, not hardcoded here --
 * that's what lets this same file serve every client without edits.
 *
 * Per-client Custom Code snippet needed on the GHL page:
 *
 * <div id="cewRoot"
 *   data-business-name="{{ custom_values.locationname }}"
 *   data-phone="{{ custom_values.location_phone }}"
 *   data-webhook-url="{{ custom_values.calculator__webhook_url }}"
 *   data-terms-url="{{ custom_values.calculator__terms_url }}"
 *   data-privacy-url="{{ custom_values.calculator__privacy_url }}"
 *   data-service-area="{{ custom_values.calculator__service_area }}"
 *   data-color-primary="{{ custom_values.calculator__brand_color_primary }}"
 *   data-color-dark="{{ custom_values.calculator__brand_color_dark }}"
 *   data-color-accent="{{ custom_values.calculator__brand_color_accent }}"
 *   data-tiers='[{"max":8,"low":5000,"high":11000}, ...]'
 *   data-scope-copy='{"0":{"heading":"...","intro":"...","bullets":["...", ...]}, "5":{...}, "9":{...}}'
 *   data-zip-multipliers-url="https://abegley5781.github.io/craftsman-digital-calculators/co-zip-multipliers.json"
 *   data-price-adjustment="0"
 * ></div>
 * <script src="https://abegley5781.github.io/craftsman-digital-calculators/bathroom-engine.js"></script>
 *
 * data-tiers drives price only now -- no heading/intro/bullets per band. The
 * results screen's description text is a separate lookup, data-scope-copy,
 * keyed by the literal "scope" question's value (0/5/9 = Refresh/Partial/Full
 * gut), not the blended score -- so someone who picks Refresh never sees
 * "near-full demolition" copy just because other answers pushed their score
 * up. Price still uses the full blended score across all 9 tiers; multiple
 * price tiers can share one scope-copy bucket (e.g. tiers 7-9 all show the
 * "Full gut remodel" copy, at three different price ranges).
 *
 * data-zip-multipliers-url is optional; defaults to the shared Colorado table
 * below. It's a flat {"zip":multiplier} file, fetched once at page load (not
 * at submit -- keeps the price reveal instant, no network wait). A ZIP not in
 * the file gets no adjustment (1.0x), same as if the fetch hasn't finished or
 * fails. Values are a ratio to the national median home value for that ZIP,
 * rescaled and clamped to 0.7-1.5 -- see channel-b-finish-line.md A23 for the
 * real formula and its known limits (e.g. small ZIPs Census suppresses
 * entirely, ~12% of Colorado's). The engine itself applies only a wide safety
 * clamp (0.5-2.0) against a corrupted file, not real business judgment --
 * that judgment happens when the file's values get generated, not here.
 *
 * Answers summary: the results screen shows a "Based on: ..." line under the
 * range built from the visitor's 6 answers (each option's "say" text), in
 * normal mode and in preview mode (where it updates live with the answers).
 * In normal mode the webhook payload carries the same sentence as
 * answers_summary. GHL needs a contact custom field mapped to answers_summary
 * to save it; until then GHL ignores the extra field and every existing
 * mapping keeps working.
 *
 * data-price-adjustment is optional: ONE +/- percent per client that shifts
 * every price up or down to fit how that contractor prices, e.g. "10" or
 * "-15" (a trailing "%" is accepted). Clamped to -50..50; missing, empty, or
 * non-numeric means 0. Final price = tier low/high x ZIP multiplier x
 * (1 + adjustment/100), rounded to the nearest $100 -- applied in one place
 * (adjustedPrices below), so the displayed range, price_range, and
 * estimate_low/high always agree. At 0 the output is exactly what it was
 * before this setting existed. The webhook payload gets one more field after
 * answers_summary, client_adjustment_pct (0 when not set);
 * price_adjustment_pct still means the ZIP adjustment only.
 *
 * data-mode="preview" is optional, for a hidden contractor-only page: no
 * contact form, no consent box, no submit, and the webhook is never called.
 * It shows the questions, a ZIP box, and a -50%..+50% slider (steps of 5,
 * starting at data-price-adjustment), and updates the price and the
 * "Based on: ..." line live on every change, with a "Your price setting:
 * +10%" line to copy into onboarding. Any other data-mode value (or none) is
 * the normal lead-capture calculator.
 */
(function () {
  // "say" is the plain-words version of each answer, used in the "Based on: ..."
  // line on the results screen and sent to GHL as answers_summary. Keep each one
  // in step with its label if a label ever changes.
  var QUESTIONS = [
    { key: 'size', label: 'How would you describe the size of the bathroom?', options: [
      { label: '25–50 sqft (Small/half bath)', value: 10, say: 'a small bathroom (25–50 sqft)' },
      { label: '51–100 sqft (Medium/full bath)', value: 14, def: true, say: 'a medium bathroom (51–100 sqft)' },
      { label: '101–150 sqft (Large/master bath)', value: 18, say: 'a large bathroom (101–150 sqft)' },
    ]},
    { key: 'scope', label: 'What best describes the scope of your remodel?', options: [
      { label: 'Refresh (fixtures, surfaces, minimal changes)', value: 0, say: 'refresh of fixtures and surfaces' },
      { label: 'Partial remodel (new shower/tub, finishes)', value: 5, def: true, say: 'partial remodel' },
      { label: 'Full gut remodel (everything rebuilt)', value: 9, say: 'full gut remodel' },
    ]},
    { key: 'tile', label: 'What level of tile work or tub/shower?', options: [
      { label: 'No tile (acrylic, solid surface panels)', value: -1, say: 'no tile (acrylic or solid surface panels)' },
      { label: 'Basic (tile surround or floor only)', value: 0, def: true, say: 'basic tile (surround or floor only)' },
      { label: 'Full tile shower (walls + pan)', value: 2, say: 'full tile shower (walls and pan)' },
      { label: 'Extensive tile (shower, floor, walls, niches)', value: 4, say: 'extensive tile (shower, floor, walls, niches)' },
    ]},
    { key: 'finish', label: 'What finish level are you aiming for?', options: [
      { label: 'Basic / budget-conscious', value: -1, say: 'basic finishes' },
      { label: 'Mid-range', value: 0, def: true, say: 'mid-range finishes' },
      { label: 'Not sure yet', value: 1, say: 'finishes not decided yet' },
      { label: 'High-end / custom', value: 3, say: 'high-end or custom finishes' },
    ]},
    { key: 'layout', label: 'Will plumbing fixtures or walls be moved?', options: [
      { label: 'No / Not sure', value: 0, def: true, say: 'no plumbing or wall moves (or not sure yet)' },
      { label: 'Yes', value: 2, say: 'plumbing or walls moved' },
    ]},
    { key: 'year', label: 'When was your home built?', options: [
      { label: '1990 or newer', value: 0, say: 'home built 1990 or newer' },
      { label: '1970–1989', value: 1, def: true, say: 'home built 1970–1989' },
      { label: 'Before 1970', value: 2, say: 'home built before 1970' },
    ]},
  ];

  function fmt(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

  // data-price-adjustment -> a number of percent, clamped to -50..50.
  // Missing, empty, or non-numeric (e.g. an unfilled GHL custom value) is 0.
  function parseAdjustment(raw) {
    var n = Number(String(raw == null ? '' : raw).trim().replace(/%$/, ''));
    if (!isFinite(n)) return 0;
    return Math.max(-50, Math.min(50, n)) || 0; // "|| 0" turns -0 into 0
  }
  function fmtPct(n) { return (n > 0 ? '+' : '') + n + '%'; }

  // Lead source tag, e.g. ?ref=demo. Read from this page's address, else from
  // the same-site page the visitor clicked through from (a hub page opened with
  // ?ref=...), else from earlier in this visit. Letters, digits, - and _ only,
  // max 40 characters; '' when there is none. Sent as `ref` in the payload.
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

  function injectStyles() {
    if (document.getElementById('cew-engine-styles')) return;
    var style = document.createElement('style');
    style.id = 'cew-engine-styles';
    style.textContent = [
      // Guard first: a later class rule setting display: on a hidden element
      // (e.g. .cew-result{display:grid}) otherwise silently wins over the
      // hidden attribute's default, since they're equal specificity -- the
      // !important here is what makes hidden actually stay hidden.
      '.cew-wrap [hidden]{display:none!important;}',
      '.cew-wrap{max-width:36rem;margin:0 auto;padding:1.5rem 1rem;font-family:"Lato",-apple-system,"Segoe UI",sans-serif;--cew-tint:#f3f8fb;--cew-line:#d7e8f5;}',
      // Tints follow the client's primary color; browsers without color-mix keep the light-blue defaults above.
      '@supports (color:color-mix(in srgb,red,blue)){.cew-wrap{--cew-tint:color-mix(in srgb,var(--cew-primary,#188bf6) 6%,#fff);--cew-line:color-mix(in srgb,var(--cew-primary,#188bf6) 14%,#fff);}}',
      '.cew{background:#ffffff;color:#101828;border-radius:12px;padding:1.9rem 1.7rem 1.7rem;box-shadow:0 12px 32px -20px rgba(16,24,40,.35);border:1px solid #EAEAEA;}',
      '.cew *{box-sizing:border-box;}',
      '.cew-top{margin-bottom:1.2rem;}',
      '.cew-brand{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;font-weight:700;}',
      '.cew-name{font-family:"Montserrat",sans-serif;font-size:1.35rem;font-weight:700;margin-top:.2rem;}',
      '.cew-promise{font-size:.82rem;font-weight:700;text-align:center;background:var(--cew-tint);border:1px solid var(--cew-line);border-radius:8px;padding:.6rem .8rem;margin:0 0 1.2rem;}',
      '.cew-qgrid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin:1.1rem 0 1.3rem;}',
      '@media (max-width:420px){.cew-qgrid{grid-template-columns:1fr;}.cew-lead-fields{grid-template-columns:1fr;}}',
      '.cew-field label,.cew-field-wrap label{display:block;font-size:.78rem;font-weight:700;margin-bottom:.35rem;line-height:1.3;}',
      '.cew-field select{width:100%;font:inherit;font-size:.9rem;color:#101828;background:#fff;border:1px solid #cbd5e0;border-radius:8px;padding:.6rem .65rem;}',
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
      '.cew-cta:disabled{opacity:.6;cursor:default;}',
      '.cew-cta-outline{font:inherit;font-weight:700;font-size:.9rem;background:#fff;border-width:2px;border-style:solid;border-radius:8px;padding:.75rem 1.3rem;cursor:pointer;width:100%;text-align:center;text-decoration:none;display:block;}',
      '.cew-cta-outline:hover{background:var(--cew-tint);}',
      '.cew-result{display:grid;gap:1.1rem;}',
      '.cew-band-label{font-size:.75rem;letter-spacing:.06em;text-transform:uppercase;font-weight:700;margin-bottom:.3rem;}',
      '.cew-price{font-family:"Montserrat",sans-serif;font-size:clamp(1.8rem,1.3rem + 2vw,2.3rem);margin:0;font-weight:700;font-variant-numeric:tabular-nums;}',
      // Price scales with the result box so the widest range stays on one line on phones;
      // if a very small screen still can't fit it, the nowrap spans make it break at the dash.
      '.cew-result{container-type:inline-size;}',
      '@supports (font-size:1cqi){.cew-price{font-size:clamp(1.4rem,9.4cqi,2.3rem);}}',
      '.cew-nw{white-space:nowrap;}',
      '.cew-blurb{font-size:.92rem;line-height:1.55;color:#4a5568;margin:.5rem 0 0;}',
      // Two classes so a host page's own p{margin:0} reset can't squash the spacing.
      '.cew-result .cew-answers{font-size:.88rem;line-height:1.5;color:#4a5568;margin:.4rem 0 .6rem;}',
      '.cew-answers strong{font-weight:700;}',
      '.cew-tier-heading{font-size:1rem;font-weight:700;margin:.9rem 0 0;}',
      '.cew-tier-bullets{margin:.6rem 0 0;padding-left:1.2rem;font-size:.9rem;line-height:1.6;color:#4a5568;}',
      '.cew-tier-bullets li{margin-bottom:.2rem;}',
      '.cew-callback-msg{font-size:.9rem;line-height:1.5;color:#1f5c33;background:#eafaf0;border:1px solid #b7e4c7;border-radius:8px;padding:.75rem .85rem;}',
      '.cew-msg{font-size:.85rem;line-height:1.5;border-radius:8px;padding:.65rem .8rem;}',
      '.cew-msg.cew-error{background:#fdecea;color:#a1362a;border:1px solid #f3c6c1;}',
      // Preview mode (data-mode="preview") only.
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
    for (var k in attrs || {}) {
      if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { e.appendChild(c); });
    return e;
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
      ref: leadRef(),
      tiers: [],
      scopeCopy: {},
      zipMultipliers: {}
    };
    // Belt and braces: preview mode never builds the form or submit handler,
    // and also has no webhook URL to post to.
    if (cfg.preview) cfg.webhookUrl = '';
    try { cfg.tiers = JSON.parse(root.getAttribute('data-tiers') || '[]'); }
    catch (e) { console.error('bathroom-engine: invalid data-tiers JSON', e); }
    try { cfg.scopeCopy = JSON.parse(root.getAttribute('data-scope-copy') || '{}'); }
    catch (e) { console.error('bathroom-engine: invalid data-scope-copy JSON', e); }
    var zipMultipliersUrl = root.getAttribute('data-zip-multipliers-url') ||
      'https://abegley5781.github.io/craftsman-digital-calculators/co-zip-multipliers.json';
    var zipTableLoaded = fetch(zipMultipliersUrl).then(function (res) {
      if (!res.ok) throw new Error('bad status ' + res.status);
      return res.json();
    }).then(function (json) {
      cfg.zipMultipliers = json || {};
    }).catch(function (e) {
      console.error('bathroom-engine: could not load zip multipliers, proceeding with no adjustment', e);
    });
    if (!cfg.tiers.length) {
      root.innerHTML = '<p style="color:#a1362a">Calculator config missing (data-tiers). Contact support.</p>';
      return;
    }

    injectStyles();

    var state = {};
    var picked = {}; // index of the chosen option per question, for the answers summary
    QUESTIONS.forEach(function (q) {
      var d = q.options.filter(function (o) { return o.def; })[0] || q.options[0];
      state[q.key] = d.value;
      picked[q.key] = q.options.indexOf(d);
    });
    function answersList() {
      return QUESTIONS.map(function (q) {
        var o = q.options[picked[q.key]] || {};
        return o.say || o.label || '';
      }).filter(Boolean).join(', ');
    }

    function currentTier(score) {
      for (var i = 0; i < cfg.tiers.length; i++) { if (score <= cfg.tiers[i].max) return cfg.tiers[i]; }
      return cfg.tiers[cfg.tiers.length - 1];
    }
    function currentScopeCopy() {
      return cfg.scopeCopy[String(state.scope)] || { heading: '', intro: '', bullets: [] };
    }
    function currentScopeLabel() {
      var scopeQ = QUESTIONS.filter(function (q) { return q.key === 'scope'; })[0];
      var opt = scopeQ.options.filter(function (o) { return o.value === state.scope; })[0];
      return opt ? opt.label : '';
    }
    function zipMultiplier(zipVal) {
      var m = Number(cfg.zipMultipliers[zipVal]);
      if (!m || isNaN(m)) return 1;
      return Math.max(0.5, Math.min(2, m)); // wide safety clamp only -- see comment above
    }
    function computeScore() {
      return QUESTIONS.reduce(function (s, q) { return s + state[q.key]; }, 0);
    }
    function answersComplete() {
      return QUESTIONS.every(function (q) { return typeof state[q.key] === 'number' && !isNaN(state[q.key]); });
    }

    // Client price adjustment in percent: fixed from data-price-adjustment in
    // normal mode, moved by the slider in preview mode.
    var adjustmentPct = cfg.priceAdjustment;
    // The ONE place a price is computed: tier x ZIP multiplier x client
    // adjustment, rounded to the nearest $100. At adjustment 0 the factor is
    // exactly 1, so the numbers are the same as before this setting existed.
    function adjustedPrices(tier, mult) {
      var f = 1 + adjustmentPct / 100;
      return {
        low: Math.round(tier.low * mult * f / 100) * 100,
        high: Math.round(tier.high * mult * f / 100) * 100
      };
    }

    // Only a real color reaches the tints; anything else (e.g. "dark green" typed as text) falls back to the default blue.
    var tintOk = window.CSS && CSS.supports && CSS.supports('color', cfg.colorPrimary);
    var wrap = el('div', { class: 'cew-wrap', style: tintOk ? '--cew-primary:' + cfg.colorPrimary : '' });
    var card = el('div', { class: 'cew' }, [
      el('div', { class: 'cew-top' }, [
        el('div', { class: 'cew-brand', style: 'color:' + cfg.colorAccent, html: cfg.businessName }),
        el('div', { class: 'cew-name', style: 'color:' + cfg.colorDark, html: 'Bathroom Cost Calculator' })
      ]),
      el('p', { class: 'cew-promise', style: 'color:' + cfg.colorPrimary, html: cfg.preview
        ? 'Preview only &mdash; try answers and price settings here. Nothing is sent or saved.'
        : 'See your price range right here, instantly. We&rsquo;ll also email you a copy with your answers, so you can come back to it.' })
    ]);

    var qgrid = el('div', { class: 'cew-qgrid' });
    QUESTIONS.forEach(function (q) {
      var select = el('select');
      q.options.forEach(function (o) {
        var opt = el('option', { value: o.value, html: o.label });
        if (o.def) opt.selected = true;
        select.appendChild(opt);
      });
      select.addEventListener('change', function (e) { state[q.key] = Number(e.target.value); picked[q.key] = e.target.selectedIndex; });
      qgrid.appendChild(el('div', { class: 'cew-field' }, [
        el('label', { style: 'color:' + cfg.colorDark, html: q.label }),
        select
      ]));
    });

    // Price display, shared by normal mode (shown after submit) and preview
    // mode (shown live).
    var bandLabel = el('div', { class: 'cew-band-label', style: 'color:' + cfg.colorAccent, html: 'Your price range' });
    var priceRange = el('p', { class: 'cew-price', style: 'color:' + cfg.colorDark, html: '$0 &ndash; $0' });
    var answersLine = el('p', { class: 'cew-answers' }); answersLine.hidden = true;
    var zipNote = el('p', { class: 'cew-blurb', style: 'margin-top:.2rem' }); zipNote.hidden = true;
    var tierHeading = el('p', { class: 'cew-tier-heading', style: 'color:' + cfg.colorDark });
    var tierIntro = el('p', { class: 'cew-blurb' });
    var tierBullets = el('ul', { class: 'cew-tier-bullets' });

    // Fills the price display (range, "Based on: ..." line, ZIP note, scope
    // copy) for the current answers and ZIP, and returns the same numbers and
    // answers sentence so normal mode sends exactly what was shown.
    function showPrice(zipVal) {
      var score = computeScore();
      var tier = currentTier(score);
      var mult = zipMultiplier(zipVal);
      var p = adjustedPrices(tier, mult);

      priceRange.innerHTML = '<span class="cew-nw">' + fmt(p.low) + '</span> &ndash; <span class="cew-nw">' + fmt(p.high) + '</span>';
      var answers = answersList();
      var answersSummary = answers ? 'Based on: ' + answers + '.' : '';
      answersLine.innerHTML = '';
      if (answers) {
        answersLine.appendChild(el('strong', { style: 'color:' + cfg.colorDark, html: 'Based on:' }));
        answersLine.appendChild(document.createTextNode(' ' + answers + '.'));
      }
      answersLine.hidden = !answers;
      if (mult !== 1) {
        zipNote.hidden = false;
        zipNote.textContent = 'Adjusted for the ' + zipVal + ' area.';
      } else {
        zipNote.hidden = true;
      }
      var copy = currentScopeCopy();
      tierHeading.textContent = copy.heading || '';
      tierIntro.textContent = copy.intro || '';
      tierBullets.innerHTML = '';
      (copy.bullets || []).forEach(function (b) {
        tierBullets.appendChild(el('li', { html: b }));
      });
      return { score: score, mult: mult, low: p.low, high: p.high, answersSummary: answersSummary };
    }

    if (cfg.preview) {
      // Contractor-only preview: no contact form, no consent box, no submit
      // button, no webhook call. The price re-renders on every change.
      var previewZip = el('input', { class: 'cew-lead-input', type: 'text', inputmode: 'numeric', maxlength: '5', placeholder: 'e.g. 81321' });
      var slider = el('input', {
        class: 'cew-range', type: 'range', min: '-50', max: '50', step: '5',
        style: 'accent-color:' + cfg.colorPrimary, 'aria-label': 'Your price setting'
      });
      // The slider moves in steps of 5, so a starting value like 7 snaps to 5;
      // the slider's value is what the price uses from here on.
      slider.value = String(Math.round(adjustmentPct / 5) * 5);
      adjustmentPct = Number(slider.value);
      var readout = el('span', { class: 'cew-slider-readout', style: 'color:' + cfg.colorDark });
      var settingLine = el('p', { class: 'cew-setting', style: 'color:' + cfg.colorDark });
      var emptyMsg = el('p', { class: 'cew-preview-empty', html: 'Pick your answers to see the price.' });
      var previewResult = el('div', { class: 'cew-result' }, [
        el('div', {}, [bandLabel, priceRange, answersLine, zipNote, tierHeading, tierIntro, tierBullets]),
        settingLine
      ]);
      var controls = el('div', { class: 'cew-preview-controls' }, [
        el('div', { class: 'cew-field-wrap' }, [
          el('label', { style: 'color:' + cfg.colorDark, html: 'Test a ZIP code (optional)' }),
          previewZip,
          el('p', { class: 'cew-hint', html: 'Uses the same area price adjustment homeowners get.' })
        ]),
        el('div', { class: 'cew-field-wrap' }, [
          el('div', { class: 'cew-slider-head' }, [
            el('label', { style: 'color:' + cfg.colorDark, html: 'Your price setting' }),
            readout
          ]),
          slider,
          el('div', { class: 'cew-range-ends' }, [el('span', { html: '-50%' }), el('span', { html: '+50%' })]),
          el('p', { class: 'cew-hint', html: 'Moves every price up or down by this percent.' })
        ])
      ]);

      var renderPreview = function () {
        readout.textContent = fmtPct(adjustmentPct);
        settingLine.textContent = 'Your price setting: ' + fmtPct(adjustmentPct);
        var ready = answersComplete();
        emptyMsg.hidden = ready;
        previewResult.hidden = !ready;
        if (ready) {
          var zipVal = previewZip.value.trim();
          showPrice(/^\d{5}$/.test(zipVal) ? zipVal : '');
        }
      };
      var onSlide = function () { adjustmentPct = Number(slider.value); renderPreview(); };
      // Each select's own listener (above) updates state first; this re-renders after it.
      Array.prototype.forEach.call(qgrid.querySelectorAll('select'), function (s) {
        s.addEventListener('change', renderPreview);
      });
      previewZip.addEventListener('input', renderPreview);
      slider.addEventListener('input', onSlide);
      slider.addEventListener('change', onSlide);
      // The ZIP table loads in the background; re-render once it is in, in
      // case a ZIP was typed before it arrived.
      zipTableLoaded.then(renderPreview);

      card.appendChild(qgrid);
      card.appendChild(controls);
      card.appendChild(emptyMsg);
      card.appendChild(previewResult);
      wrap.appendChild(card);
      root.innerHTML = '';
      root.appendChild(wrap);
      renderPreview();
      return;
    }

    var firstName = el('input', { class: 'cew-lead-input', type: 'text', placeholder: 'First Name' });
    var lastName = el('input', { class: 'cew-lead-input', type: 'text', placeholder: 'Last Name' });
    var email = el('input', { class: 'cew-lead-input', type: 'email', placeholder: 'Email' });
    var zip = el('input', { class: 'cew-lead-input', type: 'text', inputmode: 'numeric', maxlength: '5', placeholder: 'Postal Code' });
    var phoneInput = el('input', { class: 'cew-lead-input', type: 'tel', placeholder: 'Phone Number' });
    // Honeypot: invisible to a real visitor, no label, no focus stop -- a script that
    // blindly fills every input in the DOM will fill this too. Real users never will.
    var honeypot = el('input', {
      type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off',
      'aria-hidden': 'true',
      style: 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;'
    });
    var wantsCallBox = el('input', { type: 'checkbox' });
    var consentBox = el('input', { type: 'checkbox' });
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
    var phoneWrap = el('div', { class: 'cew-phone-wrap' }, [phoneInput]);
    phoneWrap.hidden = true;
    wantsCallBox.addEventListener('change', function (e) { phoneWrap.hidden = !e.target.checked; });

    var formMsg = el('div', { class: 'cew-msg' });
    formMsg.hidden = true;
    function setFormMsg(text) { formMsg.hidden = false; formMsg.className = 'cew-msg cew-error'; formMsg.textContent = text; }

    var submitBtn = el('button', {
      type: 'button', class: 'cew-cta', style: 'background:' + cfg.colorPrimary,
      html: 'See What a Bathroom Remodel Costs in ' + cfg.serviceArea
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
      (function () { var w = el('div', { class: 'cew-field-wrap' }, [el('label', { style: 'color:' + cfg.colorDark, html: 'Phone Number *' }), phoneInput]); phoneWrap.innerHTML = ''; phoneWrap.appendChild(w); return phoneWrap; })(),
      consentRow,
      el('div', { class: 'cew-cta-row' }, [submitBtn]),
      formMsg,
      honeypot
    ]);

    var callbackMsg = el('div', { class: 'cew-callback-msg' }); callbackMsg.hidden = true;
    var callNowLink = el('a', {
      class: 'cew-cta-outline', href: '#',
      style: 'color:' + cfg.colorPrimary + ';border-color:' + cfg.colorPrimary,
      html: 'Call Us Now: ' + cfg.phone
    });
    var rawPhone = cfg.phone.replace(/\D/g, '');
    if (rawPhone) callNowLink.href = 'tel:+1' + rawPhone;
    var resultMsg = el('div', { class: 'cew-msg' }); resultMsg.hidden = true;

    var result = el('div', { class: 'cew-result' }, [
      el('div', {}, [bandLabel, priceRange, answersLine, zipNote, tierHeading, tierIntro, tierBullets]),
      callbackMsg,
      callNowLink,
      resultMsg
    ]);
    result.hidden = true;

    submitBtn.addEventListener('click', function () {
      if (honeypot.value) {
        // Spam caught silently -- show the normal success screen so a script
        // probing the form gets no signal it was caught, but nothing real sends.
        form.hidden = true;
        result.hidden = false;
        return;
      }
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

      if (!firstVal || !lastVal || !emailOk || !zipOk) {
        setFormMsg('Please fill in your first name, last name, a valid email, and your postal code.');
        return;
      }
      if (wantsCall && !phoneVal) { setFormMsg('Please add a phone number so we can call you back.'); return; }
      if (!consentBox.checked) { setFormMsg('Please check the consent box so we can follow up with you.'); return; }

      var shown = showPrice(zipVal);
      var score = shown.score;
      var mult = shown.mult;
      var adjLow = shown.low;
      var adjHigh = shown.high;
      var answersSummary = shown.answersSummary;
      if (wantsCall) {
        callbackMsg.hidden = false;
        callbackMsg.textContent = 'Thanks, ' + firstVal + '! We’ll give you a call soon to talk through your project.';
      } else {
        callbackMsg.hidden = true;
      }
      form.hidden = true;
      result.hidden = false;

      var payload = {
        first_name: firstVal, last_name: lastVal, email: emailVal, phone: phoneVal,
        trade_config: 'bathroom', score: score, estimate_low: adjLow, estimate_high: adjHigh,
        price_range: fmt(adjLow) + ' – ' + fmt(adjHigh),
        tier_label: currentScopeLabel(), zip: zipVal, price_adjustment_pct: Math.round((mult - 1) * 100),
        wants_call: wantsCall ? 'Yes' : 'No',
        answers_summary: answersSummary,
        client_adjustment_pct: adjustmentPct,
        ref: cfg.ref
      };

      if (cfg.webhookUrl) {
        fetch(cfg.webhookUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        }).then(function (res) {
          if (!res.ok) throw new Error('bad status ' + res.status);
        }).catch(function () {
          resultMsg.hidden = false;
          resultMsg.className = 'cew-msg cew-error';
          resultMsg.textContent = 'We had trouble saving your info just now — if you don’t hear from us, please call ' + cfg.phone + ' directly.';
        });
      }
    });

    card.appendChild(form);
    card.appendChild(result);
    wrap.appendChild(card);
    root.innerHTML = '';
    root.appendChild(wrap);
  }

  function boot() {
    var roots = document.querySelectorAll('[data-tiers]');
    roots.forEach ? roots.forEach(init) : Array.prototype.forEach.call(roots, init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
