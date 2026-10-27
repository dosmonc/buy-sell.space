/* Synthetic test fixture only; the real audit must never be committed. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const digest = text => crypto.createHash('sha256').update(text).digest('hex');
const { parseAudit } = require('../assets/js/audit.js');

function fakeAudit() {
  const out = ['RankOps Master Audit and Priority Plan', 'Fixture date', 'Read this first', 'Fixture only.',
    'Priority to-do list', 'P0: today and tomorrow (stop the damage, about 90 minutes in total)', '#', 'Do this', 'Why (evidence)', 'Time', 'Who', 'Status'];
  for (let i = 1; i <= 26; i++) out.push(String(i), `Task ${i}`, `Evidence ${i}`, '5 min', 'Owner', i > 24 ? 'Parked' : 'Not started');
  out.push('Funnel and revenue', 'Fixture funnel', 'Free map plan', 'Fixture plan', 'Dashboard', 'Fixture dashboard',
    'Keep, fix or kill', 'Fixture inventory', 'Live site audit', 'Findings, most serious first', '#', 'Severity', 'Finding', 'Where and exact text', 'Fix (after your decision)', 'Status');
  for (let i = 1; i <= 10; i++) out.push(String(i), i < 5 ? 'HIGH' : 'MEDIUM', `Finding ${i}`, `Where ${i}`, `Fix ${i}`, 'Not started');
  out.push('What passed', 'Research track', 'Capture list from Part VI of the baseline (about 2 hours, mostly saving pages)', '#', 'Capture', 'How', 'Time', 'Status');
  for (let i = 1; i <= 6; i++) out.push(i === 1 ? '1 to 4' : String(i + 3), `Capture ${i}`, `How ${i}`, '5 min', i === 1 ? 'Done' : 'Not started');
  out.push('Harvest from the old MASTERLIST (Jul 6), then trash it', 'Fixture research', 'Money, legal and admin risks', 'Deadlines and failed payments', 'By when', 'Item', 'What I found', 'Suggested move', 'Status');
  for (let i = 1; i <= 8; i++) out.push('Today', `Deadline ${i}`, `Evidence ${i}`, `Next ${i}`, 'Not started');
  out.push('Smaller admin items', 'Item', 'What I found', 'Suggested move', 'Status');
  for (let i = 1; i <= 8; i++) out.push(`Admin ${i}`, `Evidence ${i}`, `Next ${i}`, 'Not started');
  out.push('Noise automation', 'Where the noise comes from', 'Stream', 'What I found', 'Smallest fix, not built', 'Status');
  for (let i = 1; i <= 8; i++) out.push(`Stream ${i}`, `Evidence ${i}`, `Next ${i}`, 'Not started');
  out.push('Gmail searches for your own sweep (I ran none of these)', 'Fixture search', 'Anti-chaos routines', 'Automations that chase you (not built)', 'What', 'When', 'What it does', 'Status');
  for (let i = 1; i <= 5; i++) out.push(`Automation ${i}`, 'Weekly', `Next ${i}`, 'Not started');
  out.push('Questions for you', 'Decisions that unblock everything', '#', 'Question', 'If you say “defaults”');
  const groups = {10:'Money, site claims and accounts', 19:'People, agents and outreach', 26:'Father Dust, Formspree and the land CRM', 31:'System of record and housekeeping'};
  for (let i = 1; i <= 37; i++) { if (groups[i]) out.push(groups[i], '#', 'Question', 'If you say “defaults”'); out.push(String(i), `Question ${i}?`, `Suggestion ${i}`); }
  out.push('Sources and gaps', 'Fixture sources', 'Appendix A: An unsent draft', 'Fixture draft');
  return out.join('\n');
}

test('extracts every priority, decision and additional row without dropping source text', () => {
  const source = fakeAudit();
  const parsed = parseAudit(source);
  assert.equal(parsed.priorities.length, 26); assert.equal(parsed.questions.length, 37); assert.equal(parsed.others.length, 45); assert.equal(parsed.sections.length, 15);
  assert.equal(parsed.priorities[0].priority, 'P0'); assert.equal(parsed.priorities[24].priority, 'Parked'); assert.equal(parsed.priorities[24].status, 'Parked');
  assert.equal(parsed.questions[36].question, 'Question 37?'); assert.equal(parsed.questions[9].group, 'Money, site claims and accounts');
  assert.equal(parsed.others.find(x => x.id === 'capture-1').status, 'Done');
  const rebuilt = parsed.sections.map((s, i) => i === 0 ? s.text : s.rawTitle + '\n' + s.text).join('\n');
  assert.equal(rebuilt, source);
});

test('rejects a missing question or a malformed status rather than silently losing records', () => {
  assert.throws(() => parseAudit(fakeAudit().replace('\n37\nQuestion 37?\nSuggestion 37', '')), /Expected 37 questions/);
  assert.throws(() => parseAudit(fakeAudit().replace('Task 1\nEvidence 1\n5 min\nOwner\nNot started', 'Task 1\nEvidence 1\n5 min\nOwner\nUNKNOWN')), /Could not read priority task 1/);
  assert.throws(() => parseAudit('not an audit'), /Choose the exported audit/);
});

test('optionally verifies the owner-supplied audit outside the repository', { skip: !process.env.AUDIT_SOURCE }, () => {
  const source = fs.readFileSync(process.env.AUDIT_SOURCE, 'utf8');
  const parsed = parseAudit(source);
  assert.equal(parsed.priorities.length, 26); assert.equal(parsed.questions.length, 37); assert.equal(parsed.others.length, 45);
  assert.equal(parsed.priorities[0].status, 'Not started'); assert.equal(parsed.priorities[25].status, 'Parked');
  assert.equal(parsed.others.filter(x => x.group === 'Site findings').length, 10);
  assert.equal(parsed.others.filter(x => x.group === 'Research captures').length, 6);
  const rebuilt = parsed.sections.map((s, i) => i === 0 ? s.text : s.rawTitle + '\n' + s.text).join('\n');
  assert.equal(digest(rebuilt), digest(source.replace(/\r\n?/g, '\n')), 'full source text is preserved');
});
