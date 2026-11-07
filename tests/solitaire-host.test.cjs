const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const source = readFileSync(join(__dirname, "../app.js"), "utf8");

function openLauncher({ standalone = true, navigationApi = true, hash = "", restored = false } = {}) {
  class Element extends EventTarget {
    constructor() {
      super();
      const classes = new Set();
      this.classList = { add: x => classes.add(x), remove: x => classes.delete(x), toggle() {} };
      this.contentWindow = {};
    }
    focus() { this.focused = true; }
    remove() { this.removed = true; }
  }
  const link = Object.assign(new Element(), { href: "https://example.com/mygame/apps/solitaire/index.html" });
  const shell = new Element();
  const body = Object.assign(new Element(), { children: [], append(node) { this.children.push(node); } });
  const location = new URL(`https://example.com/mygame/?source=pwa${hash}`);
  let reloads = 0;
  location.reload = () => { reloads++; };
  const window = Object.assign(new EventTarget(), { location, matchMedia: () => ({ matches: standalone }) });
  const launcher = new URL(location.href); launcher.hash = "";
  const entries = restored ? [launcher.href, location.href] : [location.href];
  let index = entries.length - 1;
  const navigation = Object.assign(new EventTarget(), {
    entries: () => entries.map((url, i) => ({ url, index: i, sameDocument: true }))
  });
  Object.defineProperty(navigation, "currentEntry", { get: () => ({ index }) });
  if (navigationApi) window.navigation = navigation;
  const history = {
    pushState(state, unused, url) { entries.splice(++index); entries.push(new URL(url, location).href); location.href = entries[index]; },
    replaceState(state, unused, url) { entries[index] = new URL(url, location).href; location.href = entries[index]; },
    back() {
      const event = Object.assign(new Event("navigate", { cancelable: true }), {
        navigationType: "traverse", destination: { sameDocument: true }
      });
      navigation.dispatchEvent(event);
      if (!event.defaultPrevented && index > 0) {
        location.href = entries[--index];
        window.dispatchEvent(new Event("popstate"));
      }
    }
  };
  const document = {
    title: "Playground", body,
    querySelector(selector) {
      return ({ ".connection-label": {}, ".game-card.solitaire": link, ".page-shell": shell })[selector] || null;
    },
    querySelectorAll: () => [link], createElement: () => new Element(), addEventListener() {}
  };
  runInNewContext(source, { window, document, navigator: { onLine: true }, URL, location, history });
  const click = () => {
    const event = Object.assign(new Event("click", { cancelable: true }), { button: 0 });
    link.dispatchEvent(event); return event.defaultPrevented;
  };
  const frame = () => body.children.findLast(node => !node.removed);
  const message = (type, origin = location.origin, sender = frame()?.contentWindow) => {
    window.dispatchEvent(Object.assign(new Event("message"), { data: { type }, origin, source: sender }));
  };
  return { window, location, history, entries, navigation, shell, link, click, frame, message, get reloads() { return reloads; } };
}

test("PWA opens Solitaire in one frame and protects same-document Back", () => {
  const app = openLauncher();
  assert.equal(app.click(), true);
  assert.equal(app.location.hash, "#solitaire");
  assert.equal(app.frame().src, app.link.href);
  assert.equal(app.shell.inert, true);
  app.click();
  assert.equal(app.entries.length, 2);
  app.history.back();
  assert.equal(app.location.hash, "#solitaire");
  assert.ok(app.frame());
});

test("only the current frame and origin can request exit or reload", () => {
  const app = openLauncher(); app.click();
  app.message("PLAYGROUND_EXIT_SOLITAIRE", "https://other.example");
  app.message("PLAYGROUND_EXIT_SOLITAIRE", app.location.origin, {});
  app.message("UNEXPECTED");
  assert.ok(app.frame());
  app.message("PLAYGROUND_RELOAD");
  assert.equal(app.reloads, 1);
  app.message("PLAYGROUND_EXIT_SOLITAIRE");
  assert.equal(app.frame(), undefined);
  assert.equal(app.location.hash, "");
  assert.equal(app.shell.inert, false);
  assert.equal(app.link.focused, true);
});

test("ordinary browser links keep their document navigation", () => {
  const app = openLauncher({ standalone: false });
  assert.equal(app.click(), false);
  assert.equal(app.frame(), undefined);
  assert.equal(app.entries.length, 1);
  const pwa = openLauncher();
  const modified = Object.assign(new Event("click", { cancelable: true }), { button: 0, ctrlKey: true });
  pwa.link.dispatchEvent(modified);
  assert.equal(modified.defaultPrevented, false);
  assert.equal(pwa.frame(), undefined);
});

test("without Navigation API, Back returns normally to the launcher", () => {
  const app = openLauncher({ navigationApi: false }); app.click();
  app.history.back();
  assert.equal(app.frame(), undefined);
  assert.equal(app.location.hash, "");
});

test("direct game route creates a real launcher return entry", () => {
  const app = openLauncher({ hash: "#solitaire" });
  assert.ok(app.frame());
  assert.equal(app.entries.length, 2);
  app.message("PLAYGROUND_EXIT_SOLITAIRE");
  assert.equal(app.location.hash, "");
  assert.equal(app.frame(), undefined);
});

test("restored same-document game route reuses its launcher entry", () => {
  const app = openLauncher({ hash: "#solitaire", restored: true });
  assert.ok(app.frame());
  assert.equal(app.entries.length, 2);
  app.message("PLAYGROUND_EXIT_SOLITAIRE");
  assert.equal(app.frame(), undefined);
});

test("uncancelable, cross-document and ordinary navigations are not intercepted", () => {
  const app = openLauncher(); app.click();
  for (const [type, sameDocument, cancelable] of [["push", true, true], ["traverse", false, true], ["traverse", true, false]]) {
    const event = Object.assign(new Event("navigate", { cancelable }), {
      navigationType: type, destination: { sameDocument }
    });
    app.navigation.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
  }
});
