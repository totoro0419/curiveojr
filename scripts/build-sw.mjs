import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

function files(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = `${dir}/${name}`;
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}
const paths = files('dist').filter(path => !path.endsWith('/sw.js') && !path.endsWith('/.nojekyll') && !path.endsWith('/brand/curiveojr-original.png')).sort();
if (!paths.includes('dist/index.html')) throw new Error('The production app shell is missing.');
const hash = createHash('sha256');
for (const path of paths) hash.update(path.slice(5)).update(readFileSync(path));
const version = hash.digest('hex').slice(0, 12);
const urls = paths.map(path => './' + path.slice(5).split('/').map(encodeURIComponent).join('/'));
const shellHtml = readFileSync('dist/index.html', 'utf8');

writeFileSync('dist/sw.js', `
const VERSION = ${JSON.stringify(version)};
const CACHE = 'curiveojr-' + VERSION;
const SCOPE = new URL(self.registration.scope);
const MARKER = new URL('__curiveojr_cache_status__', SCOPE).href;
const SHELL = new URL('index.html', SCOPE).href;
const SHELL_HTML = ${JSON.stringify(shellHtml)};
const ASSETS = ${JSON.stringify(urls)}.map(path => new URL(path, SCOPE).href)
  .filter(url => { const value = new URL(url); return value.origin === SCOPE.origin && value.pathname.startsWith(SCOPE.pathname); });
const local = url => url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname);
const ownCache = name => /^curiveojr-[a-f0-9]{12}$/.test(name);

self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  // The unversioned HTML URL can still have an older HTTP-cache response.
  // Pair this worker's exact build shell with its immutable asset URLs.
  await cache.addAll(ASSETS.filter(url => url !== SHELL).map(url => new Request(url, { cache: 'reload' })));
  await cache.put(SHELL, new Response(SHELL_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
  await cache.put(MARKER, new Response(JSON.stringify({ version: VERSION, installedAt: Date.now(), activeAt: 0 })));
  // Updates wait for explicit apply. The first install uses the browser's normal activation lifecycle.
})()));

self.addEventListener('activate', event => event.waitUntil((async () => {
  const current = await caches.open(CACHE);
  const previousMarker = await current.match(MARKER);
  const marker = previousMarker ? await previousMarker.json() : {};
  await current.put(MARKER, new Response(JSON.stringify({ ...marker, version: VERSION, activeAt: Date.now() })));
  const keys = (await caches.keys()).filter(ownCache);
  const older = [];
  const stillInstalling = new Set();
  for (let index = 0; index < keys.length; index++) {
    const name = keys[index]; if (name === CACHE) continue;
    const response = await (await caches.open(name)).match(MARKER);
    const data = response ? await response.json() : undefined;
    if (data && !data.activeAt) { stillInstalling.add(name); continue; }
    older.push({ name, rank: data?.activeAt || index });
  }
  older.sort((a, b) => b.rank - a.rank);
  const previous = older[0]?.name;
  await Promise.all(keys.filter(name => name !== CACHE && name !== previous && !stillInstalling.has(name)).map(name => caches.delete(name)));
  await self.clients.claim();
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => client.postMessage({ type: 'CURIVEO_ACTIVATED', version: VERSION }));
})()));

self.addEventListener('message', event => {
  const type = typeof event.data === 'string' ? event.data : event.data?.type;
  if (event.source?.url && !local(new URL(event.source.url))) return;
  if (type === 'SKIP_WAITING') { event.waitUntil(self.skipWaiting()); return; }
  if (type === 'GET_STATUS' || type === 'GET_VERSION') event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const cached = await Promise.all(ASSETS.map(url => cache.match(url)));
    event.ports[0]?.postMessage({ type: 'CURIVEO_STATUS', version: VERSION, cacheReady: cached.every(Boolean) });
  })());
});

async function cachedAsset(request) {
  const current = await caches.open(CACHE);
  const cached = await current.match(request);
  if (cached) return cached;
  // Tabs that have not applied the update may still request earlier hashed lazy chunks.
  const keys = (await caches.keys()).filter(name => ownCache(name) && name !== CACHE).reverse();
  for (const name of keys) {
    const result = await (await caches.open(name)).match(request);
    if (result) return result;
  }
}
async function navigation(request) {
  // Versioned shell and chunks stay together until the user explicitly applies an update.
  const shell = await (await caches.open(CACHE)).match(SHELL);
  if (shell) return shell;
  try {
    const response = await fetch(request);
    if (response.ok) return response;
    const previous = await cachedAsset(SHELL);
    return previous || response;
  } catch {
    const previous = await cachedAsset(SHELL);
    return previous || new Response('Curiveo Jr.のオフライン準備が完了していません。オンラインでアプリを開いてください。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !local(url)) return;
  if (event.request.mode === 'navigate') { event.respondWith(navigation(event.request)); return; }
  event.respondWith((async () => (await cachedAsset(event.request)) || fetch(event.request))());
});
`);
console.log(`Service worker: ${urls.length} local assets, ${version}`);
