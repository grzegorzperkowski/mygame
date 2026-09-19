importScripts("./pwa/app-shell.js");

const CACHE_PREFIX = "playground-shell-";
const CACHE_VERSION = self.PLAYGROUND_CACHE_VERSION;
const CACHE_NAME = `${CACHE_PREFIX}v${CACHE_VERSION}`;
const LEGACY_CACHE_NAME = "playground-game-launcher-shell";
const NETWORK_TIMEOUT_MS = 1800;
const ROOT = new URL("./", self.registration.scope);
const OFFLINE_URL = new URL("offline.html", ROOT).href;
const APP_SHELL = self.PLAYGROUND_APP_SHELL.map(path => new URL(path, ROOT).href);
const NAVIGATE_FALLBACKS = self.PLAYGROUND_NAVIGATE_FALLBACKS.map(item => ({
  prefix: new URL(item.prefix, ROOT).pathname,
  document: new URL(item.document, ROOT).href
}));

async function installShell() {
  const cache = await caches.open(CACHE_NAME);
  try {
    const responses = await Promise.all(APP_SHELL.map(async url => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not cache ${url}: ${response.status}`);
      return [url, response];
    }));
    await Promise.all(responses.map(([url, response]) => cache.put(url, response)));
  } catch (error) {
    await caches.delete(CACHE_NAME);
    throw error;
  }
}

self.addEventListener("install", event => event.waitUntil(installShell()));
self.addEventListener("activate", event => event.waitUntil(Promise.all([
  caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith(CACHE_PREFIX) || key === LEGACY_CACHE_NAME) && key !== CACHE_NAME).map(key => caches.delete(key)))),
  self.clients.claim()
])));
self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") event.waitUntil(self.skipWaiting());
  if (event.data?.type === "CHECK_SHELL_READY") event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const ready = (await Promise.all(APP_SHELL.map(url => cache.match(url)))).every(Boolean);
    if (ready) event.source?.postMessage({ type: "PLAYGROUND_SHELL_READY", cache: CACHE_NAME });
  })());
});

async function navigationFallback(request) {
  const cache = await caches.open(CACHE_NAME);
  const direct = await cache.match(request, { ignoreSearch: true });
  if (direct) return direct;
  const path = new URL(request.url).pathname;
  const mapping = NAVIGATE_FALLBACKS.find(item => path.startsWith(item.prefix));
  return (mapping && await cache.match(mapping.document)) || cache.match(OFFLINE_URL);
}

async function networkFirst(request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    const response = await fetch(request, { cache: "no-store", signal: controller.signal });
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
      return response;
    }
    if (response.status < 500) return response;
  } catch { /* Offline, timeout, and server errors use the declared shell. */ }
  finally { clearTimeout(timeout); }
  return navigationFallback(request);
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  const refresh = fetch(request).then(response => response.ok ? cache.put(request, response.clone()).then(() => response) : response);
  if (cached) { event.waitUntil(refresh.catch(() => {})); return cached; }
  return refresh;
}

self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  event.respondWith(request.mode === "navigate" ? networkFirst(request) : staleWhileRevalidate(request, event));
});
