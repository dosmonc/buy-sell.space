/* tyspace — synthetic, seeded analytics dataset
   ------------------------------------------------------------------
   Every number in this demo is generated deterministically in the
   browser from the seeds below. No network calls, no cookies, no
   personal data. This simulation uses estimated distributions; see
   real-data.html and README.md before integrating measured data.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var DAY_MS = 86400000;
  var N_DAYS = 790;
  var END_MS = Date.UTC(2026, 9, 25); /* 2026-10-25, matches the shipped snapshot */
  var START_MS = END_MS - (N_DAYS - 1) * DAY_MS;

  /* ---------- deterministic randomness ---------- */
  function hashStr(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rng() {
    var key = Array.prototype.join.call(arguments, '|');
    return mulberry32(hashStr(key));
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function normalize(o, keys) {
    var sum = 0, i;
    for (i = 0; i < keys.length; i++) sum += o[keys[i]] || 0;
    for (i = 0; i < keys.length; i++) o[keys[i]] = (o[keys[i]] || 0) / (sum || 1);
    return o;
  }

  /* ---------- dimensions ---------- */
  var CHANNELS = [
    { key: 'ai', name: 'AI answers', short: 'AI answers', token: 'ai', blurb: 'Visits from ChatGPT, Gemini, Perplexity, Claude and Google AI Overviews.' },
    { key: 'organic', name: 'Organic search', short: 'Organic', token: 'organic', blurb: 'Classic search results, including AI Overviews clicks that pass a referrer.' },
    { key: 'social', name: 'Social', short: 'Social', token: 'social', blurb: 'TikTok, Instagram, YouTube, X, SoundCloud and Reddit.' },
    { key: 'direct', name: 'Direct', short: 'Direct', token: 'direct', blurb: 'Typed, bookmarked or unknown-referrer traffic.' },
    { key: 'referral', name: 'Referral', short: 'Referral', token: 'referral', blurb: 'Links from other websites, directories, press and partners.' }
  ];

  var DEVICES = [
    { key: 'mobile', name: 'Mobile', token: 'mobile' },
    { key: 'desktop', name: 'Desktop', token: 'desktop' },
    { key: 'tablet', name: 'Tablet', token: 'tablet' }
  ];

  var ENGINES = [
    { key: 'gemini', name: 'Google Gemini', token: 'gemini' },
    { key: 'chatgpt', name: 'ChatGPT', token: 'chatgpt' },
    { key: 'perplexity', name: 'Perplexity', token: 'perplexity' },
    { key: 'aioverviews', name: 'AI Overviews', token: 'aioverviews' },
    { key: 'claude', name: 'Claude', token: 'claude' }
  ];

  var CHANNEL_KEYS = CHANNELS.map(function (c) { return c.key; });
  var DEVICE_KEYS = DEVICES.map(function (d) { return d.key; });
  var ENGINE_KEYS = ENGINES.map(function (e) { return e.key; });

  /* ---------- property configs ---------- */
  var PROPS = [
    {
      id: 'rankops',
      name: 'RankOps',
      domain: 'rankops.net',
      url: 'https://rankops.net',
      token: 'rankops',
      kind: 'AI search visibility agency',
      tagline: 'Neighborhood-level GEO for local service businesses.',
      base: 980,
      growth: 0.00150,
      seasonAmp: 0.10,
      seasonPhase: 0.7,
      week: [0.79, 1.06, 1.13, 1.11, 1.07, 0.94, 0.73], /* Sun → Sat */
      channels: { ai: 0.31, organic: 0.29, direct: 0.16, social: 0.12, referral: 0.12 },
      devices: { mobile: 0.57, desktop: 0.38, tablet: 0.05 },
      aiDrift: 0.62,
      citationRate: 0.19,
      citationDrift: 0.45,
      leadRate: 0.019,
      pv: 2.6,
      visibilityStart: 61,
      visibilityEnd: 78,
      engines: { gemini: 0.34, chatgpt: 0.26, perplexity: 0.18, aioverviews: 0.14, claude: 0.08 },
      events: [
        { date: '2025-02-19', lift: 0.55, decay: 12, channels: { referral: 1.9 } },
        { date: '2025-09-16', lift: 0.7, decay: 10, channels: { ai: 1.5, referral: 1.6 } },
        { date: '2026-03-04', lift: 0.9, decay: 18, channels: { ai: 1.6 }, pages: ['rubric'] },
        { date: '2026-07-14', lift: 1.15, decay: 14, channels: { referral: 2.1, direct: 1.2 }, pages: ['partners'] },
        { date: '2026-10-10', lift: 0.8, decay: 8, channels: { ai: 1.5, direct: 1.2 }, pages: ['rubric', 'score-checker'] }
      ],
      pages: [
        { id: 'home', title: 'AI visibility & local SEO in Charlotte, NC', path: '/', share: 0.20, secs: 78, cite: 1.0, lead: 1.0, bias: { ai: 1.3, organic: 1.1, social: 0.7, direct: 1.2, referral: 0.9 },
          queries: ['who is the best seo agency in charlotte', 'ai visibility agency for local business', 'how do i get my business cited by chatgpt'] },
        { id: 'rubric', title: 'The AI visibility rubric: 100 points', path: '/ai-visibility/rubric/', share: 0.12, secs: 168, cite: 1.5, lead: 1.15, bias: { ai: 1.6, organic: 0.95, social: 0.6, direct: 0.8, referral: 1.1 },
          queries: ['how is ai visibility scored', 'what does geo mean in marketing', 'ai visibility checklist for local business'] },
        { id: 'score-checker', title: 'Free AI visibility score checker', path: '/ai-score-checker/', share: 0.11, secs: 74, cite: 1.1, lead: 2.3, bias: { ai: 1.2, organic: 1.0, social: 1.5, direct: 0.7, referral: 0.8 },
          queries: ['free ai visibility checker', 'is my business visible to ai', 'check if gemini recommends my business'] },
        { id: 'seo-growth', title: 'SEO + AI visibility growth retainer', path: '/seo-growth/', share: 0.10, secs: 102, cite: 1.0, lead: 1.4, bias: { ai: 1.1, organic: 1.25, social: 0.8, direct: 1.0, referral: 1.1 },
          queries: ['monthly seo retainer charlotte', 'how much does ai seo cost'] },
        { id: 'blog', title: 'RankOps blog', path: '/blog/', share: 0.16, secs: 145, cite: 1.25, lead: 0.5, bias: { ai: 1.35, organic: 1.2, social: 1.1, direct: 0.6, referral: 0.8 },
          queries: ['how ai search changes local seo', 'does schema markup help ai answers'] },
        { id: 'build', title: 'AI HQ build', path: '/build/', share: 0.06, secs: 96, cite: 0.8, lead: 1.6, bias: { ai: 0.9, organic: 1.0, social: 0.9, direct: 1.0, referral: 1.2 },
          queries: ['ai ready website build', 'website built for google ai'] },
        { id: 'track', title: 'AI citation tracker', path: '/track/', share: 0.06, secs: 110, cite: 1.1, lead: 1.8, bias: { ai: 1.2, organic: 1.0, social: 1.0, direct: 0.9, referral: 1.0 },
          queries: ['track chatgpt citations', 'see who gemini recommends'] },
        { id: 'tyler', title: 'About Tyler Moncrieff', path: '/about/tyler/', share: 0.07, secs: 88, cite: 1.3, lead: 0.4, bias: { ai: 1.2, organic: 1.0, social: 0.8, direct: 1.6, referral: 1.4 },
          queries: ['who owns rankops', 'tyler moncrieff geo expert'] },
        { id: 'partners', title: 'Partner program for agencies', path: '/partners/', share: 0.04, secs: 84, cite: 0.7, lead: 1.9, bias: { ai: 0.8, organic: 1.0, social: 0.7, direct: 1.1, referral: 1.4 },
          queries: ['white label ai seo partner program'] },
        { id: 'contact', title: 'Contact RankOps', path: '/contact/', share: 0.05, secs: 62, cite: 0.4, lead: 3.0, bias: { ai: 0.8, organic: 0.9, social: 0.8, direct: 1.7, referral: 1.0 },
          queries: ['rankops contact', 'book ai visibility call'] }
      ]
    },
    {
      id: 'buysell',
      name: 'Buy-Sell.Land',
      domain: 'buy-sell.land',
      url: 'https://buy-sell.land',
      token: 'buysell',
      kind: 'North Carolina vacant land',
      tagline: 'All-cash offers on vacant land in all 100 NC counties.',
      base: 1150,
      growth: 0.00110,
      seasonAmp: 0.16,
      seasonPhase: 0.35,
      week: [0.84, 1.05, 1.10, 1.08, 1.04, 0.96, 0.82],
      channels: { ai: 0.13, organic: 0.43, direct: 0.26, social: 0.08, referral: 0.10 },
      devices: { mobile: 0.64, desktop: 0.31, tablet: 0.05 },
      aiDrift: 0.55,
      citationRate: 0.11,
      citationDrift: 0.5,
      leadRate: 0.030,
      pv: 1.9,
      visibilityStart: 44,
      visibilityEnd: 67,
      engines: { gemini: 0.30, chatgpt: 0.24, perplexity: 0.15, aioverviews: 0.24, claude: 0.07 },
      events: [
        { date: '2025-04-02', lift: 0.5, decay: 20, channels: { organic: 1.25 }, pages: ['sellland'] },
        { date: '2025-10-21', lift: 0.35, decay: 14, channels: { referral: 1.5 } },
        { date: '2026-03-18', lift: 0.6, decay: 25, channels: { organic: 1.3, ai: 1.3 }, pages: ['sellland', 'inherited'] },
        { date: '2026-09-09', lift: 0.5, decay: 12, channels: { referral: 1.8, direct: 1.15 }, pages: ['home'] }
      ],
      pages: [
        { id: 'home', title: 'Cash land buyers for all of North Carolina', path: '/', share: 0.20, secs: 118, cite: 1.0, lead: 1.0, bias: { ai: 1.2, organic: 1.1, social: 0.6, direct: 1.2, referral: 1.0 },
          queries: ['who buys vacant land in north carolina', 'cash land buyers near me', 'sell my land fast nc'] },
        { id: 'sellland', title: 'Get a free cash offer range', path: '/sellland', share: 0.18, secs: 156, cite: 1.0, lead: 3.2, bias: { ai: 1.1, organic: 1.15, social: 0.8, direct: 1.1, referral: 1.0 },
          queries: ['how much is my land worth in nc', 'get a cash offer for vacant land', 'sell land without a realtor'] },
        { id: 'nc', title: 'North Carolina land values by county', path: '/nc', share: 0.10, secs: 174, cite: 1.6, lead: 0.6, bias: { ai: 1.3, organic: 1.2, social: 0.5, direct: 1.0, referral: 1.2 },
          queries: ['average land price per acre in north carolina', 'cheapest counties to buy land nc'] },
        { id: 'inherited', title: 'Selling inherited land in NC', path: '/sell-inherited-land-nc', share: 0.09, secs: 148, cite: 1.3, lead: 2.4, bias: { ai: 1.4, organic: 1.1, social: 0.7, direct: 0.9, referral: 0.9 },
          queries: ['how to sell inherited land with multiple heirs', 'sell inherited property nc no probate'] },
        { id: 'how-we-buy', title: 'How we buy land', path: '/how-we-buy-land', share: 0.08, secs: 132, cite: 0.9, lead: 1.5, bias: { direct: 1.3, referral: 1.1, ai: 1.0, organic: 0.9, social: 0.6 },
          queries: ['do i need a lawyer to sell land in nc', 'who pays closing costs on land sale'] },
        { id: 'mecklenburg', title: 'Mecklenburg County land buyers', path: '/counties/mecklenburg', share: 0.07, secs: 112, cite: 1.2, lead: 2.0, bias: { ai: 1.2, organic: 1.1, direct: 1.0, social: 0.8, referral: 0.8 },
          queries: ['sell land in mecklenburg county', 'charlotte nc land buyers'] },
        { id: 'blog-why', title: "Why your land isn't selling", path: '/blog/why-your-land-isnt-selling', share: 0.07, secs: 164, cite: 1.5, lead: 0.7, bias: { ai: 1.4, organic: 1.2, social: 0.7, direct: 0.7, referral: 0.8 },
          queries: ['why is my land not selling', 'land listed for years no offers'] },
        { id: 'blog-tax', title: 'Taxes when you sell land', path: '/blog/tax-benefits-of-selling-land', share: 0.06, secs: 158, cite: 1.4, lead: 0.5, bias: { ai: 1.5, organic: 1.1, social: 0.6, direct: 0.6, referral: 0.7 },
          queries: ['capital gains on vacant land sale', '1031 exchange vacant land'] },
        { id: 'landlocked', title: 'Selling landlocked land in NC', path: '/sell-landlocked-land-nc', share: 0.05, secs: 126, cite: 1.1, lead: 1.8, bias: { ai: 1.2, organic: 1.0, direct: 1.1, social: 0.7, referral: 0.8 },
          queries: ['sell land with no road access', 'landlocked parcel value nc'] },
        { id: 'buncombe', title: 'Buncombe County land buyers', path: '/counties/buncombe', share: 0.04, secs: 106, cite: 1.1, lead: 1.7, bias: { ai: 1.1, organic: 1.0, direct: 1.0, social: 0.9, referral: 0.8 },
          queries: ['sell land asheville nc', 'buncombe county cash land offer'] },
        { id: 'blog-close', title: 'How to close on land quickly', path: '/blog/how-to-quickly-close-on-land', share: 0.06, secs: 142, cite: 1.2, lead: 0.8, bias: { ai: 1.3, organic: 1.1, social: 0.7, direct: 0.7, referral: 0.8 },
          queries: ['how fast can you close on land', 'sell land in 14 days nc'] }
      ]
    },
    {
      id: 'fatherdust',
      name: 'Father Dust',
      domain: 'fatherdust.com',
      url: 'https://fatherdust.com',
      token: 'fatherdust',
      kind: 'HorrorDrill artist · D3FFM3FFR3CORDZ',
      tagline: 'HorrorDrill trap-rap, label submissions and M3FFMU$iC drops.',
      base: 520,
      growth: 0.00220,
      seasonAmp: 0.08,
      seasonPhase: 2.1,
      week: [0.94, 1.0, 1.02, 1.0, 1.1, 1.22, 1.08],
      channels: { ai: 0.21, organic: 0.11, direct: 0.19, social: 0.40, referral: 0.09 },
      devices: { mobile: 0.77, desktop: 0.19, tablet: 0.04 },
      aiDrift: 0.8,
      citationRate: 0.26,
      citationDrift: 0.7,
      leadRate: 0.0055,
      pv: 3.4,
      visibilityStart: 38,
      visibilityEnd: 59,
      engines: { gemini: 0.22, chatgpt: 0.32, perplexity: 0.19, aioverviews: 0.14, claude: 0.13 },
      events: [
        { date: '2025-01-31', lift: 1.8, decay: 5, channels: { social: 2.4 }, pages: ['home', 'matchbook'] },
        { date: '2025-05-16', lift: 2.2, decay: 6, channels: { social: 2.8 }, pages: ['home', 'music'] },
        { date: '2025-08-08', lift: 1.6, decay: 5, channels: { social: 2.2 }, pages: ['home'] },
        { date: '2026-01-30', lift: 2.0, decay: 6, channels: { social: 2.5 }, pages: ['home', 'submit'] },
        { date: '2026-05-15', lift: 2.6, decay: 7, channels: { social: 3.0 }, pages: ['home', 'music', 'matchbook'] },
        { date: '2026-08-07', lift: 2.1, decay: 6, channels: { social: 2.4 }, pages: ['home', 'label'] },
        { date: '2026-10-03', lift: 3.0, decay: 9, channels: { social: 3.2, ai: 1.4 }, pages: ['home', 'music', 'matchbook'] }
      ],
      pages: [
        { id: 'home', title: 'Father Dust — D3FFM3FFR3CORDZ, Charlotte NC', path: '/', share: 0.32, secs: 82, cite: 1.0, lead: 1.0, bias: { ai: 1.2, organic: 1.1, social: 1.2, direct: 1.1, referral: 1.0 },
          queries: ['father dust charlotte rapper', 'horrordrill trap rap artists', 'd3ffm3ffr3cordz record label'] },
        { id: 'submit', title: 'Submit your music', path: '/submit-music/', share: 0.14, secs: 96, cite: 0.9, lead: 4.2, bias: { social: 1.8, ai: 0.9, organic: 1.0, direct: 1.2, referral: 1.0 },
          queries: ['how to get signed to a record label in charlotte', 'submit music to a label for free'] },
        { id: 'music', title: 'Music & discography', path: '/music/', share: 0.12, secs: 74, cite: 1.3, lead: 0.4, bias: { social: 1.6, ai: 1.1, organic: 0.9, direct: 1.0, referral: 0.8 },
          queries: ['father dust songs', 'm3ffmu$ic volume 4 tracklist'] },
        { id: 'label', title: 'Record label in Charlotte, NC', path: '/charlotte-nc/record-label/', share: 0.08, secs: 92, cite: 1.2, lead: 2.6, bias: { ai: 1.3, organic: 1.2, social: 0.9, direct: 0.9, referral: 1.0 },
          queries: ['who in charlotte signs rappers', 'independent record label charlotte nc'] },
        { id: 'about', title: 'Father Dust — full artist bio', path: '/about/', share: 0.07, secs: 88, cite: 1.4, lead: 0.3, bias: { ai: 1.4, organic: 1.0, social: 0.8, direct: 1.2, referral: 1.1 },
          queries: ['who is tyler moncrieff father dust', 'father dust beatties ford road'] },
        { id: 'genre', title: 'What is HorrorDrill trap-rap?', path: '/horrordrill-trap-rap/', share: 0.05, secs: 134, cite: 2.1, lead: 0.2, bias: { ai: 2.0, organic: 0.9, social: 0.7, direct: 0.5, referral: 0.8 },
          queries: ['what is horrordrill trap rap', 'horrorcore trap artists'] },
        { id: 'matchbook', title: 'Matchbook Kid — single', path: '/music/matchbook-kid/', share: 0.06, secs: 64, cite: 1.0, lead: 0.5, bias: { social: 2.0, ai: 0.8, organic: 0.8, direct: 1.0, referral: 0.7 },
          queries: ['matchbook kid father dust lyrics', 'father dust matchbook kid'] },
        { id: 'marketing', title: 'Music marketing & AI discovery', path: '/charlotte-nc/music-marketing/', share: 0.05, secs: 104, cite: 1.0, lead: 2.0, bias: { ai: 1.3, organic: 1.1, social: 0.9, direct: 0.9, referral: 1.1 },
          queries: ['who can help me market my music', 'get my label discovered by ai'] },
        { id: 'dust-did-it', title: 'Dust Did It — single', path: '/music/dust-did-it/', share: 0.05, secs: 60, cite: 0.9, lead: 0.4, bias: { social: 1.9, ai: 0.8, organic: 0.8, direct: 1.0, referral: 0.7 },
          queries: ['dust did it father dust', 'father dust new single'] },
        { id: 'development', title: 'Artist development', path: '/charlotte-nc/artist-development/', share: 0.04, secs: 98, cite: 0.8, lead: 1.9, bias: { ai: 1.1, organic: 1.2, social: 0.8, direct: 0.9, referral: 1.0 },
          queries: ['artist development program charlotte', 'how to build a rapper brand'] },
        { id: 'beats', title: 'B3ATZ & production', path: '/#beats', share: 0.02, secs: 58, cite: 0.6, lead: 0.6, bias: { social: 1.5, ai: 0.7, organic: 0.7, direct: 1.2, referral: 0.6 },
          queries: ['buy horrorcore beats', 'father dust beats'] }
      ]
    }
  ];

  /* normalize page shares + per-channel page distribution */
  PROPS.forEach(function (p) {
    var totalShare = p.pages.reduce(function (s, pg) { return s + pg.share; }, 0);
    p.pages.forEach(function (pg) { pg.share = pg.share / totalShare; });

    p._pageChannelNorm = {};
    CHANNEL_KEYS.forEach(function (c) {
      var denom = p.pages.reduce(function (s, pg) { return s + pg.share * (pg.bias[c] || 1); }, 0);
      p._pageChannelNorm[c] = p.pages.map(function (pg) {
        return (pg.share * (pg.bias[c] || 1)) / (denom || 1);
      });
    });
  });

  /* ---------- build the daily dataset ---------- */
  function buildDays(p) {
    var days = [];
    var eventMeta = p.events.map(function (ev) {
      return {
        cfg: ev,
        idx: Math.round((Date.parse(ev.date + 'T00:00:00Z') - START_MS) / DAY_MS)
      };
    });

    for (var i = 0; i < N_DAYS; i++) {
      var t = START_MS + i * DAY_MS;
      var date = new Date(t);
      var dow = date.getUTCDay();
      var tt = i / (N_DAYS - 1);
      var rand = rng('day', p.id, i);
      var r1 = rand(), r2 = rand(), r3 = rand(), r4 = rand(), r5 = rand(), r6 = rand();

      var trend = Math.exp(p.growth * (i - (N_DAYS - 1)));
      var season = 1 + p.seasonAmp * Math.sin((2 * Math.PI * i) / 365.25 + p.seasonPhase) +
        0.05 * Math.sin((2 * Math.PI * i) / 29.5 + p.seasonPhase * 1.7);
      var week = p.week[dow];

      var evMult = 1;
      var chBoost = { ai: 1, organic: 1, social: 1, direct: 1, referral: 1 };
      var pageBoost = {};
      eventMeta.forEach(function (em) {
        var d = i - em.idx;
        if (d < 0 || d > 60) return;
        var decay = Math.exp(-d / em.cfg.decay);
        evMult *= 1 + em.cfg.lift * decay;
        if (em.cfg.channels) {
          Object.keys(em.cfg.channels).forEach(function (k) {
            chBoost[k] = (chBoost[k] || 1) * (1 + (em.cfg.channels[k] - 1) * decay);
          });
        }
        if (em.cfg.pages) {
          em.cfg.pages.forEach(function (pgId) {
            pageBoost[pgId] = (pageBoost[pgId] || 1) * (1 + em.cfg.lift * 0.75 * decay);
          });
        }
      });

      var visitors = Math.max(0, Math.round(p.base * trend * season * week * evMult * (0.90 + 0.20 * r1)));

      var channels = {};
      CHANNEL_KEYS.forEach(function (c) {
        var drift = c === 'ai' ? 1 + p.aiDrift * tt : 1;
        channels[c] = (p.channels[c] || 0.01) * drift * (chBoost[c] || 1) * (0.92 + 0.16 * r2);
      });
      normalize(channels, CHANNEL_KEYS);

      var devices = {};
      DEVICE_KEYS.forEach(function (d) {
        devices[d] = (p.devices[d] || 0.02) * (0.94 + 0.12 * r3);
      });
      normalize(devices, DEVICE_KEYS);

      var citations = Math.max(0, Math.round(
        visitors * p.citationRate * (1 + p.citationDrift * tt) * (0.85 + 0.30 * r4) * (evMult > 1.15 ? 1.06 : 1)
      ));
      var leads = Math.max(0, Math.round(
        visitors * p.leadRate * (0.72 + 0.56 * r5) *
        (1 + 0.25 * Math.sin((2 * Math.PI * i) / 365 + p.seasonPhase))
      ));
      var visibility = clamp(
        p.visibilityStart + (p.visibilityEnd - p.visibilityStart) * tt +
        2.4 * Math.sin(i / 23 + p.seasonPhase) + (r6 - 0.5) * 2.2,
        20, 99
      );

      /* page distribution with daily jitter and event boosts */
      var raws = [];
      var rawSum = 0;
      for (var pi = 0; pi < p.pages.length; pi++) {
        var pg = p.pages[pi];
        var rr = rng('pg', p.id, i, pi)();
        var v = Math.max(0.01, pg.share * (0.78 + 0.44 * rr) * (pageBoost[pg.id] || 1));
        raws.push(v);
        rawSum += v;
      }

      var pages = [];
      for (var pi2 = 0; pi2 < p.pages.length; pi2++) {
        pages.push({
          id: p.pages[pi2].id,
          v: (visitors * raws[pi2]) / rawSum,
          c: 0,
          l: 0,
          s: 0
        });
      }

      var cw = 0, cweights = [];
      for (var ci = 0; ci < p.pages.length; ci++) {
        var cr = rng('cite', p.id, i, ci)();
        var w = pages[ci].v * p.pages[ci].cite * (0.8 + 0.4 * cr);
        cweights.push(w); cw += w;
      }
      var lw = 0, lweights = [];
      for (var li = 0; li < p.pages.length; li++) {
        var lr = rng('lead', p.id, i, li)();
        var wl = pages[li].v * p.pages[li].lead * (0.75 + 0.5 * lr);
        lweights.push(wl); lw += wl;
      }
      for (var si = 0; si < p.pages.length; si++) {
        pages[si].c = citations * (cweights[si] / (cw || 1));
        pages[si].l = leads * (lweights[si] / (lw || 1));
        pages[si].s = pages[si].v * p.pages[si].secs * (0.88 + 0.24 * rng('sec', p.id, i, si)());
      }

      var engines = {};
      var ew = 0;
      ENGINE_KEYS.forEach(function (key) {
        var drift = key === 'perplexity' ? 1 + 0.5 * tt : key === 'aioverviews' ? 1 + 0.35 * tt : key === 'gemini' ? 1 - 0.08 * tt : 1;
        var w = (p.engines[key] || 0.05) * drift * (0.95 + 0.1 * rng('eng', p.id, i, key)());
        engines[key] = w; ew += w;
      });
      ENGINE_KEYS.forEach(function (key) { engines[key] = (citations * engines[key]) / (ew || 1); });

      days.push({
        i: i,
        t: t,
        iso: new Date(t).toISOString().slice(0, 10),
        dow: dow,
        visitors: visitors,
        pageviews: Math.round(visitors * p.pv * (0.96 + 0.08 * r6)),
        channels: channels,
        devices: devices,
        citations: citations,
        leads: leads,
        visibility: visibility,
        pages: pages,
        engines: engines
      });
    }
    return days;
  }

  var dataset = {};
  PROPS.forEach(function (p) {
    dataset[p.id] = buildDays(p);
  });

  /* ---------- public API ---------- */
  window.TYSPACE = window.TYSPACE || {};
  window.TYSPACE.dimensions = {
    channels: CHANNELS,
    devices: DEVICES,
    engines: ENGINES,
    channelKeys: CHANNEL_KEYS,
    deviceKeys: DEVICE_KEYS,
    engineKeys: ENGINE_KEYS
  };
  window.TYSPACE.properties = PROPS;
  window.TYSPACE.data = dataset;
  window.TYSPACE.time = {
    DAY_MS: DAY_MS,
    N_DAYS: N_DAYS,
    START_MS: START_MS,
    END_MS: END_MS,
    startIso: new Date(START_MS).toISOString().slice(0, 10),
    endIso: new Date(END_MS).toISOString().slice(0, 10)
  };
  window.TYSPACE.getProp = function (id) {
    for (var i = 0; i < PROPS.length; i++) if (PROPS[i].id === id) return PROPS[i];
    return null;
  };
})();
