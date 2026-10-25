# Changelog

## 0.4.0 — 25 October 2026

- Default to counts-only redacted summaries for review JSON/Markdown, single-string inspection and vendor lookup.
- Omit identifying/free-text details, raw signals, individual IDs, timestamps, versions and file fingerprints using allowlisted output structures.
- Require a fresh full-report choice for every download; preserve current work and reject attempts to reopen a summary as a review file.
- Add a self-contained offline HTML edition with inline code/styles, embedded examples/notices, local links and a network-blocking Content Security Policy.
- Bundle synthetic examples so their downloads need no network request.
- Explain GitHub visitor logging and the limits of redaction; keep full local backups available.

## 0.3.0 — 25 October 2026

- Compare publisher restrictions by vendor and purpose, with separate added, removed, changed and unchanged counts.
- Preserve multiple encoded restriction types and normalize equivalent ranges, duplicate entries and ordering.
- Include full restriction differences in JSON and Markdown reports; show up to 200 changes on screen.
- Add a downloadable restriction-only synthetic report with zero flag changes and three restriction changes.
- Download validated public examples through the report download path for in-app browser support, preserving their original filenames and contents.
- Reset the signal-transition decision when reopening reports without matching comparison coverage, retaining notes and evidence references.
- Bound restriction expansion at 10,000 steps per signal, allow reports up to 32 MiB, and block oversized exports.

## 0.2.0 — 25 October 2026

- Publish a browser-only release on GitHub Pages, with no installation required.
- Bound decoder work before expanding vendor-ID ranges, including overlapping ranges and publisher restrictions.
- Correct asset, home, and example-report links for the project URL.
- Verify decoding against the published IAB TC String Format example.
- Document a check against the official archived GVL version 48.
- Exercise report import and JSON export in the production build through the browser file picker.

Existing capabilities include signal comparison, reviewer decisions and evidence references, report reopening, and separate version-matched local vendor lookup. This remains an independent technical review aid, not an official IAB compliance assessment.
