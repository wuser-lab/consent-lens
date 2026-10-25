# Release validation

This records technical evidence for the 0.2.0, 0.3.0 and 0.4.0 releases. It does not establish legal compliance, production adoption, or time saved in real audits.

## Redacted reports and offline use (0.4.0)

The suite has 82 passing tests. Independent privacy tests place identifying canaries in context, source strings, decoded metadata, labels, notes, evidence references, filenames, hashes and unknown nested fields. Redacted JSON and Markdown use fixed allowlists and counts; tests verify canaries are absent, invalid scalar values cannot carry text, original objects are not modified, and equivalent counts produce identical summaries without substituted identifiers.

Real UI handlers cover redacted defaults for audit JSON/Markdown, single inspection and vendor lookup. A one-download full choice resets before export, including failures, and does not affect subsequent downloads. Redacted summaries are explicitly rejected as resumable reviews.

The generated offline file is verified to contain one inline classic script, inline CSS, both exact-byte examples, license notices, local-only links and a network-blocking Content Security Policy. Its local-file execution test exercises comparison, inspection, vendor lookup, redacted exports, an intentional full backup and reopening it, and example downloads with fetch/XHR/WebSocket traps. No network attempts were observed in those automated workflows. The normal hosted-download handler is excluded from the offline bundle.

Actual browser testing of the web production build downloaded a redacted summary containing none of the synthetic identifying details or raw captures. A deliberate full backup retained them and reset the selector. The offline download matched the generated HTML byte for byte. The browser automation policy blocks opening file URLs, so direct manual browser verification of the saved file was not performed; local-file execution is covered by the automated test.

The public website still contacts GitHub and is subject to host visitor logging. Downloading the offline file from that site also contacts the host once. Using an already-local copy avoids those app hosting requests. Counts may still be linkable; no full anonymity guarantee is claimed. See [privacy details](PRIVACY.md).

## Publisher restrictions (0.3.0)

Independent bit-level synthetic fixtures reproduce the coverage gap: changing an encoded restriction type leaves every consent flag and metadata field unchanged. The new comparison reports the vendor-purpose change separately. Tests cover all three types, empty sections, added/removed/changed/unchanged pairs, reversed comparisons, equivalent ranges and individual IDs, duplicates, ordering, maximum vendor ID, and multiple encoded types on the same pair.

JSON and readable exports retain the exact before/after types. Reopening re-decodes the source captures instead of trusting saved differences. Older comparison coverage resets the signal-transition decision and retains notes/evidence. UI tests verify that edits and failed comparisons remove stale rows and disable export, and that only the first 200 changes are rendered.

Restriction expansion has a separate 10,000-step per-input processing cap, including overlaps and duplicates, enforced before library decoding. The report size ceiling is 32 MiB for both import and export. These are resource bounds, not validity rules. No GVL is attached to the decoded model or used to remove encoded restriction evidence.

The production build was reopened through the actual browser file picker with the synthetic restriction-only report. The screen showed zero flag changes and three restriction changes. Both JSON and Markdown downloads preserved the exact before/after types; JSON retained the original source captures and capture instants. All 68 automated tests pass.

The example download was also exercised in the in-app browser: the validated public JSON is saved through the same Blob download path as exported reports, preserving its original bytes and filename. Tests cover failures and verify that downloading examples does not change the current review.

The downloadable report is synthetic. Real-audit adoption and time saved remain unmeasured.

## Published TCF example

Source: [IAB TC String Format specification](https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20Consent%20string%20and%20vendor%20list%20formats%20v2.md#tc-string-format).

The checked example decodes as encoding version 2, CMP ID 880, GVL version 48, policy version 2, and service-specific scope. Header values were independently checked against the published bit layout. Consent IDs are 1–4; disclosed IDs are 1–5, 100 and 404. Omitting the disclosure segment is reported as missing data rather than as vendor removals.

The example uses a historical policy value. Its presence in the specification does not make it a current compliance reference or a real production capture.

## Official archived vendor list

Source: [IAB Europe GVL v2 archive, version 48](https://vendor-list.consensu.org/v2/archives/vendor-list-v48.json).

The downloaded public file was parsed locally. Its list version 48 and policy version 2 match the published example, and it contains 437 vendor entries. The seven referenced IDs were checked; 3, 5 and 404 are not listed in that supplied archive. This is an observation about the example and archive, not a compliance finding. The archive is not bundled or fetched automatically by the app.

## Production workflow

- Build assets, the home link, and the example report resolve under `/consent-lens/`.
- The real browser file picker reopened the synthetic JSON report in the production build.
- Exported JSON retained case ID `SYNTHETIC-REOPEN-DEMO`, the two purpose-flag changes, and the original UTC capture instant.
- Automated tests cover import rejection, replacement cancellation, concurrent editing, timestamps, version mismatch, disclosure presence, and text-only handling of untrusted names and notes.

## Decoder workload limit

A 22,573-character constructed signal with 4,095 overlapping full-ID ranges could request about 268 million vendor-vector writes from the upstream decoder. The preflight now rejects this input before invoking that decoder. Tests cover core vectors, disclosed and allowed segments, publisher restrictions, repeated segments, truncation, and supported overlapping ranges below the limit. All 50 original automated tests passed for 0.2.0; the 0.3.0 suite has 68 passing tests.

The per-input budget is 1,000,000 vendor-ID expansion/scan steps, with a 100,000-character cap. Release 0.3.0 additionally caps publisher-restriction expansion at 10,000 steps. This bounds the counted work; it is not a wall-clock timeout or a framework validity rule. The preflight follows the pinned library layouts and needs review when that dependency changes.

## Practical limits

Files and pasted strings are processed in the browser. Reports still need human evidence review. Vendor-list authenticity and completeness are not verified. Audit reports and vendor-check reports are separate. No real user audit has yet been used to measure time saved or false-positive reduction.
