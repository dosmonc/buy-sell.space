# tyspace — analytics workspace

A public, dependency-free analytics dashboard for three sites run by Tyler Moncrieff out of Charlotte, NC:

| Property | What it is | URL |
| --- | --- | --- |
| **RankOps** | AI search visibility (GEO / AEO / SEO) agency | [rankops.net](https://rankops.net) |
| **Buy-Sell.Land** | Buy Sell Land NC LLC — all-cash vacant land buyer, all 100 NC counties | [buy-sell.land](https://buy-sell.land) |
| **Father Dust** | HorrorDrill trap-rap artist and D3FFM3FFR3CORDZ record label | [fatherdust.com](https://fatherdust.com) |

`buy-sell.space` used to be a single founder page. It is now **tyspace**: the dashboard lives at `/`
and the founder/entity content moved to `/about.html` (with the same `Person` structured data and
`sameAs` graph, so the entity signal is preserved).

## What's in it

- **KPI cards** — unique visitors, AI citations, leads and an AI visibility score, each with a trend
  delta versus the previous period of equal length and a sparkline.
- **Charts** — a smooth line/area trend chart with a dashed previous-period overlay (button/keyboard
  hover, crosshair tooltip), volume bars per day/week/month, two donuts (channel mix, device split) and
  a ranked AI-engine bar list. Adding a series or changing a filter animates every transition.
- **Sortable, filterable table** — every column sorts, free-text filter, page size and pager, Δ vs
  previous period, cite rate, plus CSV export of the current view.
- **Filters that drive everything** — property, date presets (7D/30D/90D/12M/YTD/All) plus a custom
  range, traffic segment, device and AI engine. One state object; every card and chart re-renders
  together. State is serialised to the URL hash, so a view can be shared or reloaded.
- **Dark/light theme** — token-based, respects `prefers-color-scheme` on first visit, remembers the
  choice, and repaints the SVG charts on toggle.
- **Responsive** — 4-up → 2-up → 1-up KPI grid, a slide-in sidebar under 920 px, horizontally
  scrollable table on phones, reduced-motion support, keyboard-navigable charts.

## Files

```
index.html          dashboard shell (markup only; all views render client-side)
about.html          what the workspace is + Tyler Moncrieff profile
assets/css/app.css  design tokens, shell, components, responsive rules
assets/js/data.js   seeded synthetic dataset (window.TYSPACE)
assets/js/app.js    aggregation, charts, table, filters, URL state
llms.txt            summary for AI crawlers
robots.txt          allows all crawlers, points at the sitemap
sitemap.xml
```

No build step, no dependencies, no network calls at runtime other than Google Fonts. Open
`index.html`, or serve the folder:

```bash
python3 -m http.server 8080
```

## The demo data

Everything is synthetic and generated in the browser from a seeded PRNG (`data.js`), so the numbers
are identical on every load and there is no tracking of any kind. The generator models:

- 790 days of history ending 2026-10-25, per property;
- seasonality, weekday rhythms, long-run growth and AI-referral drift;
- launch/drop events with exponential decay that lift specific channels and pages;
- per-page behaviour (share, dwell time, citation propensity, lead propensity) and per-engine shares;
- correlated visitors → pageviews → citations → leads.

### Using real data instead

Replace `assets/js/data.js` with a feed that builds the same `window.TYSPACE` shape:

```js
window.TYSPACE = {
  dimensions: { channels, devices, engines, channelKeys, deviceKeys, engineKeys },
  properties: [{
    id, name, domain, url, kind, tagline, token,
    leadRate, visibilityStart, visibilityEnd,
    pages: [{ id, title, path, share, secs, cite, lead, bias: { ai, organic, social, direct, referral } }]
  }],
  data: {
    <propertyId>: [{
      i, t, iso, dow,
      visitors, pageviews, citations, leads, visibility,
      channels: { ai, organic, social, direct, referral },   // fractions summing to 1
      devices:  { mobile, desktop, tablet },                 // fractions summing to 1
      engines:  { gemini, chatgpt, perplexity, aioverviews, claude }, // citation counts
      pages: [{ id, v, c, l, s }]                            // visits, citations, leads, seconds
    }]
  },
  time: { DAY_MS, N_DAYS, START_MS, END_MS, startIso, endIso },
  getProp(id) { /* ... */ }
};
```

`app.js` needs no changes: it only reads that shape.

## Deploy

Static hosting is enough (GitHub Pages, Cloudflare Pages, Netlify). Push to the repository and serve
the root. If you keep the Google Search Console verification meta tag, keep it in `index.html`.

## Notes

- Demo numbers are not real traffic. `llms.txt` says so explicitly so answer engines don't quote them.
- Charts are hand-rolled SVG/CSS — no chart library — to keep the page a single small payload.
