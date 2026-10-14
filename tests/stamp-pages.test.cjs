const assert = require("node:assert/strict");
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

test("stamped launcher and game pages expose the same version used by the worker", () => {
  const prefix = join(tmpdir(), "mygame-stamp-test-");
  const site = mkdtempSync(prefix);
  try {
    mkdirSync(join(site, "pwa"));
    mkdirSync(join(site, "apps", "game"), { recursive: true });
    writeFileSync(join(site, "pwa", "app-shell.js"), 'self.PLAYGROUND_CACHE_VERSION = "222222222222";');
    for (const page of ["index.html", "apps/game/index.html"]) {
      writeFileSync(join(site, page), "<!doctype html><html><body>Game</body></html>");
    }
    const result = spawnSync("pwsh", ["-NoProfile", "-File", join(__dirname, "../scripts/stamp-pages.ps1"), "-SiteRoot", site], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    for (const page of ["index.html", "apps/game/index.html"]) {
      const html = readFileSync(join(site, page), "utf8");
      assert.match(html, /data-playground-build="222222222222"/);
      assert.match(html, /· 222222222222<\/small>/);
    }
  } finally {
    assert.ok(resolve(site).startsWith(resolve(prefix)), "cleanup must stay within the generated test directory");
    rmSync(site, { recursive: true, force: true });
  }
});
