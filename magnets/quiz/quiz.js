/*
 * Craftsman Digital free tool: Find Your Bottleneck quiz.
 * Spec: ICM-WORKSPACE/workspaces/craftsman-digital/offers/mini-lead-magnets.md (tool 1)
 * The four stages and their wording come from the live Bottleneck Guide,
 * Part 1 (craftsman-digital.com/bottleneck-guide-read, read 2026-10-16).
 *
 * DRAFT: copy is for Andrew to edit. If the native GHL quiz is picked
 * (D4), this wording moves into GHL and this file is not used.
 *
 * Embed:
 * <div data-cd-magnet="quiz" data-webhook-url="..." data-guide-url="https://craftsman-digital.com/bottleneck-guide-read"></div>
 * <script src="https://abegley5781.github.io/craftsman-digital-calculators/magnets/quiz/quiz.js"></script>
 * data-mode="mock" posts nothing (previews).
 *
 * Scoring: each statement belongs to one stage. Not true = 0, Sometimes = 1,
 * Very true = 2. A stage's score is its points over its max, so stages with
 * 2 or 3 statements compare fairly. Highest wins. A tie goes to the earlier
 * stage (leads, then sales, production, operations), because the guide says
 * the bottleneck moves forward: fix the first one first.
 */
(function () {
  'use strict';

  var TOOL = 'quiz';
  var CONSENT_TEXT = 'I agree that Craftsman Digital LLC may send me marketing texts and calls at this number, ' +
    'including automated texts and prerecorded voicemails. Agreeing is not required to buy anything. ' +
    'Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.';

  var STAGES = ['leads', 'sales', 'production', 'operations'];
  var STAGE_NAME = { leads: 'Leads', sales: 'Sales', production: 'Production', operations: 'Operations' };

  var QUESTIONS = [
    { stage: 'leads', text: 'The phone doesn\'t ring enough.' },
    { stage: 'leads', text: 'When work slows down, I wait for referrals. I don\'t have a way to turn up more leads.' },
    { stage: 'leads', text: 'People who look me up on Google find very little: few reviews, few photos, or no website.' },
    { stage: 'sales', text: 'I get calls, but not enough of them turn into signed jobs.' },
    { stage: 'sales', text: 'I miss calls while I\'m on a job, and some of those people never call back.' },
    { stage: 'sales', text: 'After I give an estimate, I follow up once or not at all.' },
    { stage: 'production', text: 'I\'ve sold more work than I have the time or crew to build.' },
    { stage: 'production', text: 'I\'m booked out months ahead.' },
    { stage: 'operations', text: 'Nothing happens unless I do it.' },
    { stage: 'operations', text: 'If I took a week off, the business would stall.' }
  ];
  var ANSWERS = [
    { label: 'Not true', pts: 0 },
    { label: 'Sometimes', pts: 1 },
    { label: 'Very true', pts: 2 }
  ];

  // First moves per stage, for the emailed report (teaser on screen, full report by email:
  // Andrew 2026-10-17). Leads and Sales come from the guide's Parts 2 and 3; Production and
  // Operations from Parts 4 and 5 plus Andrew's 10/17 note that the production problem is time
  // and crew, not quality.
  var MOVES = {
    leads: [
      'Make referrals a system. At the final walkthrough, ask every happy customer for a name: "Who do you know who\'s been talking about redoing a bathroom?" gets a name; "Do you know anyone?" gets "I\'ll keep you in mind."',
      'Fill in every field of your Google profile. Spell out your services and add real photos of real work.',
      'Ask every finished customer for a Google review. Make it a habit, not a campaign.'
    ],
    sales: [
      'Treat a missed call like a locked door. Call back fast, the same hour if you can. Most people won\'t leave a voicemail; they call the next contractor.',
      'Follow up after every estimate, more than once. Most homeowners don\'t decide on the first contact.',
      'Show a realistic price range before the visit, and ask early: "What matters most to you: the price, how fast it\'s done, or the finish?"'
    ],
    production: [
      'Write down every sold job and the weeks it needs, so you can see how far out you\'re really booked.',
      'Give new customers an honest start date before they sign, instead of squeezing them in.',
      'Decide which work only you can do, and which a helper or a sub could take.'
    ],
    operations: [
      'List the things that only happen when you remember them: callbacks, follow-ups, review asks.',
      'Hand the repeating ones to something that doesn\'t forget: a system that replies, follows up and asks for the review.',
      'Take one day off and see what stalls. That\'s your next thing to fix.'
    ]
  };

  // Result screens. "part" names the guide section to read.
  var RESULTS = {
    leads: {
      head: 'Your bottleneck is leads.',
      why: 'Not enough of the right people are finding you. Good work doesn\'t help if the phone doesn\'t ring, and waiting on referrals keeps you in feast and famine.',
      part: 'Part 2: Leads',
      fit: 'This is the problem our Core plan is built for: a website and price calculator that give the people who look you up a reason to call, with every lead saved in one place.',
      link: { text: 'See how Core works', href: 'https://craftsman-digital.com/how-it-works' }
    },
    sales: {
      head: 'Your bottleneck is sales.',
      why: 'The calls are coming, but jobs slip away between the first ring and the signed contract: missed calls, slow callbacks, and estimates that go quiet.',
      part: 'Part 3: Sales',
      fit: 'Core handles the follow-up emails and shows homeowners a price range before they call. If missed calls are your big leak, our Growth plan adds a business phone number that texts back missed calls.',
      link: { text: 'See how it works', href: 'https://craftsman-digital.com/how-it-works' }
    },
    production: {
      head: 'Your bottleneck is production.',
      // Matches the live guide's Part 1 recap (Andrew, 2026-10-17).
      why: 'You\'ve sold more work than you have the time or crew to build, or you\'re booked out months ahead. That\'s a good problem, but more leads won\'t help right now. The next fix is how the work gets done: schedules, crews, and who does what.',
      part: 'Part 5: What comes next',
      fit: 'We\'re not the fix for this one yet. Our tools help get leads and turn them into jobs. Read the guide\'s section on what comes next, and come back when the calendar opens up.',
      link: null
    },
    operations: {
      head: 'Your bottleneck is operations.',
      why: 'Everything still runs through you. Every decision, every follow-up, every answer. The next fix is getting the business to run without you on every call.',
      part: 'Part 4 and Part 5',
      fit: 'We can take some of it off your plate: our system catches every lead, replies right away and follows up while you work. But the bigger fix here is in how the business runs, and we\'re not the fix for that part yet.',
      link: null
    }
  };

  function scoreQuiz(answers) {
    var got = {}, max = {};
    STAGES.forEach(function (s) { got[s] = 0; max[s] = 0; });
    QUESTIONS.forEach(function (q, i) { max[q.stage] += 2; got[q.stage] += answers[i] || 0; });
    var pct = {}; STAGES.forEach(function (s) { pct[s] = max[s] ? Math.round(100 * got[s] / max[s]) : 0; });
    var top = STAGES.reduce(function (best, s) { return pct[s] > pct[best] ? s : best; }, STAGES[0]);
    return { pct: pct, top: top, allLow: STAGES.every(function (s) { return pct[s] < 34; }) };
  }

  // The emailed report (plain text; the email shows it as written, line breaks kept).
  function quizReport(s) {
    var r = RESULTS[s.top];
    return [
      r.head,
      r.why,
      '',
      'Your first 3 moves:',
      MOVES[s.top].map(function (m, i) { return (i + 1) + '. ' + m; }).join('\n'),
      '',
      'Your scores: ' + STAGES.map(function (st) { return STAGE_NAME[st] + ' ' + s.pct[st] + '%'; }).join(', ') + '.',
      'Start with ' + r.part.replace(/^(Part \d+): (.+)$/, '$1 ($2)') + ' of the guide. The link is below.',
      '',
      r.fit
    ].join('\n');
  }

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  var CSS = [
    '.cdq{--cdm-ink:#1f2328;--cdm-navy:#2d3646;--cdm-muted:#4c5564;--cdm-steel:#4e7c91;--cdm-steel-2:#5f8fa6;--cdm-gold:#c2a26d;',
    '--cdm-paper:#ffffff;--cdm-wash:#f3f6f8;--cdm-line:#d5dde3;--cdm-good:#2f7a4f;--cdm-fix:#a8571c;--cdm-on-steel:#ffffff;',
    '--cdm-head:"Libre Baskerville",Georgia,"Times New Roman",serif;--cdm-body:"Source Sans 3","Source Sans Pro",Arial,Helvetica,sans-serif;',
    'font-family:var(--cdm-body);color:var(--cdm-ink);font-size:17px;line-height:1.5;max-width:760px;margin:0 auto;}',
    '.cdq *{box-sizing:border-box;}',
    '.cdq-card{background:var(--cdm-paper);border:1px solid var(--cdm-line);border-radius:10px;padding:clamp(18px,4vw,30px);display:grid;gap:18px;}',
    '.cdq h3{font-family:var(--cdm-head);font-weight:700;font-size:clamp(1.25rem,3.2vw,1.6rem);line-height:1.25;margin:0;color:var(--cdm-navy);text-wrap:balance;}',
    '.cdq h4{font-family:var(--cdm-head);font-weight:700;font-size:1.1rem;margin:0;color:var(--cdm-navy);}',
    '.cdq p{margin:0;}',
    '.cdq-lede{color:var(--cdm-muted);}',
    '.cdq-qs{display:grid;gap:0;border-top:1px solid var(--cdm-line);margin:0;padding:0;}',
    '.cdq-q{display:grid;gap:10px;padding:14px 0;border:0;border-bottom:1px solid var(--cdm-line);margin:0;min-width:0;}',
    '.cdq-q legend{font-weight:600;padding:0;margin-bottom:10px;}',
    '.cdq-q .n{color:var(--cdm-muted);font-variant-numeric:tabular-nums;margin-right:6px;}',
    '.cdq-opts{display:flex;flex-wrap:wrap;gap:8px;}',
    '.cdq-opt{position:relative;}',
    '.cdq-opt input{position:absolute;opacity:0;width:1px;height:1px;}',
    '.cdq-opt span{display:inline-block;padding:9px 16px;border:1px solid var(--cdm-line);border-radius:999px;cursor:pointer;min-height:44px;line-height:24px;}',
    '.cdq-opt input:checked+span{background:var(--cdm-steel);border-color:var(--cdm-steel);color:var(--cdm-on-steel);font-weight:600;}',
    '.cdq-opt input:focus-visible+span{outline:3px solid var(--cdm-steel-2);outline-offset:2px;}',
    '.cdq-q.cdq-miss legend{color:var(--cdm-fix);}',
    '.cdq-btn{font:inherit;font-weight:700;font-size:17px;border:0;border-radius:8px;padding:14px 22px;background:var(--cdm-steel);color:var(--cdm-on-steel);cursor:pointer;justify-self:start;min-height:48px;}',
    '.cdq-btn:focus-visible,.cdq input:focus-visible{outline:3px solid var(--cdm-steel-2);outline-offset:2px;}',
    '.cdq-msg{font-size:.95rem;color:var(--cdm-fix);}',
    '.cdq-result{display:grid;gap:14px;}',
    '.cdq-bars{display:grid;gap:8px;}',
    '.cdq-bar{display:grid;grid-template-columns:minmax(0,7.5em) 1fr auto;gap:10px;align-items:center;font-size:.95rem;}',
    '.cdq-bar .t{height:14px;background:var(--cdm-wash);border-radius:4px;overflow:hidden;}',
    '.cdq-bar .f{display:block;height:100%;background:var(--cdm-steel-2);}',
    '.cdq-bar.top .f{background:var(--cdm-gold);}',
    '.cdq-bar.top span:first-child{font-weight:700;}',
    '.cdq-bar .c{font-variant-numeric:tabular-nums;min-width:4ch;text-align:right;}',
    '.cdq-fit{background:var(--cdm-wash);border-radius:8px;padding:14px 16px;display:grid;gap:8px;}',
    '.cdq a{color:var(--cdm-steel);}',
    '.cdq-fine{font-size:.85rem;color:var(--cdm-muted);}',
    '.cdq-field{display:grid;gap:6px;min-width:0;}',
    '.cdq-field label{font-weight:600;font-size:.95rem;}',
    '.cdq-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;}',
    '.cdq input[type=text],.cdq input[type=email],.cdq input[type=tel]{width:100%;font:inherit;font-size:17px;padding:12px 14px;border:1px solid var(--cdm-line);border-radius:8px;background:var(--cdm-paper);color:var(--cdm-ink);}',
    '.cdq-optin{background:var(--cdm-wash);border-radius:10px;padding:clamp(16px,3.5vw,24px);display:grid;gap:14px;}',
    '.cdq-consent{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;font-size:.92rem;}',
    '.cdq-consent input{width:20px;height:20px;margin-top:2px;}',
    '.cdq-err{border-color:var(--cdm-fix)!important;}',
    '.cdq-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0;}',
    '.cdq-done{font-weight:600;color:var(--cdm-good);}'
  ].join('');

  function injectCss() {
    if (document.getElementById('cdq-css')) return;
    var s = document.createElement('style'); s.id = 'cdq-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  function init(root) {
    var cfg = {
      webhook: root.getAttribute('data-webhook-url') || '',
      guide: root.getAttribute('data-guide-url') || 'https://craftsman-digital.com/bottleneck-guide-read',
      terms: root.getAttribute('data-terms-url') || 'https://craftsman-digital.com/terms',
      privacy: root.getAttribute('data-privacy-url') || 'https://craftsman-digital.com/privacy',
      mock: String(root.getAttribute('data-mode') || '').toLowerCase() === 'mock'
    };
    var answers = QUESTIONS.map(function () { return null; });
    var wrap = el('div', { class: 'cdq' });
    var card = el('div', { class: 'cdq-card' });
    var quiz = el('div', { style: 'display:grid;gap:18px' });
    var result = el('div', { class: 'cdq-result' }); result.hidden = true;

    quiz.appendChild(el('h3', { text: 'Find your bottleneck in 2 minutes' }));
    quiz.appendChild(el('p', { class: 'cdq-lede', text: 'Ten quick statements. Pick how true each one is for your business right now. Your answer shows on the next screen, no email needed.' }));
    var qWrap = el('div', { class: 'cdq-qs' });
    var sets = QUESTIONS.map(function (q, i) {
      var fs = el('fieldset', { class: 'cdq-q' }, [el('legend', {}, [el('span', { class: 'n', text: (i + 1) + '.' }), q.text])]);
      var opts = el('div', { class: 'cdq-opts' });
      ANSWERS.forEach(function (a, j) {
        var id = 'cdq-' + i + '-' + j;
        var input = el('input', { type: 'radio', name: 'cdq-' + i, id: id, value: String(a.pts) });
        input.addEventListener('change', function () { answers[i] = a.pts; fs.classList.remove('cdq-miss'); });
        opts.appendChild(el('label', { class: 'cdq-opt', for: id }, [input, el('span', { text: a.label })]));
      });
      fs.appendChild(opts);
      qWrap.appendChild(fs);
      return fs;
    });
    quiz.appendChild(qWrap);
    var go = el('button', { type: 'button', class: 'cdq-btn', text: 'Show my bottleneck' });
    var msg = el('p', { class: 'cdq-msg', role: 'alert' }); msg.hidden = true;
    quiz.appendChild(go); quiz.appendChild(msg);
    card.appendChild(quiz); card.appendChild(result);
    wrap.appendChild(card); root.innerHTML = ''; root.appendChild(wrap);

    var last = null;
    go.addEventListener('click', function () {
      var missing = answers.map(function (a, i) { return a === null ? i : -1; }).filter(function (i) { return i >= 0; });
      sets.forEach(function (fs, i) { fs.classList.toggle('cdq-miss', answers[i] === null); });
      if (missing.length) { msg.hidden = false; msg.textContent = 'Answer all ten. Number ' + (missing[0] + 1) + ' is still blank.'; return; }
      msg.hidden = true;
      last = scoreQuiz(answers);
      renderResult();
    });

    function renderResult(noScroll) {
      var r = RESULTS[last.top];
      result.innerHTML = '';
      result.appendChild(el('h3', { text: r.head }));
      if (last.allLow) result.appendChild(el('p', { class: 'cdq-fine', text: 'None of the four scored high, so this is your biggest one by a small margin. That usually means things are working. Read the section anyway and see if it fits.' }));
      result.appendChild(el('p', { text: r.why }));
      result.appendChild(el('div', { class: 'cdq-bars' }, STAGES.map(function (s) {
        return el('div', { class: 'cdq-bar' + (s === last.top ? ' top' : '') }, [
          el('span', { text: STAGE_NAME[s] }),
          el('span', { class: 't' }, [el('span', { class: 'f', style: 'width:' + last.pct[s] + '%' })]),
          el('span', { class: 'c', text: last.pct[s] + '%' })
        ]);
      })));
      result.appendChild(el('p', {}, ['Read ', el('a', { href: cfg.guide, target: '_blank', rel: 'noopener', text: r.part + ' of The Remodeler\'s Bottleneck Guide' }), '. It\'s free, no email needed.']));
      // Teaser ends here. The first moves and the fit line go in the emailed report.
      result.appendChild(el('div', { class: 'cdq-fit' }, [
        el('p', { style: 'font-weight:700', text: 'Your full report: the first 3 moves for ' + STAGE_NAME[last.top].toLowerCase() + ', by email' }),
        el('p', { text: 'Three plain first steps for your bottleneck, your scores for all four stages, and the part of the guide to read first.' })
      ]));
      var again = el('button', { type: 'button', class: 'cdq-btn', style: 'background:none;color:var(--cdm-steel);padding:6px 0;min-height:0;text-decoration:underline', text: 'Change my answers' });
      again.addEventListener('click', function () { result.hidden = true; quiz.hidden = false; });
      result.appendChild(again);
      result.appendChild(buildOptin());
      quiz.hidden = true; result.hidden = false;
      if (!noScroll) { try { root.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }
    }

    function buildOptin() {
      var first = el('input', { type: 'text', id: 'cdq-first', autocomplete: 'given-name', placeholder: 'First name' });
      var email = el('input', { type: 'email', id: 'cdq-email', autocomplete: 'email', placeholder: 'Email' });
      var phone = el('input', { type: 'tel', id: 'cdq-phone', autocomplete: 'tel', placeholder: 'Phone' });
      var hp = el('input', { type: 'text', class: 'cdq-hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', name: 'website' });
      var box = el('input', { type: 'checkbox', id: 'cdq-consent' });
      var consent = el('div', { class: 'cdq-consent' }, [box, el('label', { for: 'cdq-consent' }, [CONSENT_TEXT + ' ',
        el('a', { href: cfg.terms, target: '_blank', rel: 'noopener', text: 'Terms of Service' }), ' and ',
        el('a', { href: cfg.privacy, target: '_blank', rel: 'noopener', text: 'Privacy Policy' }), '.'])]);
      var send = el('button', { type: 'button', class: 'cdq-btn', text: 'Email me my full report' });
      var m = el('p', { class: 'cdq-msg', role: 'alert' }); m.hidden = true;
      var b = el('div', { class: 'cdq-optin' }, [
        el('h4', { text: 'Email me my full report + the Bottleneck Guide' }),
        el('div', { class: 'cdq-grid' }, [
          el('div', { class: 'cdq-field' }, [el('label', { for: 'cdq-first', text: 'First name' }), first]),
          el('div', { class: 'cdq-field' }, [el('label', { for: 'cdq-email', text: 'Email *' }), email]),
          el('div', { class: 'cdq-field' }, [el('label', { for: 'cdq-phone', text: 'Phone *' }), phone])
        ]), consent, send, m, hp]);
      send.addEventListener('click', function () {
        var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()); var d = phone.value.replace(/\D/g, '');
        email.classList.toggle('cdq-err', !ok); phone.classList.toggle('cdq-err', d.length < 10); consent.classList.toggle('cdq-err', !box.checked);
        if (!ok || d.length < 10) { m.hidden = false; m.textContent = 'Add a valid email and phone number.'; return; }
        if (!box.checked) { m.hidden = false; m.textContent = 'Check the box to get your full report by email.'; return; }
        m.hidden = true;
        function done(t) { b.innerHTML = ''; b.appendChild(el('h4', { text: 'Sent.' })); b.appendChild(el('p', { class: 'cdq-done', text: t })); }
        if (hp.value) { done('Check your inbox for your full report and the guide.'); return; }
        var now = new Date(); var r = RESULTS[last.top];
        var payload = {
          tool: TOOL, first_name: first.value.trim(), email: email.value.trim(), phone: d,
          results: quizReport(last),
          last_date: now.toISOString().slice(0, 10),
          consent_proof: 'Box checked. Wording shown: ' + CONSENT_TEXT + ' Page: ' + location.href.split('#')[0] + '. Time: ' + now.toISOString(),
          place_id: '', gbp_score: '', gbp_gaps: '', gbp_rank: '', lead_value: '', yearly_loss: '',
          bottleneck: STAGE_NAME[last.top], site_url: '', site_mobile_score: ''
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

    // Preview only: data-preview-answers="2,1,..." pre-picks answers and shows that result.
    var pre = root.getAttribute('data-preview-answers');
    if (cfg.mock && pre) {
      pre.split(',').forEach(function (v, i) {
        var pts = parseInt(v, 10); if (isNaN(pts) || i >= QUESTIONS.length) return;
        answers[i] = pts; var inp = document.getElementById('cdq-' + i + '-' + pts); if (inp) inp.checked = true;
      });
      last = scoreQuiz(answers); renderResult(true);
    }
  }

  window.CDMagnetQuiz = { scoreQuiz: scoreQuiz, QUESTIONS: QUESTIONS, RESULTS: RESULTS };

  function boot() { injectCss(); Array.prototype.forEach.call(document.querySelectorAll('[data-cd-magnet="quiz"]'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
