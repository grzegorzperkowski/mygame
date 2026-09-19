# Playground

Launcher PWA for six games at https://grzegorzperkowski.github.io/mygame/.

Nested URLs stay `/mygame/apps/<id>/`. The games themselves live in their own public repos. This repo keeps the launcher only; GitHub Actions copies the allowlist, rewrites nested HTML, and deploys Pages.

## Update a game

1. Push the game repo (that updates the standalone site, e.g. `/2048/`).
2. Rebuild Playground:

```bash
gh workflow run pages.yml
```

Or Actions → **Deploy Playground to GitHub Pages** → **Run workflow**.

Installed app: reload when the update banner appears. Pushing a game repo does not change `/mygame/apps/...` until this workflow runs.

## Update the shelf

Push `mygame`. The same workflow assembles current game tips and deploys.

## Local nested preview

From this directory, with the six game clones as siblings under `C:\Sources` (`Sudoku`, `Matemetyka`, …):

```powershell
pwsh -File .\scripts\sync-apps.ps1
```

Serve `C:\Sources` so the path is `/mygame/`. Do not commit `apps/` or `pwa/app-shell.js`.

```powershell
pwsh -File .\scripts\sync-apps.ps1 -Check
```

compares the current generated tree to a fresh assemble.

## Pages source

Settings → Pages → Source must be **GitHub Actions**. Branch deploy from `master` `/` will not run this workflow.

Standalone `/2048/`, `/sudoku/`, and the other game URLs still deploy from their own repos.
