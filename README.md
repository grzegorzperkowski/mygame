# Playground

Launcher PWA for six games at https://grzegorzperkowski.github.io/mygame/.

Nested URLs stay `/mygame/apps/<id>/`. The games themselves live in their own public repos. This repo keeps the launcher only; GitHub Actions copies the allowlist, rewrites nested HTML, and deploys Pages.

## PWA behavior

- One installation covers the launcher and all six nested games under `/mygame/`.
- The first successful online load prepares the complete app shell for offline use. The status changes to **All games ready offline** when caching finishes.
- Playground requests persistent browser storage when the user installs the app or first presses a game card; there is no separate persistence button.
- A waiting service worker shows an update banner. Use **Reload** to activate it without forcing a reload in the middle of a game.
- The Android install sheet uses the launcher screenshot plus one screenshot for every game. Launcher artwork is based on `assets/icon.svg` and uses the gamepad mark.

## Update a game

1. Push the game repo (that updates the standalone site, e.g. `/2048/`).
2. Rebuild Playground:

```bash
gh workflow run pages.yml
```

Or Actions → **Deploy Playground to GitHub Pages** → **Run workflow**.

Installed app: reload when the update banner appears. Pushing a game repo does not change `/mygame/apps/...` until this workflow runs.

## Update the shelf

Push `mygame`. The same workflow assembles the current allowlisted game sources and deploys them with the launcher.

## Local nested preview

From this directory, with the six game clones as siblings under `C:\Sources` (`Sudoku`, `Matemetyka`, …) and Python 3 installed:

```powershell
pwsh -File .\scripts\preview.ps1
```

Open **http://127.0.0.1:8765/mygame/**, then follow the game links or open **http://127.0.0.1:8765/mygame/apps/minesweeper/** directly. Press Ctrl+C to stop the server. The preview builds a stamped copy under `.preview/mygame/`, using the same `/mygame/` URL path as GitHub Pages. To inspect the stamped HTML through `file://`, run `pwsh -File .\scripts\preview.ps1 -BuildOnly` and open `file:///C:/Sources/mygame/.preview/mygame/index.html`. File navigation works there, but offline installation and service workers require the HTTP preview. Do not commit `apps/`, `pwa/app-shell.js`, or `.preview/`.

```powershell
pwsh -File .\scripts\sync-apps.ps1 -Check
```

The preview command runs assembly and this check automatically. You can also run `-Check` after `sync-apps.ps1` to compare the current generated tree to a fresh assemble.

The generated cache version is derived from the launcher assets and assembled game tree, so a changed game gets a new service-worker cache on the next deployment.

Each deployed HTML page also shows a small build label at the bottom: Warsaw assembly time (CET or CEST) plus the 12-character content hash. This includes the launcher, game pages, and Matematyka subpages. The label is embedded in the HTML, so an offline or cached page shows the version of the page that actually loaded. The workflow stamps pages after the assembly check and before upload. The preview command stamps its copy in the same way.

## PWA assets

- Edit `assets/icon.svg` and regenerate the checked-in Playground PNGs when changing the launcher icon. `scripts/generate-icons.ps1` generates icon sets for the six standalone game repositories only.
- Keep all seven `540x960` images in `assets/screenshots/` synchronized with the manifest: `playground-home.png` and one image per game.
- Changes to a launcher asset listed by `scripts/sync-apps.ps1` are included in the generated app shell during deployment.

## Pages source

Settings → Pages → Source must be **GitHub Actions**. Branch deploy from `master` `/` will not run this workflow.

Standalone `/2048/`, `/sudoku/`, and the other game URLs still deploy from their own repos.
