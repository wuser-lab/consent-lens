import { build } from 'vite';
import { JSDOM } from 'jsdom';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export const OFFLINE_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src data: blob:; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'";

export async function generateEmbeddedExamples() {
  const directory = resolve(root, 'public/examples');
  const names = (await readdir(directory)).filter(name => name.endsWith('.json')).sort();
  const entries = [];
  for (const name of names) {
    const text = await readFile(resolve(directory, name), 'utf8');
    JSON.parse(text);
    entries.push([name, text]);
  }
  const source = '// Generated from public/examples/*.json by scripts/build-offline.mjs.\n'
    + '// Synthetic examples only; preserve their exact download bytes.\n'
    + `const examples = Object.freeze(${JSON.stringify(Object.fromEntries(entries), null, 2)});\n\n`
    + 'export const EMBEDDED_EXAMPLE_NAMES = Object.freeze(Object.keys(examples));\n'
    + 'export function getEmbeddedExample(fileName) {\n'
    + '  return Object.hasOwn(examples, fileName) ? examples[fileName] : undefined;\n'
    + '}\n';
  const output = resolve(root, 'src/embedded-examples.js');
  const previous = await readFile(output, 'utf8').catch(() => '');
  if (source !== previous) await writeFile(output, source);
  return entries;
}

export async function buildOffline({ outputPath = resolve(root, 'dist/consent-lens-offline.html') } = {}) {
  await generateEmbeddedExamples();
  const bundle = await build({
    root,
    configFile: false,
    logLevel: 'warn',
    base: './',
    plugins: [{
      name: 'offline-without-hosted-download',
      enforce: 'pre',
      resolveId(source) {
        if (source === './offline-download.js' || source === resolve(root, 'src/offline-download.js')) {
          return '\0consent-lens-offline-download-disabled';
        }
      },
      load(id) { if (id === '\0consent-lens-offline-download-disabled') return 'export {};'; },
    }],
    build: {
      write: false,
      minify: true,
      cssCodeSplit: false,
      sourcemap: false,
      lib: { entry: resolve(root, 'src/main.js'), name: 'ConsentLensOffline', formats: ['iife'] },
    },
  });
  const files = (Array.isArray(bundle) ? bundle : [bundle]).flatMap(result => result.output);
  const scripts = files.filter(file => file.type === 'chunk');
  const styles = files.filter(file => file.type === 'asset' && file.fileName.endsWith('.css'));
  const unexpected = files.filter(file => !scripts.includes(file) && !styles.includes(file));
  if (scripts.length !== 1 || styles.length !== 1 || unexpected.length) {
    throw new Error('Offline build must contain exactly one JavaScript bundle and one stylesheet, with no separate assets.');
  }
  const dom = new JSDOM(await readFile(resolve(root, 'index.html'), 'utf8'));
  const document = dom.window.document;
  document.documentElement.dataset.offline = 'true';
  document.title = 'Consent Lens · Offline evidence review';
  document.querySelectorAll('script, link[rel="stylesheet"], link[rel="modulepreload"], meta[http-equiv="Content-Security-Policy"]').forEach(node => node.remove());
  document.querySelectorAll('meta[http-equiv="refresh"]').forEach(node => node.remove());
  document.getElementById('offline-download')?.remove();
  document.querySelectorAll('.online-only').forEach(node => node.remove());
  document.querySelectorAll('.offline-only').forEach(node => { node.hidden = false; });
  const security = document.createElement('meta');
  security.httpEquiv = 'Content-Security-Policy';
  security.content = OFFLINE_CSP;
  const charset = document.querySelector('meta[charset]');
  if (charset) charset.after(security);
  else document.head.prepend(security);
  let referrer = document.querySelector('meta[name="referrer"]');
  if (!referrer) { referrer = document.createElement('meta'); referrer.name = 'referrer'; document.head.append(referrer); }
  referrer.content = 'no-referrer';
  document.querySelector('.brand')?.setAttribute('href', '#');
  for (const link of document.querySelectorAll('.import-panel a[download]')) {
    const source = link.getAttribute('href') || '';
    const fileName = source.split('/').pop();
    link.dataset.exampleFile = fileName;
    link.setAttribute('href', '#');
  }
  for (const link of document.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href');
    if (/THIRD_PARTY_NOTICES\.txt(?:$|[?#])/.test(href)) link.setAttribute('href', '#offline-third-party-notices');
    else if (/^(?:https?:)?\/\//i.test(href)) link.replaceWith(document.createTextNode(link.textContent));
  }
  const notices = document.createElement('details');
  notices.id = 'offline-third-party-notices';
  const summary = document.createElement('summary'); summary.textContent = 'Third-party notices';
  const noticeText = document.createElement('pre');
  noticeText.textContent = await readFile(resolve(root, 'public/THIRD_PARTY_NOTICES.txt'), 'utf8');
  notices.append(summary, noticeText);
  (document.querySelector('footer') || document.querySelector('main')).append(notices);
  const style = document.createElement('style');
  style.textContent = String(styles[0].source).replace(/<\/style/gi, '<\\/style')
    + '\n#offline-third-party-notices{margin-top:20px}#offline-third-party-notices pre{white-space:pre-wrap;overflow-wrap:anywhere}';
  document.head.append(style);
  const script = document.createElement('script');
  script.textContent = scripts[0].code.replace(/<\/script/gi, '<\\/script');
  document.body.append(script);
  const html = dom.serialize();
  dom.window.close();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html);
  return { outputPath, html };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--examples-only')) {
    await generateEmbeddedExamples();
    console.log('Embedded synthetic examples refreshed.');
  } else {
    const result = await buildOffline();
    console.log(`Offline edition: ${result.outputPath} (single HTML file; no server required).`);
  }
}
