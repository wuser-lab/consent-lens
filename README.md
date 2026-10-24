# Consent Lens

A browser-based TCF v2 consent-string inspector. Paste a signal to see CMP metadata, policy and vendor-list versions, timestamps, purpose flags, vendor IDs, and technical observations. Export the displayed report as JSON.

## Run

Requires Node.js 22.12+ and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local address printed by Vite. Use **Try an example** to inspect a historical sample with no consent flags set.

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

## Sources

- [TCF core library](https://github.com/InteractiveAdvertisingBureau/iabtcf-es)
- [TCF technical specifications](https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework)
- The non-empty regression fixture comes from [GPP issue 96](https://github.com/IABTechLab/iabgpp-es/issues/96).

## Next steps

Add policy-aware purpose descriptions, vendor-list lookup with version matching, GPP support, and string-to-string comparison.

Independent learning project; not affiliated with IAB Europe, IAB Tech Lab, or Heinz Baumann.
