/*
 * Craftsman Digital free tool: Website check.
 * Spec: ICM-WORKSPACE/workspaces/craftsman-digital/offers/mini-lead-magnets.md (tool 5)
 *
 * Embed:
 * <div data-cd-magnet="site-check" data-api-url="https://cd-magnets.<account>.workers.dev" data-webhook-url="..."></div>
 * <script src="https://abegley5781.github.io/craftsman-digital-calculators/magnets/site-check/site-check.js"></script>
 * data-mode="mock" runs on sample data and posts nothing (previews); data-mock-case="redirect"
 * shows an address that sends people to another site.
 *
 * A browser page can't read another business's website (the browser blocks
 * it), so the cd-magnets Worker does the reading and the PageSpeed call:
 *   GET {api}/site-check?url=...
 *   -> { entered, finalUrl, loads, https, offDomain, finalHost, hasTel, hasForm,
 *        quoteLink, mobileScore, lcpSeconds } or { error }
 *
 * Mobile speed bands are Google's own Lighthouse bands: "0 to 49 (red):
 * Poor", "50 to 89 (orange): Needs Improvement", "90 to 100 (green): Good"
 * (https://developer.chrome.com/docs/lighthouse/performance/performance-scoring).
 */
(function () {
  'use strict';

  var TOOL = 'website-check';
  var CONSENT_TEXT = 'I agree that Craftsman Digital LLC may send me marketing texts and calls at this number, ' +
    'including automated texts and prerecorded voicemails. Agreeing is not required to buy anything. ' +
    'Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.';

  // Mock only: data-mock-case="redirect" shows an address that sends people to another site.
  function mockCheck(url, mockCase) {
    if (mockCase === 'redirect') {
      return { entered: url, finalUrl: 'https://www.casino-bonus-slots.example/', loads: true, https: true, offDomain: true,
        finalHost: 'www.casino-bonus-slots.example', hasTel: false, hasForm: false, quoteLink: '', mobileScore: 71, lcpSeconds: 3.2 };
    }
    return { entered: url, finalUrl: 'https://www.sample-remodeling.com/', loads: true, https: true, offDomain: false,
      finalHost: 'www.sample-remodeling.com', hasTel: false, hasForm: true, quoteLink: 'Get a Free Estimate',
      mobileScore: 38, lcpSeconds: 7.9 };
  }

  // The address the report is about. When the entered address sends people to
  // another site, every other check would describe that other site, so the
  // tool names the entered address and stops after the redirect row.
  function checkedAddress(d) { return d.offDomain ? d.entered : (d.finalUrl || d.entered); }
  var OFF_DOMAIN_NOTE = 'We stopped there. Speed, the lock, tap-to-call and a way to reach you would all be checks of someone else\'s site. Once your address opens your own site, run the check again.';

  function checkSite(d) {
    var rows = [];
    if (!d.loads) {
      rows.push({ key: 'loads', label: 'Site loads', ok: false, found: 'Didn\'t load', fix: 'Your site didn\'t load for us. Check it on your phone right now; if it\'s down for us, it may be down for homeowners.' });
      return rows;
    }
    // Label wording: Andrew, 2026-10-17 ("URL: Open correct site").
    rows.push({ key: 'domain', label: 'URL: Opens correct site', ok: !d.offDomain,
      found: d.offDomain ? 'No, it sends people to ' + d.finalHost : 'Yes',
      fix: 'Your web address sends visitors to a different site (' + d.finalHost + '). Homeowners who type your name land somewhere else. Fix this first: call whoever registered your domain.' });
    if (d.offDomain) return rows;
    rows.push({ key: 'https', label: 'Secure lock (https)', ok: !!d.https,
      found: d.https ? 'Yes' : 'No lock',
      fix: 'Browsers mark sites without the lock as "Not secure". Most hosts turn it on for free (look for SSL in your host\'s settings).' });
    var s = typeof d.mobileScore === 'number' ? d.mobileScore : null;
    var band = s === null ? null : s >= 90 ? 'Good' : s >= 50 ? 'Needs improvement' : 'Poor';
    rows.push({ key: 'speed', label: 'Mobile speed (Google\'s test)', ok: s !== null && s >= 90, warn: s !== null && s >= 50 && s < 90,
      found: s === null ? 'Couldn\'t measure' : s + ' of 100 (' + band + ')' + (d.lcpSeconds ? ', main content shows in ' + d.lcpSeconds.toFixed(1) + ' s' : ''),
      fix: 'Most homeowners look you up on a phone. Big photos are the usual cause; shrink them before you upload.' });
    // We read the page's code as it arrives. Some site builders (GHL, Wix and others) add buttons
    // after the page loads, so "not found" is said plainly as "not in the code", with a phone check.
    rows.push({ key: 'tel', label: 'Tap-to-call link', ok: !!d.hasTel, found: d.hasTel ? 'Yes' : 'Not found in your home page\'s code',
      fix: 'Make your phone number a link people can tap to call. On a phone, typing a number is one more reason not to call. Some site builders add the link after the page loads: open your site on your phone and tap the number. If it dials, you\'re fine.' });
    rows.push({ key: 'form', label: 'Way to reach you (form or estimate button)', ok: !!(d.hasForm || d.quoteLink),
      found: d.hasForm && d.quoteLink ? 'Form and "' + d.quoteLink + '"' : d.hasForm ? 'Form' : d.quoteLink ? '"' + d.quoteLink + '"' : 'Not found in your home page\'s code',
      fix: 'Give people a way to reach you at 10 at night, when they plan projects: a short form or a "Get an estimate" button.' });
    return rows;
  }

  // The emailed full report (teaser on screen, full report by email: Andrew 2026-10-17).
  function siteReport(d, rows) {
    var order = { domain: 0, loads: 0, https: 1, tel: 2, form: 3, speed: 4 };
    var bad = rows.filter(function (r) { return !r.ok; }).sort(function (a, b) { return (a.warn ? 1 : 0) - (b.warn ? 1 : 0) || order[a.key] - order[b.key]; });
    var good = rows.filter(function (r) { return r.ok; });
    var L = ['Website check for ' + checkedAddress(d), ''];
    var speed = rows.filter(function (r) { return r.key === 'speed'; })[0];
    if (speed) L.push('Mobile speed is ' + speed.found + '. Google PageSpeed Insights on a phone scores 90 to 100 as good, 50 to 89 as needs work, and under 50 as poor.', '');
    if (bad.length) {
      L.push('What to fix, worst first:');
      bad.forEach(function (r, i) { L.push((i + 1) + '. ' + r.label + ' (' + r.found + '). ' + r.fix); });
      L.push('');
    }
    if (d.offDomain) { L.push(OFF_DOMAIN_NOTE); return L.join('\n'); }
    if (good.length) L.push('Already good:', good.map(function (r) { return '- ' + r.label; }).join('\n'));
    L.push('We checked your home page only.');
    return L.join('\n');
  }

  function resultsSentence(d, rows) {
    var fixes = rows.filter(function (r) { return !r.ok; }).map(function (r) { return r.label.toLowerCase(); });
    var speed = rows.filter(function (r) { return r.key === 'speed'; })[0];
    return 'Website check for ' + checkedAddress(d) + '. ' + (speed ? 'Mobile speed: ' + speed.found + '. ' : '') +
      (fixes.length ? 'To fix: ' + fixes.join(', ') + '.' : 'Nothing big to fix.');
  }

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  var CSS = [
    '.cds{--cdm-ink:#1f2328;--cdm-navy:#2d3646;--cdm-muted:#4c5564;--cdm-steel:#4e7c91;--cdm-steel-2:#5f8fa6;--cdm-gold:#c2a26d;',
    '--cdm-paper:#ffffff;--cdm-wash:#f3f6f8;--cdm-line:#d5dde3;--cdm-good:#2f7a4f;--cdm-fix:#a8571c;--cdm-warn:#8a6d1f;--cdm-on-steel:#ffffff;',
    '--cdm-head:"Libre Baskerville",Georgia,"Times New Roman",serif;--cdm-body:"Source Sans 3","Source Sans Pro",Arial,Helvetica,sans-serif;',
    'font-family:var(--cdm-body);color:var(--cdm-ink);font-size:17px;line-height:1.5;max-width:760px;margin:0 auto;}',
    '.cds *{box-sizing:border-box;}',
    '.cds-card{background:var(--cdm-paper);border:1px solid var(--cdm-line);border-radius:10px;padding:clamp(18px,4vw,30px);display:grid;gap:18px;}',
    '.cds-sample{background:var(--cdm-gold);color:#1f2328;font-weight:700;font-size:.82rem;letter-spacing:.06em;text-transform:uppercase;padding:6px 12px;border-radius:6px;justify-self:start;}',
    '.cds h3{font-family:var(--cdm-head);font-weight:700;font-size:clamp(1.25rem,3.2vw,1.6rem);line-height:1.25;margin:0;color:var(--cdm-navy);text-wrap:balance;}',
    '.cds h4{font-family:var(--cdm-head);font-weight:700;font-size:1.1rem;margin:0;color:var(--cdm-navy);}',
    '.cds p{margin:0;}',
    '.cds-lede,.cds-fine{color:var(--cdm-muted);}',
    '.cds-fine{font-size:.85rem;}',
    '.cds-go{display:grid;grid-template-columns:1fr auto;gap:10px;}',
    '@media (max-width:520px){.cds-go{grid-template-columns:1fr;}}',
    '.cds-field{display:grid;gap:6px;min-width:0;}',
    '.cds-field label{font-weight:600;font-size:.95rem;}',
    '.cds-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;}',
    '.cds input[type=text],.cds input[type=email],.cds input[type=tel],.cds input[type=url]{width:100%;font:inherit;font-size:17px;padding:12px 14px;border:1px solid var(--cdm-line);border-radius:8px;background:var(--cdm-paper);color:var(--cdm-ink);}',
    '.cds input:focus-visible,.cds button:focus-visible{outline:3px solid var(--cdm-steel-2);outline-offset:2px;}',
    '.cds-btn{font:inherit;font-weight:700;font-size:17px;border:0;border-radius:8px;padding:12px 22px;background:var(--cdm-steel);color:var(--cdm-on-steel);cursor:pointer;min-height:48px;justify-self:start;}',
    '.cds-btn[disabled]{opacity:.55;cursor:default;}',
    '.cds-msg{font-size:.95rem;color:var(--cdm-fix);}',
    '.cds-head{display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:center;}',
    '@media (max-width:520px){.cds-head{grid-template-columns:1fr;}}',
    '.cds-gauge{width:120px;height:120px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--g) calc(var(--p)*1%),var(--cdm-wash) 0);}',
    '.cds-gauge>div{width:94px;height:94px;border-radius:50%;background:var(--cdm-paper);display:grid;place-content:center;text-align:center;}',
    '.cds-gauge b{font-family:var(--cdm-head);font-size:2rem;line-height:1;color:var(--cdm-navy);font-variant-numeric:tabular-nums;}',
    '.cds-gauge span{font-size:.75rem;color:var(--cdm-muted);}',
    '.cds-checks{display:grid;border-top:1px solid var(--cdm-line);}',
    '.cds-check{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;padding:12px 0;border-bottom:1px solid var(--cdm-line);align-items:start;}',
    '.cds-check>span{min-width:0;overflow-wrap:anywhere;}',
    '.cds-pill{font-size:.75rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:3px 8px;border-radius:999px;margin-top:2px;}',
    '.cds-pill.ok{background:color-mix(in srgb,var(--cdm-good) 14%,transparent);color:var(--cdm-good);}',
    '.cds-pill.warn{background:color-mix(in srgb,var(--cdm-warn) 16%,transparent);color:var(--cdm-warn);}',
    '.cds-pill.fix{background:color-mix(in srgb,var(--cdm-fix) 14%,transparent);color:var(--cdm-fix);}',
    '.cds-check .lbl{font-weight:700;}',
    '.cds-check .tip{grid-column:2;color:var(--cdm-muted);font-size:.95rem;}',
    '.cds a{color:var(--cdm-steel);}',
    '.cds-optin{background:var(--cdm-wash);border-radius:10px;padding:clamp(16px,3.5vw,24px);display:grid;gap:14px;}',
    '.cds-consent{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;font-size:.92rem;}',
    '.cds-consent input{width:20px;height:20px;margin-top:2px;}',
    '.cds-err{border-color:var(--cdm-fix)!important;}',
    '.cds-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0;}',
    '.cds-done{font-weight:600;color:var(--cdm-good);}'
  ].join('');

  function injectCss() {
    if (document.getElementById('cds-css')) return;
    var s = document.createElement('style'); s.id = 'cds-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  function normalizeUrl(v) {
    v = String(v || '').trim();
    if (!v) return '';
    if (!/^https?:\/\//i.test(v)) v = 'http://' + v;
    try { var u = new URL(v); if (!/\./.test(u.hostname)) return ''; return u.href; } catch (e) { return ''; }
  }

  function init(root) {
    var cfg = {
      api: (root.getAttribute('data-api-url') || '').replace(/\/+$/, ''),
      webhook: root.getAttribute('data-webhook-url') || '',
      terms: root.getAttribute('data-terms-url') || 'https://craftsman-digital.com/terms',
      privacy: root.getAttribute('data-privacy-url') || 'https://craftsman-digital.com/privacy',
      mock: String(root.getAttribute('data-mode') || '').toLowerCase() === 'mock',
      mockCase: root.getAttribute('data-mock-case') || ''
    };
    var wrap = el('div', { class: 'cds' });
    var card = el('div', { class: 'cds-card' });
    if (cfg.mock) card.appendChild(el('div', { class: 'cds-sample', text: 'Preview with sample data. Not a real website.' }));
    card.appendChild(el('h3', { text: 'Does your website work for a homeowner on a phone?' }));
    card.appendChild(el('p', { class: 'cds-lede', text: 'Put in your web address. We check mobile speed, the secure lock, tap-to-call, a way to reach you, and that your address doesn\'t send people somewhere else. Takes about 30 seconds.' }));
    var urlIn = el('input', { type: 'url', id: 'cds-url', placeholder: 'yourbusiness.com', autocomplete: 'url', inputmode: 'url' });
    var go = el('button', { type: 'button', class: 'cds-btn', text: 'Check my website' });
    var msg = el('p', { class: 'cds-msg', role: 'alert' }); msg.hidden = true;
    card.appendChild(el('div', { class: 'cds-field' }, [el('label', { for: 'cds-url', text: 'Your website' }), el('div', { class: 'cds-go' }, [urlIn, go])]));
    card.appendChild(msg);
    var results = el('div', { style: 'display:grid;gap:16px' }); results.hidden = true;
    card.appendChild(results);
    wrap.appendChild(card); root.innerHTML = ''; root.appendChild(wrap);

    var last = null;
    function run() {
      var url = normalizeUrl(urlIn.value);
      urlIn.classList.toggle('cds-err', !url);
      if (!url) { msg.hidden = false; msg.textContent = 'Put in a web address, like yourbusiness.com.'; return; }
      msg.hidden = true; go.disabled = true; go.textContent = 'Checking... (up to 30 s)';
      var p = cfg.mock ? new Promise(function (res) { setTimeout(function () { res(mockCheck(url, cfg.mockCase)); }, 600); })
        : fetch(cfg.api + '/site-check?url=' + encodeURIComponent(url)).then(function (r) { return r.json(); });
      p.then(function (d) {
        go.disabled = false; go.textContent = 'Check my website';
        if (!d || d.error) { msg.hidden = false; msg.textContent = (d && d.error) || 'The check did not finish. Try again in a minute.'; return; }
        last = { d: d, rows: checkSite(d) }; render();
      }).catch(function () { go.disabled = false; go.textContent = 'Check my website'; msg.hidden = false; msg.textContent = 'The check did not finish. Try again in a minute.'; });
    }
    go.addEventListener('click', run);
    urlIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });

    function render(noScroll) {
      var d = last.d, rows = last.rows;
      results.innerHTML = '';
      var s = typeof d.mobileScore === 'number' ? d.mobileScore : null;
      var color = s === null ? 'var(--cdm-line)' : s >= 90 ? 'var(--cdm-good)' : s >= 50 ? 'var(--cdm-warn)' : 'var(--cdm-fix)';
      var fixes = rows.filter(function (r) { return !r.ok; }).length;
      // Redirected away: no speed gauge (it would be the other site's speed), and the heading names the problem.
      results.appendChild(el('div', { class: 'cds-head' }, [
        d.offDomain ? null : el('div', { class: 'cds-gauge', style: '--p:' + (s || 0) + ';--g:' + color, role: 'img', 'aria-label': 'Mobile speed ' + (s === null ? 'unknown' : s + ' of 100') },
          [el('div', {}, [el('b', { text: s === null ? '?' : String(s) }), el('span', { text: 'mobile speed' })])]),
        el('div', { style: 'display:grid;gap:6px;min-width:0' }, [
          el('h4', { text: d.offDomain ? 'Your web address sends people to another site'
            : fixes ? fixes + ' thing' + (fixes === 1 ? '' : 's') + ' to fix on ' + (d.finalHost || d.entered) : 'Your site passed every check' }),
          el('p', { class: 'cds-fine', text: d.offDomain ? OFF_DOMAIN_NOTE
            : 'Speed is Google\'s own PageSpeed test on a phone: 90 to 100 is good, 50 to 89 needs work, under 50 is poor. Other checks look at your home page only.' })
        ])
      ]));
      results.appendChild(el('div', { class: 'cds-checks' }, rows.map(function (r) {
        var cls = r.ok ? 'ok' : r.warn ? 'warn' : 'fix', word = r.ok ? 'Good' : r.warn ? 'Close' : 'Fix';
        return el('div', { class: 'cds-check' }, [
          el('span', { class: 'cds-pill ' + cls, text: word }),
          el('span', {}, [el('span', { class: 'lbl', text: r.label + ': ' }), el('span', { text: r.found })]),
          null // how to fix each one goes in the emailed report
        ]);
      })));
      if (fixes) results.appendChild(el('div', { class: 'cds-optin', style: 'gap:6px' }, [
        el('p', { style: 'font-weight:700', text: 'Your full report: how to fix each one, by email' }),
        el('p', { class: 'cds-lede', text: 'Plain steps for every item marked Fix or Close, worst first.' })
      ]));
      if (!d.offDomain) results.appendChild(el('p', { class: 'cds-fine' }, ['Speed test by ', el('a', { href: 'https://pagespeed.web.dev/', target: '_blank', rel: 'noopener', text: 'Google PageSpeed Insights' }), '.']));
      results.appendChild(buildOptin());
      results.hidden = false;
      if (!noScroll) { try { results.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }
    }

    function buildOptin() {
      var first = el('input', { type: 'text', id: 'cds-first', autocomplete: 'given-name', placeholder: 'First name' });
      var email = el('input', { type: 'email', id: 'cds-email', autocomplete: 'email', placeholder: 'Email' });
      var phone = el('input', { type: 'tel', id: 'cds-phone', autocomplete: 'tel', placeholder: 'Phone' });
      var hp = el('input', { type: 'text', class: 'cds-hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', name: 'website' });
      var box = el('input', { type: 'checkbox', id: 'cds-consent' });
      var consent = el('div', { class: 'cds-consent' }, [box, el('label', { for: 'cds-consent' }, [CONSENT_TEXT + ' ',
        el('a', { href: cfg.terms, target: '_blank', rel: 'noopener', text: 'Terms of Service' }), ' and ',
        el('a', { href: cfg.privacy, target: '_blank', rel: 'noopener', text: 'Privacy Policy' }), '.'])]);
      var send = el('button', { type: 'button', class: 'cds-btn', text: 'Email me my full report' });
      var m = el('p', { class: 'cds-msg', role: 'alert' }); m.hidden = true;
      var b = el('div', { class: 'cds-optin' }, [
        el('h4', { text: 'Email me my full report + the Bottleneck Guide' }),
        el('div', { class: 'cds-grid' }, [
          el('div', { class: 'cds-field' }, [el('label', { for: 'cds-first', text: 'First name' }), first]),
          el('div', { class: 'cds-field' }, [el('label', { for: 'cds-email', text: 'Email *' }), email]),
          el('div', { class: 'cds-field' }, [el('label', { for: 'cds-phone', text: 'Phone *' }), phone])
        ]), consent, send, m, hp]);
      send.addEventListener('click', function () {
        var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()); var dg = phone.value.replace(/\D/g, '');
        email.classList.toggle('cds-err', !ok); phone.classList.toggle('cds-err', dg.length < 10); consent.classList.toggle('cds-err', !box.checked);
        if (!ok || dg.length < 10) { m.hidden = false; m.textContent = 'Add a valid email and phone number.'; return; }
        if (!box.checked) { m.hidden = false; m.textContent = 'Check the box to get your full report by email.'; return; }
        m.hidden = true;
        function done(t) { b.innerHTML = ''; b.appendChild(el('h4', { text: 'Sent.' })); b.appendChild(el('p', { class: 'cds-done', text: t })); }
        if (hp.value) { done('Check your inbox for your full report and the guide.'); return; }
        var now = new Date();
        var payload = {
          tool: TOOL, first_name: first.value.trim(), email: email.value.trim(), phone: dg,
          results: siteReport(last.d, last.rows), last_date: now.toISOString().slice(0, 10),
          consent_proof: 'Box checked. Wording shown: ' + CONSENT_TEXT + ' Page: ' + location.href.split('#')[0] + '. Time: ' + now.toISOString(),
          place_id: '', gbp_score: '', gbp_gaps: '', gbp_rank: '', lead_value: '', yearly_loss: '', bottleneck: '',
          site_url: last.d.entered || '', site_mobile_score: !last.d.offDomain && typeof last.d.mobileScore === 'number' ? String(last.d.mobileScore) : ''
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

    // Preview only: data-autorun="<url>" opens the mock with that address already checked.
    var auto = root.getAttribute('data-autorun');
    if (cfg.mock && auto) { urlIn.value = auto; var d0 = mockCheck(normalizeUrl(auto), cfg.mockCase); last = { d: d0, rows: checkSite(d0) }; render(true); }
  }

  window.CDMagnetSite = { checkSite: checkSite, resultsSentence: resultsSentence, siteReport: siteReport, normalizeUrl: normalizeUrl };

  function boot() { injectCss(); Array.prototype.forEach.call(document.querySelectorAll('[data-cd-magnet="site-check"]'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
