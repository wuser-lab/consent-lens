# Consent Lens

A browser-based TCF v2 evidence review workspace. Compare consent strings before and after a user action, record evidence references, document reviewer decisions, and export a traceable report. Single-string inspection remains available in a separate mode.

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
2. Select **Compare signals** to see added and removed purpose, vendor, legitimate-interest, and special-feature flags, plus metadata differences.
3. Record the case ID, reviewer, website/app source, participant type, user action, and exact controls/reference version.
4. Add an evidence index with references to screenshots or request logs, capture method, and known limitations.
5. Review each technical prompt with **Needs review**, **Pass**, **Fail**, or **Skipped**. Completed decisions require a rationale; pass/fail decisions also require evidence references.
6. Download JSON or a readable Markdown report. Missing context or unfinished decisions keep the report in **draft** state. Skipped checks remain explicitly skipped, and failures remain findings.

Editing either signal clears the comparison, disables export, and resets decisions to **Needs review**. Existing notes remain visible for rechecking. Switching modes retains in-memory entries. Reloading or closing the page loses them; export before leaving. Exported capture times are normalized to UTC and include the browser timezone.

Editing audit context (including the source, action, capture times, reference version, or evidence index) also resets decisions to **Needs review**, while retaining notes and signal differences. This prevents an earlier decision from silently carrying over to revised evidence. Editing a decision's rationale or evidence references preserves its status.

**Load synthetic example** demonstrates purpose consent IDs 1 and 2 being added. The fixtures were generated using the IAB encoder and an empty synthetic vendor list, with illustrative CMP metadata. They are not real audit evidence and leave the review incomplete. Loading the example over existing work asks before replacing entries.

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

## Scope and privacy

- Decodes using the official `@iabtechlabtcf/core` library, bundled locally with the application.
- Processes pasted strings in the browser; no analytics, external fonts, uploads, or persistence.
- Supports standalone TCF v2 strings. GPP decoding is not implemented.
- Displays all 24 encoded purpose bit positions; their applicability depends on policy version.
- Shows vendor IDs without fetching vendor names or declarations.
- Does not validate every structural or policy requirement, determine lawful processing, or certify legal compliance.
- Export is a selected-field report, not a complete serialization of every segment or publisher restriction.
- Comparison covers seven signal groups, including disclosed and allowed vendor IDs, and the displayed metadata. A missing optional segment is shown as absent, not as an empty list. Optional segment ID differences are calculated only when the segment is present in both captures. Publisher restrictions and other undisplayed fields remain outside the comparison.
- Review prompts are general technical prompts, not official IAB control numbers. There is no automatic application of enforcement deadlines or a Controls Catalogue.
- Evidence entries are references and notes. Files are not embedded, fetched, or verified.
- Review completion describes documentation completeness, not compliance certification or independent evidence verification.

## Validation

`pnpm test` covers decoding, malformed inputs, exact additions/removals, identical captures, capture-specific errors, draft/completed report states, evidence requirements, skipped checks, recorded failures, chronology, and readable exports. `pnpm build` checks the production bundle.

## Sources

- [TCF core library](https://github.com/InteractiveAdvertisingBureau/iabtcf-es)
- [TCF technical specifications](https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework)
- The non-empty regression fixture comes from [GPP issue 96](https://github.com/IABTechLab/iabgpp-es/issues/96).

## Next steps

Validate the workflow with an anonymised real audit, then consider version-matched vendor-list lookup, evidence-file packaging, policy-aware purpose descriptions, GPP support, and reviewed mappings to official controls.

Independent learning project;
