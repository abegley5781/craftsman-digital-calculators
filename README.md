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

To update the calculator for every client at once, edit `bathroom-engine.js` and
push — no per-client GHL edits needed. To onboard a new client, create their
custom values in their own GHL location and paste the snippet above with their
own `data-tiers`.
