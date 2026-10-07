# Craftsman Digital Calculators

Shared calculator engine(s) for Channel B website clients, hosted via GitHub Pages
so every client's page loads the same file instead of a pasted-in copy per client.

## Bathroom calculator

`bathroom-engine.js` — reads its config from `data-*` attributes on its container
element. Per-client GHL Custom Code snippet:

```html
<div id="cewRoot"
  data-business-name="{{ custom_values.locationname }}"
  data-phone="{{ custom_values.location_phone }}"
  data-webhook-url="{{ custom_values.calculator__webhook_url }}"
  data-terms-url="{{ custom_values.calculator__terms_url }}"
  data-privacy-url="{{ custom_values.calculator__privacy_url }}"
  data-service-area="{{ custom_values.calculator__service_area }}"
  data-color-primary="{{ custom_values.calculator__brand_color_primary }}"
  data-color-dark="{{ custom_values.calculator__brand_color_dark }}"
  data-color-accent="{{ custom_values.calculator__brand_color_accent }}"
  data-tiers='[{"max":8,"low":5000,"high":11000,"label":"Light refresh","blurb":"..."}]'
></div>
<script src="https://abegley5781.github.io/craftsman-digital-calculators/bathroom-engine.js"></script>
```

The 6 questions (size/scope/tile/finish/layout/year) are universal and live in the
engine file itself — they measure the bathroom's own complexity, not anything
specific to a business, so they don't change per client. What changes per client
is `data-tiers` (their real pricing bands) and the custom values above.

**Start time and required answers (2026-10-06):** both engines add a 7th
question, "When are you hoping to start?" (As soon as possible / In the next 1
to 3 months / 3 to 6 months out / Just planning for now). It doesn't change the
price and isn't in the "Based on" line; it is sent as `start_timeframe`. Every
question now starts blank ("Pick one") and must be answered before the price
shows; a missed one gets a red border and a message. Preview mode shows the
price once the 6 price questions are answered.

**Answers summary:** both engines show a "Based on: ..." line under the price
range, built from the visitor's 6 answers, and send the same sentence in the
webhook payload as `answers_summary`. To save it on the contact (and show it in
Email 1), each client's GHL location needs one text custom field mapped to
`answers_summary` in the lead-capture workflow's Create/Update Contact step.

**Price, speed, quality note:** both engines show one line under the range on
the results screen: "Every remodel is a trade between three things: the price,
how fast it gets done, and the quality of the work..." A page can replace it with
`data-expectation-note="..."` or hide it with `data-expectation-note=""`.

**Priority lean (owner only):** both engines also send `priority_lean` in the
webhook payload: "Leans price (...)", "Leans quality (...)", or "No clear lean",
read from the finish and tile answers (bathroom) or the cabinet and counter
answers (kitchen). It is never shown to the homeowner. It is a guess, and it
can't show time. To use it, map `priority_lean` to a text custom field in the
lead-capture workflow and add that field to the owner's lead alert.

To update the calculator for every client at once, edit `bathroom-engine.js` and
push — no per-client GHL edits needed. To onboard a new client, create their
custom values in their own GHL location and paste the snippet above with their
own `data-tiers`.

## Kitchen calculator

`kitchen-engine.js` — same widget shell, form fields, and webhook behavior as
bathroom (copied deliberately, not re-derived). Uses the exact same custom
values, webhook URL, and GHL workflow/custom fields as bathroom — nothing new
to build in GHL to add this to a client already set up for bathroom, beyond
pasting this snippet on its own page:

```html
<div id="cewRoot"
  data-business-name="{{ custom_values.locationname }}"
  data-phone="{{ custom_values.location_phone }}"
  data-webhook-url="{{ custom_values.calculator__webhook_url }}"
  data-terms-url="{{ custom_values.calculator__terms_url }}"
  data-privacy-url="{{ custom_values.calculator__privacy_url }}"
  data-service-area="{{ custom_values.calculator__service_area }}"
  data-color-primary="{{ custom_values.calculator__brand_color_primary }}"
  data-color-dark="{{ custom_values.calculator__brand_color_dark }}"
  data-color-accent="{{ custom_values.calculator__brand_color_accent }}"
  data-tiers='[
    {"max":15,"low":18000,"high":35000,"label":"Minor Kitchen Refresh","heading":"What this range is best suited for","intro":"This budget typically covers a cosmetic refresh — keeping your existing cabinet boxes and layout while updating the surfaces and finishes that get the most daily use.","bullets":["New countertops, sink, and faucet","Refaced or refinished cabinet doors and drawer fronts, new hardware","Updated lighting and paint","Same footprint — no plumbing or electrical relocation"]},
    {"max":32,"low":55000,"high":100000,"label":"Full Kitchen Remodel (Midrange)","heading":"What this range is best suited for","intro":"This budget typically covers a full kitchen remodel — new cabinets, countertops, and appliances throughout, without changing the kitchen's footprint.","bullets":["New stock or semi-custom cabinets throughout","Quartz or granite countertops","New mid-range appliance suite","New flooring and lighting, same layout"]},
    {"max":999,"low":120000,"high":220000,"label":"Custom / Upscale Remodel","heading":"What this range is best suited for","intro":"This budget typically covers a full custom remodel — including layout changes, premium materials, and high-end finishes throughout.","bullets":["Custom cabinetry and premium stone countertops","High-end or panel-ready appliance suite","Layout changes — moved plumbing/electrical or removed walls","Designer-level lighting, flooring, and finish details"]}
  ]'
></div>
<script src="https://abegley5781.github.io/craftsman-digital-calculators/kitchen-engine.js"></script>
```

**Pricing source:** unlike bathroom (which recovered real per-tier copy from
CKB's own live form), no live kitchen reference form exists, so these tiers
are grounded in Journal of Light Construction's 2025 Cost vs. Value report —
national averages, not CKB-specific quotes, per Andrew's explicit direction
(2026-09-14: "national/industry numbers only. I used cost v value many times.
I like it."):

| CVV category | National avg. job cost | Tier `low`–`high` used above |
|---|---|---|
| Minor Kitchen Remodel | $28,458 | $18,000–$35,000 |
| Major Kitchen Remodel (Midrange) | $82,793 | $55,000–$100,000 |
| Major Kitchen Remodel (Upscale) | $164,104 | $120,000–$220,000 |

The 6 questions (size/scope/cabinets/finish/layout/year) and their point
values are new for kitchen — not pulled from any report, just built to spread
realistically across the 3 CVV bands above. If real per-client data ever
becomes available (a live kitchen quote form, actual job costs), replace
these with the same recover-real-content approach bathroom used.
