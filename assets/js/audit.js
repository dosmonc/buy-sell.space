/* The audit is supplied by the owner at runtime. No private source is bundled.
   Everything below runs in the browser; no upload, analytics or remote API. */
(function () {
  'use strict';
  var KEY = 'tyspace-rankops-audit-v1';
  var BACKUP = 'tyspace-audit-backup-v1';
  var STATUS = ['Not started', 'In progress', 'Blocked', 'Done', 'Parked'];
  var QUESTION_GROUPS = ['Decisions that unblock everything', 'Money, site claims and accounts', 'People, agents and outreach', 'Father Dust, Formspree and the land CRM', 'System of record and housekeeping'];
  var SOURCE_HEADINGS = ['Read this first', 'Priority to-do list', 'Funnel and revenue', 'Free map plan', 'Dashboard', 'Keep, fix or kill', 'Live site audit', 'Research track', 'Money, legal and admin risks', 'Noise automation', 'Anti-chaos routines', 'Questions for you', 'Sources and gaps', 'Appendix A:'];
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var state = null, parsed = null, saveTimer = null;

  function node(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = String(text);
    return el;
  }
  function message(text, error) {
    var el = $('#auditMessage'); el.textContent = text || ''; el.classList.toggle('error', !!error);
  }
  function cleanLines(source) { return source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n').map(function (s) { return s.trim(); }); }
  function position(lines, term, start) {
    var i = lines.indexOf(term, start || 0);
    if (i < 0) throw new Error('Missing audit section: ' + term);
    return i;
  }
  function between(lines, start, end) { var a = position(lines, start); return lines.slice(a + 1, position(lines, end, a + 1)).filter(Boolean); }
  function hash(source) {
    var h = 2166136261;
    for (var i = 0; i < source.length; i++) { h ^= source.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16) + '-' + source.length;
  }
  function taskPriority(n) { return n <= 5 ? 'P0' : n <= 12 ? 'P1' : n <= 16 ? 'P2' : n <= 24 ? 'P3' : 'Parked'; }
  function parsePriorities(lines) {
    var rows = between(lines, 'P0: today and tomorrow (stop the damage, about 90 minutes in total)', 'Funnel and revenue');
    var result = [];
    for (var i = 0; i < rows.length; i++) {
      var n = Number(rows[i]);
      if (!/^\d+$/.test(rows[i]) || n !== result.length + 1) continue;
      if (i + 5 >= rows.length || STATUS.indexOf(rows[i + 5]) < 0) throw new Error('Could not read priority task ' + n + '.');
      result.push({ id: 'task-' + n, n: n, priority: taskPriority(n), title: rows[i + 1], evidence: rows[i + 2], time: rows[i + 3], owner: rows[i + 4], status: rows[i + 5] });
      i += 5;
    }
    if (result.length !== 26) throw new Error('Expected 26 priority tasks; found ' + result.length + '.');
    return result;
  }
  function parseQuestions(lines) {
    var rows = between(lines, QUESTION_GROUPS[0], 'Sources and gaps');
    var result = [], group = QUESTION_GROUPS[0];
    for (var i = 0; i < rows.length; i++) {
      if (QUESTION_GROUPS.indexOf(rows[i]) >= 0) { group = rows[i]; continue; }
      var n = Number(rows[i]);
      if (!/^\d+$/.test(rows[i]) || n !== result.length + 1) continue;
      if (!rows[i + 1] || !rows[i + 2]) throw new Error('Could not read question ' + n + '.');
      result.push({ id: 'q-' + n, n: n, group: group, question: rows[i + 1], suggested: rows[i + 2] }); i += 2;
    }
    if (result.length !== 37) throw new Error('Expected 37 questions; found ' + result.length + '.');
    return result;
  }
  function parseNumberedTable(lines, start, end, count, category, kind) {
    var rows = between(lines, start, end), result = [];
    for (var i = 0; i < rows.length; i++) {
      var first = rows[i], index = result.length + 1;
      var match = kind === 'capture' ? ((index === 1 && first === '1 to 4') || Number(first) === index + 3) : Number(first) === index;
      if (!match || !/^(\d+|1 to 4)$/.test(first)) continue;
      if (kind === 'site') {
        if (STATUS.indexOf(rows[i + 5]) < 0) throw new Error('Could not read a site finding.');
        result.push({ id: 'site-' + index, n: first, group: category, severity: rows[i + 1], title: rows[i + 2], evidence: rows[i + 3], next: rows[i + 4], status: rows[i + 5] }); i += 5;
      } else {
        if (STATUS.indexOf(rows[i + 4]) < 0) throw new Error('Could not read an evidence capture.');
        result.push({ id: 'capture-' + index, n: first, group: category, title: rows[i + 1], next: rows[i + 2], time: rows[i + 3], status: rows[i + 4] }); i += 4;
      }
    }
    if (result.length !== count) throw new Error('Expected ' + count + ' rows in ' + category + '; found ' + result.length + '.');
    return result;
  }
  function parseFlatTable(lines, start, end, count, category, idPrefix, fields) {
    var rows = between(lines, start, end), statusHeader = rows.indexOf('Status');
    if (statusHeader < 0) throw new Error('Could not find table header: ' + category);
    rows = rows.slice(statusHeader + 1);
    var result = [];
    for (var i = 0; i < count; i++) {
      var cells = rows.slice(i * fields.length, (i + 1) * fields.length);
      if (cells.length !== fields.length || STATUS.indexOf(cells[cells.length - 1]) < 0) throw new Error('Could not read row ' + (i + 1) + ' in ' + category + '.');
      var item = { id: idPrefix + '-' + (i + 1), n: i + 1, group: category };
      fields.forEach(function (field, j) { item[field] = cells[j]; }); result.push(item);
    }
    return result;
  }
  function parseSections(source) {
    var lines = source.replace(/\r\n?/g, '\n').split('\n');
    var sections = [], last = 0;
    SOURCE_HEADINGS.forEach(function (heading) {
      var index = -1;
      for (var i = last; i < lines.length; i++) if (heading === 'Appendix A:' ? lines[i].trim().startsWith(heading) : lines[i].trim() === heading) { index = i; break; }
      if (index < 0) throw new Error('Missing full-audit section: ' + heading);
      if (sections.length) sections[sections.length - 1].text = lines.slice(last, index).join('\n');
      else if (index > 0) sections.push({ title: 'Document details', text: lines.slice(0, index).join('\n') });
      sections.push({ title: lines[index].trim(), rawTitle: lines[index], text: '' }); last = index + 1;
    });
    sections[sections.length - 1].text = lines.slice(last).join('\n');
    return sections;
  }
  function parseAudit(source) {
    if (typeof source !== 'string' || source.length < 1000 || source.length > 4000000) throw new Error('Choose the exported audit text or a tyspace backup (up to 4 MB).');
    var lines = cleanLines(source);
    if (!lines[0].includes('RankOps Master Audit and Priority Plan')) throw new Error('This is not the RankOps Master Audit and Priority Plan text export.');
    var priorities = parsePriorities(lines), questions = parseQuestions(lines);
    var others = [].concat(
      parseNumberedTable(lines, 'Findings, most serious first', 'What passed', 10, 'Site findings', 'site'),
      parseNumberedTable(lines, 'Capture list from Part VI of the baseline (about 2 hours, mostly saving pages)', 'Harvest from the old MASTERLIST (Jul 6), then trash it', 6, 'Research captures', 'capture'),
      parseFlatTable(lines, 'Deadlines and failed payments', 'Smaller admin items', 8, 'Deadlines & payments', 'money', ['time', 'title', 'evidence', 'next', 'status']),
      parseFlatTable(lines, 'Smaller admin items', 'Noise automation', 8, 'Smaller admin items', 'admin', ['title', 'evidence', 'next', 'status']),
      parseFlatTable(lines, 'Where the noise comes from', 'Gmail searches for your own sweep (I ran none of these)', 8, 'Noise automation', 'noise', ['title', 'evidence', 'next', 'status']),
      parseFlatTable(lines, 'Automations that chase you (not built)', 'Questions for you', 5, 'Proposed automations', 'auto', ['title', 'time', 'next', 'status'])
    );
    return { priorities: priorities, questions: questions, others: others, sections: parseSections(source) };
  }
  function safeMap(obj, maxLen) {
    var result = Object.create(null);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return result;
    Object.keys(obj).forEach(function (key) {
      if (/^(task|site|capture|money|admin|noise|auto|q)-\d+$/.test(key) && typeof obj[key] === 'string') result[key] = obj[key].slice(0, maxLen);
    });
    return result;
  }
  function normalize(obj) {
    if (!obj || typeof obj !== 'object' || typeof obj.source !== 'string') throw new Error('This backup does not contain the audit text.');
    var data = parseAudit(obj.source);
    var next = { format: BACKUP, source: obj.source, sourceId: hash(obj.source), statuses: safeMap(obj.statuses, 20), answers: safeMap(obj.answers, 20000), notes: safeMap(obj.notes, 4000), dates: safeMap(obj.dates, 10) };
    Object.keys(next.statuses).forEach(function (key) { if (STATUS.indexOf(next.statuses[key]) < 0) delete next.statuses[key]; });
    Object.keys(next.dates).forEach(function (key) { if (!/^\d{4}-\d{2}-\d{2}$/.test(next.dates[key])) delete next.dates[key]; });
    return { state: next, parsed: data };
  }
  function save() {
    if (!state) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { message('Browser storage is unavailable or full. Your changes are only in memory; export a backup before leaving.', true); return false; }
  }
  function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 180); }
  function status(item) { return state.statuses[item.id] || item.status; }
  function allItems() { return parsed.priorities.concat(parsed.others); }
  function isAnswered(q) { return !!(state.answers[q.id] || '').trim(); }
  function download(name, content, type) {
    var url = URL.createObjectURL(new Blob([content], { type: type }));
    var a = node('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function showWorkspace() {
    $('#workspace').hidden = false; $('#importCard').hidden = true; $('#backupBtn').disabled = false;
    var cat = $('#otherFilter'); cat.replaceChildren(node('option', '', 'All categories')); cat.firstChild.value = 'all';
    Array.from(new Set(parsed.others.map(function (x) { return x.group; }))).forEach(function (g) { var opt = node('option', '', g); opt.value = g; cat.appendChild(opt); });
    renderSummary(); renderPriorities(); renderQuestions(); renderOthers(); renderSource();
  }
  function renderSummary() {
    var p0 = parsed.priorities.filter(function (t) { return t.priority === 'P0' && status(t) !== 'Done' && status(t) !== 'Parked'; }).length;
    var done = parsed.priorities.filter(function (t) { return status(t) === 'Done'; }).length;
    var answered = parsed.questions.filter(isAnswered).length;
    var active = allItems().find(function (t) { return status(t) === 'In progress'; });
    $('#summaryP0').textContent = p0 + ' / 5'; $('#summaryQuestions').textContent = answered + ' / ' + parsed.questions.length; $('#summaryTasks').textContent = done + ' / ' + parsed.priorities.length;
    $('#summaryFocus').textContent = active ? active.title : 'None yet'; $('#summaryFocusSub').textContent = active ? (active.priority || active.group) + ' · In progress' : 'Choose one task to start';
    $('#p0Progress').style.width = (p0 / 5 * 100) + '%'; $('#questionProgress').style.width = (answered / parsed.questions.length * 100) + '%'; $('#taskProgress').style.width = (done / parsed.priorities.length * 100) + '%';
    $('#tabTaskCount').textContent = String(parsed.priorities.length); $('#tabQuestionCount').textContent = String(parsed.questions.length - answered);
  }
  function groupHeading(title, count) {
    var header = node('div', 'group-heading'); header.append(node('span', '', title), node('span', 'group-count', String(count)), node('span', 'group-line')); return header;
  }
  function setItemStatus(item, select) {
    var wanted = select.value, before = status(item);
    if (wanted === 'In progress') {
      var active = allItems().find(function (x) { return x.id !== item.id && status(x) === 'In progress'; });
      if (active) { select.value = before; message('One task at a time: change the current in-progress task before starting another.', true); return; }
    }
    state.statuses[item.id] = wanted; message('Status saved on this device.'); save(); renderSummary();
    if (item.priority && $('#statusFilter').value !== 'all') renderPriorities();
  }
  function itemCard(item) {
    var card = node('article', 'audit-item');
    var num = node('div', 'item-index', String(item.n).padStart(2, '0'));
    var body = node('div', 'item-body'); body.appendChild(node('h4', '', item.title));
    var meta = node('div', 'item-meta');
    if (item.priority) meta.appendChild(node('span', 'priority-pill ' + item.priority.toLowerCase(), item.priority));
    if (item.severity) meta.appendChild(node('span', 'severity-pill ' + item.severity.toLowerCase(), item.severity));
    if (item.time) meta.appendChild(node('span', '', '◷ ' + item.time));
    if (item.owner) meta.appendChild(node('span', '', '◎ ' + item.owner));
    body.appendChild(meta);
    var details = node('details', 'item-evidence'); details.appendChild(node('summary', '', 'Details, next step & notes'));
    if (item.evidence) { var p = node('p'); p.appendChild(node('strong', '', 'Evidence: ')); p.appendChild(document.createTextNode(item.evidence)); details.appendChild(p); }
    if (item.next) { var n = node('p'); n.appendChild(node('strong', '', 'Suggested next step: ')); n.appendChild(document.createTextNode(item.next)); details.appendChild(n); }
    var note = node('input', 'item-note'); note.type = 'text'; note.maxLength = 4000; note.placeholder = 'Your next action or handoff note (local)'; note.value = state.notes[item.id] || ''; note.setAttribute('aria-label', 'Next action for ' + item.title);
    note.addEventListener('input', function () { state.notes[item.id] = note.value; queueSave(); }); details.appendChild(note);
    var date = node('input', 'item-note'); date.type = 'date'; date.value = state.dates[item.id] || ''; date.setAttribute('aria-label', 'Target date for ' + item.title);
    date.addEventListener('change', function () { state.dates[item.id] = date.value; save(); }); details.appendChild(date); body.appendChild(details);
    var statusWrap = node('div', 'item-status'); var select = node('select', 'status-select'); select.setAttribute('aria-label', 'Status for ' + item.title);
    STATUS.forEach(function (s) { var o = node('option', '', s); o.value = s; select.appendChild(o); }); select.value = status(item); select.addEventListener('change', function () { setItemStatus(item, select); }); statusWrap.appendChild(select);
    card.append(num, body, statusWrap); return card;
  }
  function matches(query, values) { return !query || values.join(' ').toLowerCase().includes(query); }
  function renderPriorities() {
    var query = $('#taskSearch').value.trim().toLowerCase(), priority = $('#priorityFilter').value, filter = $('#statusFilter').value;
    var rows = parsed.priorities.filter(function (x) { return (priority === 'all' || x.priority === priority) && (filter === 'all' || status(x) === filter) && matches(query, [x.title, x.evidence, x.owner, x.time, x.n]); });
    var host = $('#taskList'); host.replaceChildren(); var groups = ['P0', 'P1', 'P2', 'P3', 'Parked'];
    var titles = { P0: 'P0 · Today and tomorrow', P1: 'P1 · This week', P2: 'P2 · Next two weeks', P3: 'P3 · Cleanup', Parked: 'Parked · Until the first client pays' };
    groups.forEach(function (g) { var items = rows.filter(function (x) { return x.priority === g; }); if (!items.length) return; host.appendChild(groupHeading(titles[g], items.length)); items.forEach(function (x) { host.appendChild(itemCard(x)); }); });
    if (!rows.length) host.appendChild(node('p', 'empty-results', 'No priority tasks match those filters.'));
  }
  function renderQuestions() {
    var query = $('#questionSearch').value.trim().toLowerCase(), filter = $('#questionFilter').value;
    var rows = parsed.questions.filter(function (q) { return (filter === 'all' || (filter === 'answered') === isAnswered(q)) && matches(query, [q.question, q.suggested, q.n, q.group, state.answers[q.id] || '']); });
    var host = $('#questionList'); host.replaceChildren();
    QUESTION_GROUPS.forEach(function (g) {
      var items = rows.filter(function (q) { return q.group === g; }); if (!items.length) return; host.appendChild(groupHeading(g, items.length));
      items.forEach(function (q) {
        var card = node('article', 'question-card'), body = node('div', 'question-body'), top = node('div', 'question-top');
        top.appendChild(node('h4', '', q.question)); var badge = node('span', 'answer-badge', isAnswered(q) ? 'ANSWERED' : 'UNANSWERED'); badge.classList.toggle('answered', isAnswered(q)); top.appendChild(badge); body.appendChild(top);
        var details = node('details', 'suggested'); details.appendChild(node('summary', '', 'See suggested default · not yet approved')); details.appendChild(node('p', '', q.suggested));
        var use = node('button', '', 'Use suggestion as my answer'); use.type = 'button'; details.appendChild(use); body.appendChild(details);
        var textarea = node('textarea'); textarea.placeholder = 'Write your decision or notes…'; textarea.value = state.answers[q.id] || ''; textarea.maxLength = 20000; textarea.setAttribute('aria-label', 'Your answer to question ' + q.n);
        textarea.addEventListener('input', function () { state.answers[q.id] = textarea.value; badge.textContent = isAnswered(q) ? 'ANSWERED' : 'UNANSWERED'; badge.classList.toggle('answered', isAnswered(q)); queueSave(); renderSummary(); });
        textarea.addEventListener('change', function () { if ($('#questionFilter').value !== 'all') renderQuestions(); });
        use.addEventListener('click', function () { if (textarea.value.trim() && !window.confirm('Replace your existing answer with the suggested default?')) return; textarea.value = q.suggested; textarea.dispatchEvent(new Event('input', { bubbles: true })); textarea.focus(); });
        body.appendChild(textarea); card.append(node('div', 'question-index', String(q.n).padStart(2, '0')), body); host.appendChild(card);
      });
    });
    if (!rows.length) host.appendChild(node('p', 'empty-results', 'No questions match those filters.'));
  }
  function renderOthers() {
    var query = $('#otherSearch').value.trim().toLowerCase(), filter = $('#otherFilter').value;
    var rows = parsed.others.filter(function (x) { return (filter === 'all' || filter === x.group) && matches(query, [x.title, x.evidence || '', x.next || '', x.time || '', x.severity || '']); });
    var host = $('#otherList'); host.replaceChildren();
    Array.from(new Set(parsed.others.map(function (x) { return x.group; }))).forEach(function (g) { var items = rows.filter(function (x) { return x.group === g; }); if (!items.length) return; host.appendChild(groupHeading(g, items.length)); items.forEach(function (x) { host.appendChild(itemCard(x)); }); });
    if (!rows.length) host.appendChild(node('p', 'empty-results', 'No findings or actions match those filters.'));
  }
  function renderSource() {
    var query = $('#sourceSearch').value.trim().toLowerCase();
    var rows = parsed.sections.filter(function (s) { return matches(query, [s.title, s.text]); });
    var host = $('#sourceList'); host.replaceChildren();
    rows.forEach(function (s) { var d = node('details', 'source-card'); d.appendChild(node('summary', '', s.title)); d.appendChild(node('pre', '', s.text.replace(/^\t+/gm, ''))); host.appendChild(d); });
    if (!rows.length) host.appendChild(node('p', 'empty-results', 'No audit sections match that search.'));
  }
  function openView(name) {
    $$('.workspace-view').forEach(function (view) { view.hidden = view.id !== 'view-' + name; });
    $$('.audit-tab[data-view]').forEach(function (tab) { var active = tab.dataset.view === name; tab.classList.toggle('active', active); if (active) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current'); });
  }
  function importFile(file, input) {
    if (!file) return;
    if (file.size > 5000000) { message('That file is too large. Choose the audit text or a tyspace backup under 5 MB.', true); input.value = ''; return; }
    var reader = new FileReader();
    reader.onerror = function () { message('Could not read that file. Try downloading it again.', true); input.value = ''; };
    reader.onload = function () {
      try {
        var contents = String(reader.result), candidate;
        if (file.name.toLowerCase().endsWith('.json')) {
          candidate = JSON.parse(contents);
          if (candidate.format !== BACKUP) throw new Error('This is not a tyspace audit backup.');
        } else candidate = { source: contents };
        var loaded = normalize(candidate);
        if (state && file.name.toLowerCase().endsWith('.json')) {
          if (!window.confirm('Restore this backup? It will replace the audit and local edits currently on this device. Export a backup first if you want to keep them.')) { input.value = ''; return; }
        } else if (state && state.sourceId === loaded.state.sourceId) {
          loaded.state.statuses = state.statuses; loaded.state.answers = state.answers; loaded.state.notes = state.notes; loaded.state.dates = state.dates;
        } else if (state && !window.confirm('Replace the current local audit and its edits? Export a backup first if you want to keep them.')) { input.value = ''; return; }
        state = loaded.state; parsed = loaded.parsed; var persisted = save(); showWorkspace(); if (persisted) message('Audit loaded on this device. No information was uploaded.');
      } catch (e) { message('Import failed: ' + e.message, true); }
      input.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  }
  function init() {
    try { var saved = localStorage.getItem(KEY); if (saved) { var loaded = normalize(JSON.parse(saved)); state = loaded.state; parsed = loaded.parsed; showWorkspace(); } }
    catch (e) { message('Saved audit could not be read. Import a private backup or audit text to continue.', true); }
    $('#auditFile').addEventListener('change', function () { importFile(this.files[0], this); });
    $('#replaceFile').addEventListener('change', function () { importFile(this.files[0], this); });
    $('#backupBtn').addEventListener('click', function () { if (!state) return; clearTimeout(saveTimer); save(); download('tyspace-private-audit-backup.json', JSON.stringify(state, null, 2), 'application/json'); message('Private backup downloaded. Store it somewhere access-controlled.'); });
    $('#downloadSource').addEventListener('click', function () { if (state) download('rankops-audit-original.txt', state.source, 'text/plain;charset=utf-8'); });
    $('#clearBtn').addEventListener('click', function () {
      if (!window.confirm('Remove the audit and all local answers, notes and statuses from this browser? Export a backup first. This cannot be undone here.')) return;
      clearTimeout(saveTimer); try { localStorage.removeItem(KEY); } catch (e) { message('Could not clear browser storage. Remove site data in browser settings.', true); return; }
      state = null; parsed = null; $('#workspace').hidden = true; $('#importCard').hidden = false; $('#backupBtn').disabled = true; message('Audit and edits removed from this browser. Downloaded files were not changed.');
    });
    $$('.audit-tab[data-view]').forEach(function (tab) { tab.addEventListener('click', function () { openView(tab.dataset.view); }); });
    ['taskSearch', 'priorityFilter', 'statusFilter'].forEach(function (id) { $('#' + id).addEventListener(id === 'taskSearch' ? 'input' : 'change', renderPriorities); });
    ['questionSearch', 'questionFilter'].forEach(function (id) { $('#' + id).addEventListener(id === 'questionSearch' ? 'input' : 'change', renderQuestions); });
    ['otherSearch', 'otherFilter'].forEach(function (id) { $('#' + id).addEventListener(id === 'otherSearch' ? 'input' : 'change', renderOthers); });
    $('#sourceSearch').addEventListener('input', renderSource);
    [$('#auditTheme'), $('#auditThemeMobile')].forEach(function (theme) { if (theme) theme.addEventListener('click', function () { var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', next); try { localStorage.setItem('tyspace-theme', next); } catch (e) {} }); });
    window.addEventListener('pagehide', function () { if (saveTimer) { clearTimeout(saveTimer); save(); } });
  }
  /* Keep the parser testable with Node without shipping audit contents. */
  if (typeof module !== 'undefined' && module.exports) { module.exports = { parseAudit: parseAudit }; return; }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}());
