# Privacy in Consent Lens

## Inputs stay local

The app processes pasted signals, selected report/GVL files and reviewer notes on your device. It has no account, analytics, advertising, input upload, or automatic review storage. Closing/reloading loses the in-memory review. A downloaded full review is a file on your device; the app does not upload it.

## Default redacted summaries

Review JSON/Markdown, single inspection JSON and vendor lookup JSON default to newly constructed, allowlisted summaries. They retain fixed technical labels, aggregate counts and known status categories. They omit entered names, case IDs, sources/URLs, all free text and evidence references, raw signals, individual vendor/purpose IDs, decoded metadata values and versions, all timestamps, source filenames and hashes. No identifier or fingerprint is substituted for the removed data.

Counts can still be recognizable when combined with other information. Redacted summaries are not guaranteed anonymous, cannot resume a review and cannot independently reproduce or verify evidence. The importer explains that a full review file is required.

## Full reports are a deliberate choice

Choose **Full report — next download only** when a private backup or detailed report is needed. That choice is consumed before preparing the download and then resets to redacted, including after a failed export. It applies to one current-data download across all export modes. A full file retains source data and entered details; review it before sharing. Changing privacy mode never removes local inputs or notes.

## Online visitor privacy

Opening the hosted app requests its HTML, bundled script and stylesheet from GitHub Pages. GitHub documents that it logs visitor IP addresses for security, regardless of sign-in: [GitHub Pages data collection](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection). The app cannot disable the hosting provider's logs.

Synthetic examples are bundled and downloaded locally without fetching a server copy. Clicking **Download offline edition** explicitly retrieves only the public HTML package from the same site, without credentials or current review data. Its initial download still contacts the host. The page sets a no-referrer policy.

## Offline visitor privacy

The generated **consent-lens-offline.html** is one local file containing the application, styles, both synthetic reports and third-party notices. It uses an inline classic script, so it does not require a local web server. It has no external asset references, external navigation links or hosted-download handler. Its Content Security Policy uses **connect-src 'none'**, blocks external scripts/frames/objects/forms and allows only its bundled inline script/styles. Defaults and review workflows match the online app.

Opening a copy already saved locally avoids requests to the hosting provider during use. This does not make the browser, extensions, OS, backups or later file sharing anonymous. The public repository's ownership/history is a separate matter and is outside this visitor/report privacy feature.
