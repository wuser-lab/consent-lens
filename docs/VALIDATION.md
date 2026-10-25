# Release validation

This records technical evidence for the 0.2.0 release. It does not establish legal compliance, production adoption, or time saved in real audits.

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

A 22,573-character constructed signal with 4,095 overlapping full-ID ranges could request about 268 million vendor-vector writes from the upstream decoder. The preflight now rejects this input before invoking that decoder. Tests cover core vectors, disclosed and allowed segments, publisher restrictions, repeated segments, truncation, and supported overlapping ranges below the limit. All 50 automated tests pass.

The per-input budget is 1,000,000 vendor-ID expansion/scan steps, with a 100,000-character cap. This bounds the counted work; it is not a wall-clock timeout or a framework validity rule. The preflight follows the pinned library layouts and needs review when that dependency changes.

## Practical limits

Files and pasted strings are processed in the browser. Reports still need human evidence review. Vendor-list authenticity and completeness are not verified. Audit reports and vendor-check reports are separate. No real user audit has yet been used to measure time saved or false-positive reduction.
