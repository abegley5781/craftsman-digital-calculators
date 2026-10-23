/*
 * Craftsman Digital / Channel B -- shared general remodel calculator engine.
 * Sibling to bathroom-engine.js -- same widget shell, form fields, honeypot,
 * webhook posting, ZIP multiplier, price setting, preview mode, and
 * hidden/CSS handling (copied deliberately, not re-derived). What is new:
 * the price is size x rate for the space and scope picked, not score bands,
 * and the size, scope and plumbing questions swap their options per space.
 * Spec (every number DECIDED 2026-10-08): ICM-WORKSPACE/workspaces/
 * craftsman-digital/outreach/general-calculator-v2-room-model-2026-10-08.md,
 * sections 2, 4, 5 and 7. Whole house and "add another room" (section 10)
 * were added 2026-10-23 (Channel B Finish, Lane C, C2); see below.
 *
 * Per-client Custom Code snippet needed on the GHL page:
 *
 * <div id="cewRoot"
 *   data-business-name="{{ custom_values.locationname }}"
 *   data-phone="{{ custom_values.location_phone }}"
 *   data-webhook-url="{{ custom_values.calculator__general_webhook_url }}"
 *   data-terms-url="{{ custom_values.calculator__terms_url }}"
 *   data-privacy-url="{{ custom_values.calculator__privacy_url }}"
 *   data-service-area="{{ custom_values.calculator__service_area }}"
 *   data-color-primary="{{ custom_values.calculator__brand_color_primary }}"
 *   data-color-dark="{{ custom_values.calculator__brand_color_dark }}"
 *   data-color-accent="{{ custom_values.calculator__brand_color_accent }}"
 *   data-rates='{"spaces":{"bedroom":{"sizes":[[80,120],[120,180],[180,260]],"rates":{"refresh":41,"partial":75,"full":116}}, ...}, "finish":{...}, ...}'
 *   data-zip-multipliers-url="https://abegley5781.github.io/craftsman-digital-calculators/co-zip-multipliers.json"
 *   data-price-adjustment="0"
 * ></div>
 * <script src="https://abegley5781.github.io/craftsman-digital-calculators/general-engine.js"></script>
 *
 * data-rates holds every price number in ONE object (shape: DEFAULT_RATES
 * below), so a client's numbers change without touching this file. It is
 * deep-merged over DEFAULT_RATES: a page can pass the whole object or only
 * the parts it changes (arrays such as a size [low, high] are replaced, not
 * merged). Missing means the defaults; invalid JSON logs an error and uses
 * the defaults. The engine boots on any element with data-rates (or
 * data-calc="general", which uses the defaults as is).
 *
 * The math (spec section 5), in one place (price() below):
 *   room part = size low/high (sq ft) x rate (space, scope) x finish factor
 *               x home-age factor (remodel or new-space column)
 *   add-ons   = plumbing (Q5, by finish) + basement bath/wet bar extras
 *               + one egress window (basement finished with rooms)
 *               -- add-ons are not age-adjusted
 *   then x ZIP multiplier x (1 + client adjustment/100), then the minimum
 *   job (low >= minJob[0], high >= minJob[1]), then round to $100.
 * additionFloor is null (no floor, DECIDED 2026-10-08: "stick with industry
 * for now"). If a number is ever set, it is a minimum $/sq ft for an
 * addition's rate after finish and ZIP.
 *
 * "In-person estimate" outcome: attic "needs a dormer, new stairs, or
 * stronger floor framing" and addition "full basement under it" / "second
 * story" show no price. The result says the job needs an in-person estimate
 * and the lead is still captured and sent (estimate_low/high 0, price_range
 * "In-person estimate needed"). Never "priced on the call" (Andrew).
 *
 * data-scope-copy is optional: replaces the results-screen copy per scope,
 * keyed by scope key (refresh, partial, full, open, rooms, redo, slab,
 * structural, basementUnder, secondStory; whole house: wholeRefresh,
 * wholePartial, wholeFull, wholeLarge; several rooms: several), each {"heading","intro",
 * "bullets":[...]}. "{space}" in the text is filled with the space name.
 * Defaults are in SCOPE_COPY below.
 *
 * data-trade-label is optional: the trade_config value sent to GHL.
 * Defaults to "general remodel".
 *
 * ZIP multiplier, answers summary, price setting (data-price-adjustment),
 * preview mode (data-mode="preview"), lead ref, start_timeframe and
 * priority_lean all work exactly as in bathroom-engine.js -- see its header.
 * Webhook payload: the same keys as bathroom, plus `space` and `scope`.
 * `score` has no meaning here, so it carries the $/sq ft rate used (after
 * finish, before age and ZIP), or "" for an in-person outcome.
 *
 * Whole house (2026-10-23): "Whole house" is the last pick in the space
 * question. It swaps the size question to home size, hides the plumbing
 * question, and shows three of its own: kitchen (none or one of the three
 * live kitchen bands), full bathrooms and half baths to redo. Price, all
 * from numbers already here:
 *   rest of house = (home size - kitchen area - bath areas) x the living
 *                   room rate for the scope x finish x home-age (remodel)
 *   kitchen       = wholeHouse.kitchen band (CKB's live kitchen bands, from
 *                   Cost vs. Value 2025; not finish- or age-adjusted)
 *   each bathroom = the plumbing full / half bath add-on (Andrew's bath bands)
 *   then ZIP, client adjustment, minimum job and rounding as above. Areas
 *   come from the bath and kitchen calculators' own size picks (full bath
 *   51-100 sq ft, half 25-50, kitchen 100-200): the low end takes off the
 *   large areas, the high end the small ones. Over 3,500 sq ft or 4+ full
 *   bathrooms = the in-person estimate outcome.
 *
 * Add another room (2026-10-23): under the questions, "+ Add another room"
 * saves the room answered so far and clears space, size, scope and plumbing
 * for the next (finish, home age and start time carry over). On submit each
 * room is priced on its own (ZIP, adjustment and rounding per room, no
 * minimum), the total is their sum with the minimum job applied once, and the
 * results list each room's range. Rooms needing an in-person estimate are
 * listed but not in the total. Nothing changes for a visitor who never adds a
 * room: same questions, same result, same payload. A several-room lead posts
 * once, with the same keys: estimate_low/high and price_range are the total,
 * answers_summary names each room and its range, score is "", tier_label is
 * "Several rooms (N)", space and scope list each room's label, plus room_count.
 * Preview mode shows the running total live as rooms are added.
 *
 * data-mode="mock" (2026-10-23): the full homeowner flow, posts nothing, and
 * says so under the result (demo and review pages). Same as countertop.
 *
 * For tests, the pricing is a pure function: GeneralCalc.price(rates,
 * answers, opts) -- on window.GeneralCalc in a browser, module.exports in
 * node. GeneralCalc.priceRooms(rates, rooms, year, opts) prices several.
 */
(function () {
  var DEFAULT_EXPECTATION_NOTE = 'Every remodel is a trade between three things: the price, how fast it gets done, and the quality of the work. You can usually have two of the three. When you talk with us, tell us which one matters most to you.';

  // "Powered by Craftsman Digital" line under the calculator (Andrew, 2026-10-16).
  // Every client gets it linked to CD's how-it-works page; a Complete-tier
  // page shows it as plain text with data-powered-by="text".
  var POWERED_BY_URL = 'https://craftsman-digital.com/how-it-works?ref=calculator';

  // Every price number, matching the v2 room model (2026, national, before
  // ZIP). Rates are mid-range $/sq ft; finish factors multiply them.
  // Sizes are [low, high] sq ft per size option, in the order the size
  // question lists them. notSure (optional) is the size index "Not sure"
  // uses; left out, it is the middle option (the 2nd of 3 or of 4).
  var DEFAULT_RATES = {
    spaces: {
      bedroom: { sizes: [[80, 120], [120, 180], [180, 260]], rates: { refresh: 41, partial: 75, full: 116 } },
      closet: { sizes: [[10, 20], [20, 40], [40, 70]], rates: { refresh: 41, partial: 75, full: 116 } },
      living: { sizes: [[150, 220], [220, 320], [320, 450]], rates: { refresh: 41, partial: 75, full: 116 } },
      laundry: { sizes: [[25, 50], [50, 90], [90, 140]], rates: { refresh: 41, partial: 75, full: 116 } },
      basement: { sizes: [[300, 500], [500, 800], [800, 1200], [1200, 1600]], rates: { open: 72, rooms: 79, redo: 116 } },
      attic: { sizes: [[200, 350], [350, 500], [500, 700]], rates: { open: 90, rooms: 99, redo: 116 } },
      addition: { sizes: [[80, 150], [150, 250], [250, 400], [400, 600]], rates: { slab: 394 } }
    },
    // Basic 0.90, mid 1.0, not sure = mid, high-end 1.25.
    finish: { basic: 0.9, mid: 1, notsure: 1, high: 1.25 },
    // Home age (Q6). "remodel" = bedroom, closet, living, laundry and any
    // tear-out; "new" = finishing an unfinished basement or attic, and additions.
    age: {
      remodel: { y1990: 1, y1970: 1.05, pre1970: 1.12 },
      'new': { y1990: 1, y1970: 1.03, pre1970: 1.06 }
    },
    ageGroup: { refresh: 'remodel', partial: 'remodel', full: 'remodel', redo: 'remodel', open: 'new', rooms: 'new', slab: 'new' },
    // Plumbing add-ons (Q5), [low, high]: std = basic, mid-range or not sure; high = high-end.
    plumbing: {
      half: { std: [15000, 22000], high: [18000, 26000] },
      full: { std: [22000, 32000], high: [30000, 42000] },
      wetbar: { std: [15000, 22000], high: [18000, 26000] },
      washer: { std: [7500, 11000], high: [7500, 11000] }
    },
    // Basement only, on top of the plumbing add-on: bath = slab cut, trench
    // and patch, high end with a sewage ejector; other = wet bar or washer
    // move, no-pump line only.
    basementExtras: { bath: [2100, 9700], other: [2100, 5000] },
    // One egress window when space = basement and scope = finished with rooms.
    egress: { std: [3900, 7800], high: [5500, 9100] },
    additionFloor: null,
    minJob: [3000, 5000],
    // Whole house (section 10). sizes = finished living space, sq ft; a size
    // past the last one is the in-person outcome. The rest of the house uses
    // spaces.living.rates. kitchen = CKB's live kitchen bands (kitchen page
    // data-tiers; Cost vs. Value 2025, see README). Areas are the bath and
    // kitchen calculators' size picks. "4 or more" full bathrooms = in-person.
    wholeHouse: {
      sizes: [[800, 1200], [1200, 1800], [1800, 2500], [2500, 3500]],
      kitchen: { refresh: [18000, 35000], full: [55000, 100000], custom: [120000, 220000] },
      kitchenArea: [100, 200],
      bathArea: { full: [51, 100], half: [25, 50] }
    }
  };

  // Scopes that show the in-person estimate result instead of a price.
  var IN_PERSON = { structural: true, basementUnder: true, secondStory: true };

  // "say" is the plain-words version of each answer, used in the "Based on: ..."
  // line on the results screen and sent to GHL as answers_summary. Keep each one
  // in step with its label if a label ever changes. Size labels name the sq ft
  // ranges in DEFAULT_RATES; keep them in step if a page changes the sizes.
  // noun fills "{space}" in the results copy.
  var SPACES = [
    { value: 'bedroom', label: 'Bedroom, home office, or den', say: 'a bedroom, home office or den', noun: 'room', group: 'room', sizes: [
      { label: 'About 10x10 (80 to 120 sq ft)', say: 'about 10x10 (80 to 120 sq ft)' },
      { label: 'About 12x12 (120 to 180 sq ft)', say: 'about 12x12 (120 to 180 sq ft)' },
      { label: 'Primary bedroom, about 14x16, closet included (180 to 260 sq ft)', say: 'a primary bedroom, about 14x16 with its closet (180 to 260 sq ft)' }
    ]},
    { value: 'closet', label: 'Closet (reach-in or walk-in)', say: 'a closet', noun: 'closet', group: 'room', sizes: [
      { label: 'Reach-in, about 2x6 (10 to 20 sq ft)', say: 'a reach-in, about 2x6 (10 to 20 sq ft)' },
      { label: 'Small walk-in, about 5x6 (20 to 40 sq ft)', say: 'a small walk-in, about 5x6 (20 to 40 sq ft)' },
      { label: 'Large walk-in, about 7x9 (40 to 70 sq ft)', say: 'a large walk-in, about 7x9 (40 to 70 sq ft)' }
    ]},
    { value: 'living', label: 'Living room or family room', say: 'a living or family room', noun: 'room', group: 'room', sizes: [
      { label: 'About 12x15 (150 to 220 sq ft)', say: 'about 12x15 (150 to 220 sq ft)' },
      { label: 'About 15x18 (220 to 320 sq ft)', say: 'about 15x18 (220 to 320 sq ft)' },
      { label: 'About 18x22 or open plan (320 to 450 sq ft)', say: 'about 18x22 or open plan (320 to 450 sq ft)' }
    ]},
    { value: 'laundry', label: 'Laundry room or mudroom', say: 'a laundry room or mudroom', noun: 'room', group: 'room', sizes: [
      { label: 'Laundry closet, about 5x7 (25 to 50 sq ft)', say: 'a laundry closet, about 5x7 (25 to 50 sq ft)' },
      { label: 'About 8x10 (50 to 90 sq ft)', say: 'about 8x10 (50 to 90 sq ft)' },
      { label: 'About 10x12 or bigger (90 to 140 sq ft)', say: 'about 10x12 or bigger (90 to 140 sq ft)' }
    ]},
    { value: 'basement', label: 'Basement (finish it, or redo a finished one)', say: 'a basement', noun: 'basement', group: 'basement', sizes: [
      { label: 'Under 500 sq ft', say: 'under 500 sq ft' },
      { label: '500 to 800 sq ft', say: '500 to 800 sq ft' },
      { label: '800 to 1,200 sq ft', say: '800 to 1,200 sq ft' },
      { label: 'Over 1,200 sq ft', say: 'over 1,200 sq ft' }
    ]},
    { value: 'attic', label: 'Attic or bonus room (finish space the house already has)', say: 'an attic or bonus room', noun: 'attic', group: 'attic', sizes: [
      { label: 'Small, about 14x20 (200 to 350 sq ft)', say: 'small, about 14x20 (200 to 350 sq ft)' },
      { label: 'About 20x22 (350 to 500 sq ft)', say: 'about 20x22 (350 to 500 sq ft)' },
      { label: 'Large (500 to 700 sq ft)', say: 'large (500 to 700 sq ft)' }
    ]},
    { value: 'addition', label: 'Room addition (new room on a new foundation, ground floor)', say: 'a room addition', noun: 'addition', group: 'addition', sizes: [
      { label: 'Bump-out, about 8x12 (80 to 150 sq ft)', say: 'a bump-out, about 8x12 (80 to 150 sq ft)' },
      { label: 'One room, about 12x16 (150 to 250 sq ft)', say: 'one room, about 12x16 (150 to 250 sq ft)' },
      { label: 'Large room, about 16x20 (250 to 400 sq ft)', say: 'a large room, about 16x20 (250 to 400 sq ft)' },
      { label: 'Suite size (400 to 600 sq ft)', say: 'suite size (400 to 600 sq ft)' }
    ]},
    // Whole house: its own questions below (kitchen, baths); sizes are wholeHouse.sizes.
    { value: 'whole', label: 'Whole house (most rooms, plus kitchen and bathrooms)', say: 'a whole-house remodel', noun: 'house', group: 'whole', sizes: [
      { label: 'Under 1,200 sq ft (800 to 1,200)', say: 'an 800 to 1,200 sq ft house' },
      { label: '1,200 to 1,800 sq ft', say: 'a 1,200 to 1,800 sq ft house' },
      { label: '1,800 to 2,500 sq ft', say: 'a 1,800 to 2,500 sq ft house' },
      { label: '2,500 to 3,500 sq ft', say: 'a 2,500 to 3,500 sq ft house' }
    ]}
  ];
  var WHOLE_OVER = { value: 'over', label: 'Over 3,500 sq ft', say: 'a house over 3,500 sq ft' };

  // Scope options per space group (spec section 2, Q3).
  var SCOPES = {
    room: [
      { value: 'refresh', label: 'Refresh: paint, flooring, trim, lighting, doors', say: 'a refresh (paint, flooring, trim, lighting, doors)' },
      { value: 'partial', label: 'Partial: refresh plus drywall repair, electrical changes, a window', say: 'a partial remodel (refresh plus drywall repair, electrical changes, a window)' },
      { value: 'full', label: 'Full gut: down to the studs, then insulation, drywall, wiring, heat, flooring, trim', say: 'a full gut down to the studs' }
    ],
    basement: [
      { value: 'open', label: 'Finish it as one open room', say: 'finished as one open room' },
      { value: 'rooms', label: 'Finish it with rooms (bedroom, office, walls and doors)', say: 'finished with rooms' },
      { value: 'redo', label: 'Tear out and redo a finished basement', say: 'tear out and redo a finished basement' }
    ],
    attic: [
      { value: 'open', label: 'Finish it as one open room (floor, stairs, headroom already there)', say: 'finished as one open room' },
      { value: 'rooms', label: 'Finish it with a closet, knee walls, or a small room', say: 'finished with a closet, knee walls or a small room' },
      { value: 'redo', label: 'Tear out and redo a finished attic', say: 'tear out and redo a finished attic' },
      { value: 'structural', label: 'It needs a dormer, new stairs, or stronger floor framing', say: 'needs a dormer, new stairs or stronger floor framing' }
    ],
    addition: [
      { value: 'slab', label: 'Slab or crawlspace foundation', say: 'on a slab or crawlspace foundation' },
      { value: 'basementUnder', label: 'Full basement under it', say: 'with a full basement under it' },
      { value: 'secondStory', label: 'Second story', say: 'a second story' }
    ],
    // Whole house: how far the work goes in the rooms that aren't the kitchen or a bath.
    whole: [
      { value: 'refresh', label: 'Refresh the rest of the house: paint, flooring, trim, lighting, doors', say: 'a refresh of the rest of the house (paint, flooring, trim, lighting, doors)' },
      { value: 'partial', label: 'Partial: refresh plus drywall repair, electrical changes, some windows', say: 'a partial remodel of the rest of the house (refresh plus drywall repair, electrical changes, some windows)' },
      { value: 'full', label: 'Full gut: the rest of the house down to the studs and built back new', say: 'a full gut of the rest of the house, down to the studs' }
    ]
  };

  // Whole-house questions (shown only when the space is "whole").
  var KITCHEN_OPTS = [
    { value: 'none', label: 'No kitchen work', say: 'no kitchen work' },
    { value: 'refresh', label: 'Kitchen refresh: keep the cabinets and layout, new counters and surfaces', say: 'a kitchen refresh' },
    { value: 'full', label: 'Full kitchen remodel: new cabinets, counters and appliances, same layout', say: 'a full kitchen remodel' },
    { value: 'custom', label: 'Custom kitchen: layout changes and premium materials', say: 'a custom kitchen' }
  ];
  var FULL_BATH_OPTS = [
    { value: '0', label: 'None', say: 'no full bathrooms' },
    { value: '1', label: '1', say: '1 full bathroom' },
    { value: '2', label: '2', say: '2 full bathrooms' },
    { value: '3', label: '3', say: '3 full bathrooms' },
    { value: '4plus', label: '4 or more', say: '4 or more full bathrooms' }
  ];
  var HALF_BATH_OPTS = [
    { value: '0', label: 'None', say: 'no half baths' },
    { value: '1', label: '1', say: '1 half bath' },
    { value: '2', label: '2', say: '2 half baths' }
  ];
  function isWhole(space) { return space === 'whole'; }

  var PLUMBING = [
    { value: 'none', label: 'None', say: 'no new plumbing' },
    { value: 'half', label: 'A half bath', say: 'adding a half bath' },
    { value: 'full', label: 'A full bath', say: 'adding a full bath' },
    { value: 'wetbar', label: 'A wet bar', say: 'adding a wet bar' }
  ];
  // Laundry and mudroom only: "A wet bar" swaps to this.
  var PLUMBING_LAUNDRY = { value: 'washer', label: 'Move or add washer hookups or a utility sink', say: 'moving or adding washer hookups or a utility sink' };

  function spaceInfo(key) { return SPACES.filter(function (s) { return s.value === key; })[0] || null; }

  var QUESTIONS = [
    { key: 'space', label: 'Which space are you remodeling?', wide: true, options: SPACES },
    // Size, scope and plumbing options depend on the space picked. Size and
    // scope are cleared whenever the space changes (the same pick means a
    // different thing in a different space); plumbing is cleared only if the
    // old pick is not offered for the new space.
    { key: 'size', label: 'About how big is it?', resetOnSpace: true, options: function (space) {
      var s = spaceInfo(space);
      if (!s) return [];
      var opts = s.sizes.map(function (z, i) { return { value: String(i), label: z.label, say: z.say }; });
      var mid = s.sizes[notSureIndex(currentRatesFor(space), s.sizes.length)] || s.sizes[0];
      if (isWhole(space)) opts.push(WHOLE_OVER);
      opts.push({ value: 'notsure', label: 'Not sure', say: 'size not sure (priced as ' + mid.say + ')' });
      return opts;
    }},
    { key: 'scope', label: 'What is the scope of the work?', resetOnSpace: true, options: function (space) {
      var s = spaceInfo(space);
      return s ? SCOPES[s.group] : [];
    }},
    { key: 'finish', label: 'What finish level are you aiming for?', options: [
      { value: 'basic', label: 'Basic and budget-friendly', say: 'basic finishes', lean: 'price' },
      { value: 'mid', label: 'Mid-range', say: 'mid-range finishes' },
      { value: 'high', label: 'High-end', say: 'high-end finishes', lean: 'quality' },
      { value: 'notsure', label: 'Not sure yet', say: 'finishes not decided yet (priced as mid-range)' }
    ]},
    { key: 'plumbing', label: 'Are you adding any plumbing?', when: function (space) { return !isWhole(space); }, options: function (space) {
      if (space !== 'laundry') return PLUMBING;
      return PLUMBING.map(function (o) { return o.value === 'wetbar' ? PLUMBING_LAUNDRY : o; });
    }},
    // Whole house only (when): the kitchen and bathrooms, priced from their own bands.
    { key: 'kitchen', label: 'What about the kitchen?', wide: true, when: isWhole, options: KITCHEN_OPTS },
    { key: 'fullBaths', label: 'Full bathrooms to redo', when: isWhole, options: FULL_BATH_OPTS },
    { key: 'halfBaths', label: 'Half baths to redo', when: isWhole, options: HALF_BATH_OPTS },
    { key: 'year', label: 'When was your home built?', options: [
      { value: 'y1990', label: '1990 or newer', say: 'home built 1990 or newer' },
      { value: 'y1970', label: '1970 to 1989', say: 'home built 1970 to 1989' },
      { value: 'pre1970', label: 'Before 1970', say: 'home built before 1970' }
    ]},
    // When they hope to start. Doesn't change the price and isn't in the
    // "Based on" line; it goes to the owner as start_timeframe.
    { key: 'start', label: 'When are you hoping to start?', price: false, wide: true, options: [
      { value: 'asap', label: 'As soon as possible', say: 'as soon as possible' },
      { value: '1to3', label: 'In the next 1 to 3 months', say: 'in the next 1 to 3 months' },
      { value: '3to6', label: '3 to 6 months out', say: '3 to 6 months out' },
      { value: 'planning', label: 'Just planning for now', say: 'just planning for now' }
    ]}
  ];

  // Results-screen copy per scope. Draft (Claude, 2026-10-08) for Andrew to
  // edit. A page can replace any block with data-scope-copy.
  var SCOPE_COPY = {
    refresh: { heading: 'What this range is best suited for', intro: 'A refresh updates how the {space} looks and feels without opening up the walls.', bullets: [
      'Fresh paint on walls, ceiling and trim', 'New flooring', 'New trim and doors', 'New light fixtures' ] },
    partial: { heading: 'What this range is best suited for', intro: 'A partial remodel goes past the surface in a few places, without taking the {space} down to the studs.', bullets: [
      'Fresh paint, new flooring, trim, doors and lighting', 'Drywall repair and some new drywall', 'Added outlets, switches or circuits', 'A new or replaced window' ] },
    full: { heading: 'What this range is best suited for', intro: 'A full gut takes the {space} down to the studs and builds it back new.', bullets: [
      'New insulation, drywall and wiring', 'Heat extended from your current system', 'New flooring, trim, doors and lighting', 'New windows and doors where needed' ] },
    open: { heading: 'What this range is best suited for', intro: 'Finishing turns the unfinished {space} into one open room you can live in.', bullets: [
      'Wall framing, insulation and drywall', 'Wiring, outlets and lighting', 'Heat extended from your current system', 'Flooring, trim and paint' ] },
    rooms: { heading: 'What this range is best suited for', intro: 'Finishing with rooms adds walls and doors, so the {space} works as a bedroom, office or other room.', bullets: [
      'Wall framing, insulation and drywall', 'Inside walls, doors and trim for each room', 'Wiring, outlets and lighting for each room', 'Heat extended from your current system', 'Flooring, trim and paint', 'Closets where the plan calls for them' ] },
    redo: { heading: 'What this range is best suited for', intro: 'A redo tears out the old finish in the {space} and builds it back new.', bullets: [
      'Removal of old drywall, flooring and trim', 'New insulation, drywall and wiring', 'Heat extended or updated', 'New flooring, trim, doors and lighting' ] },
    slab: { heading: 'What this range is best suited for', intro: 'A ground-floor room addition on a slab or crawlspace foundation, built to match the house.', bullets: [
      'Foundation, framing and roof', 'Windows, doors and outside finish to match', 'Insulation, drywall, wiring and heat', 'Flooring, trim and paint inside' ] },
    structural: { heading: 'This job needs an in-person estimate', intro: 'A dormer, new stairs or stronger floor framing changes the structure of the house. Those jobs vary too much to price from a few questions, so the next step is an in-person estimate. We have your answers and will reach out to set it up.', bullets: [] },
    basementUnder: { heading: 'This job needs an in-person estimate', intro: 'A full basement under an addition changes how the whole job is dug and built. It varies too much to price from a few questions, so the next step is an in-person estimate. We have your answers and will reach out to set it up.', bullets: [] },
    secondStory: { heading: 'This job needs an in-person estimate', intro: 'A second story has to be carried by the house below it, and every house is different. It varies too much to price from a few questions, so the next step is an in-person estimate. We have your answers and will reach out to set it up.', bullets: [] },
    // Whole house (draft, Claude, 2026-10-23, for Andrew to edit).
    wholeRefresh: { heading: 'What this range is best suited for', intro: 'This range covers the kitchen and bathrooms you picked, plus a refresh of the rest of the house without opening up the walls.', bullets: [
      'The kitchen and bathroom work you picked', 'Fresh paint on walls, ceilings and trim', 'New flooring, trim and doors', 'New light fixtures' ] },
    wholePartial: { heading: 'What this range is best suited for', intro: 'This range covers the kitchen and bathrooms you picked, plus a partial remodel of the rest of the house: past the surface in places, without taking it down to the studs.', bullets: [
      'The kitchen and bathroom work you picked', 'Paint, new flooring, trim, doors and lighting', 'Drywall repair and some new drywall', 'Added outlets, switches or circuits, and some new windows' ] },
    wholeFull: { heading: 'What this range is best suited for', intro: 'This range covers the kitchen and bathrooms you picked, plus taking the rest of the house down to the studs and building it back new.', bullets: [
      'The kitchen and bathroom work you picked', 'New insulation, drywall and wiring', 'Heat extended from your current system', 'New flooring, trim, doors, lighting, and windows where needed' ] },
    wholeLarge: { heading: 'This job needs an in-person estimate', intro: 'A house this size, or with this many bathrooms, varies too much to price from a few questions, so the next step is an in-person estimate. We have your answers and will reach out to set it up.', bullets: [] },
    // Several rooms: the total (draft, Claude, 2026-10-23).
    several: { heading: 'How this total is figured', intro: 'Each room is priced on its own from your answers, then added up. The in-person estimate firms up the whole job.', bullets: [] }
  };

  var NOTE_OLDER_HOME = 'Older homes can hide surprises like asbestos, old wiring or rot behind the walls. Those aren\'t in this range. The in-person estimate checks for them.';
  var NOTE_CLOSET = 'Built-in shelving systems vary a lot and aren\'t in this range. The in-person estimate covers them.';

  // The rates object the page is using, so the size question's "Not sure"
  // say text can name the right size. Set by init(); defaults until then.
  var activeRates = DEFAULT_RATES;
  function currentRatesFor(space) { return (isWhole(space) ? activeRates.wholeHouse : (activeRates.spaces || {})[space]) || {}; }
  function notSureIndex(sp, n) {
    var i = Number(sp && sp.notSure);
    if (sp && sp.notSure != null && isFinite(i) && i >= 0 && i < n) return Math.floor(i);
    return Math.floor((n - 1) / 2);
  }

  function isPlainObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  // Deep-merges a page's data-rates over the defaults. Arrays and plain
  // values replace; objects merge key by key.
  function mergeRates(base, over) {
    var out = {};
    var k;
    for (k in base) out[k] = isPlainObject(base[k]) ? mergeRates(base[k], {}) : base[k];
    for (k in over || {}) {
      out[k] = isPlainObject(over[k]) && isPlainObject(out[k]) ? mergeRates(out[k], over[k]) : over[k];
    }
    return out;
  }

  // Pure pricing (spec section 5). rates = a full rates object (DEFAULT_RATES
  // or a merge over it). answers = { space, size: '0'..'3' or 'notsure',
  // scope, finish, plumbing, year }. opts = { zipMult, adjustmentPct }.
  // Returns null if the answers or rates don't add up, { inPerson: true } for
  // an in-person-estimate scope, else { low, high, rate, egress, noEgress }
  // in whole dollars rounded to $100 (egress is the one-window price after
  // ZIP and adjustment, or null; noEgress is the range without it).
  // Whole house: answers also carry kitchen, fullBaths, halfBaths (see
  // priceWhole). opts.noMin skips the minimum job (one room of several).
  function price(rates, a, opts) {
    opts = opts || {};
    if (isWhole(a.space)) return priceWhole(rates, a, opts);
    if (IN_PERSON[a.scope]) return { inPerson: true };
    var sp = (rates.spaces || {})[a.space];
    if (!sp || !sp.sizes || !sp.rates) return null;
    var rate = Number(sp.rates[a.scope]);
    var idx = a.size === 'notsure' ? notSureIndex(sp, sp.sizes.length) : Number(a.size);
    var size = sp.sizes[idx];
    var finishF = Number((rates.finish || {})[a.finish]);
    var ageCol = (rates.age || {})[(rates.ageGroup || {})[a.scope] || 'remodel'] || {};
    var ageF = Number(ageCol[a.year]);
    if (!rate || !size || !finishF || !ageF) return null;

    var zip = Number(opts.zipMult) || 1;
    var f = 1 + (Number(opts.adjustmentPct) || 0) / 100;
    var highEnd = a.finish === 'high';
    var rateUsed = rate * finishF;
    // additionFloor (null by default): a minimum $/sq ft for an addition,
    // after finish and ZIP, so it is compared at local prices.
    var floor = rates.additionFloor;
    if (a.space === 'addition' && floor != null && isFinite(Number(floor))) {
      rateUsed = Math.max(rateUsed, Number(floor) / zip);
    }
    var low = size[0] * rateUsed * ageF;
    var high = size[1] * rateUsed * ageF;

    // Add-ons: not age-adjusted (the plumbing bands already carry the
    // bathroom engine's own age point).
    var plumb = a.plumbing && a.plumbing !== 'none' ? (rates.plumbing || {})[a.plumbing] : null;
    if (plumb) {
      var band = highEnd ? (plumb.high || plumb.std) : plumb.std;
      low += band[0]; high += band[1];
      if (a.space === 'basement' && rates.basementExtras) {
        var extra = (a.plumbing === 'half' || a.plumbing === 'full') ? rates.basementExtras.bath : rates.basementExtras.other;
        if (extra) { low += extra[0]; high += extra[1]; }
      }
    }
    var eg = null;
    if (a.space === 'basement' && a.scope === 'rooms' && rates.egress) {
      eg = highEnd ? (rates.egress.high || rates.egress.std) : rates.egress.std;
    }

    var minJob = opts.noMin ? [0, 0] : (rates.minJob || [0, 0]);
    function settle(lo, hi) {
      lo = Math.max(lo * zip * f, minJob[0] || 0);
      hi = Math.max(hi * zip * f, minJob[1] || 0);
      return { low: Math.round(lo / 100) * 100, high: Math.round(hi / 100) * 100 };
    }
    var noEgress = settle(low, high);
    var withEgress = eg ? settle(low + eg[0], high + eg[1]) : noEgress;
    return {
      inPerson: false,
      low: withEgress.low,
      high: withEgress.high,
      rate: Math.round(rateUsed),
      noEgress: noEgress,
      egress: eg ? { low: Math.round(eg[0] * zip * f / 100) * 100, high: Math.round(eg[1] * zip * f / 100) * 100 } : null
    };
  }

  // Whole house (section 10, built 2026-10-23). answers = { space: 'whole',
  // size: '0'..'3', 'over' or 'notsure', scope (refresh, partial, full),
  // finish, kitchen (none, refresh, full, custom), fullBaths ('0'..'3' or
  // '4plus'), halfBaths ('0'..'2'), year }. Over the last size or 4+ full
  // bathrooms = { inPerson: true, copy: 'wholeLarge' }. Otherwise the same
  // shape as price(), with egress null.
  function priceWhole(rates, a, opts) {
    var wh = rates.wholeHouse || {};
    if (a.size === 'over' || a.fullBaths === '4plus') return { inPerson: true, copy: 'wholeLarge' };
    var sizes = wh.sizes || [];
    var size = sizes[a.size === 'notsure' ? notSureIndex(wh, sizes.length) : Number(a.size)];
    var rate = Number((((rates.spaces || {}).living || {}).rates || {})[a.scope]);
    var finishF = Number((rates.finish || {})[a.finish]);
    var ageF = Number(((rates.age || {})[(rates.ageGroup || {})[a.scope] || 'remodel'] || {})[a.year]);
    var kitchen = a.kitchen === 'none' ? [0, 0] : (wh.kitchen || {})[a.kitchen];
    var nFull = a.fullBaths === '' || a.fullBaths == null ? NaN : Number(a.fullBaths);
    var nHalf = a.halfBaths === '' || a.halfBaths == null ? NaN : Number(a.halfBaths);
    if (!size || !rate || !finishF || !ageF || !kitchen || !isFinite(nFull) || !isFinite(nHalf)) return null;

    // The rest of the house: home size less the kitchen and bath areas. The
    // low end takes off the large areas, the high end the small ones.
    var ka = a.kitchen === 'none' ? [0, 0] : (wh.kitchenArea || [0, 0]);
    var fa = (wh.bathArea || {}).full || [0, 0];
    var ha = (wh.bathArea || {}).half || [0, 0];
    var restLow = Math.max(0, size[0] - ka[1] - nFull * fa[1] - nHalf * ha[1]);
    var restHigh = Math.max(0, size[1] - ka[0] - nFull * fa[0] - nHalf * ha[0]);
    var rateUsed = rate * finishF;
    var low = restLow * rateUsed * ageF + kitchen[0];
    var high = restHigh * rateUsed * ageF + kitchen[1];
    // Bathrooms: the plumbing add-on bands (Andrew's bath bands), by finish.
    var highEnd = a.finish === 'high';
    [['full', nFull], ['half', nHalf]].forEach(function (b) {
      var p = (rates.plumbing || {})[b[0]];
      if (!p || !b[1]) return;
      var band = highEnd ? (p.high || p.std) : p.std;
      low += b[1] * band[0]; high += b[1] * band[1];
    });

    var zip = Number(opts.zipMult) || 1;
    var f = 1 + (Number(opts.adjustmentPct) || 0) / 100;
    var minJob = opts.noMin ? [0, 0] : (rates.minJob || [0, 0]);
    var out = {
      low: Math.round(Math.max(low * zip * f, minJob[0] || 0) / 100) * 100,
      high: Math.round(Math.max(high * zip * f, minJob[1] || 0) / 100) * 100
    };
    return { inPerson: false, low: out.low, high: out.high, rate: Math.round(rateUsed), noEgress: out, egress: null };
  }

  // Several rooms ("add another room", 2026-10-23). rooms = list of answers
  // without year ({ space, size, scope, finish, plumbing }); year is the
  // home's. Each room is priced with no minimum; the total is the sum of the
  // priced rooms, then the minimum job once. Returns null if any room doesn't
  // price, else { inPerson, low, high, rooms: [each room's price() result] };
  // inPerson is true only when no room has a price.
  function priceRooms(rates, rooms, year, opts) {
    opts = opts || {};
    var each = [];
    var low = 0, high = 0, priced = 0;
    for (var i = 0; i < rooms.length; i++) {
      var a = {};
      for (var k in rooms[i]) a[k] = rooms[i][k];
      a.year = year;
      var r = price(rates, a, { zipMult: opts.zipMult, adjustmentPct: opts.adjustmentPct, noMin: true });
      if (!r) return null;
      each.push(r);
      if (!r.inPerson) { low += r.low; high += r.high; priced++; }
    }
    if (!priced) return { inPerson: true, low: 0, high: 0, rooms: each };
    var minJob = rates.minJob || [0, 0];
    return { inPerson: false, low: Math.max(low, minJob[0] || 0), high: Math.max(high, minJob[1] || 0), rooms: each };
  }

  var GeneralCalc = { DEFAULT_RATES: DEFAULT_RATES, mergeRates: mergeRates, price: price, priceRooms: priceRooms };
  if (typeof module !== 'undefined' && module.exports) module.exports = GeneralCalc;
  if (typeof window !== 'undefined') window.GeneralCalc = GeneralCalc;
  if (typeof document === 'undefined') return; // node (tests): pricing only

  function fmt(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

  // data-price-adjustment -> a number of percent, clamped to -50..50.
  // Missing, empty, or non-numeric (e.g. an unfilled GHL custom value) is 0.
  function parseAdjustment(raw) {
    var n = Number(String(raw == null ? '' : raw).trim().replace(/%$/, ''));
    if (!isFinite(n)) return 0;
    return Math.max(-50, Math.min(50, n)) || 0; // "|| 0" turns -0 into 0
  }
  function fmtPct(n) { return (n > 0 ? '+' : '') + n + '%'; }

  // Lead source tag, e.g. ?ref=demo. Same as bathroom-engine.js.
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

  // Same styles as bathroom-engine.js (same cew- classes, so a page styled
  // for one calculator fits the other), plus the notes and disabled selects.
  // Its own style id, so the extras still load if the bathroom engine's
  // styles are already on the page.
  function injectStyles() {
    if (document.getElementById('cew-general-styles')) return;
    var style = document.createElement('style');
    style.id = 'cew-general-styles';
    style.textContent = [
      // Guard first: a later class rule setting display: on a hidden element
      // otherwise silently wins over the hidden attribute's default.
      '.cew-wrap [hidden]{display:none!important;}',
      '.cew-wrap{max-width:36rem;margin:0 auto;padding:1.5rem 1rem;font-family:"Lato",-apple-system,"Segoe UI",sans-serif;--cew-tint:#f3f8fb;--cew-line:#d7e8f5;}',
      '.cew-powered{text-align:center;font-size:.78rem;line-height:1.4;color:#6b7785;margin:.75rem 0 0;}',
      '.cew-powered a{color:inherit;text-decoration:underline;text-underline-offset:2px;}',
      '.cew-powered a:hover{color:var(--cew-primary,#188bf6);}',
      // Tints follow the client's primary color; browsers without color-mix keep the light-blue defaults above.
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
      '.cew-field select{width:100%;font:inherit;font-size:.9rem;color:#101828;background:#fff;border:1px solid #cbd5e0;border-radius:8px;padding:.6rem .65rem;}',
      '.cew-field select:disabled{background:#f5f5f5;color:#6b7785;cursor:default;}',
      '.cew-field select.cew-err{border-color:#e25950;}',
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
      '.cew-result .cew-note{font-size:.88rem;line-height:1.5;color:#334155;background:#f5f5f5;border:1px solid #EAEAEA;border-radius:8px;padding:.6rem .75rem;margin:.7rem 0 0;}',
      '.cew-expect{margin:.9rem 0 0;padding:.1rem 0 .1rem .75rem;border-left:3px solid #188bf6;font-size:1rem;line-height:1.6;color:#4a5568;}',
      '.cew-callback-msg{font-size:.9rem;line-height:1.5;color:#1f5c33;background:#eafaf0;border:1px solid #b7e4c7;border-radius:8px;padding:.75rem .85rem;}',
      '.cew-next{font-size:.9rem;line-height:1.5;color:#4a5568;margin:0;}',
      '.cew-notes{resize:vertical;min-height:4.5rem;}',
      '.cew-msg{font-size:.85rem;line-height:1.5;border-radius:8px;padding:.65rem .8rem;}',
      '.cew-msg.cew-error{background:#fdecea;color:#a1362a;border:1px solid #f3c6c1;}',
      '.cew-msg.cew-ok{background:#eafaf0;color:#1f5c33;border:1px solid #b7e4c7;}',
      // Add another room (2026-10-23).
      '.cew-add-room-row{display:grid;gap:.4rem;margin:-.3rem 0 1.3rem;}',
      '.cew-add-room-row .cew-hint{margin:0;text-align:center;}',
      '.cew-rooms{display:grid;gap:.45rem;margin:0 0 .3rem;}',
      '.cew-rooms-head{font-size:.78rem;font-weight:700;margin:0;}',
      '.cew-room{display:flex;justify-content:space-between;align-items:flex-start;gap:.6rem;font-size:.85rem;line-height:1.45;color:#334155;background:var(--cew-tint);border:1px solid var(--cew-line);border-radius:8px;padding:.55rem .7rem;}',
      '.cew-room-remove{font:inherit;font-size:.78rem;font-weight:700;color:#a1362a;background:none;border:none;padding:0;cursor:pointer;text-decoration:underline;flex-shrink:0;}',
      '.cew-room-lines{margin:.5rem 0 0;padding-left:1.1rem;font-size:.88rem;line-height:1.5;color:#4a5568;}',
      '.cew-room-lines li{margin-bottom:.35rem;}',
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
      tradeLabel: String(root.getAttribute('data-trade-label') || '').trim() || 'general remodel',
      ref: leadRef(),
      rates: DEFAULT_RATES,
      scopeCopy: SCOPE_COPY,
      zipMultipliers: {},
      responseTime: String(root.getAttribute('data-response-time') || '').trim(),
      bookingClosed: String(root.getAttribute('data-booking-status') || '').trim().toLowerCase() === 'closed',
      expectationNote: root.hasAttribute('data-expectation-note') ? root.getAttribute('data-expectation-note') : DEFAULT_EXPECTATION_NOTE
    };
    // Belt and braces: preview mode never builds the form or submit handler,
    // and also has no webhook URL to post to. Mock never posts either.
    if (cfg.preview || cfg.mock) cfg.webhookUrl = '';
    var ratesRaw = String(root.getAttribute('data-rates') || '').trim();
    if (ratesRaw) {
      try { cfg.rates = mergeRates(DEFAULT_RATES, JSON.parse(ratesRaw)); }
      catch (e) { console.error('general-engine: invalid data-rates JSON, using the default rates', e); }
    }
    activeRates = cfg.rates;
    try { cfg.scopeCopy = mergeRates(SCOPE_COPY, JSON.parse(root.getAttribute('data-scope-copy') || '{}')); }
    catch (e) { console.error('general-engine: invalid data-scope-copy JSON', e); }
    var zipMultipliersUrl = root.getAttribute('data-zip-multipliers-url') ||
      'https://abegley5781.github.io/craftsman-digital-calculators/co-zip-multipliers.json';
    var zipTableLoaded = fetch(zipMultipliersUrl).then(function (res) {
      if (!res.ok) throw new Error('bad status ' + res.status);
      return res.json();
    }).then(function (json) {
      cfg.zipMultipliers = json || {};
    }).catch(function (e) {
      console.error('general-engine: could not load zip multipliers, proceeding with no adjustment', e);
    });

    injectStyles();

    // Every question starts blank and has to be picked (same as bathroom).
    // state holds each question's picked option value ('' = not picked).
    var state = {};
    QUESTIONS.forEach(function (q) { state[q.key] = ''; });
    // Rooms saved with "+ Add another room" (answers objects, room keys only).
    // The room being answered now is in state; year and start are the home's.
    var ROOM_KEYS = ['space', 'size', 'scope', 'finish', 'plumbing'];
    var rooms = [];
    // A question shows only when its when(space) is true (whole house swaps some).
    function active(q, ans) { return !q.when || q.when((ans || state).space); }
    function optionsFor(q, ans) {
      var opts = typeof q.options === 'function' ? q.options((ans || state).space) : q.options;
      // Whole house can't be one of several rooms.
      if (q.key === 'space' && rooms.length) opts = opts.filter(function (o) { return !isWhole(o.value); });
      return opts;
    }
    function optionIn(ans, key) {
      var q = QUESTIONS.filter(function (x) { return x.key === key; })[0];
      if (!q || !ans[key] || !active(q, ans)) return null;
      return optionsFor(q, ans).filter(function (o) { return o.value === ans[key]; })[0] || null;
    }
    function pickedOption(key) { return optionIn(state, key); }
    function startTimeframe() {
      var o = pickedOption('start');
      return o ? o.label : '';
    }
    // Price / quality lean from the visitor's finish pick(s), for the owner's
    // alert only (never shown to the homeowner). A guess, same as bathroom.
    function priorityLean() {
      var price = [], quality = [];
      rooms.concat(roomEmpty() ? [] : [state]).forEach(function (ans) {
        QUESTIONS.forEach(function (q) {
          var o = optionIn(ans, q.key) || {};
          if (o.lean === 'price') price.push(o.say);
          if (o.lean === 'quality') quality.push(o.say);
        });
      });
      if (price.length > quality.length) return 'Leans price (' + price.join(', ') + ')';
      if (quality.length > price.length) return 'Leans quality (' + quality.join(', ') + ')';
      return 'No clear lean';
    }
    // The "say" list for one set of answers: every price question, or with
    // keys, only those.
    function sayList(ans, keys) {
      return QUESTIONS.filter(function (q) { return q.price !== false && (!keys || keys.indexOf(q.key) >= 0); }).map(function (q) {
        var o = optionIn(ans, q.key) || {};
        return o.say || o.label || '';
      }).filter(Boolean).join(', ');
    }
    function answersList() { return sayList(state); }
    function zipMultiplier(zipVal) {
      var m = Number(cfg.zipMultipliers[zipVal]);
      if (!m || isNaN(m)) return 1;
      return Math.max(0.5, Math.min(2, m)); // wide safety clamp only -- see bathroom-engine.js
    }
    // With saved rooms, the room in progress may be left blank (no space picked).
    function roomEmpty() { return rooms.length > 0 && !state.space; }
    function missingQuestions() {
      return QUESTIONS.filter(function (q) {
        if (!active(q) || pickedOption(q.key)) return false;
        return !(roomEmpty() && ROOM_KEYS.indexOf(q.key) >= 0);
      });
    }
    function roomComplete() {
      return ROOM_KEYS.every(function (k) {
        var q = QUESTIONS.filter(function (x) { return x.key === k; })[0];
        return !active(q) || !!pickedOption(k);
      });
    }
    function answersComplete() {
      return missingQuestions().every(function (q) { return q.price === false; });
    }

    // Client price adjustment in percent: fixed from data-price-adjustment in
    // normal mode, moved by the slider in preview mode.
    var adjustmentPct = cfg.priceAdjustment;

    // Only a real color reaches the tints; anything else falls back to the default blue.
    var tintOk = window.CSS && CSS.supports && CSS.supports('color', cfg.colorPrimary);
    var wrap = el('div', { class: 'cew-wrap', style: tintOk ? '--cew-primary:' + cfg.colorPrimary : '' });
    var card = el('div', { class: 'cew' }, [
      el('div', { class: 'cew-top' }, [
        el('div', { class: 'cew-brand', style: 'color:' + cfg.colorAccent, html: cfg.businessName }),
        el('div', { class: 'cew-name', style: 'color:' + cfg.colorDark, html: 'Remodel Cost Calculator' })
      ]),
      el('p', { class: 'cew-promise', style: 'color:' + cfg.colorPrimary, html: cfg.preview
        ? 'Preview only. Try answers and price settings here. Nothing is sent or saved.'
        : 'See your price range right here, instantly. We\'ll also email you a copy with your answers, so you can come back to it.' })
    ]);

    var qgrid = el('div', { class: 'cew-qgrid' });
    var selects = {};
    // (Re)builds a select's options for the current space, keeping the pick
    // if it is still offered.
    function fillSelect(q) {
      var select = selects[q.key];
      var opts = optionsFor(q);
      select.innerHTML = '';
      var blank = el('option', { value: '', html: opts.length ? 'Pick one' : 'Pick the space first' });
      blank.disabled = true;
      select.appendChild(blank);
      opts.forEach(function (o) { select.appendChild(el('option', { value: o.value, html: o.label })); });
      select.disabled = !opts.length;
      if (state[q.key] && opts.some(function (o) { return o.value === state[q.key]; })) select.value = state[q.key];
      else { state[q.key] = ''; blank.selected = true; }
      if (fields[q.key]) fields[q.key].hidden = !active(q);
    }
    // After the space changes (or rooms are added), refresh the questions
    // that depend on it, and show or hide the whole-house ones.
    function refreshForSpace(resetDependent) {
      QUESTIONS.forEach(function (d) {
        if (typeof d.options === 'function' || d.key === 'space') {
          if (resetDependent && d.resetOnSpace) state[d.key] = '';
          fillSelect(d);
        } else if (fields[d.key]) {
          fields[d.key].hidden = !active(d);
        }
      });
      if (addRoomRow) addRoomRow.hidden = isWhole(state.space);
    }
    var fields = {};
    var addRoomRow = null;
    QUESTIONS.forEach(function (q) {
      var select = el('select');
      selects[q.key] = select;
      fillSelect(q);
      select.addEventListener('change', function (e) {
        state[q.key] = e.target.value;
        select.classList.remove('cew-err');
        if (q.key !== 'space') return;
        refreshForSpace(true);
      });
      fields[q.key] = el('div', { class: q.wide ? 'cew-field cew-wide' : 'cew-field' }, [
        el('label', { style: 'color:' + cfg.colorDark, html: q.label }),
        select
      ]);
      fields[q.key].hidden = !active(q);
      qgrid.appendChild(fields[q.key]);
    });

    // "+ Add another room" (not for whole house): saves the room in progress
    // and clears space, size, scope and plumbing for the next one. The saved
    // rooms show above the questions, each with a Remove link.
    var roomList = el('div', { class: 'cew-rooms' }); roomList.hidden = true;
    var roomMsg = el('div', { class: 'cew-msg' }); roomMsg.hidden = true;
    var addRoomBtn = el('button', {
      type: 'button', class: 'cew-cta-outline cew-add-room',
      style: 'color:' + cfg.colorPrimary + ';border-color:' + cfg.colorPrimary,
      html: '+ Add another room'
    });
    var roomHint = el('p', { class: 'cew-hint', html: 'Pricing more than one room? Add each one, and you\u2019ll see every room and the total.' });
    addRoomRow = el('div', { class: 'cew-add-room-row' }, [addRoomBtn, roomHint, roomMsg]);
    function renderRooms() {
      roomList.innerHTML = '';
      roomList.hidden = !rooms.length;
      roomHint.innerHTML = 'Pricing more than one room? Add each one, and you\u2019ll see every room and the total.';
      if (!rooms.length) return;
      roomList.appendChild(el('p', { class: 'cew-rooms-head', style: 'color:' + cfg.colorDark, html: 'Rooms added so far' }));
      rooms.forEach(function (r, i) {
        var remove = el('button', { type: 'button', class: 'cew-room-remove', html: 'Remove' });
        remove.addEventListener('click', function () {
          rooms.splice(i, 1);
          renderRooms();
          refreshForSpace(false);
          onRoomsChanged();
        });
        var text = el('span', {});
        text.textContent = 'Room ' + (i + 1) + ': ' + sayList(r, ROOM_KEYS);
        roomList.appendChild(el('div', { class: 'cew-room' }, [text, remove]));
      });
      roomHint.innerHTML = 'Answer the next room above, or leave it blank if you\u2019re done.';
    }
    var onRoomsChanged = function () {};
    addRoomBtn.addEventListener('click', function () {
      var missing = ROOM_KEYS.filter(function (k) {
        var q = QUESTIONS.filter(function (x) { return x.key === k; })[0];
        return active(q) && !pickedOption(k);
      });
      ROOM_KEYS.forEach(function (k) { selects[k].classList.toggle('cew-err', missing.indexOf(k) >= 0); });
      if (missing.length) {
        roomMsg.hidden = false; roomMsg.className = 'cew-msg cew-error';
        roomMsg.textContent = 'Please finish this room\u2019s answers first.';
        return;
      }
      if (rooms.length >= 8) {
        roomMsg.hidden = false; roomMsg.className = 'cew-msg cew-error';
        roomMsg.textContent = 'That\u2019s the most rooms this calculator adds up. For more, ask about an in-person estimate.';
        return;
      }
      roomMsg.hidden = true;
      var saved = {};
      ROOM_KEYS.forEach(function (k) { saved[k] = state[k]; });
      rooms.push(saved);
      ['space', 'size', 'scope', 'plumbing'].forEach(function (k) { state[k] = ''; });
      renderRooms();
      refreshForSpace(false);
      onRoomsChanged();
      try { roomList.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
    });
    var questionsBlock = el('div', {}, [roomList, qgrid, addRoomRow]);

    // Price display, shared by normal mode (shown after submit) and preview
    // mode (shown live).
    var bandLabel = el('div', { class: 'cew-band-label', style: 'color:' + cfg.colorAccent, html: 'Your price range' });
    var priceRange = el('p', { class: 'cew-price', style: 'color:' + cfg.colorDark, html: '$0 &ndash; $0' });
    var roomBreakdown = el('ul', { class: 'cew-room-lines' }); roomBreakdown.hidden = true;
    var answersLine = el('p', { class: 'cew-answers' }); answersLine.hidden = true;
    var zipNote = el('p', { class: 'cew-blurb', style: 'margin-top:.2rem' }); zipNote.hidden = true;
    var tierHeading = el('p', { class: 'cew-tier-heading', style: 'color:' + cfg.colorDark });
    var tierIntro = el('p', { class: 'cew-blurb' });
    var tierBullets = el('ul', { class: 'cew-tier-bullets' });
    var notes = el('div', {});
    var expectNote = el('p', { class: 'cew-expect', style: 'border-left-color:' + cfg.colorPrimary });
    expectNote.textContent = cfg.expectationNote || '';
    expectNote.hidden = !String(cfg.expectationNote || '').trim();

    // Fills the price display (range or in-person outcome, "Based on: ..."
    // line, ZIP note, scope copy, notes) for the current answers and ZIP, and
    // returns the same numbers and answers sentence so normal mode sends
    // exactly what was shown.
    function showPrice(zipVal) {
      var mult = zipMultiplier(zipVal);
      var opts = { zipMult: mult, adjustmentPct: adjustmentPct };
      // Several rooms: the saved ones plus the one in progress (if started).
      var multi = rooms.length > 0;
      var list = multi ? rooms.concat(roomEmpty() ? [] : [ROOM_KEYS.reduce(function (o, k) { o[k] = state[k]; return o; }, {})]) : null;
      var r = multi ? priceRooms(cfg.rates, list, state.year, opts) : price(cfg.rates, {
        space: state.space, size: state.size, scope: state.scope,
        finish: state.finish, plumbing: state.plumbing, year: state.year,
        kitchen: state.kitchen, fullBaths: state.fullBaths, halfBaths: state.halfBaths
      }, opts);
      if (!r) console.error('general-engine: no price for these answers; check data-rates', state);
      var inPerson = !!(r && r.inPerson);
      var low = r && !inPerson ? r.low : 0;
      var high = r && !inPerson ? r.high : 0;
      function range(lo, hi) { return fmt(lo) + ' to ' + fmt(hi); }

      if (inPerson) {
        bandLabel.textContent = 'Your next step';
        priceRange.textContent = 'In-person estimate';
      } else {
        bandLabel.textContent = multi ? 'Your price range, ' + list.length + ' rooms' : 'Your price range';
        priceRange.innerHTML = '<span class="cew-nw">' + fmt(low) + '</span> &ndash; <span class="cew-nw">' + fmt(high) + '</span>';
      }
      var answers, answersSummary;
      roomBreakdown.innerHTML = '';
      roomBreakdown.hidden = !multi;
      if (multi) {
        // On screen: one line per room with its range; the home's age under them.
        // Sent: the same in one sentence (answers_summary).
        var parts = [];
        list.forEach(function (room, i) {
          var each = r && r.rooms ? r.rooms[i] : null;
          var says = sayList(room, ROOM_KEYS);
          var cost = !each ? '' : each.inPerson ? 'in-person estimate, not in the total' : range(each.low, each.high);
          parts.push('Room ' + (i + 1) + ', ' + says + (cost ? ' (' + cost + ')' : ''));
          var li = el('li', {});
          li.appendChild(el('strong', { style: 'color:' + cfg.colorDark, html: 'Room ' + (i + 1) + ':' }));
          li.appendChild(document.createTextNode(' ' + says + '. '));
          var c = el('span', { class: 'cew-nw' }); c.textContent = cost.charAt(0).toUpperCase() + cost.slice(1); li.appendChild(c);
          roomBreakdown.appendChild(li);
        });
        var home = sayList(state, ['year']);
        answers = home;
        answersSummary = 'Based on: ' + parts.join('; ') + (home ? '; ' + home : '') + '.';
      } else {
        answers = answersList();
        answersSummary = answers ? 'Based on: ' + answers + '.' : '';
      }
      answersLine.innerHTML = '';
      if (answers) {
        answersLine.appendChild(el('strong', { style: 'color:' + cfg.colorDark, html: 'Based on:' }));
        answersLine.appendChild(document.createTextNode(' ' + answers + '.'));
      }
      answersLine.hidden = !answers;
      if (mult !== 1 && !inPerson) {
        zipNote.hidden = false;
        zipNote.textContent = 'Adjusted for the ' + zipVal + ' area.';
      } else {
        zipNote.hidden = true;
      }
      var sp = spaceInfo(state.space) || { noun: 'space' };
      function fill(t) { return String(t || '').split('{space}').join(sp.noun); }
      var copyKey = multi ? (inPerson ? (list.filter(function (x) { return IN_PERSON[x.scope]; })[0] || {}).scope : 'several')
        : isWhole(state.space) ? (r && r.copy) || 'whole' + String(state.scope).charAt(0).toUpperCase() + String(state.scope).slice(1)
        : state.scope;
      var copy = cfg.scopeCopy[copyKey] || { heading: '', intro: '', bullets: [] };
      tierHeading.textContent = fill(copy.heading);
      tierIntro.textContent = fill(copy.intro);
      tierBullets.innerHTML = '';
      (copy.bullets || []).forEach(function (b) { tierBullets.appendChild(el('li', { html: fill(b) })); });
      tierBullets.hidden = !(copy.bullets || []).length;

      notes.innerHTML = '';
      function note(text) { var p = el('p', { class: 'cew-note' }); p.textContent = text; notes.appendChild(p); }
      var egress = multi ? ((r && r.rooms) || []).filter(function (x) { return x.egress; })[0] : r;
      if (egress && egress.egress) {
        note('If the rooms include a bedroom, code requires an egress window (an escape window) in it. This range includes one, at about ' +
          fmt(egress.egress.low) + ' to ' + fmt(egress.egress.high) + ' per bedroom.');
      }
      if (multi && !inPerson && list.some(function (x) { return IN_PERSON[x.scope]; })) {
        note('A room marked in-person estimate changes the structure of the house, so it isn\u2019t in this total. The in-person estimate prices it.');
      }
      if (multi ? list.some(function (x) { return x.space === 'closet'; }) : state.space === 'closet') note(NOTE_CLOSET);
      if (state.year === 'y1970' || state.year === 'pre1970') note(NOTE_OLDER_HOME);

      return {
        mult: mult, inPerson: inPerson, rate: r && !inPerson && !multi ? r.rate : '', low: low, high: high,
        answersSummary: answersSummary, rooms: multi ? list : null
      };
    }

    var resultTop = function () { return el('div', {}, [bandLabel, priceRange, roomBreakdown, answersLine, zipNote, tierHeading, tierIntro, tierBullets, notes, expectNote]); };

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
      var previewResult = el('div', { class: 'cew-result' }, [resultTop(), settingLine]);
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

      onRoomsChanged = renderPreview;
      card.appendChild(questionsBlock);
      card.appendChild(controls);
      card.appendChild(emptyMsg);
      card.appendChild(previewResult);
      wrap.appendChild(card);
      wrap.appendChild(poweredBy(root));
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
    // Optional open question (PX research, 2026-10-17): the one answer that isn't required.
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
      html: 'See What Your Remodel Costs in ' + cfg.serviceArea
    });

    var form = el('div', {}, [
      questionsBlock,
      el('p', { class: 'cew-section-label', style: 'color:' + cfg.colorDark, html: 'Your Info' }),
      el('div', { class: 'cew-lead-fields' }, [
        el('div', { class: 'cew-field-wrap' }, [el('label', { style: 'color:' + cfg.colorDark, html: 'First Name *' }), firstName]),
        el('div', { class: 'cew-field-wrap' }, [el('label', { style: 'color:' + cfg.colorDark, html: 'Last Name *' }), lastName])
      ]),
      el('div', { class: 'cew-lead-fields' }, [
        el('div', { class: 'cew-field-wrap' }, [el('label', { style: 'color:' + cfg.colorDark, html: 'Email *' }), email]),
        el('div', { class: 'cew-field-wrap' }, [el('label', { style: 'color:' + cfg.colorDark, html: 'Postal Code *' }), zip])
      ]),
      el('div', { class: 'cew-est-row' }, [wantsCallBox, el('label', { html: 'I\'d also like a call to talk through my project' })]),
      phoneWrap,
      el('div', { class: 'cew-field-wrap cew-notes-wrap' }, [el('label', { style: 'color:' + cfg.colorDark, html: 'Anything else we should know about your project?' }), notesInput]),
      consentRow,
      el('div', { class: 'cew-cta-row' }, [submitBtn]),
      formMsg,
      honeypot
    ]);

    var callbackMsg = el('div', { class: 'cew-callback-msg' }); callbackMsg.hidden = true;
    var nextMsg = el('p', { class: 'cew-next' });
    var callNowLink = el('a', {
      class: 'cew-cta-outline', href: '#',
      style: 'color:' + cfg.colorPrimary + ';border-color:' + cfg.colorPrimary,
      html: 'Call Us Now: ' + cfg.phone
    });
    var rawPhone = cfg.phone.replace(/\D/g, '');
    if (rawPhone) callNowLink.href = 'tel:+1' + rawPhone;
    var resultMsg = el('div', { class: 'cew-msg' }); resultMsg.hidden = true;

    var result = el('div', { class: 'cew-result' }, [resultTop(), callbackMsg, nextMsg, callNowLink, resultMsg]);
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
      var unanswered = missingQuestions();
      QUESTIONS.forEach(function (q) { selects[q.key].classList.toggle('cew-err', unanswered.indexOf(q) >= 0); });
      if (unanswered.length) {
        setFormMsg('Please answer every question above so we can price your project.');
        return;
      }

      if (!firstVal || !lastVal || !emailOk || !zipOk) {
        setFormMsg('Please fill in your first name, last name, a valid email, and your postal code.');
        return;
      }
      if (wantsCall && !phoneVal) { setFormMsg('Please add a phone number so we can call you back.'); return; }
      if (!consentBox.checked) { setFormMsg('Please check the consent box so we can follow up with you.'); return; }

      var shown = showPrice(zipVal);
      if (wantsCall) {
        callbackMsg.hidden = false;
        callbackMsg.textContent = cfg.bookingClosed
          ? 'Thanks, ' + firstVal + '. We\u2019re not taking on new projects right now, so we\u2019ve added you to our wait list. We\u2019ll call you as soon as we\u2019re able.'
          : 'Thanks, ' + firstVal + '! We\u2019ll call you ' + (cfg.responseTime || 'soon') + ' at ' + phoneVal + ' to talk through your project.';
      } else {
        callbackMsg.hidden = true;
      }
      nextMsg.textContent = 'Your price range and answers are on their way to ' + emailVal + '. If you don\u2019t see the email in a few minutes, check your Promotions or spam folder.';
      callNowLink.hidden = cfg.bookingClosed;
      form.hidden = true;
      result.hidden = false;
      // The form is long on a phone; once it hides, bring the result into view.
      try { if (card.getBoundingClientRect().top < 0) card.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}

      var scopeOpt = pickedOption('scope') || {};
      var spaceOpt = pickedOption('space') || {};
      var payload = {
        first_name: firstVal, last_name: lastVal, email: emailVal, phone: phoneVal,
        trade_config: cfg.tradeLabel, score: shown.rate, estimate_low: shown.low, estimate_high: shown.high,
        price_range: shown.inPerson ? 'In-person estimate needed' : fmt(shown.low) + ' \u2013 ' + fmt(shown.high),
        tier_label: scopeOpt.label || '', zip: zipVal, price_adjustment_pct: Math.round((shown.mult - 1) * 100),
        wants_call: wantsCall ? 'Yes' : 'No',
        answers_summary: shown.answersSummary,
        project_notes: notesInput.value.trim(),
        priority_lean: priorityLean(),
        start_timeframe: startTimeframe(),
        client_adjustment_pct: adjustmentPct,
        ref: cfg.ref,
        space: spaceOpt.label || '',
        scope: scopeOpt.label || ''
      };
      if (shown.rooms) {
        // Several rooms: same keys, the total, each room's labels.
        payload.tier_label = 'Several rooms (' + shown.rooms.length + ')';
        payload.space = shown.rooms.map(function (x) { return (optionIn(x, 'space') || {}).label || ''; }).join(' + ');
        payload.scope = shown.rooms.map(function (x) { return (optionIn(x, 'scope') || {}).label || ''; }).join(' + ');
        payload.room_count = shown.rooms.length;
      }

      if (cfg.mock) {
        root.setAttribute('data-last-payload', JSON.stringify(payload));
        resultMsg.hidden = false;
        resultMsg.className = 'cew-msg cew-ok';
        resultMsg.textContent = 'Demo: nothing was sent. On a remodeler\u2019s real site this saves the lead and emails the homeowner a copy.';
        return;
      }

      if (cfg.webhookUrl) {
        fetch(cfg.webhookUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        }).then(function (res) {
          if (!res.ok) throw new Error('bad status ' + res.status);
          trackLead('general', cfg.ref);
        }).catch(function () {
          resultMsg.hidden = false;
          resultMsg.className = 'cew-msg cew-error';
          resultMsg.textContent = 'We had trouble saving your info just now. If you don\'t hear from us, please call ' + cfg.phone + ' directly.';
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
    var roots = document.querySelectorAll('[data-rates], [data-calc="general"]');
    Array.prototype.forEach.call(roots, init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
