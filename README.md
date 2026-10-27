# tyspace

A static workspace for RankOps, buy-sell.land and Father Dust. The analytics dashboard is a **synthetic demo**, not a live account connection. The RankOps priority workspace imports a private audit into the owner's browser; the audit itself is not in this public repository.

- `/` — sample analytics for the three properties, with filters, charts and a sortable table.
- `/audit.html` — a local-first audit workspace: the original document, 26 priorities, 37 decisions, plus site findings, research captures, deadlines and other action tables.
- `/real-data.html` — a step-by-step roadmap for replacing the demo responsibly.
- `/about.html` — founder and property information.

## Use the audit privately

1. Get the private `rankops-audit-source.txt` supplied separately, or export **RankOps Master Audit and Priority Plan** from Google Docs as plain text. Do not add this file to the repo or web root.
2. Open `/audit.html`, choose that `.txt` file, and keep the data on the device. The importer checks the document structure and extracts the action and decision tables. It also retains the complete original text, including its sources, caveats and draft.
3. Edit statuses, notes, target dates and answers. Suggested defaults remain suggestions unless you explicitly use them. No action is sent, approved or performed by this workspace. Only one item may be marked `In progress` at a time.
4. Use **Export backup** to save a private JSON backup of the original source and local edits. Import it on another device to transfer changes. `Replace file` imports another source or backup; restoring a backup replaces the current local data. **Clear device data** deletes the saved browser copy, not previously downloaded files or the original document.

Audit contents, answers and backup files are sensitive. Browser storage is **not encrypted**, and anyone with access to the browser profile, or malicious code running on this origin, may be able to read it. The public site and repository are not access controls. Clearing site data, using a temporary/private browser session, or switching browsers/devices can lose the local copy. Store backups in a private, access-controlled location and export before clearing. Nothing is synchronized with the source Google Doc or any service. The audit is an October 26, 2026 snapshot; verify current account state and deadlines before acting.

The audit page sends no data to a server: it uses the File API and `localStorage`. Its Content Security Policy blocks network connections from the page. The static HTML, CSS and JavaScript contain no audit content, keys, or records. The user still needs to trust the site code and device; for online sharing, set up a properly authenticated service rather than putting private data in Git or browser JavaScript.

## Run locally

No build step or runtime dependencies are required. From the repository root:

```sh
python3 -m http.server 8080 --bind 0.0.0.0
```

Open `http://localhost:8080/`. Serve only this public repo directory, **never** a parent directory containing the private audit or backups. `_headers` adds no-store/noindex and a restrictive Content Security Policy on Cloudflare Pages; equivalent headers should be configured on another host. Search-engine `noindex` is not authentication.

## Test the importer

```sh
node --test tests/audit-parser.test.cjs
# Optional: also check the real private export without copying it into the repo:
AUDIT_SOURCE=/path/to/private/rankops-audit-source.txt node --test tests/audit-parser.test.cjs
```

The committed tests use generated, non-sensitive fixtures. The optional test reads the source locally and checks the parsed counts and full-text preservation; it does not upload the source.

## Replacing the analytics demo with real data

Read `/real-data.html` first. The following is an engineering checklist, **not a working integration**:

1. **Define and acquire.** Verify access to Search Console, the selected analytics system for each property, actual tracker runs/report JSON, the queue/CRM/submission records, and billing/booking sources. Obtain permission; use read-only access. Establish reporting windows, timezone, definitions, test/duplicate rules, source receipts, freshness and data owners. Do not treat the audit's dated claims or estimated costs as current measurements.
2. **Prototype privately.** Export a 30-day baseline for one property to an access-controlled folder. Reconcile one daily total, one range total and one breakdown against each original source. Keep identifiable lead records and raw reports private. Treat unavailable or stale values as unavailable, not as zero.
3. **Replace the demo aggregation.** `assets/js/data.js` generates synthetic daily totals and simulated shares; `assets/js/app.js` multiplies channel, device, and engine shares as if independent, weights per-page data with synthetic `_pageChannelNorm` values, sums daily visitor totals, and traffic-weights visibility scores. These are not defensible real cross-filter measurements. Rebuild the aggregation and chart bindings around real, source-supported dimensions; disable unsupported filters and metrics. A simple data-file swap is **not sufficient**.
4. **Use the correct units.** A daily unique-user count is not additive across days or domains; use range-deduplicated users from the source or label the metric sessions/page views as appropriate. Search Console clicks are not all traffic. AI referrals, answer mentions, report scores and leads are distinct measures with different denominators. Citations divided by site visits is not an AI-visibility rate. Don't infer page, device or engine attribution absent real measurements.
5. **Design the private feed.** Use a protected backend or a deliberately local-only import, not a secret embedded in a static page. For online use, enforce authentication and authorization on every API request (including validating Cloudflare Access identity tokens server-side if used), minimize returned fields, and keep service credentials in a secret manager. Add read-only scoped permissions, retention, idempotent sync, cost caps, error handling and last-successful-sync timestamps. Avoid raw PII in public output, logs, URLs and Git history.
6. **Review and release.** Test reconciliation, missing values, source failures, non-additive totals, unsupported cross-filters, timezones, permissions and data leakage. Verify a private preview, get owner approval, deploy with rollback, and reconcile again after release. Replace demo badges only after the source and its scope are verified.

The historic `window.TYSPACE` shape is an implementation detail of the demo, not a safe real-data contract. It assumes identical consecutive daily arrays per property, page arrays matching each property definition, and specific synthetic dimension keys. Changing source data without replacing these assumptions can silently misstate results.

## Files

```text
index.html                 public synthetic analytics dashboard
audit.html                 public shell; imports private text or backup locally
real-data.html             migration roadmap
about.html                 founder/entity page
assets/js/data.js          synthetic data generator
assets/js/app.js           demo aggregation and interactive charts
assets/js/audit.js         local audit parser, decisions and status UI
assets/js/audit-theme.js   local theme bootstrap
assets/css/app.css         shared design system and analytics styles
assets/css/audit.css       local audit and guide styles
_headers                   Cloudflare Pages headers for audit.html
robots.txt, sitemap.xml, llms.txt
```

## Deploy

Cloudflare Pages can serve the repository root without a build command. Verify that the Pages project is connected to this repository and that its production branch is `main`; preview branch deployments do not automatically become production. Do not upload private source text or backups as build artifacts. After merging an approved change, verify the Pages deployment and live site; roll back in Cloudflare if necessary.
