const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");

const source = readFileSync(require("node:path").join(__dirname, "../pwa/register.js"), "utf8");
const workerSource = readFileSync(require("node:path").join(__dirname, "../service-worker.js"), "utf8");
const flush = () => new Promise(setImmediate);

async function openApp({ pageVersion = "111111111111", waitingVersion, legacyWorker = false, gamePage = false } = {}) {
  const panel = { hidden: true };
  const button = new EventTarget();
  const notices = [];
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    currentScript: { src: "https://example.com/mygame/pwa/register.js" },
    querySelector: selector => ({
      "#update-panel": gamePage ? null : panel, "#update-button": gamePage ? null : button,
      "[data-playground-build]": { dataset: { playgroundBuild: pageVersion } },
      "[data-playground-update]": notices[0]
    })[selector] || null,
    body: { append(notice) { notices.push(notice); } },
    createElement() {
      return Object.assign(new EventTarget(), {
        dataset: {}, style: {}, children: [], setAttribute() {},
        append(...children) { this.children.push(...children); },
        remove() { notices.splice(notices.indexOf(this), 1); }
      });
    }
  });
  let reloads = 0;
  const location = { protocol: "https:", reload() { reloads++; window.dispatchEvent(new Event("pagehide")); } };
  const timers = new Map();
  let timerId = 0;
  const window = Object.assign(new EventTarget(), {
    isSecureContext: true, location, matchMedia: () => ({ matches: true }),
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  });
  const active = { postMessage() {} };
  let checks = 0;
  let offline = false;
  let updateVersion = null;
  let activations = 0;
  const serviceWorker = Object.assign(new EventTarget(), { controller: active });
  function createWorker(version) {
    const worker = Object.assign(new EventTarget(), {
      state: "installing",
      postMessage(data) {
        if (legacyWorker && data.type !== "SKIP_WAITING") return;
        const client = { postMessage(reply) {
          queueMicrotask(() => serviceWorker.dispatchEvent(Object.assign(new Event("message"), { data: reply, source: worker })));
        } };
        scope.dispatchEvent(Object.assign(new Event("message"), { data, source: client, waitUntil() {} }));
      }
    });
    const scope = Object.assign(new EventTarget(), {
      registration: { scope: "https://example.com/mygame/" },
      clients: { claim: async () => {} },
      async skipWaiting() {
        activations++;
        worker.state = "activated";
        serviceWorker.controller = worker;
        serviceWorker.dispatchEvent(new Event("controllerchange"));
      }
    });
    runInNewContext(workerSource, {
      self: scope, URL,
      importScripts() {
        scope.PLAYGROUND_CACHE_VERSION = version;
        scope.PLAYGROUND_APP_SHELL = [];
        scope.PLAYGROUND_NAVIGATE_FALLBACKS = [];
      }
    });
    return worker;
  }
  const registration = Object.assign(new EventTarget(), {
    active, waiting: null, installing: null,
    async update() {
      checks++;
      if (offline) throw new Error("Offline");
      if (updateVersion && !this.waiting) {
        const worker = createWorker(updateVersion);
        this.installing = worker;
        this.dispatchEvent(new Event("updatefound"));
        this.waiting = worker;
        worker.state = "installed";
        worker.dispatchEvent(new Event("statechange"));
      }
      return this;
    }
  });
  if (waitingVersion) {
    registration.waiting = createWorker(waitingVersion);
    registration.waiting.state = "installed";
  }
  Object.assign(serviceWorker, { register: async () => registration, ready: Promise.resolve(registration) });
  runInNewContext(source, { window, document, navigator: { serviceWorker }, location, URL });
  window.dispatchEvent(new Event("load"));
  await flush();
  return {
    document, window, panel, serviceWorker, notices,
    get checks() { return checks; }, get reloads() { return reloads; },
    get activations() { return activations; },
    get waitingWorker() { return registration.waiting; },
    deploy(version = "222222222222") { updateVersion = version; },
    clickReload() { button.dispatchEvent(new Event("click")); },
    runTimers() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } },
    setOffline(value) { offline = value; },
    setHidden(value) { document.hidden = value; document.dispatchEvent(new Event("visibilitychange")); },
    pageshow(persisted) { window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted })); }
  };
}

test("returning to the PWA detects a deployment and shows the banner without reloading", async () => {
  const app = await openApp();
  assert.equal(app.checks, 1);
  assert.equal(app.panel.hidden, true);
  app.setHidden(true);
  app.deploy();
  assert.equal(app.checks, 1, "going to the background must not check");
  app.setHidden(false);
  await flush();
  assert.equal(app.checks, 2, "resuming must check again");
  assert.equal(app.panel.hidden, false);
  assert.equal(app.reloads, 0);
});

test("a manually refreshed page activates its matching update silently", async () => {
  const app = await openApp({ pageVersion: "222222222222" });
  app.deploy();
  app.setHidden(true);
  app.setHidden(false);
  await flush();
  app.runTimers();
  assert.equal(app.activations, 1);
  assert.equal(app.panel.hidden, true);
  assert.equal(app.reloads, 0);
});

test("an update already waiting on load also activates silently when versions match", async () => {
  const app = await openApp({ pageVersion: "222222222222", waitingVersion: "222222222222" });
  app.runTimers();
  assert.equal(app.activations, 1);
  assert.equal(app.panel.hidden, true);
  assert.equal(app.reloads, 0);
});

test("an older page keeps its update banner and reloads only after the user accepts", async () => {
  const app = await openApp({ waitingVersion: "222222222222" });
  assert.equal(app.panel.hidden, false);
  assert.equal(app.activations, 0);
  app.clickReload();
  await flush();
  app.runTimers();
  assert.equal(app.activations, 1);
  assert.equal(app.reloads, 1);
});

test("pages without a build version retain the manual update flow", async () => {
  const app = await openApp({ pageVersion: "", waitingVersion: "222222222222" });
  app.runTimers();
  assert.equal(app.panel.hidden, false);
  assert.equal(app.activations, 0);
});

test("workers that do not report their version fall back to the update banner", async () => {
  const app = await openApp({ waitingVersion: "222222222222", legacyWorker: true });
  app.runTimers();
  assert.equal(app.panel.hidden, false);
  assert.equal(app.activations, 0);
});

test("a version reply from another worker cannot silently accept an update", async () => {
  const app = await openApp({ waitingVersion: "222222222222", legacyWorker: true });
  app.serviceWorker.dispatchEvent(Object.assign(new Event("message"), {
    data: { type: "PLAYGROUND_VERSION", version: "111111111111" },
    source: app.serviceWorker.controller
  }));
  app.runTimers();
  assert.equal(app.panel.hidden, false);
  assert.equal(app.activations, 0);
});

test("a game page already using the new build does not get a floating update notice", async () => {
  const app = await openApp({ gamePage: true, pageVersion: "222222222222", waitingVersion: "222222222222" });
  app.runTimers();
  assert.equal(app.activations, 1);
  assert.equal(app.notices.length, 0);
  assert.equal(app.reloads, 0);
});

test("a late matching version reply removes a game's fallback notice without reloading", async () => {
  const app = await openApp({ gamePage: true, waitingVersion: "111111111111", legacyWorker: true });
  app.runTimers();
  assert.equal(app.notices.length, 1);
  app.serviceWorker.dispatchEvent(Object.assign(new Event("message"), {
    data: { type: "PLAYGROUND_VERSION", version: "111111111111" },
    source: app.waitingWorker
  }));
  assert.equal(app.notices.length, 0);
  assert.equal(app.activations, 1);
  assert.equal(app.reloads, 0);
});

test("restoring a visible page from the back-forward cache checks for updates", async () => {
  const app = await openApp();
  app.pageshow(false);
  assert.equal(app.checks, 1, "normal pageshow must not duplicate the load check");
  app.deploy();
  app.pageshow(true);
  await flush();
  assert.equal(app.checks, 2);
  assert.equal(app.panel.hidden, false);
});

test("restoring a hidden page does not check until it becomes visible", async () => {
  const app = await openApp();
  app.setHidden(true);
  app.pageshow(true);
  assert.equal(app.checks, 1);
  app.setHidden(false);
  assert.equal(app.checks, 2);
});

test("an offline resume can retry on the next resume without an unhandled rejection", async () => {
  const app = await openApp();
  app.setOffline(true);
  app.setHidden(true);
  app.setHidden(false);
  await flush();
  assert.equal(app.checks, 2);
  assert.equal(app.panel.hidden, true);
  app.setOffline(false);
  app.deploy();
  app.setHidden(true);
  app.setHidden(false);
  await flush();
  assert.equal(app.checks, 3);
  assert.equal(app.panel.hidden, false);
  assert.equal(app.reloads, 0);
});
