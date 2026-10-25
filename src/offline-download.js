const link = document.getElementById('offline-download');
const MAX_OFFLINE_BYTES = 2 * 1024 * 1024;
if (link) link.addEventListener('click', async event => {
  event.preventDefault();
  const status = document.getElementById('offline-download-status');
  const say = text => { if (status) status.textContent = text; };
  say('Downloading the public offline edition. Your review inputs are not included.');
  try {
    const source = new URL(link.href);
    if (source.origin !== window.location.origin) throw new Error('The offline edition must come from this site.');
    const response = await fetch(source.href, { credentials: 'omit', mode: 'same-origin' });
    if (!response.ok) throw new Error(`The offline edition could not be loaded (HTTP ${response.status}).`);
    if (Number(response.headers.get('content-length')) > MAX_OFFLINE_BYTES) throw new Error('Offline edition exceeds the download limit.');
    const html = await response.text();
    if (html.length > MAX_OFFLINE_BYTES || new TextEncoder().encode(html).length > MAX_OFFLINE_BYTES) throw new Error('Offline edition exceeds the download limit.');
    if (!/data-offline=["']true["']/.test(html) || !html.includes("connect-src 'none'")) throw new Error('The downloaded file is not the expected offline edition.');
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const download = document.createElement('a');
    download.href = url; download.download = 'consent-lens-offline.html'; download.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say('Offline edition downloaded. Open the saved HTML file to review locally with app network connections blocked.');
  } catch (error) {
    say(`Offline edition not downloaded: ${error.message} Your current review is unchanged.`);
  }
});
