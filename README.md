# Consent Lens

A browser-based TCF v2 evidence review workspace. Compare consent strings before and after a user action, record evidence references, document reviewer decisions, and export a traceable report. Single-string inspection remains available in a separate mode.

**[Open Consent Lens](https://wuser-lab.github.io/consent-lens/)** — no installation required. Pasted signals and local files are processed in your browser.

**Privacy:** downloads default to counts-only redacted summaries. For use without hosting connections, download the single-file offline edition from the app, or build it locally. [Privacy details](docs/PRIVACY.md).

[Release validation](docs/VALIDATION.md) records published-example checks, archived-GVL checks, and production workflow testing. Real audit adoption and time savings have not yet been measured.

## Screenshots

The screens below use synthetic demonstration data, not real audit evidence.

### Review workspace

![Consent Lens workspace with before and after capture inputs](docs/screenshots/workspace.png)

### Signal comparison

See added and removed consent flags alongside metadata differences.

![Signal comparison showing purpose consent IDs 1 and 2 added](docs/screenshots/comparison.png)

### Reviewer decisions

Record a decision, rationale, and evidence references for each review prompt.

![Reviewer workflow showing a needs-review decision and synthetic evidence notes](docs/screenshots/review.png)

### Vendor disclosure comparison

Compare disclosed and allowed vendor IDs, with explicit segment-presence reporting. This screenshot uses synthetic segments and does not represent a real audit.

![Disclosed vendor comparison showing vendor 8 added and vendor 2 removed](docs/screenshots/vendor-disclosures.png)

## Review workflow

1. Paste before and after TCF v2 signals and enter their capture times in your local timezone.
2. Select **Compare signals** to see added and removed purpose, vendor, legitimate-interest, and special-feature flags, plus publisher-restriction and metadata differences.
3. Record the case ID, reviewer, website/app source, participant type, user action, and exact controls/reference version.
4. Add an evidence index with references to screenshots or request logs, capture method, and known limitations.
5. Review each technical prompt with **Needs review**, **Pass**, **Fail**, or **Skipped**. Completed decisions require a rationale; pass/fail decisions also require evidence references.
6. Download a redacted JSON or Markdown summary by default. For a file that can reopen the review, explicitly choose **Full report — next download only**, then download JSON. The privacy choice resets after one download. Missing context or unfinished decisions keep the report in **draft** state. Skipped checks remain explicitly skipped, and failures remain findings.

Editing either signal clears the comparison, disables export, and resets decisions to **Needs review**. Existing notes remain visible for rechecking. Switching modes retains in-memory entries. Reloading or closing the page loses them; download a full review JSON file before leaving if you need to resume later. Full review files normalize capture times to UTC and include the browser timezone; redacted summaries omit all timestamps.

Editing audit context (including the source, action, capture times, reference version, or evidence index) also resets decisions to **Needs review**, while retaining notes and signal differences. This prevents an earlier decision from silently carrying over to revised evidence. Editing a decision's rationale or evidence references preserves its status.

## Publisher-restriction comparison

The comparison also shows restrictions for each vendor and purpose: **Not allowed** (encoded type 0), **Require consent** (1), and **Require legitimate interest** (2). Added, removed, and changed restrictions have separate counts from consent flags. A change in the type for one vendor-purpose pair counts once; unchanged pairs are counted separately.

Rows are sorted by purpose and vendor ID. Reordered groups, ranges, repeated entries and individual IDs with the same decoded meaning do not create false changes. Multiple encoded types for one pair remain visible together; the tool does not select a winning type. **No encoded restriction** means none was recorded for that pair and does not establish permission to process. Vendor declarations and policy applicability need separate review. These are the [restriction values defined by the IAB technical format](https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20Consent%20string%20and%20vendor%20list%20formats%20v2.md#what-are-publisher-restrictions).

The screen shows up to 200 changed pairs; Full JSON and Markdown reports include the complete difference table; full JSON also includes the decoded captures. Default redacted summaries contain change counts only. Download the [synthetic restriction-only report](public/examples/synthetic-restrictions.json), then reopen it with **Resume a saved review** to see **0 flag changes · 3 restriction changes**. It is demonstration data, not real audit evidence.

![Synthetic publisher-restriction comparison with one change, one removal, and one addition](docs/screenshots/publisher-restrictions.jpg)

Reports now include a comparison-coverage marker. Reopening an older report without the matching marker recalculates the restrictions and resets **Signal transition** to **Needs review**, retaining its rationale and evidence references. Other recorded decisions are preserved. A visible notice explains the reset. The marker records comparison coverage, not independent evidence verification.

## Reopen a saved review

Choose **Full report — next download only** and download your review as JSON, then use **Resume a saved review** to select that file later. The import restores source strings, capture times, context, decisions, rationales, and evidence references. A [synthetic sample report](public/examples/synthetic-review.json) is included for trying the workflow.

![Resume a saved review by choosing an exported JSON report](docs/screenshots/resume-review.png)

Reports are read locally with a 32 MiB size limit. Downloads over the same size are blocked before saving. The importer accepts Consent Lens schema `1.0`, including older reports without the newer derived disclosure fields. It re-decodes the source strings and recalculates comparison results and review completeness instead of trusting saved outcomes. Restored decisions remain the original reviewer's entries; import does not independently verify their evidence.

Capture times are displayed in the current browser timezone. Unedited imported timestamps retain their exact UTC instants and milliseconds, including during the repeated hour when daylight saving time ends. Invalid files and cancelled replacements leave current work intact. There is still no automatic browser storage; export changes again before closing the page. Markdown reports are intended for reading and cannot be imported.

**Load synthetic example** demonstrates purpose consent IDs 1 and 2 being added. The fixtures were generated using the IAB encoder and an empty synthetic vendor list, with illustrative CMP metadata. They are not real audit evidence and leave the review incomplete. Loading the example over existing work asks before replacing entries.

## Version-matched vendor lookup

Use **Vendor lookup** to choose a local Global Vendor List JSON file (up to 16 MiB), then select the before capture, after capture, or single-string input. Vendor names and membership are shown only if both the GVL version and policy version match the decoded signal. A mismatch blocks lookup; use the matching archived list from your organisation's trusted source.

The table includes all referenced consent, legitimate-interest, disclosed, and allowed vendor IDs, along with supplied names and any recorded deletion date. Filter by name or ID; the interface shows up to 200 matching rows. A full vendor JSON download contains all referenced IDs; the default redacted download contains membership counts only. The full download records list metadata, source filename and a SHA-256 file fingerprint where available. These are omitted from redacted summaries. A fingerprint identifies file contents; it does not authenticate the source.

**Try synthetic lookup** demonstrates listed, deleted, and unlisted entries with made-up vendor names. It replaces the loaded list and single-string input after confirmation if needed, while retaining audit captures and notes. Vendor lookup results are separate from saved audit reports and must be exported separately. Signals, files and notes are never sent to a remote service.

![Synthetic vendor lookup showing names, encoded signals, deletion dates, and an unlisted ID](docs/screenshots/vendor-lookup.png)

The tool validates the fields it uses for lookup, not the full GVL schema. It does not evaluate vendor declarations, permitted legal bases or legal compliance. A matching version does not prove the supplied list is authentic or complete; a not-listed ID is an observation for review.

## Run

Requires Node.js 22.22.2+ within the Node 22 release line, or Node.js 24.15+, and pnpm. The test tooling uses jsdom; GitHub checks run on Node 24.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local address printed by Vite. Use **Load synthetic example** for a comparison, or switch to **Inspect one string** and choose **Try an example** for a historical single-string sample.

```sh
pnpm test
pnpm build
```

The build produces a static site in `dist/`.

For the GitHub Pages project URL:

```sh
pnpm run build:pages
pnpm run verify:pages
pnpm run preview
```

Open the `/consent-lens/` URL printed by the preview command. The publish workflow tests and verifies the project-path build before deployment.

## Offline edition and redacted downloads

Download **Offline edition** in the app, then open the saved `consent-lens-offline.html` in a browser. Its code, styles, synthetic examples and license notices are all in that file. It needs no local server. The saved edition has no external asset references or outbound links, and its Content Security Policy blocks app network connections. Loading or downloading from the public website still reaches GitHub; using a copy already saved locally avoids those hosting requests.

To create the file locally:

```sh
pnpm run build:offline
pnpm run verify:offline
```

The file is written to `dist/consent-lens-offline.html`. Normal production builds include it too.

All three export flows—review, single-string inspection and vendor lookup—default to a new **redacted summary** containing fixed labels and aggregate counts. The summary omits names, case/source details, all free text, raw strings, individual IDs, timestamps, versions, filenames and file fingerprints. It cannot reopen a review or reproduce its evidence. Unusual combinations of counts may still be linkable; this is redaction, not a guarantee of anonymity.

A full report is an explicit one-download choice, preserving the original data for private backups. After that download, the selector resets to redacted. Neither choice changes current inputs or notes. Synthetic example downloads contain only the bundled demonstration data and make no network request.

GitHub [logs visitor IP addresses for security](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection) on the public site. The offline edition does not anonymize the surrounding browser, extensions, operating system, or files a user later shares. See [privacy details](docs/PRIVACY.md).

## Scope and privacy

- Decodes using the official `@iabtechlabtcf/core` library, bundled locally with the application.
- Processes pasted strings in the browser; no analytics, external fonts, uploads, or persistence.
- Supports standalone TCF v2 strings. GPP decoding is not implemented.
- Caps each input at 100,000 characters, 1,000,000 total vendor-ID expansion/scan steps, and 10,000 publisher-restriction expansion steps to bound decoding, comparison and export work. Overlapping and repeated restriction ranges count repeatedly. These are local processing limits, not framework validity rules.
- Displays all 24 encoded purpose bit positions; their applicability depends on policy version.
- The audit report shows vendor IDs. A separate optional lookup resolves names from a user-selected matching GVL file; no vendor list is fetched automatically.
- Does not validate every structural or policy requirement, determine lawful processing, or certify legal compliance.
- Export is a selected-field report, not a complete serialization of every TCF field or segment.
- Comparison covers seven signal groups, including disclosed and allowed vendor IDs, encoded publisher restrictions, and the displayed metadata. A missing optional segment is shown as absent, not as an empty list. Optional segment ID differences are calculated only when the segment is present in both captures. Other undisplayed fields, including publisher-purpose signals from the separate Publisher TC segment, remain outside the comparison.
- Review prompts are general technical prompts, not official IAB control numbers. There is no automatic application of enforcement deadlines or a Controls Catalogue.
- Evidence entries are references and notes. Files are not embedded, fetched, or verified.
- Review completion describes documentation completeness, not compliance certification or independent evidence verification.

## Validation

`pnpm test` covers decoding, malformed inputs, exact additions/removals, identical captures, capture-specific errors, draft/completed report states, evidence requirements, skipped checks, recorded failures, chronology, and readable exports. `pnpm build` checks the production bundle.

## Sources

- [Third-party notices](public/THIRD_PARTY_NOTICES.txt)
- [TCF core library](https://github.com/InteractiveAdvertisingBureau/iabtcf-es)
- [TCF technical specifications](https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework)
- The non-empty regression fixture comes from [GPP issue 96](https://github.com/IABTechLab/iabgpp-es/issues/96).

## Next steps

Validate the workflow with an anonymised real audit, then consider evidence-file packaging, policy-aware purpose descriptions, GPP support, and reviewed mappings to official controls.

Independent learning project;
