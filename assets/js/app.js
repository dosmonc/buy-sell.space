/* tyspace — dashboard application
   ------------------------------------------------------------------
   Reads window.TYSPACE (data.js), aggregates on every filter change and
   renders: KPI cards, a line/area trend chart, an HTML bar chart, two
   donut charts, an engine bar list and a sortable content table.
   No dependencies. Vanilla DOM + SVG.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var T = window.TYSPACE;
  if (!T) return;

  var DIMS = T.dimensions;
  var PROPS = T.properties;
  var DATA = T.data;
  var TIME = T.time;
  var CHANNELS = DIMS.channels;
  var DEVICES = DIMS.devices;
  var ENGINES = DIMS.engines;
  var CH_KEYS = DIMS.channelKeys;
  var DEV_KEYS = DIMS.deviceKeys;
  var ENG_KEYS = DIMS.engineKeys;

  var PROP_INITIALS = { rankops: 'RO', buysell: 'BS', fatherdust: 'FD' };
  var PROP_TOKEN = { rankops: '--s-ai', buysell: '--s-organic', fatherdust: '--s-social', all: '--accent' };
  var CHANNEL_TOKEN = { ai: '--s-ai', organic: '--s-organic', social: '--s-social', direct: '--s-direct', referral: '--s-referral' };
  var DEVICE_TOKEN = { mobile: '--s-ai', desktop: '--s-direct', tablet: '--s-referral' };
  var ENGINE_TOKEN = { gemini: '--s-ai', chatgpt: '--s-organic', perplexity: '--s-social', aioverviews: '--s-direct', claude: '--s-referral' };

  var METRICS = {
    visitors: { label: 'Visitors', unit: '', plural: 'visits' },
    citations: { label: 'AI citations', unit: '', plural: 'citations' },
    leads: { label: 'Leads', unit: '', plural: 'leads' },
    visibility: { label: 'Visibility score', unit: '/100', plural: 'score' }
  };

  var YTD_START = Math.round((Date.UTC(2026, 0, 1) - TIME.START_MS) / TIME.DAY_MS);

  /* ---------- helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round(n) { return Math.round(n); }

  var nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  function fmtInt(n) { return nf0.format(Math.round(n || 0)); }
  function fmtCompact(n) {
    n = Math.round(n || 0);
    if (Math.abs(n) >= 1e6) return nf1.format(n / 1e6).replace('.0', '') + 'M';
    if (Math.abs(n) >= 1e4) return nf1.format(n / 1e3).replace('.0', '') + 'k';
    if (Math.abs(n) >= 1e3) return nf1.format(n / 1e3) + 'k';
    return nf0.format(n);
  }
  function fmtPct(ratio, digits) {
    if (!isFinite(ratio)) return '—';
    return (ratio * 100).toFixed(digits == null ? 1 : digits) + '%';
  }
  function fmtSigned(ratio, digits) {
    if (!isFinite(ratio)) return '—';
    var s = (ratio * 100).toFixed(digits == null ? 1 : digits);
    return (ratio > 0 ? '+' : '') + s + '%';
  }
  function fmtDuration(secs) {
    if (!secs || !isFinite(secs)) return '0s';
    var m = Math.floor(secs / 60), s = Math.round(secs % 60);
    if (m === 0) return s + 's';
    return m + 'm ' + (s < 10 ? '0' : '') + s + 's';
  }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function isoToDate(iso) { var p = iso.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function fmtShort(iso) { var d = isoToDate(iso); return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate(); }
  function fmtLong(iso) { var d = isoToDate(iso); return DAYS[d.getUTCDay()] + ', ' + MONTHS_FULL[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear(); }
  function fmtShortYear(iso) { var d = isoToDate(iso); return MONTHS[d.getUTCMonth()] + " '" + String(d.getUTCFullYear()).slice(2); }
  function fmtRange(a, b) {
    var ya = isoToDate(a).getUTCFullYear(), yb = isoToDate(b).getUTCFullYear();
    if (ya !== yb) return fmtShort(a) + ', ' + ya + ' – ' + fmtShort(b) + ', ' + yb;
    return fmtShort(a) + ' – ' + fmtShort(b) + ', ' + yb;
  }
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function zeroKeys(keys) { var o = {}; keys.forEach(function (k) { o[k] = 0; }); return o; }

  /* ---------- state ---------- */
  var DEFAULT_STATE = {
    property: 'all',
    metric: 'visitors',
    barMetric: 'visitors',
    range: '30d',
    from: null,
    to: null,
    segment: 'all',
    device: 'all',
    engine: 'all',
    compare: true,
    search: '',
    sortKey: 'visitors',
    sortDir: 'desc',
    page: 1,
    pageSize: 8
  };
  var state = Object.assign({}, DEFAULT_STATE);

  function hashHasState(raw) {
    return /(^|&)(p|r|m|seg|dev|eng|sort)=/.test(raw);
  }

  function readHash() {
    var raw = (location.hash || '').replace(/^#/, '');
    if (!raw || !hashHasState(raw)) return;
    var q;
    try { q = new URLSearchParams(raw); } catch (e) { return; }
    function pick(key, valid) {
      var v = q.get(key);
      return v !== null && valid.indexOf(v) > -1 ? v : null;
    }
    var p = pick('p', ['all', 'rankops', 'buysell', 'fatherdust']);
    if (p) state.property = p;
    var m = pick('m', Object.keys(METRICS));
    if (m) state.metric = m;
    var bm = pick('bm', ['visitors', 'citations', 'leads']);
    if (bm) state.barMetric = bm;
    var r = pick('r', ['7d', '30d', '90d', '12m', 'ytd', 'all', 'custom']);
    if (r) state.range = r;
    if (q.get('from') && /^\d{4}-\d{2}-\d{2}$/.test(q.get('from')) && q.get('from') >= TIME.startIso && q.get('from') <= TIME.endIso) state.from = q.get('from');
    if (q.get('to') && /^\d{4}-\d{2}-\d{2}$/.test(q.get('to')) && q.get('to') >= TIME.startIso && q.get('to') <= TIME.endIso) state.to = q.get('to');
    if (state.range === 'custom' && (!state.from || !state.to)) state.range = '30d';
    var seg = pick('seg', CH_KEYS.concat(['all']));
    if (seg) state.segment = seg;
    var dev = pick('dev', DEV_KEYS.concat(['all']));
    if (dev) state.device = dev;
    var eng = pick('eng', ENG_KEYS.concat(['all']));
    if (eng) state.engine = eng;
    if (q.get('cmp') === '0') state.compare = false;
    if (q.get('q')) state.search = q.get('q').slice(0, 80);
    var sort = (q.get('sort') || '').split('.');
    if (sort.length === 2 && ['title', 'visitors', 'delta', 'citations', 'leads', 'secs', 'citeRate'].indexOf(sort[0]) > -1 && ['asc', 'desc'].indexOf(sort[1]) > -1) {
      state.sortKey = sort[0]; state.sortDir = sort[1];
    }
    if (q.get('rows') && ['6', '8', '12', '25'].indexOf(q.get('rows')) > -1) state.pageSize = parseInt(q.get('rows'), 10);
  }

  function writeHash() {
    var q = new URLSearchParams();
    q.set('p', state.property);
    q.set('m', state.metric);
    q.set('r', state.range);
    if (state.range === 'custom') { q.set('from', state.from); q.set('to', state.to); }
    if (state.segment !== 'all') q.set('seg', state.segment);
    if (state.device !== 'all') q.set('dev', state.device);
    if (state.engine !== 'all') q.set('eng', state.engine);
    if (!state.compare) q.set('cmp', '0');
    if (state.search) q.set('q', state.search);
    if (state.sortKey !== 'visitors' || state.sortDir !== 'desc') q.set('sort', state.sortKey + '.' + state.sortDir);
    if (state.pageSize !== 8) q.set('rows', String(state.pageSize));
    var next = '#' + q.toString();
    if (location.hash !== next) {
      try { history.replaceState(null, '', next); } catch (e) { location.hash = next; }
    }
  }

  /* ---------- date windows ---------- */
  function indexOfIso(iso) {
    return clamp(Math.round((isoToDate(iso).getTime() - TIME.START_MS) / TIME.DAY_MS), 0, TIME.N_DAYS - 1);
  }
  function getWindow() {
    var end = TIME.N_DAYS - 1, start, label;
    var len = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 }[state.range];
    if (state.range === 'all') {
      start = 0; label = 'All time';
    } else if (state.range === 'ytd') {
      start = YTD_START; label = 'Year to date';
    } else if (state.range === 'custom' && state.from && state.to) {
      var a = indexOfIso(state.from), b = indexOfIso(state.to);
      start = Math.min(a, b); end = Math.max(a, b);
      label = 'Custom range';
    } else {
      if (!len) len = 30;
      start = Math.max(0, end - len + 1);
      label = 'Last ' + (len === 365 ? '12 months' : len + ' days');
    }
    if (end - start < 0) start = end;
    return {
      start: start,
      end: end,
      len: end - start + 1,
      label: label,
      fromIso: DATA[PROPS[0].id][start].iso,
      toIso: DATA[PROPS[0].id][end].iso
    };
  }
  function getPrevWindow(win) {
    var prevEnd = win.start - 1;
    var prevStart = prevEnd - win.len + 1;
    if (prevStart < 0) return null;
    return { start: prevStart, end: prevEnd, len: win.len,
      fromIso: DATA[PROPS[0].id][prevStart].iso, toIso: DATA[PROPS[0].id][prevEnd].iso };
  }

  /* ---------- aggregation ---------- */
  function aggregate(opts) {
    var win = opts.win;
    var props = opts.property === 'all' ? PROPS : [T.getProp(opts.property)];
    var seg = opts.segment || 'all';
    var dev = opts.device || 'all';
    var eng = opts.engine || 'all';

    var out = {
      days: [],
      totals: { visitors: 0, citations: 0, leads: 0, pageviews: 0, secs: 0, visW: 0, visV: 0, visibility: 0 },
      channels: zeroKeys(CH_KEYS),
      devices: zeroKeys(DEV_KEYS),
      engines: zeroKeys(ENG_KEYS),
      pages: {}
    };

    var daySlots = [];
    for (var i = win.start; i <= win.end; i++) daySlots.push({ t: 0, iso: '', dow: 0, visitors: 0, citations: 0, leads: 0, visibility: 0, visW: 0 });

    props.forEach(function (prop) {
      var arr = DATA[prop.id];
      for (var d = win.start; d <= win.end; d++) {
        var day = arr[d];
        var slot = daySlots[d - win.start];
        var aiShare = day.channels.ai;
        var engShare = eng !== 'all' ? (day.engines[eng] || 0) / (day.citations || 1) : 1;
        var aiFactor = 1 - aiShare + aiShare * engShare;
        var devShare = dev !== 'all' ? day.devices[dev] : 1;
        var segShare = seg !== 'all' ? day.channels[seg] : 1;

        var v = day.visitors * devShare * segShare * aiFactor;
        var c = day.citations * devShare * segShare * (eng !== 'all' ? engShare : 1);
        var l = day.leads * devShare * segShare * aiFactor;

        slot.t = day.t; slot.iso = day.iso; slot.dow = day.dow;
        slot.visitors += v; slot.citations += c; slot.leads += l;
        slot.visW += day.visibility * v;

        out.totals.visitors += v;
        out.totals.citations += c;
        out.totals.leads += l;
        out.totals.pageviews += day.pageviews * devShare * segShare * aiFactor;
        out.totals.visW += day.visibility * v;
        out.totals.visV += v;

        CH_KEYS.forEach(function (k) {
          var val = day.channels[k] * day.visitors * devShare;
          if (k === 'ai') val *= engShare;
          out.channels[k] = (out.channels[k] || 0) + val;
        });
        DEV_KEYS.forEach(function (k) {
          out.devices[k] = (out.devices[k] || 0) + day.visitors * day.devices[k] * segShare * aiFactor;
        });
        ENG_KEYS.forEach(function (k) {
          out.engines[k] = (out.engines[k] || 0) + (day.engines[k] || 0) * devShare * segShare;
        });

        if (opts.withPages) {
          for (var p = 0; p < prop.pages.length; p++) {
            var pg = prop.pages[p];
            var dp = day.pages[p];
            var weight = seg !== 'all' ? prop._pageChannelNorm[seg][p] : 1;
            var key = prop.id + '::' + pg.id;
            var entry = out.pages[key];
            if (!entry) {
              entry = out.pages[key] = {
                key: key, propId: prop.id, propName: prop.name, domain: prop.domain,
                title: pg.title, path: pg.path, token: PROP_TOKEN[prop.id],
                visitors: 0, citations: 0, leads: 0, secs: 0
              };
            }
            var pv = dp.v * devShare * weight * aiFactor;
            entry.visitors += pv;
            entry.citations += dp.c * devShare * weight * (eng !== 'all' ? engShare : 1);
            entry.leads += dp.l * devShare * weight * aiFactor;
            entry.secs += dp.s * devShare * weight * aiFactor;
          }
        }
      }
    });

    daySlots.forEach(function (slot) {
      slot.visibility = slot.visitors > 0 ? slot.visW / slot.visitors : 0;
      out.days.push(slot);
    });

    out.totals.visibility = out.totals.visV > 0 ? out.totals.visW / out.totals.visV : 0;
    return out;
  }

  /* ---------- buckets for the bar chart ---------- */
  function makeBuckets(days) {
    var n = days.length;
    var mode = n <= 14 ? 'day' : n <= 120 ? 'week' : 'month';
    var buckets = [], map = {};
    days.forEach(function (d, i) {
      var date = new Date(d.t);
      var key, label;
      if (mode === 'day') {
        key = d.iso;
        label = fmtShort(d.iso);
      } else if (mode === 'week') {
        /* 7-day groups counted from the start of the window, so no partial buckets */
        key = 'w' + Math.floor(i / 7);
        label = fmtShort(d.iso);
      } else {
        key = d.iso.slice(0, 7);
        label = n > 400 ? fmtShortYear(d.iso) : MONTHS[date.getUTCMonth()];
      }
      if (!map[key]) {
        map[key] = { key: key, label: label, start: i, end: i, mode: mode, days: 0 };
        buckets.push(map[key]);
      }
      map[key].end = i;
      map[key].days++;
    });
    /* avoid duplicate month labels when the range spans years */
    if (mode === 'month') {
      var seen = {};
      buckets.forEach(function (b) { seen[b.label] = (seen[b.label] || 0) + 1; });
      buckets.forEach(function (b) { if (seen[b.label] > 1) b.label = fmtShortYear(b.start >= 0 ? days[b.start].iso : days[0].iso); });
    }
    return buckets;
  }

  /* ---------- number animation ---------- */
  function animateNumber(node, from, to, format) {
    if (!isFinite(from) || from === to) { node.textContent = format(to); return; }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.textContent = format(to); return;
    }
    var start = performance.now();
    var dur = 460;
    function step(now) {
      var p = clamp((now - start) / dur, 0, 1);
      var e = 1 - Math.pow(1 - p, 3);
      node.textContent = format(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- tooltip ---------- */
  var tipEl = $('#tooltip');
  function showTip(html, x, y) {
    tipEl.innerHTML = html;
    tipEl.classList.add('show');
    var w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    var left = clamp(x, w / 2 + 10, window.innerWidth - w / 2 - 10);
    var top = clamp(y, h + 18, window.innerHeight - 8);
    tipEl.style.left = left + 'px';
    tipEl.style.top = top + 'px';
  }
  function hideTip() { tipEl.classList.remove('show'); }

  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg><span>' + esc(msg) + '</span>';
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2400);
  }

  /* ---------- svg helpers ---------- */
  function niceMax(v) {
    if (!v || v <= 0) return 1;
    var exp = Math.pow(10, Math.floor(Math.log10(v)));
    var f = v / exp;
    var nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nf * exp;
  }
  /* pick a round step so every gridline lands on a readable number */
  function niceScale(maxValue, base, targetTicks) {
    var range = (maxValue - base) || 1;
    var raw = range / targetTicks;
    var exp = Math.pow(10, Math.floor(Math.log10(raw)));
    var f = raw / exp;
    var nf = f <= 1 ? 1 : f <= 1.5 ? 1.5 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    var step = nf * exp;
    var count = Math.max(1, Math.ceil(range / step));
    if (count > 8) { step = niceMax(range / targetTicks); count = Math.ceil(range / step); }
    return { step: step, top: base + step * count, count: count };
  }
  function smoothPath(pts, top, bottom) {
    if (pts.length === 0) return '';
    if (pts.length === 1) return 'M' + pts[0][0] + ' ' + pts[0][1];
    var d = 'M' + pts[0][0].toFixed(2) + ' ' + pts[0][1].toFixed(2);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i];
      var p1 = pts[i];
      var p2 = pts[i + 1];
      var p3 = pts[i + 2] || p2;
      var c1x = p1[0] + (p2[0] - p0[0]) / 6;
      var c1y = clamp(p1[1] + (p2[1] - p0[1]) / 6, top, bottom);
      var c2x = p2[0] - (p3[0] - p1[0]) / 6;
      var c2y = clamp(p2[1] - (p3[1] - p1[1]) / 6, top, bottom);
      d += 'C' + c1x.toFixed(2) + ' ' + c1y.toFixed(2) + ',' + c2x.toFixed(2) + ' ' + c2y.toFixed(2) + ',' + p2[0].toFixed(2) + ' ' + p2[1].toFixed(2);
    }
    return d;
  }
  function sparkline(values, token) {
    var w = 92, h = 34;
    if (!values || values.length < 2) values = [0, 0];
    var stride = Math.max(1, Math.ceil(values.length / 28));
    var pts = [];
    for (var i = 0; i < values.length; i += stride) pts.push(values[i]);
    if (pts[pts.length - 1] !== values[values.length - 1]) pts.push(values[values.length - 1]);
    var min = Math.min.apply(null, pts);
    var max = Math.max.apply(null, pts);
    var range = max - min || 1;
    var coords = pts.map(function (v, idx) {
      return [1 + (idx / (pts.length - 1)) * (w - 6), h - 3 - ((v - min) / range) * (h - 8)];
    });
    var line = smoothPath(coords, 1, h - 2);
    var area = line + 'L' + (w - 5).toFixed(2) + ' ' + h + 'L1 ' + h + 'Z';
    var last = coords[coords.length - 1];
    return '<svg class="spark" viewBox="0 0 92 34" preserveAspectRatio="none" aria-hidden="true" style="--tok:var(' + token + ')">' +
      '<path class="area" d="' + area + '"></path>' +
      '<path class="line" d="' + line + '" vector-effect="non-scaling-stroke"></path>' +
      '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="2" vector-effect="non-scaling-stroke"></circle>' +
      '</svg>';
  }
  function deltaChip(change, isPoints) {
    var dir = change > 0.0005 ? 'up' : change < -0.0005 ? 'down' : 'flat';
    var arrow = dir === 'up'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>'
      : dir === 'down'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7l10 10M17 9v8H9"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>';
    var text = isPoints
      ? (change > 0 ? '+' : '') + change.toFixed(1) + ' pts'
      : fmtSigned(change);
    return '<span class="kpi-delta ' + dir + '">' + arrow + text + '</span>';
  }
  function legendKey(label, token, style) {
    return '<span class="legend-key' + (style ? ' ' + style : '') + '"><i style="--tok:var(' + token + ')"></i>' + esc(label) + '</span>';
  }

  /* ============================================================
     SIDEBAR / META
     ============================================================ */
  function renderProps(view) {
    var host = $('#propList');
    var rows = [{ id: 'all', name: 'All properties', domain: '3 sites combined' }].concat(PROPS.map(function (p) {
      return { id: p.id, name: p.name, domain: p.domain };
    }));
    host.innerHTML = rows.map(function (row) {
      var total = 0;
      if (row.id === 'all') {
        total = view.byProp.reduce(function (s, p) { return s + p.visitors; }, 0);
      } else {
        var match = view.byProp.filter(function (p) { return p.id === row.id; })[0];
        total = match ? match.visitors : 0;
      }
      return '<li><button class="prop-item' + (row.id === 'all' ? ' all' : '') + '" type="button" data-property="' + row.id + '"' +
        ' aria-current="' + (state.property === row.id) + '">' +
        '<span class="prop-dot" style="--tok:var(' + (PROP_TOKEN[row.id] || '--accent') + ')"></span>' +
        '<span class="prop-name">' + esc(row.name) + '<small>' + esc(row.domain) + '</small></span>' +
        '<span class="prop-val">' + fmtCompact(total) + '</span>' +
        '</button></li>';
    }).join('');
  }

  function renderMeta(win, prevWin) {
    var prop = state.property === 'all' ? null : T.getProp(state.property);
    var title = prop ? prop.name + ' — overview' : 'Overview — all properties';
    $('#pageTitle').textContent = title;
    $('#pageSub').textContent = prop ? prop.domain + ' · ' + prop.kind : 'rankops.net · buy-sell.land · fatherdust.com';
    $('#introEyebrow').textContent = 'tyspace / ' + (prop ? prop.domain : 'portfolio');

    var heading, copy;
    if (!prop) {
      heading = 'Every property, <span class="accent">one live read</span>.';
      copy = 'Traffic, AI citations and leads across the RankOps agency site, the North Carolina land company and the Father Dust label — filtered together, updated together.';
    } else if (prop.id === 'rankops') {
      heading = 'The agency site, <span class="accent">in numbers</span>.';
      copy = 'Which GEO pages AI assistants actually cite, where the free visibility maps come from, and which content turns into retainer conversations.';
    } else if (prop.id === 'buysell') {
      heading = 'Land sellers, <span class="accent">end to end</span>.';
      copy = 'Cash-offer and county pages, AI answers about selling land in North Carolina, and how many landowners get as far as a written offer request.';
    } else {
      heading = 'The label, <span class="accent">the artist, the noise</span>.';
      copy = 'Drop-day spikes, horrorcore search demand, D3FFM3FFR3CORDZ submission interest and the AI answers that name Father Dust.';
    }
    $('#introHeading').innerHTML = heading;
    $('#introCopy').textContent = copy;
    $('#metaRange').textContent = fmtRange(win.fromIso, win.toIso);
    $('#metaScope').textContent = prop ? prop.name : 'All properties';
    $('#metaUpdated').textContent = fmtShort(TIME.endIso) + ' · demo snapshot';
    document.title = (prop ? prop.name : 'tyspace') + ' — analytics workspace';
    return prevWin;
  }

  /* ============================================================
     CONTROLS
     ============================================================ */
  function renderControls(win, prevWin) {
    $$('#rangePresets .seg').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.range === state.range));
    });
    var from = $('#dateFrom'), to = $('#dateTo');
    from.value = win.fromIso;
    to.value = win.toIso;
    from.max = TIME.endIso; to.max = TIME.endIso;
    from.min = TIME.startIso; to.min = TIME.startIso;
    $('#compareBtn').setAttribute('aria-pressed', String(state.compare));
    $('#compareBtn').disabled = !prevWin;
    $('#compareBtn').title = prevWin
      ? 'Overlay ' + fmtRange(prevWin.fromIso, prevWin.toIso)
      : 'No earlier data in the demo dataset to compare against';

    $('#fSegment').value = state.segment;
    $('#fDevice').value = state.device;
    $('#fEngine').value = state.engine;
    $('#tableSearch').value = state.search;
    $('#pageSize').value = String(state.pageSize);
    $$('#metricTabs button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.metric === state.metric)); });
    $$('#barMetricTabs button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.metric === state.barMetric)); });
  }

  function renderChips(win, prevWin) {
    var host = $('#activeFilters');
    var chips = [];
    var propName = state.property === 'all' ? 'All properties' : T.getProp(state.property).name;
    chips.push({ label: propName, kind: 'property' });
    chips.push({ label: fmtRange(win.fromIso, win.toIso), kind: 'range' });
    if (state.segment !== 'all') chips.push({ label: 'Segment: ' + channelName(state.segment), kind: 'segment' });
    if (state.device !== 'all') chips.push({ label: 'Device: ' + deviceName(state.device), kind: 'device' });
    if (state.engine !== 'all') chips.push({ label: 'AI source: ' + engineName(state.engine), kind: 'engine' });
    if (state.compare && prevWin) chips.push({ label: 'vs ' + fmtRange(prevWin.fromIso, prevWin.toIso), kind: 'compare' });
    if (state.search) chips.push({ label: 'Search: “' + state.search + '”', kind: 'search' });

    var anyCleared = state.segment !== 'all' || state.device !== 'all' || state.engine !== 'all' || state.search;
    host.innerHTML = chips.map(function (c) {
      var removable = ['segment', 'device', 'engine', 'search', 'compare'].indexOf(c.kind) > -1;
      return '<span class="chip">' + esc(c.label) +
        (removable ? '<button type="button" data-clear="' + c.kind + '" aria-label="Remove ' + esc(c.label) + ' filter">×</button>' : '') +
        '</span>';
    }).join('') + (anyCleared ? '<button class="btn ghost" type="button" id="clearInline" style="padding:3px 8px;font-size:11px">Clear filters</button>' : '');
  }
  function channelName(key) { var m = CHANNELS.filter(function (c) { return c.key === key; })[0]; return m ? m.name : key; }
  function deviceName(key) { var m = DEVICES.filter(function (c) { return c.key === key; })[0]; return m ? m.name : key; }
  function engineName(key) { var m = ENGINES.filter(function (c) { return c.key === key; })[0]; return m ? m.name : key; }

  /* ============================================================
     KPI CARDS
     ============================================================ */
  function metricValue(day, metric) {
    if (metric === 'visibility') return day.visibility;
    return day[metric];
  }

  function renderKpis(view) {
    var host = $('#kpis');
    var agg = view.agg, prev = view.prevAgg;
    var cards = [
      { metric: 'visitors', label: 'Unique visitors', token: '--accent', help: 'Human sessions across the selected scope. AI-answer visits are tagged from referrer and UTM signals.' },
      { metric: 'citations', label: 'AI citations', token: '--s-ai', help: 'Times an AI engine named the site by name in an answer. This is the count, not a share of prompts.' },
      { metric: 'leads', label: 'Leads & requests', token: '--s-organic', help: 'Form submissions, cash-offer estimates and submissions the label actually receives.' },
      { metric: 'visibility', label: 'AI visibility score', token: '--s-direct', help: 'Weighted average of the site\'s AI visibility score across the window (0–100 rubric).' }
    ];

    host.innerHTML = cards.map(function (card) {
      var isScore = card.metric === 'visibility';
      var value = isScore ? agg.totals.visibility : agg.totals[card.metric];
      var prevValue = prev ? (isScore ? prev.totals.visibility : prev.totals[card.metric]) : null;
      var change = prevValue ? (isScore ? value - prevValue : (value - prevValue) / prevValue) : null;
      var series = agg.days.map(function (d) { return metricValue(d, card.metric); });
      var deltaHtml = prevValue === null || prevValue === undefined
        ? '<span class="kpi-delta flat">no prior</span>'
        : deltaChip(change, isScore);
      var caption = prevValue === null || prevValue === undefined
        ? 'first ' + view.win.len + ' days of the dataset'
        : 'vs previous ' + view.win.len + ' days';
      return '<button class="kpi" type="button" data-metric="' + card.metric + '" aria-pressed="' + (state.metric === card.metric) + '" style="--tok:var(' + card.token + ')" title="' + esc(card.help) + '">' +
        '<span class="kpi-head">' +
          '<span class="kpi-label"><i></i>' + esc(card.label) + '</span>' +
          '<span class="kpi-info" aria-hidden="true">i</span>' +
        '</span>' +
        '<span class="kpi-value" data-fmt="' + card.metric + '" data-value="' + value + '">' +
          (isScore ? value.toFixed(1) : fmtInt(value)) +
          (isScore ? '<span class="unit">/100</span>' : '') +
        '</span>' +
        '<span class="kpi-foot">' +
          '<span style="display:grid;gap:5px;min-width:0">' + deltaHtml +
            '<span class="kpi-caption">' + esc(caption) + '</span>' +
          '</span>' +
          sparkline(series, card.token) +
        '</span>' +
      '</button>';
    }).join('');

    /* count-up from the previous render */
    $$('.kpi-value', host).forEach(function (node) {
      var metric = node.dataset.fmt;
      var next = parseFloat(node.dataset.value);
      var key = 'count' + metric;
      var from = typeof host[key] === 'number' ? host[key] : next * 0.965;
      host[key] = next;
      var isScore = metric === 'visibility';
      var unit = node.querySelector('.unit');
      if (!unit) {
        unit = document.createElement('span');
        unit.className = 'unit';
      }
      unit.textContent = '/100';
      animateNumber(node, from, next, function (v) {
        return isScore ? v.toFixed(1) : fmtInt(v);
      });
      if (isScore) node.appendChild(unit);
    });
  }

  /* ============================================================
     TREND CHART
     ============================================================ */
  function renderTrend(view) {
    var host = $('#trendChart');
    var days = view.agg.days;
    var metric = state.metric;
    var values = days.map(function (d) { return metricValue(d, metric); });
    var prevDays = view.prevAgg ? view.prevAgg.days : null;
    var prevValues = prevDays ? prevDays.map(function (d) { return metricValue(d, metric); }) : null;
    var showPrev = state.compare && prevValues && prevValues.length === values.length;

    $('#trendTag').textContent = METRICS[metric].label.toLowerCase();
    $('#trendSub').textContent = (metric === 'visibility' ? 'Daily visibility score (0–100)' : 'Daily ' + METRICS[metric].plural) +
      ' · ' + fmtRange(view.win.fromIso, view.win.toIso);

    $('#trendLegend').innerHTML =
      legendKey(METRICS[metric].label, metric === 'citations' ? '--s-ai' : metric === 'leads' ? '--s-organic' : metric === 'visibility' ? '--s-direct' : '--accent', 'line') +
      (showPrev ? legendKey('Previous period', '--s-neutral', 'line dashed') : '') +
      '<span style="margin-left:auto;font-size:10.5px;color:var(--faint);font-family:var(--font-mono)">' +
      (metric === 'visibility'
        ? (values.reduce(function (s, v) { return s + v; }, 0) / (values.length || 1)).toFixed(1) + ' avg'
        : fmtInt(values.reduce(function (s, v) { return s + v; }, 0)) + ' total') + '</span>';

    if (!values.length || host.clientWidth === 0) { host.innerHTML = ''; return; }

    var w = host.clientWidth;
    var h = w < 540 ? 208 : 272;
    var pad = { t: 16, r: 10, b: 26, l: w < 540 ? 30 : 40 };
    var plotW = w - pad.l - pad.r;
    var plotH = h - pad.t - pad.b;
    var allValues = showPrev ? values.concat(prevValues) : values;
    var maxV = Math.max.apply(null, allValues);
    var minV = metric === 'visibility' ? Math.max(0, Math.min.apply(null, allValues) - 5) : 0;
    var base = metric === 'visibility' ? Math.floor(minV / 5) * 5 : 0;
    var scale = niceScale(maxV * 1.02, base, w < 540 ? 4 : 5);
    var top = Math.max(scale.top, maxV || 1);
    function yOf(v) { return pad.t + plotH * (1 - (v - base) / ((top - base) || 1)); }
    function xOf(i) { return values.length === 1 ? pad.l + plotW / 2 : pad.l + (i / (values.length - 1)) * plotW; }

    var pts = values.map(function (v, i) { return [xOf(i), yOf(v)]; });
    var prevPts = showPrev ? prevValues.map(function (v, i) { return [xOf(i), yOf(v)]; }) : null;

    /* y grid + labels */
    var ticks = scale.count, gridHtml = '', yLabels = '';
    for (var g = 0; g <= ticks; g++) {
      var val = base + (top - base) * (g / ticks);
      var y = yOf(val);
      gridHtml += '<line class="grid-line' + (g === 0 ? ' zero' : '') + '" x1="' + pad.l + '" x2="' + (w - pad.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"></line>';
      yLabels += '<text class="axis-label y" x="' + (pad.l - 7) + '" y="' + (y + 3.2).toFixed(1) + '">' +
        (metric === 'visibility' ? Math.round(val) : fmtCompact(val)) + '</text>';
    }

    /* x labels */
    var maxLabels = w < 540 ? 4 : w < 820 ? 5 : 7;
    var step = Math.max(1, Math.ceil(values.length / maxLabels));
    var xLabels = '';
    for (var xi = 0; xi < values.length; xi += step) {
      var iso = days[xi].iso;
      var label = view.win.len > 200 ? fmtShortYear(iso) : fmtShort(iso);
      var anchor = xi === 0 ? 'start' : 'middle';
      if (xi === 0 && values.length > 6) anchor = 'start';
      xLabels += '<text class="axis-label" x="' + xOf(xi).toFixed(1) + '" y="' + (h - 6) + '" text-anchor="' + anchor + '">' + esc(label) + '</text>';
    }

    var lineColor = metric === 'citations' ? cssVar('--s-ai') : metric === 'leads' ? cssVar('--s-organic') : metric === 'visibility' ? cssVar('--s-direct') : cssVar('--accent');
    var linePath = smoothPath(pts, pad.t, pad.t + plotH);
    var areaPath = linePath + 'L' + pts[pts.length - 1][0].toFixed(2) + ' ' + (pad.t + plotH) + 'L' + pts[0][0].toFixed(2) + ' ' + (pad.t + plotH) + 'Z';
    var prevPath = prevPts ? smoothPath(prevPts, pad.t, pad.t + plotH) : '';
    var gradId = 'grad-trend';

    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' +
      esc(METRICS[metric].label + ' from ' + fmtShort(view.win.fromIso) + ' to ' + fmtShort(view.win.toIso)) + '">' +
      '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + lineColor + '" stop-opacity="0.34"></stop>' +
        '<stop offset="70%" stop-color="' + lineColor + '" stop-opacity="0.05"></stop>' +
        '<stop offset="100%" stop-color="' + lineColor + '" stop-opacity="0"></stop>' +
      '</linearGradient></defs>' +
      gridHtml + yLabels + xLabels +
      (prevPath ? '<path class="series-line prev" d="' + prevPath + '" style="stroke:' + cssVar('--s-neutral') + '"></path>' : '') +
      '<path d="' + areaPath + '" fill="url(#' + gradId + ')"></path>' +
      '<path class="trend-line" d="' + linePath + '" style="fill:none;stroke:' + lineColor + ';stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round"></path>' +
      '<circle cx="' + pts[pts.length - 1][0].toFixed(1) + '" cy="' + pts[pts.length - 1][1].toFixed(1) + '" r="3.4" style="fill:' + lineColor + ';stroke:var(--panel);stroke-width:2"></circle>' +
      '<g class="hover-g" style="opacity:0">' +
        '<line class="hover-line" x1="0" x2="0" y1="' + pad.t + '" y2="' + (pad.t + plotH) + '"></line>' +
        '<circle class="hover-dot" r="4.5" cx="0" cy="0" style="fill:' + lineColor + '"></circle>' +
      '</g>' +
      '<rect class="hit" x="' + pad.l + '" y="' + pad.t + '" width="' + plotW + '" height="' + plotH + '" fill="transparent" pointer-events="all" style="cursor:crosshair"></rect>' +
      '</svg>';

    host.innerHTML = svg;
    var svgEl = host.querySelector('svg');
    var hoverG = svgEl.querySelector('.hover-g');
    var hLine = hoverG.querySelector('.hover-line');
    var hDot = hoverG.querySelector('.hover-dot');
    var hit = svgEl.querySelector('.hit');
    var activeIndex = values.length - 1;

    /* draw-in animation for the main line */
    var lineEl = svgEl.querySelector('.trend-line');
    if (lineEl && lineEl.getTotalLength) {
      try {
        var len = lineEl.getTotalLength();
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          lineEl.style.strokeDasharray = len;
          lineEl.style.strokeDashoffset = len;
          lineEl.style.transition = 'stroke-dashoffset .75s cubic-bezier(.22,.61,.36,1)';
          requestAnimationFrame(function () { lineEl.style.strokeDashoffset = 0; });
        }
      } catch (e) { /* older engines: no draw-in */ }
    }

    var fmtVal = function (v) { return metric === 'visibility' ? v.toFixed(1) : fmtInt(v); };

    function tipHtml(i) {
      var d = days[i];
      var html = '<div class="tt-head"><span>' + esc(fmtShort(d.iso)) + '</span><span>' + DAYS[d.dow] + '</span></div>';
      html += '<div class="tt-row"><i style="background:' + lineColor + '"></i><span>' + esc(METRICS[metric].label) + '</span><b>' + fmtVal(values[i]) + '</b></div>';
      if (showPrev) {
        var pv = prevValues[i];
        var diff = values[i] - pv;
        html += '<div class="tt-row"><i style="background:' + cssVar('--s-neutral') + '"></i><span>Previous</span><b>' + fmtVal(pv) + '</b></div>';
        html += '<div class="tt-total"><span>Change</span><b>' +
          (metric === 'visibility' ? (diff > 0 ? '+' : '') + diff.toFixed(1) + ' pts' : pv ? fmtSigned(diff / pv) : '—') + '</b></div>';
      }
      return html;
    }

    function moveTo(i, clientX, clientY) {
      activeIndex = clamp(i, 0, values.length - 1);
      var x = xOf(activeIndex), y = yOf(values[activeIndex]);
      hoverG.style.opacity = 1;
      hLine.setAttribute('x1', x); hLine.setAttribute('x2', x);
      hDot.setAttribute('cx', x); hDot.setAttribute('cy', y);
      var rect = svgEl.getBoundingClientRect();
      var scaleX = rect.width / w, scaleY = rect.height / h;
      var px = clientX != null ? clientX : rect.left + x * scaleX;
      var py = clientY != null ? clientY : rect.top + y * scaleY;
      showTip(tipHtml(activeIndex), px, py);
    }

    hit.addEventListener('pointermove', function (e) {
      var rect = svgEl.getBoundingClientRect();
      var relX = ((e.clientX - rect.left) / rect.width) * w;
      var ratio = values.length === 1 ? 0 : (relX - pad.l) / plotW;
      moveTo(Math.round(ratio * (values.length - 1)), e.clientX, e.clientY);
    });
    hit.addEventListener('pointerleave', function () {
      hoverG.style.opacity = 0;
      hideTip();
    });
    svgEl.setAttribute('tabindex', '0');
    svgEl.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        moveTo(activeIndex + (e.key === 'ArrowRight' ? 1 : -1));
      } else if (e.key === 'Escape') {
        hoverG.style.opacity = 0; hideTip();
      }
    });
    svgEl.addEventListener('blur', function () { hoverG.style.opacity = 0; hideTip(); });
  }

  /* ============================================================
     DONUTS
     ============================================================ */
  function renderDonut(hostEl, legendEl, items, opts) {
    var total = items.reduce(function (s, i) { return s + Math.max(0, i.value); }, 0) || 1;
    var activeKey = opts.activeKey;
    var r = 48, cx = 60, cy = 60, C = 2 * Math.PI * r;
    var offset = 0;
    var arcs = items.map(function (item) {
      var frac = Math.max(0, item.value) / total;
      var len = Math.max(0, frac * C - (items.length > 1 ? 2.2 : 0));
      var dim = activeKey && activeKey !== 'all' && activeKey !== item.key;
      var arc = '<circle class="arc" cx="' + cx + '" cy="' + cy + '" r="' + r + '"' +
        ' stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '"' +
        ' stroke-dashoffset="' + (-offset).toFixed(2) + '"' +
        ' style="stroke:var(' + item.token + ');' + (dim ? 'opacity:.18;' : '') + (opts.clickable ? 'cursor:pointer' : '') + '"' +
        ' data-key="' + esc(item.key) + '"></circle>';
      offset += frac * C;
      return arc;
    }).join('');

    var centerValue = opts.centerValue != null ? opts.centerValue : fmtCompact(total);
    hostEl.innerHTML = '<svg viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" style="stroke:var(--panel-2)" stroke-width="11"></circle>' +
      arcs + '</svg>' +
      '<div class="donut-center"><span class="dc-val">' + esc(centerValue) + '</span><span class="dc-label">' + esc(opts.centerLabel || 'total') + '</span></div>';
    hostEl.setAttribute('role', 'img');
    hostEl.setAttribute('aria-label', items.map(function (i) { return i.name + ' ' + fmtPct(i.value / total); }).join(', '));

    legendEl.innerHTML = items.map(function (item) {
      var dim = activeKey && activeKey !== 'all' && activeKey !== item.key;
      return '<button class="dl-row" type="button" data-key="' + esc(item.key) + '"' + (dim ? ' style="opacity:.5"' : '') + '>' +
        '<i style="--tok:var(' + item.token + ')"></i>' +
        '<span class="dl-name">' + esc(item.name) + '</span>' +
        '<span class="dl-val">' + fmtCompact(item.value) + '</span>' +
        '<span class="dl-pct">' + fmtPct(item.value / total) + '</span>' +
        '</button>';
    }).join('');

    /* interactions */
    $$('[data-key]', hostEl).concat($$('.dl-row', legendEl)).forEach(function (node) {
      var key = node.dataset.key;
      var item = items.filter(function (i) { return i.key === key; })[0];
      if (!item) return;
      node.addEventListener('pointerenter', function (e) {
        var rect = node.getBoundingClientRect();
        showTip('<div class="tt-head"><span>' + esc(item.name) + '</span></div>' +
          '<div class="tt-row"><i style="background:var(' + item.token + ')"></i><span>' + esc(opts.unit || 'count') + '</span><b>' + fmtInt(item.value) + '</b></div>' +
          '<div class="tt-total"><span>' + esc(opts.shareLabel || 'Share') + '</span><b>' + fmtPct(item.value / total) + '</b></div>',
          e.clientX || rect.left + rect.width / 2, e.clientY || rect.top);
      });
      node.addEventListener('pointerleave', hideTip);
      if (opts.clickable) {
        node.addEventListener('click', function () { opts.onSelect(key); });
      }
    });
  }

  function renderChannelDonut(view) {
    var facet = view.channelFacet;
    var items = CHANNELS.map(function (c) {
      return { key: c.key, name: c.name, value: facet.channels[c.key] || 0, token: CHANNEL_TOKEN[c.key] };
    }).sort(function (a, b) { return b.value - a.value; });
    var total = items.reduce(function (s, i) { return s + i.value; }, 0);
    $('#channelSub').textContent = 'Share of visits · click a slice to filter';
    var selected = state.segment;
    var centerValue = selected !== 'all'
      ? fmtPct((items.filter(function (i) { return i.key === selected; })[0] || { value: 0 }).value / (total || 1))
      : fmtCompact(total);
    renderDonut($('#channelDonut'), $('#channelLegend'), items, {
      activeKey: selected,
      clickable: true,
      unit: 'visits',
      centerValue: centerValue,
      centerLabel: selected !== 'all' ? channelName(selected) : 'visits',
      onSelect: function (key) { state.segment = state.segment === key ? 'all' : key; state.page = 1; render(); }
    });
  }

  function renderDeviceDonut(view) {
    var facet = view.deviceFacet;
    var items = DEVICES.map(function (d) {
      return { key: d.key, name: d.name, value: facet.devices[d.key] || 0, token: DEVICE_TOKEN[d.key] };
    }).sort(function (a, b) { return b.value - a.value; });
    var total = items.reduce(function (s, i) { return s + i.value; }, 0);
    renderDonut($('#deviceDonut'), $('#deviceLegend'), items, {
      activeKey: state.device,
      clickable: true,
      unit: 'visits',
      centerValue: state.device !== 'all'
        ? fmtPct((items.filter(function (i) { return i.key === state.device; })[0] || { value: 0 }).value / (total || 1))
        : fmtCompact(total),
      centerLabel: state.device !== 'all' ? deviceName(state.device) : 'visits',
      onSelect: function (key) { state.device = state.device === key ? 'all' : key; state.page = 1; render(); }
    });
  }

  /* ============================================================
     BAR CHART (volume by period)
     ============================================================ */
  function renderBars(view) {
    var host = $('#barsChart');
    var metric = state.barMetric;
    var days = view.agg.days;
    var prevDays = view.prevAgg ? view.prevAgg.days : null;
    var buckets = makeBuckets(days);
    var prevBuckets = prevDays && prevDays.length === days.length ? makeBuckets(prevDays) : null;
    var showPrev = state.compare && !!prevBuckets;

    var rows = buckets.map(function (b, i) {
      var sum = 0;
      for (var d = b.start; d <= b.end; d++) sum += metricValue(days[d], metric);
      var prevSum = null;
      if (showPrev && prevBuckets[i]) {
        prevSum = 0;
        for (var p = prevBuckets[i].start; p <= prevBuckets[i].end; p++) prevSum += metricValue(prevDays[p], metric);
      }
      return { label: b.label, value: sum, prev: prevSum, mode: b.mode, days: b.days, startIso: days[b.start].iso, endIso: days[b.end].iso };
    });

    var max = Math.max.apply(null, rows.map(function (r) { return Math.max(r.value, r.prev || 0); }).concat([1]));
    var barMode = rows[0] ? rows[0].mode : 'day';
    $('#barsSub').textContent = METRICS[metric].label + (barMode === 'day' ? ' per day' : barMode === 'week' ? ' in 7-day blocks' : ' per month');
    $('#barsLegend').innerHTML = legendKey(METRICS[metric].label, metric === 'citations' ? '--s-ai' : metric === 'leads' ? '--s-organic' : '--accent') +
      (showPrev ? legendKey('Previous period', '--s-neutral') : '');

    host.innerHTML = rows.map(function (r, i) {
      var pct = (r.value / max) * 100;
      var prevPct = r.prev != null ? (r.prev / max) * 100 : 0;
      return '<div class="bar-col' + (r.mode === 'month' ? ' monthly' : '') + '" data-i="' + i + '">' +
        '<div class="bar-track">' +
          (showPrev ? '<div class="bar-fill prev" style="height:' + prevPct.toFixed(1) + '%"></div>' : '') +
          '<div class="bar-fill" style="height:' + pct.toFixed(1) + '%;--tok:var(' + (metric === 'citations' ? '--s-ai' : metric === 'leads' ? '--s-organic' : '--accent') + ')"></div>' +
        '</div>' +
        '<span class="bar-xlabel">' + esc(r.label) + '</span>' +
        '<button class="bar-hit" type="button" aria-label="' + esc(r.label + ': ' + fmtInt(r.value)) + '"></button>' +
      '</div>';
    }).join('');

    $$('.bar-col', host).forEach(function (col, i) {
      var row = rows[i];
      var hit = col.querySelector('.bar-hit');
      hit.addEventListener('pointerenter', function (e) {
        var head = row.mode === 'day' ? esc(row.label) : esc(fmtShort(row.startIso) + ' – ' + fmtShort(row.endIso));
        var meta = row.mode === 'day' ? '' : row.days + (row.days === 1 ? ' day' : ' days');
        var html = '<div class="tt-head"><span>' + head + '</span><span>' + meta + '</span></div>' +
          '<div class="tt-row"><i style="background:var(' + (metric === 'citations' ? '--s-ai' : metric === 'leads' ? '--s-organic' : '--accent') + ')"></i><span>' + esc(METRICS[metric].label) + '</span><b>' + fmtInt(row.value) + '</b></div>';
        if (row.prev != null) {
          html += '<div class="tt-row"><i style="background:var(--s-neutral)"></i><span>Previous</span><b>' + fmtInt(row.prev) + '</b></div>';
          html += '<div class="tt-total"><span>Change</span><b>' + (row.prev ? fmtSigned((row.value - row.prev) / row.prev) : '—') + '</b></div>';
        }
        showTip(html, e.clientX, e.clientY);
      });
      hit.addEventListener('pointermove', function (e) {
        tipEl.style.left = clamp(e.clientX, tipEl.offsetWidth / 2 + 10, window.innerWidth - tipEl.offsetWidth / 2 - 10) + 'px';
      });
      hit.addEventListener('pointerleave', hideTip);
    });
  }

  /* ============================================================
     ENGINE BARS
     ============================================================ */
  function renderEngines(view) {
    var host = $('#engineBars');
    var facet = view.engineFacet;
    var items = ENGINES.map(function (e) {
      return { key: e.key, name: e.name, value: facet.engines[e.key] || 0, token: ENGINE_TOKEN[e.key] };
    }).sort(function (a, b) { return b.value - a.value; });
    var total = items.reduce(function (s, i) { return s + i.value; }, 0) || 1;
    var max = Math.max.apply(null, items.map(function (i) { return i.value; }).concat([1]));
    $('#engineSub').textContent = fmtInt(total) + ' citations · click to filter';

    host.innerHTML = items.map(function (item) {
      var dim = state.engine !== 'all' && state.engine !== item.key;
      return '<button class="hbar-row" type="button" data-key="' + item.key + '" aria-pressed="' + (state.engine === item.key) + '"' + (dim ? ' style="opacity:.42"' : '') + '>' +
        '<span class="hbar-label" style="--tok:var(' + item.token + ')"><i></i><span>' + esc(item.name) + '</span></span>' +
        '<span class="hbar-track"><span class="hbar-fill" style="width:' + ((item.value / max) * 100).toFixed(1) + '%;--tok:var(' + item.token + ')"></span></span>' +
        '<span class="hbar-val">' + fmtInt(item.value) + ' <span class="hbar-pct">' + fmtPct(item.value / total, 0) + '</span></span>' +
        '</button>';
    }).join('');

    $$('.hbar-row', host).forEach(function (row) {
      var item = items.filter(function (i) { return i.key === row.dataset.key; })[0];
      row.addEventListener('pointerenter', function (e) {
        showTip('<div class="tt-head"><span>' + esc(item.name) + '</span></div>' +
          '<div class="tt-row"><i style="background:var(' + item.token + ')"></i><span>Citations</span><b>' + fmtInt(item.value) + '</b></div>' +
          '<div class="tt-total"><span>Share of AI citations</span><b>' + fmtPct(item.value / total) + '</b></div>', e.clientX, e.clientY);
      });
      row.addEventListener('pointerleave', hideTip);
      row.addEventListener('click', function () {
        state.engine = state.engine === item.key ? 'all' : item.key;
        state.page = 1;
        render();
      });
    });
  }

  /* ============================================================
     INSIGHTS
     ============================================================ */
  function renderInsights(view) {
    var host = $('#insights');
    var agg = view.agg, prev = view.prevAgg;
    var cards = [];

    /* 1 — dominant channel */
    var chItems = CHANNELS.map(function (c) {
      return { name: c.name, value: agg.channels[c.key] || 0 };
    }).sort(function (a, b) { return b.value - a.value; });
    var chTotal = chItems.reduce(function (s, i) { return s + i.value; }, 0) || 1;
    var topCh = chItems[0];
    var aiShare = (agg.channels.ai || 0) / (agg.totals.visitors || 1);
    cards.push({
      icon: '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M12 3v9h9a9 9 0 0 0-9-9z"/>',
      title: topCh.name + ' leads with ' + fmtPct(topCh.value / chTotal, 0) + ' of visits',
      body: 'AI answers supply <b>' + fmtPct(aiShare, 1) + '</b> of the traffic in this window and <b>' +
        fmtInt(agg.totals.citations) + '</b> named citations across <b>' + fmtInt(agg.totals.visitors) + '</b> visits.'
    });

    /* 2 — peak day */
    var peak = agg.days.reduce(function (best, d) { return d.visitors > best.visitors ? d : best; }, agg.days[0] || { visitors: 0, iso: TIME.endIso, dow: 0 });
    var avg = agg.totals.visitors / (agg.days.length || 1);
    cards.push({
      icon: '<path d="M3 17l5-6 4 3 5-8 4 5"/><path d="M3 21h18"/>',
      title: 'Peak day: ' + fmtShort(peak.iso) + ' at ' + fmtInt(peak.visitors) + ' visits',
      body: 'That is <b>' + (avg ? ((peak.visitors / avg - 1) * 100).toFixed(0) : '0') + '%</b> above the daily average of <b>' +
        fmtInt(avg) + '</b>. Traffic per day is <b>' + (prev ? fmtSigned((agg.totals.visitors / (agg.days.length || 1)) / (prev.totals.visitors / (prev.days.length || 1)) - 1) : '—') + '</b> on the previous period.'
    });

    /* 3 — fastest growing page */
    var growth = null;
    if (prev) {
      Object.keys(agg.pages).forEach(function (key) {
        var cur = agg.pages[key];
        var before = prev.pages[key];
        if (!before || before.visitors < 20 || cur.visitors < 20) return;
        var delta = (cur.visitors - before.visitors) / before.visitors;
        if (!growth || delta > growth.delta) growth = { delta: delta, page: cur };
      });
    }
    if (growth) {
      cards.push({
        icon: '<path d="M4 19V5"/><path d="M4 19h16"/><rect x="8" y="12" width="3" height="7"/><rect x="14" y="7" width="3" height="12"/>',
        title: 'Fastest riser: ' + growth.page.title,
        body: '<b>' + fmtSigned(growth.delta) + '</b> visitors versus the previous period, on <b>' + fmtInt(growth.page.visitors) +
          '</b> visits. Page-level leads: <b>' + fmtInt(growth.page.leads) + '</b>.'
      });
    } else {
      cards.push({
        icon: '<path d="M4 19V5"/><path d="M4 19h16"/><rect x="8" y="12" width="3" height="7"/><rect x="14" y="7" width="3" height="12"/>',
        title: 'Citation rate: ' + fmtPct(agg.totals.citations / (agg.totals.visitors || 1), 1),
        body: '<b>' + fmtInt(agg.totals.citations) + '</b> AI citations against <b>' + fmtInt(agg.totals.visitors) +
          '</b> visits, with <b>' + fmtPct(agg.totals.leads / (agg.totals.visitors || 1), 1) + '</b> converting to a lead.'
      });
    }

    host.innerHTML = cards.map(function (c) {
      return '<article class="insight">' +
        '<span class="insight-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + c.icon + '</svg></span>' +
        '<div class="insight-copy"><strong>' + esc(c.title) + '</strong><p>' + c.body + '</p></div>' +
        '</article>';
    }).join('');
  }

  /* ============================================================
     TABLE
     ============================================================ */
  function buildTableRows(view) {
    var agg = view.agg, prev = view.prevAgg;
    var rows = Object.keys(agg.pages).map(function (key) {
      var cur = agg.pages[key];
      var before = prev ? prev.pages[key] : null;
      return {
        key: key,
        title: cur.title,
        path: cur.path,
        domain: cur.domain,
        propId: cur.propId,
        token: cur.token,
        visitors: cur.visitors,
        citations: cur.citations,
        leads: cur.leads,
        secs: cur.visitors > 0 ? cur.secs / cur.visitors : 0,
        citeRate: cur.visitors > 0 ? cur.citations / cur.visitors : 0,
        delta: before && before.visitors > 0 ? (cur.visitors - before.visitors) / before.visitors : null
      };
    });
    var q = state.search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(function (r) {
        return r.title.toLowerCase().indexOf(q) > -1 || r.path.toLowerCase().indexOf(q) > -1 || r.domain.indexOf(q) > -1;
      });
    }
    var key = state.sortKey, dir = state.sortDir === 'asc' ? 1 : -1;
    rows.sort(function (a, b) {
      if (key === 'title') return a.title.localeCompare(b.title) * dir;
      var av = a[key], bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
    return rows;
  }

  function renderTable(view) {
    var rows = buildTableRows(view);
    var body = $('#pagesBody');
    var totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
    state.page = clamp(state.page, 1, totalPages);
    var start = (state.page - 1) * state.pageSize;
    var pageRows = rows.slice(start, start + state.pageSize);
    var maxVisitors = rows.reduce(function (m, r) { return Math.max(m, r.visitors); }, 1);

    $('#tableSub').textContent = rows.length + ' page' + (rows.length === 1 ? '' : 's') + ' · sorted by ' +
      (state.sortKey === 'citeRate' ? 'cite rate' : state.sortKey === 'secs' ? 'avg time' : state.sortKey) + ' ' + state.sortDir;

    body.innerHTML = pageRows.map(function (r) {
      var deltaTag = r.delta == null
        ? '<span class="tag">new</span>'
        : '<span class="tag ' + (r.delta >= 0 ? 'pos' : 'neg') + '">' + fmtSigned(r.delta, 0) + '</span>';
      return '<tr data-key="' + esc(r.key) + '">' +
        '<td><span class="cell-page">' +
          '<span class="fav" style="--tok:var(' + r.token + ')">' + esc(PROP_INITIALS[r.propId] || '·') + '</span>' +
          '<span class="pg-copy"><span class="pg-title" title="' + esc(r.title) + '">' + esc(r.title) + '</span>' +
          '<span class="pg-path">' + esc(r.domain + r.path) + '</span></span>' +
        '</span></td>' +
        '<td class="num"><span class="meter"><span class="meter-track"><span class="meter-fill" style="width:' +
          ((r.visitors / maxVisitors) * 100).toFixed(1) + '%;--tok:var(' + r.token + ')"></span></span>' + fmtInt(r.visitors) + '</span></td>' +
        '<td class="num">' + deltaTag + '</td>' +
        '<td class="num dim">' + fmtInt(r.citations) + '</td>' +
        '<td class="num">' + fmtInt(r.leads) + '</td>' +
        '<td class="num dim">' + fmtDuration(r.secs) + '</td>' +
        '<td class="num dim">' + fmtPct(r.citeRate, 1) + '</td>' +
      '</tr>';
    }).join('');

    $('#tableEmpty').hidden = rows.length > 0;
    $('#pagesTable').hidden = rows.length === 0;

    /* sort indicators */
    $$('#pagesTable thead th').forEach(function (th) {
      var active = th.dataset.key === state.sortKey;
      th.setAttribute('aria-sort', active ? (state.sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
    });

    $('#rowSummary').textContent = rows.length
      ? 'Showing ' + (start + 1) + '–' + Math.min(start + state.pageSize, rows.length) + ' of ' + rows.length + ' pages · ' + fmtInt(rows.reduce(function (s, r) { return s + r.visitors; }, 0)) + ' visits'
      : 'No rows';

    /* pager */
    var pager = $('#pager');
    if (rows.length === 0) { pager.innerHTML = ''; return; }
    var pages = [];
    for (var i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - state.page) <= 1) pages.push(i);
      else if (pages[pages.length - 1] !== '…') pages.push('…');
    }
    pager.innerHTML = '<button type="button" data-page="' + (state.page - 1) + '"' + (state.page === 1 ? ' disabled' : '') + ' aria-label="Previous page">‹</button>' +
      pages.map(function (p) {
        return p === '…'
          ? '<button type="button" disabled aria-hidden="true">…</button>'
          : '<button type="button" data-page="' + p + '"' + (p === state.page ? ' aria-current="true"' : '') + ' aria-label="Page ' + p + '">' + p + '</button>';
      }).join('') +
      '<button type="button" data-page="' + (state.page + 1) + '"' + (state.page === totalPages ? ' disabled' : '') + ' aria-label="Next page">›</button>';
  }

  function exportCsv(view) {
    var rows = buildTableRows(view);
    var header = ['page', 'path', 'property', 'visitors', 'change_vs_previous', 'ai_citations', 'leads', 'avg_time_seconds', 'cite_rate'];
    var lines = [header.join(',')];
    rows.forEach(function (r) {
      lines.push([
        csvCell(r.title), csvCell(r.domain + r.path), csvCell(r.domain),
        Math.round(r.visitors), r.delta == null ? '' : (r.delta * 100).toFixed(1) + '%',
        Math.round(r.citations), Math.round(r.leads), Math.round(r.secs), (r.citeRate * 100).toFixed(2) + '%'
      ].join(','));
    });
    var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'tyspace-' + state.property + '-' + view.win.fromIso + '-to-' + view.win.toIso + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
    toast('Exported ' + rows.length + ' pages to CSV');
  }
  function csvCell(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }

  /* ============================================================
     RENDER PIPELINE
     ============================================================ */
  var currentView = null;

  function computeView() {
    var win = getWindow();
    var prevWin = getPrevWindow(win);
    var showCompare = state.compare && !!prevWin;
    var base = { property: state.property, segment: state.segment, device: state.device, engine: state.engine };

    var agg = aggregate(Object.assign({}, base, { win: win, withPages: true }));
    var prevAgg = showCompare ? aggregate(Object.assign({}, base, { win: prevWin, withPages: true })) : null;

    var channelFacet = aggregate(Object.assign({}, base, { win: win, segment: 'all' }));
    var engineFacet = aggregate(Object.assign({}, base, { win: win, engine: 'all' }));
    var deviceFacet = aggregate(Object.assign({}, base, { win: win, device: 'all' }));

    var byProp = PROPS.map(function (p) {
      var own = (state.property === p.id) ? agg : aggregate(Object.assign({}, base, { property: p.id, win: win }));
      return { id: p.id, name: p.name, visitors: own.totals.visitors };
    });

    return {
      win: win,
      prevWin: showCompare ? prevWin : null,
      agg: agg,
      prevAgg: prevAgg,
      channelFacet: channelFacet,
      engineFacet: engineFacet,
      deviceFacet: deviceFacet,
      byProp: byProp
    };
  }

  function render() {
    var view = currentView = computeView();
    renderMeta(view.win, view.prevWin);
    renderProps(view);
    renderControls(view.win, view.prevWin);
    renderChips(view.win, view.prevWin);
    renderKpis(view);
    renderTrend(view);
    renderChannelDonut(view);
    renderBars(view);
    renderEngines(view);
    renderDeviceDonut(view);
    renderInsights(view);
    renderTable(view);
    writeHash();

    var scope = state.property === 'all' ? 'all properties' : T.getProp(state.property).name;
    var status = 'Updated. ' + fmtRange(view.win.fromIso, view.win.toIso) + ', ' + scope + ', ' +
      fmtInt(view.agg.totals.visitors) + ' visitors, ' + fmtInt(view.agg.totals.citations) + ' AI citations, ' +
      fmtInt(view.agg.totals.leads) + ' leads.';
    $('#a11yStatus').textContent = status;
  }

  /* ============================================================
     EVENTS
     ============================================================ */
  function setState(patch, opts) {
    Object.assign(state, patch);
    if (!opts || !opts.keepPage) state.page = 1;
    render();
  }

  function bind() {
    /* property switcher */
    $('#propList').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-property]');
      if (!btn) return;
      setState({ property: btn.dataset.property });
      if (window.innerWidth <= 920) closeDrawer();
    });

    /* date presets */
    $('#rangePresets').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-range]');
      if (!btn) return;
      setState({ range: btn.dataset.range, from: null, to: null });
    });

    /* custom dates */
    function onDateChange() {
      var from = $('#dateFrom').value, to = $('#dateTo').value;
      if (!from || !to) return;
      if (from > to) { var t = from; from = to; to = t; $('#dateFrom').value = from; $('#dateTo').value = to; }
      setState({ range: 'custom', from: from, to: to });
    }
    $('#dateFrom').addEventListener('change', onDateChange);
    $('#dateTo').addEventListener('change', onDateChange);

    /* selects */
    $('#fSegment').addEventListener('change', function (e) { setState({ segment: e.target.value }); });
    $('#fDevice').addEventListener('change', function (e) { setState({ device: e.target.value }); });
    $('#fEngine').addEventListener('change', function (e) { setState({ engine: e.target.value }); });
    $('#pageSize').addEventListener('change', function (e) { setState({ pageSize: parseInt(e.target.value, 10) }); });

    /* compare + reset */
    $('#compareBtn').addEventListener('click', function () {
      setState({ compare: !state.compare });
    });
    $('#resetBtn').addEventListener('click', function () {
      var theme = document.documentElement.getAttribute('data-theme');
      state = Object.assign({}, DEFAULT_STATE, { sortKey: 'visitors', sortDir: 'desc' });
      render();
      toast('Filters reset');
      if (theme) document.documentElement.setAttribute('data-theme', theme);
    });

    /* metric tabs */
    $('#metricTabs').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-metric]');
      if (btn) setState({ metric: btn.dataset.metric });
    });
    $('#barMetricTabs').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-metric]');
      if (btn) setState({ barMetric: btn.dataset.metric });
    });

    /* KPI cards pick the trend metric */
    $('#kpis').addEventListener('click', function (e) {
      var card = e.target.closest('.kpi');
      if (!card) return;
      setState({ metric: card.dataset.metric });
      var panel = $('#trend-panel');
      if (panel && panel.getBoundingClientRect().top < 0) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    /* chip removal */
    $('#activeFilters').addEventListener('click', function (e) {
      if (e.target.id === 'clearInline' || e.target.closest('#clearInline')) {
        setState({ segment: 'all', device: 'all', engine: 'all', search: '', compare: true });
        return;
      }
      var btn = e.target.closest('[data-clear]');
      if (!btn) return;
      var kind = btn.dataset.clear;
      if (kind === 'segment') setState({ segment: 'all' });
      else if (kind === 'device') setState({ device: 'all' });
      else if (kind === 'engine') setState({ engine: 'all' });
      else if (kind === 'search') setState({ search: '' });
      else if (kind === 'compare') setState({ compare: false });
    });

    /* table sorting */
    $('#pagesTable').addEventListener('click', function (e) {
      var btn = e.target.closest('.th-btn');
      if (!btn) return;
      var th = btn.closest('th');
      var key = th.dataset.key;
      var dir = state.sortKey === key ? (state.sortDir === 'asc' ? 'desc' : 'asc') : (key === 'title' ? 'asc' : 'desc');
      setState({ sortKey: key, sortDir: dir }, { keepPage: true });
    });

    /* table search */
    var searchTimer;
    $('#tableSearch').addEventListener('input', function (e) {
      var value = e.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.search = value.slice(0, 80);
        state.page = 1;
        render();
      }, 130);
    });

    /* pager */
    $('#pager').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-page]');
      if (!btn || btn.disabled) return;
      var page = parseInt(btn.dataset.page, 10);
      if (!isFinite(page)) return;
      state.page = page;
      render();
    });

    /* export + share */
    $('#exportBtn').addEventListener('click', function () { if (currentView) exportCsv(currentView); });
    $('#shareBtn').addEventListener('click', function () {
      var url = location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { toast('View link copied'); },
          function () { toast('Copy failed — the URL bar has it'); });
      } else {
        toast('Copy the URL to share this view');
      }
    });

    /* theme */
    $('#themeToggle').addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('tyspace-theme', next); } catch (e) {}
      updateThemeLabel();
      /* charts read their colours from CSS variables, so redraw */
      if (currentView) {
        renderTrend(currentView);
        renderChannelDonut(currentView);
        renderDeviceDonut(currentView);
      }
    });

    /* drawer */
    $('#drawerToggle').addEventListener('click', function () {
      document.body.classList.contains('drawer-open') ? closeDrawer() : openDrawer();
    });
    $('#scrim').addEventListener('click', closeDrawer);
    $('#sidebar').addEventListener('click', function (e) {
      if (e.target.closest('a') && window.innerWidth <= 920) closeDrawer();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeDrawer(); hideTip(); }
    });

    /* hash navigation (back / forward or hand-edited links) */
    window.addEventListener('hashchange', function () {
      var raw = (location.hash || '').replace(/^#/, '');
      if (!hashHasState(raw)) return; /* in-page anchor, leave the view alone */
      var theme = document.documentElement.getAttribute('data-theme');
      state = Object.assign({}, DEFAULT_STATE);
      readHash();
      render();
      if (theme) document.documentElement.setAttribute('data-theme', theme);
    });

    /* responsive redraw */
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { if (currentView) renderTrend(currentView); }, 140);
    });
    if (window.ResizeObserver) {
      var lastW = $('#trendChart').clientWidth;
      var pending = false;
      var ro = new ResizeObserver(function () {
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () {
          pending = false;
          var w = $('#trendChart').clientWidth;
          if (Math.abs(w - lastW) > 12) { lastW = w; if (currentView) renderTrend(currentView); }
        });
      });
      ro.observe($('#trendChart'));
    }
  }

  function openDrawer() {
    document.body.classList.add('drawer-open');
    $('#drawerToggle').setAttribute('aria-expanded', 'true');
    $('#scrim').hidden = false;
    var first = $('#sidebar .prop-item');
    if (first) first.focus();
  }
  function closeDrawer() {
    if (!document.body.classList.contains('drawer-open')) return;
    document.body.classList.remove('drawer-open');
    $('#drawerToggle').setAttribute('aria-expanded', 'false');
    $('#drawerToggle').focus();
  }
  function updateThemeLabel() {
    var t = document.documentElement.getAttribute('data-theme');
    var label = $('#themeLabel');
    if (label) label.textContent = t === 'dark' ? 'Dark' : 'Light';
    $('#themeToggle').setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }

  /* ---------- boot ---------- */
  function init() {
    /* selects */
    $('#fSegment').innerHTML = '<option value="all">All segments</option>' + CHANNELS.map(function (c) {
      return '<option value="' + c.key + '">' + esc(c.name) + '</option>';
    }).join('');
    $('#fDevice').innerHTML = '<option value="all">All devices</option>' + DEVICES.map(function (d) {
      return '<option value="' + d.key + '">' + esc(d.name) + '</option>';
    }).join('');
    $('#fEngine').innerHTML = '<option value="all">All AI engines</option>' + ENGINES.map(function (e) {
      return '<option value="' + e.key + '">' + esc(e.name) + '</option>';
    }).join('');

    var fromHash = hashHasState((location.hash || '').replace(/^#/, ''));
    readHash();
    updateThemeLabel();
    bind();
    render();

    /* A short scripted filter change on a visitor's first page load: it shows
       that every card and chart is wired to the same state, and it animates
       the numbers up from the narrower window instead of popping in. */
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fromHash && !reduce) {
      try {
        if (!sessionStorage.getItem('tyspace-intro')) {
          sessionStorage.setItem('tyspace-intro', '1');
          state.range = '7d';
          render();
          setTimeout(function () {
            state.range = '30d';
            render();
          }, 620);
        }
      } catch (e) { /* storage blocked: just leave the 30-day default */ }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
