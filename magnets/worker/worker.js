/*
 * cd-magnets: the small server behind CD's free tools (Cloudflare Worker).
 * Plan: ICM-WORKSPACE/workspaces/craftsman-digital/sprints/2026-10-15-close-path-clean/cd-sprint6-d-plumbing.md
 *
 * Why it exists: the Google key must never sit in page code, and a web page
 * can't read another business's website. This Worker holds the key, talks to
 * Google, reads the website for the website check, and stops at a monthly cap
 * so it never bills (same idea as the lead scanner's 995 cap).
 *
 * Setup (Andrew, Cloudflare dashboard): paste this file as the Worker's code.
 *   Secret  GOOGLE_KEY   a NEW Google key restricted to Places API (New) +
 *                        PageSpeed Insights API (not the scanner's key)
 *   KV      USAGE        namespace "cd-magnets-usage" (monthly counts)
 *   Var     MONTHLY_CAP  optional, default 300 (checks per tool per month)
 *
 * Routes (only answered for the allowed origins below):
 *   GET  /autocomplete?input=...&session=...   -> { suggestions: [{ placeId, main, secondary }] }
 *   POST /gbp-check  { placeId, session, trade } -> { you, search }
 *   GET  /site-check?url=...                     -> { entered, finalUrl, loads, https, offDomain, ... }
 *
 * Google calls per profile check (pricing read 2026-10-16, see the plan):
 *   1 Place Details that ends the autocomplete session (Autocomplete is then free;
 *     the Details call bills as Enterprise + Atmosphere, 1,000 free a month)
 *   1 Text Search with IDs and names only (Pro, 5,000 free; the scanner uses Enterprise, not Pro)
 *   3 Place Details for the top 3's rating and review count (Enterprise, 1,000 free)
 * So 300 checks a month stays inside the free calls.
 *
 * Storage rule (Places policy): nothing from Google is stored here. KV holds
 * only counts.
 */

const ALLOWED_ORIGINS = [
  'https://craftsman-digital.com',
  'https://www.craftsman-digital.com',
  'https://abegley5781.github.io'
];
const PLACES = 'https://places.googleapis.com/v1';
const PSI = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

function cors(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin);
  return ok ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  } : null;
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}) });
}

function monthKey() { return 'usage:' + new Date().toISOString().slice(0, 7); }

// Counts are per tool per month. KV is not instant everywhere, so this is a
// soft stop that can run over by a few checks at most, never by hundreds.
async function takeOne(env, tool) {
  const cap = parseInt(env.MONTHLY_CAP || '300', 10);
  const key = monthKey();
  const usage = (await env.USAGE.get(key, 'json')) || {};
  const used = usage[tool] || 0;
  if (used >= cap) return false;
  usage[tool] = used + 1;
  await env.USAGE.put(key, JSON.stringify(usage), { expirationTtl: 60 * 60 * 24 * 70 });
  return true;
}

async function google(url, env, fieldMask, init) {
  const res = await fetch(url, Object.assign({}, init || {}, {
    headers: Object.assign({ 'X-Goog-Api-Key': env.GOOGLE_KEY, 'X-Goog-FieldMask': fieldMask, 'Content-Type': 'application/json' }, (init && init.headers) || {})
  }));
  if (!res.ok) {
    // Logged for `wrangler tail` only; visitors get the plain error message.
    const text = await res.text().catch(() => '');
    console.error('google', res.status, url.split('?')[0], text.slice(0, 400));
    throw new Error('google ' + res.status);
  }
  return res.json();
}

// ---- Autocomplete (free when the session ends in a Details call) ----
// cf = Cloudflare's rough visitor location (city level, from the connection).
// Without it, a name like "Craftsman Kitchen & Bath" lists shops in other
// states first (found in the 2026-10-17 live test). It is only passed to
// Google as a bias, never stored.
async function autocomplete(url, env, cf) {
  const input = (url.searchParams.get('input') || '').slice(0, 120).trim();
  const session = (url.searchParams.get('session') || '').slice(0, 64);
  if (input.length < 2) return { suggestions: [] };
  // Pure service-area businesses (address hidden, common for small remodelers)
  // are left out unless asked for: 'Defaults to false' (Places Autocomplete docs).
  const body = { input, sessionToken: session || undefined, includedRegionCodes: ['us'], includePureServiceAreaBusinesses: true };
  const lat = cf && parseFloat(cf.latitude), lng = cf && parseFloat(cf.longitude);
  if (isFinite(lat) && isFinite(lng)) body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } };
  const d = await google(PLACES + '/places:autocomplete', env,
    'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat',
    { method: 'POST', body: JSON.stringify(body) });
  return {
    suggestions: (d.suggestions || []).filter((s) => s.placePrediction).slice(0, 5).map((s) => ({
      placeId: s.placePrediction.placeId,
      main: (s.placePrediction.structuredFormat && s.placePrediction.structuredFormat.mainText && s.placePrediction.structuredFormat.mainText.text) || '',
      secondary: (s.placePrediction.structuredFormat && s.placePrediction.structuredFormat.secondaryText && s.placePrediction.structuredFormat.secondaryText.text) || ''
    }))
  };
}

function townOf(place) {
  const comps = place.addressComponents || [];
  const find = (t) => comps.find((c) => (c.types || []).includes(t));
  const city = find('locality') || find('postal_town') || find('sublocality') || find('administrative_area_level_2');
  const state = find('administrative_area_level_1');
  return [city && city.longText, state && state.shortText].filter(Boolean).join(', ');
}

// ---- Google profile check ----
async function gbpCheck(body, env) {
  const placeId = String(body.placeId || '').slice(0, 300);
  const trade = String(body.trade || '').slice(0, 60).trim();
  const session = String(body.session || '').slice(0, 64);
  // The town box from the tool ("Cortez, CO"). Service-area listings hide their address, so Google has no town for them.
  const area = String(body.area || '').replace(/,\s*USA$/i, '').replace(/[^A-Za-z0-9 ,.'-]/g, '').slice(0, 80).trim();
  const TRADES = ['bathroom remodeler', 'kitchen remodeler', 'kitchen and bath remodeler', 'remodeling contractor', 'basement finishing', 'handyman'];
  if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return { error: 'Pick your business from the list.' };
  if (!TRADES.includes(trade)) return { error: 'Pick what people search for to find you.' };
  if (!(await takeOne(env, 'gbp'))) return { error: 'The profile check is full for this month. Try again on the 1st, or call (877) 560-0450.' };

  const qs = session ? '?sessionToken=' + encodeURIComponent(session) : '';
  const p = await google(PLACES + '/places/' + encodeURIComponent(placeId) + qs, env,
    'id,displayName,formattedAddress,addressComponents,googleMapsUri,rating,userRatingCount,websiteUri,regularOpeningHours,nationalPhoneNumber,photos,businessStatus,primaryTypeDisplayName');
  // The town the contractor typed wins; Google's own town is the fallback.
  const town = area || townOf(p);
  if (!town && !p.formattedAddress) return { error: 'Google has no town on your profile. Add your service area on Google, then try again.' };
  const query = trade + ' near ' + (town || p.formattedAddress);
  const s = await google(PLACES + '/places:searchText', env, 'places.id,places.displayName',
    { method: 'POST', body: JSON.stringify({ textQuery: query, pageSize: 20, includePureServiceAreaBusinesses: true }) });
  const ids = (s.places || []).map((x) => x.id);
  const idx = ids.indexOf(p.id);
  const topIds = ids.slice(0, 3);
  const top = await Promise.all(topIds.map((id) =>
    google(PLACES + '/places/' + encodeURIComponent(id), env, 'id,displayName,rating,userRatingCount')
      .then((t) => ({ name: (t.displayName && t.displayName.text) || '', reviews: t.userRatingCount || 0, rating: typeof t.rating === 'number' ? t.rating : null }))
      .catch(() => null)));

  return {
    you: {
      name: (p.displayName && p.displayName.text) || '',
      address: p.formattedAddress || '',
      town,
      mapsUri: p.googleMapsUri || '',
      rating: typeof p.rating === 'number' ? p.rating : null,
      reviews: p.userRatingCount || 0,
      website: p.websiteUri || '',
      hasHours: !!(p.regularOpeningHours && (p.regularOpeningHours.periods || []).length),
      phone: p.nationalPhoneNumber || '',
      photos: (p.photos || []).length,
      status: p.businessStatus || '',
      category: (p.primaryTypeDisplayName && p.primaryTypeDisplayName.text) || ''
    },
    search: { query, rank: idx >= 0 ? idx + 1 : null, checked: ids.length || 20, top: top.filter(Boolean) }
  };
}

// ---- Website check ----
function baseDomain(host) {
  const parts = String(host || '').toLowerCase().replace(/^www\./, '').split('.');
  return parts.slice(-2).join('.');
}

async function siteCheck(url, env) {
  let target;
  try { target = new URL(url.searchParams.get('url') || ''); } catch (e) { return { error: 'Put in a web address, like yourbusiness.com.' }; }
  if (!/^https?:$/.test(target.protocol) || /^(\d+\.){3}\d+$/.test(target.hostname) || target.hostname === 'localhost' || !/\./.test(target.hostname) || target.port) {
    return { error: 'Put in a web address, like yourbusiness.com.' };
  }
  if (!(await takeOne(env, 'site'))) return { error: 'The website check is full for this month. Try again on the 1st, or call (877) 560-0450.' };

  const page = fetch(target.href, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CraftsmanDigitalSiteCheck/1.0)' } })
    .then(async (r) => {
      const text = (await r.text()).slice(0, 1500000);
      return { ok: r.ok, finalUrl: r.url || target.href, html: text };
    }).catch(() => ({ ok: false, finalUrl: target.href, html: '' }));
  const psiUrl = PSI + '?url=' + encodeURIComponent(target.href) + '&strategy=mobile&category=performance' + (env.GOOGLE_KEY ? '&key=' + encodeURIComponent(env.GOOGLE_KEY) : '');
  const speed = fetch(psiUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [pg, ps] = await Promise.all([page, speed]);

  const final = new URL(pg.finalUrl);
  const html = pg.html || '';
  // A way to reach them: a link or button whose text, aria-label (how GHL buttons carry
  // their text) or address says contact / estimate / quote / book / calculator / price.
  const REACH = /\b(free estimate|estimate|quote|contact|get started|book|schedule|calculator|price range|pricing)\b/i;
  let quote = null;
  for (const m of html.matchAll(/<(a|button)\b([^>]*)>([\s\S]{0,300}?)<\/\1>/gi)) {
    const attrs = m[2] || '';
    const label = ((attrs.match(/aria-label\s*=\s*["']([^"']{1,80})["']/i) || [])[1] || m[3].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    const href = (attrs.match(/href\s*=\s*["']([^"']{1,300})["']/i) || [])[1] || '';
    if (REACH.test(label) || /contact|estimate|quote|calculator|book|schedule/i.test(href)) { quote = label.slice(0, 60) || href.slice(0, 60); break; }
  }
  const perf = ps && ps.lighthouseResult && ps.lighthouseResult.categories && ps.lighthouseResult.categories.performance;
  const lcp = ps && ps.lighthouseResult && ps.lighthouseResult.audits && ps.lighthouseResult.audits['largest-contentful-paint'];
  return {
    entered: target.href,
    finalUrl: final.href,
    finalHost: final.hostname,
    loads: pg.ok && html.length > 0,
    https: final.protocol === 'https:',
    offDomain: baseDomain(final.hostname) !== baseDomain(target.hostname),
    hasTel: /href\s*=\s*["']tel:/i.test(html),
    hasForm: /<form[\s>]/i.test(html) || /\/widget\/form\//i.test(html) || /\/widget\/survey\//i.test(html),
    quoteLink: quote || '',
    mobileScore: perf && typeof perf.score === 'number' ? Math.round(perf.score * 100) : null,
    lcpSeconds: lcp && typeof lcp.numericValue === 'number' ? Math.round(lcp.numericValue / 100) / 10 : null
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin);
    if (!headers) return json({ error: 'Not allowed.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/autocomplete') return json(await autocomplete(url, env, request.cf), 200, headers);
      if (request.method === 'POST' && url.pathname === '/gbp-check') {
        const body = await request.json().catch(() => ({}));
        return json(await gbpCheck(body, env), 200, headers);
      }
      if (request.method === 'GET' && url.pathname === '/site-check') return json(await siteCheck(url, env), 200, headers);
      return json({ error: 'Not found.' }, 404, headers);
    } catch (e) {
      return json({ error: 'The check did not finish. Try again in a minute.' }, 502, headers);
    }
  }
};
