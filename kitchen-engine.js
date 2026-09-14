/*
 * Craftsman Digital / Channel B -- shared kitchen calculator engine.
 * Sibling to bathroom-engine.js -- same widget shell, form fields, webhook
 * posting, and hidden/CSS handling (copied deliberately, not re-derived),
 * with kitchen-specific questions and pricing tiers.
 *
 * Unlike bathroom (which pulled real per-tier copy from CKB's own live
 * form), CKB has no live kitchen calculator to source from. Per Andrew's
 * direction 2026-09-14, pricing tiers below are grounded in Journal of
 * Light Construction's Cost vs. Value report (2026 national figures,
 * cross-checked against a Colorado-market citation of the same report):
 *   - Minor Kitchen Remodel:            $28,458 national avg job cost
 *   - Major Kitchen Remodel (Midrange): $82,793 national avg job cost
 *   - Major Kitchen Remodel (Upscale):  $164,104 national avg job cost
 * These are national industry baselines, not CKB-specific quotes -- same
 * treatment already accepted for the painting calculator (flagged as
 * least-grounded, national numbers only). Tier low/high ranges below are
 * reasonable spreads around each anchor, not independently sourced.
 *
 * Per-client Custom Code snippet needed on the GHL page (same custom
 * values as bathroom -- no new GHL config needed to onboard this):
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
 *   data-tiers='[{"max":15,"low":18000,"high":35000,"label":"...","heading":"...","intro":"...","bullets":["..."]}, ...]'
 * ></div>
 * <script src="https://abegley5781.github.io/craftsman-digital-calculators/kitchen-engine.js"></script>
 */
(function () {
  var QUESTIONS = [
    { key: 'size', label: 'How would you describe the size of the kitchen?', options: [
      { label: 'Small / galley (under 100 sqft)', value: 8 },
      { label: 'Medium / standard (100–200 sqft)', value: 12, def: true },
      { label: 'Large / open-concept (200+ sqft)', value: 18 },
    ]},
    { key: 'scope', label: 'What best describes the scope of your remodel?', options: [
      { label: 'Cosmetic refresh (paint, hardware, keep cabinets & layout)', value: 0 },
      { label: 'Reface & upgrade (new cabinet fronts or full cabinets, same layout)', value: 6, def: true },
      { label: 'Full gut remodel (everything replaced)', value: 14 },
    ]},
    { key: 'cabinets', label: 'What level of cabinetry are you considering?', options: [
      { label: 'Refinish or reface existing cabinet boxes', value: -2 },
      { label: 'New stock or semi-custom cabinets', value: 0, def: true },
      { label: 'Full custom cabinetry', value: 6 },
    ]},
    { key: 'finish', label: 'What countertop / finish level are you aiming for?', options: [
      { label: 'Laminate or butcher block', value: -2 },
      { label: 'Quartz or granite (mid-range)', value: 0, def: true },
      { label: 'Premium stone / high-end custom finishes', value: 5 },
    ]},
    { key: 'layout', label: 'Will the layout, walls, or plumbing/electrical change?', options: [
      { label: 'No / Not sure', value: 0, def: true },
      { label: 'Move some plumbing or electrical, same footprint', value: 4 },
      { label: 'Remove walls / full layout change', value: 9 },
    ]},
    { key: 'year', label: 'When was your home built?', options: [
      { label: '1990 or newer', value: 0 },
      { label: '1970–1989', value: 1, def: true },
      { label: 'Before 1970', value: 3 },
    ]},
  ];

  function fmt(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

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
      '.cew-wrap{max-width:36rem;margin:0 auto;padding:1.5rem 1rem;font-family:"Lato",-apple-system,"Segoe UI",sans-serif;}',
      '.cew{background:#ffffff;color:#101828;border-radius:12px;padding:1.9rem 1.7rem 1.7rem;box-shadow:0 12px 32px -20px rgba(16,24,40,.35);border:1px solid #EAEAEA;}',
      '.cew *{box-sizing:border-box;}',
      '.cew-top{margin-bottom:1.2rem;}',
      '.cew-brand{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;font-weight:700;}',
      '.cew-name{font-family:"Montserrat",sans-serif;font-size:1.35rem;font-weight:700;margin-top:.2rem;}',
      '.cew-promise{font-size:.82rem;font-weight:700;text-align:center;background:#f3f8fb;border:1px solid #d7e8f5;border-radius:8px;padding:.6rem .8rem;margin:0 0 1.2rem;}',
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
      '.cew-cta-outline:hover{background:#f3f8fb;}',
      '.cew-result{display:grid;gap:1.1rem;}',
      '.cew-band-label{font-size:.75rem;letter-spacing:.06em;text-transform:uppercase;font-weight:700;margin-bottom:.3rem;}',
      '.cew-price{font-family:"Montserrat",sans-serif;font-size:clamp(1.8rem,1.3rem + 2vw,2.3rem);margin:0;font-weight:700;font-variant-numeric:tabular-nums;}',
      '.cew-blurb{font-size:.92rem;line-height:1.55;color:#4a5568;margin:.5rem 0 0;}',
      '.cew-tier-heading{font-size:1rem;font-weight:700;margin:.9rem 0 0;}',
      '.cew-tier-bullets{margin:.6rem 0 0;padding-left:1.2rem;font-size:.9rem;line-height:1.6;color:#4a5568;}',
      '.cew-tier-bullets li{margin-bottom:.2rem;}',
      '.cew-callback-msg{font-size:.9rem;line-height:1.5;color:#1f5c33;background:#eafaf0;border:1px solid #b7e4c7;border-radius:8px;padding:.75rem .85rem;}',
      '.cew-msg{font-size:.85rem;line-height:1.5;border-radius:8px;padding:.65rem .8rem;}',
      '.cew-msg.cew-error{background:#fdecea;color:#a1362a;border:1px solid #f3c6c1;}'
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
      tiers: []
    };
    try { cfg.tiers = JSON.parse(root.getAttribute('data-tiers') || '[]'); }
    catch (e) { console.error('kitchen-engine: invalid data-tiers JSON', e); }
    if (!cfg.tiers.length) {
      root.innerHTML = '<p style="color:#a1362a">Calculator config missing (data-tiers). Contact support.</p>';
      return;
    }

    injectStyles();

    var state = {};
    QUESTIONS.forEach(function (q) {
      var d = q.options.filter(function (o) { return o.def; })[0] || q.options[0];
      state[q.key] = d.value;
    });

    function currentTier(score) {
      for (var i = 0; i < cfg.tiers.length; i++) { if (score <= cfg.tiers[i].max) return cfg.tiers[i]; }
      return cfg.tiers[cfg.tiers.length - 1];
    }
    function computeScore() {
      return QUESTIONS.reduce(function (s, q) { return s + state[q.key]; }, 0);
    }

    var wrap = el('div', { class: 'cew-wrap' });
    var card = el('div', { class: 'cew' }, [
      el('div', { class: 'cew-top' }, [
        el('div', { class: 'cew-brand', style: 'color:' + cfg.colorAccent, html: cfg.businessName }),
        el('div', { class: 'cew-name', style: 'color:' + cfg.colorDark, html: 'Kitchen Cost Calculator' })
      ]),
      el('p', { class: 'cew-promise', style: 'color:' + cfg.colorPrimary, html: 'See your price range right here, instantly &mdash; we&rsquo;ll also send a copy to your email.' })
    ]);

    var qgrid = el('div', { class: 'cew-qgrid' });
    QUESTIONS.forEach(function (q) {
      var select = el('select');
      q.options.forEach(function (o) {
        var opt = el('option', { value: o.value, html: o.label });
        if (o.def) opt.selected = true;
        select.appendChild(opt);
      });
      select.addEventListener('change', function (e) { state[q.key] = Number(e.target.value); });
      qgrid.appendChild(el('div', { class: 'cew-field' }, [
        el('label', { style: 'color:' + cfg.colorDark, html: q.label }),
        select
      ]));
    });

    var firstName = el('input', { class: 'cew-lead-input', type: 'text', placeholder: 'First Name' });
    var lastName = el('input', { class: 'cew-lead-input', type: 'text', placeholder: 'Last Name' });
    var email = el('input', { class: 'cew-lead-input', type: 'email', placeholder: 'Email' });
    var zip = el('input', { class: 'cew-lead-input', type: 'text', inputmode: 'numeric', maxlength: '5', placeholder: 'Postal Code' });
    var phoneInput = el('input', { class: 'cew-lead-input', type: 'tel', placeholder: 'Phone Number' });
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
      html: 'See What a Kitchen Remodel Costs in ' + cfg.serviceArea
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
      formMsg
    ]);

    var bandLabel = el('div', { class: 'cew-band-label', style: 'color:' + cfg.colorAccent, html: 'Your price range' });
    var priceRange = el('p', { class: 'cew-price', style: 'color:' + cfg.colorDark, html: '$0 &ndash; $0' });
    var tierHeading = el('p', { class: 'cew-tier-heading', style: 'color:' + cfg.colorDark });
    var tierIntro = el('p', { class: 'cew-blurb' });
    var tierBullets = el('ul', { class: 'cew-tier-bullets' });
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
      el('div', {}, [bandLabel, priceRange, tierHeading, tierIntro, tierBullets]),
      callbackMsg,
      callNowLink,
      resultMsg
    ]);
    result.hidden = true;

    submitBtn.addEventListener('click', function () {
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

      var score = computeScore();
      var tier = currentTier(score);

      priceRange.textContent = fmt(tier.low) + ' – ' + fmt(tier.high);
      tierHeading.textContent = tier.heading || '';
      tierIntro.textContent = tier.intro || '';
      tierBullets.innerHTML = '';
      (tier.bullets || []).forEach(function (b) {
        tierBullets.appendChild(el('li', { html: b }));
      });
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
        trade_config: 'kitchen', score: score, estimate_low: tier.low, estimate_high: tier.high,
        tier_label: tier.label, zip: zipVal, price_adjustment_pct: 0,
        wants_call: wantsCall ? 'Yes' : 'No'
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
