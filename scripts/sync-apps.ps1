[CmdletBinding()]
param([switch]$Check)

$ErrorActionPreference = "Stop"
$launcherRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$sourcesRoot = [IO.Path]::GetFullPath((Join-Path $launcherRoot ".."))
$appsRoot = [IO.Path]::GetFullPath((Join-Path $launcherRoot "apps"))
$stagingRoot = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) ("mygame-sync-" + [guid]::NewGuid().ToString("N"))))

function Assert-ChildPath([string]$Path, [string]$Parent, [string]$Label) {
  $full = [IO.Path]::GetFullPath($Path)
  $prefix = [IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
  if (-not $full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "$Label escaped its intended root: $full"
  }
  return $full
}

function Copy-AllowlistedFile([string]$Repository, [string]$RelativePath, [string]$TargetName) {
  $repositoryRoot = Assert-ChildPath (Join-Path $sourcesRoot $Repository) $sourcesRoot "Repository"
  $source = Assert-ChildPath (Join-Path $repositoryRoot $RelativePath) $repositoryRoot "Source"
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing allowlisted source: $source" }
  $destination = Assert-ChildPath (Join-Path $stagingRoot (Join-Path $TargetName $RelativePath)) $stagingRoot "Staging destination"
  $parent = Split-Path -Parent $destination
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination
}

function Rewrite-VendoredHtml([string]$Path, [bool]$IsChapter) {
  $html = Get-Content -Raw -LiteralPath $Path
  $html = [regex]::Replace($html, '(?is)<script\b[^>]*\bdata-pwa-register\b[^>]*>\s*</script>', '')
  $html = [regex]::Replace($html, '(?is)<script\b[^>]*goatcounter[^>]*>\s*</script>', '')
  $html = [regex]::Replace($html, '(?is)<link\b[^>]*rel=["''](?:manifest|icon|apple-touch-icon)["''][^>]*>', '')
  $head = @'
  <meta name="playground-root" content="/mygame/">
  <link rel="manifest" href="/mygame/manifest.webmanifest">
  <link rel="icon" href="/mygame/assets/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/mygame/assets/apple-touch-icon.png">
  <script src="/mygame/pwa/register.js" defer></script>
'@
  $html = $html -replace '</head>', "$head</head>"
  $home = if ($IsChapter) { '../../../' } else { '../../' }
  $crumb = "<a href=`"$home`" class=`"playground-breadcrumb`" data-playground-breadcrumb>← Playground</a>"
  $style = '<style>.playground-breadcrumb{position:relative;z-index:100;display:inline-flex;margin:.75rem 1rem 0;padding:.5rem .75rem;border-radius:999px;color:inherit;background:color-mix(in srgb,currentColor 9%,transparent);font:700 13px/1 system-ui;text-decoration:none}@media(display-mode:standalone){.playground-breadcrumb{margin-top:max(.75rem,env(safe-area-inset-top))}}</style>'
  $html = $html -replace '<body([^>]*)>', "<body`$1>$style$crumb"
  Set-Content -LiteralPath $Path -Value $html -Encoding utf8NoBOM
}

function Get-TreeDigest([string]$Root) {
  if (-not (Test-Path -LiteralPath $Root)) { return @() }
  return Get-ChildItem -LiteralPath $Root -Recurse -File | Sort-Object FullName | ForEach-Object {
    $relative = [IO.Path]::GetRelativePath($Root, $_.FullName).Replace('\', '/')
    "$relative $((Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash)"
  }
}

$allowlists = [ordered]@{
  "15puzzle" = @{ repository = "15puzzle"; files = @("index.html", "app.js", "styles.css") }
  "2048" = @{ repository = "2048"; files = @("index.html", "app.js", "styles.css") }
  "blockfall" = @{ repository = "Blockfall"; files = @("index.html", "script.js", "style.css") }
  "minesweeper" = @{ repository = "Minesweeper"; files = @("index.html", "styles.css", "js/app.js", "js/game-state.js", "js/game-rules.js", "js/renderer.js") }
  "sudoku" = @{ repository = "Sudoku"; files = @("index.html", "styles.css", "js/board.js", "js/exact.js", "js/logical.js", "js/difficulty.js", "js/generator.js", "js/game.js", "js/persistence.js", "js/view.js", "js/app.js") }
  "matematyka" = @{ repository = "Matemetyka"; files = @(
    "index.html", "shared/game-engine.js", "shared/game.css", "assets/math-town-mascot.png",
    "Chapter1/index.html", "Chapter1/game.js", "Chapter2/index.html", "Chapter2/game.js",
    "Chapter3/index.html", "Chapter3/game.js", "Chapter4/index.html", "Chapter4/game.js",
    "Chapter5/index.html", "Chapter5/game.js", "Chapter6/index.html", "Chapter6/game.js",
    "Chapter7/index.html", "Chapter7/game.js"
  ) }
}

try {
  New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null
  foreach ($target in $allowlists.Keys) {
    $entry = $allowlists[$target]
    foreach ($file in $entry.files) { Copy-AllowlistedFile $entry.repository $file $target }
  }

  Get-ChildItem -LiteralPath $stagingRoot -Recurse -Filter index.html | ForEach-Object {
    $relative = [IO.Path]::GetRelativePath($stagingRoot, $_.FullName).Replace('\', '/')
    Rewrite-VendoredHtml $_.FullName ($relative -match '^matematyka/Chapter[1-7]/index\.html$')
  }

  $forbidden = Get-ChildItem -LiteralPath $stagingRoot -Recurse -File | Where-Object {
    $_.Name -in @("service-worker.js", "manifest.webmanifest", "pwa-register.js", "puzzles.js") -or
    $_.FullName -match '[\\/](tests?|pages-3079|\.git)[\\/]' -or $_.Name -match '^page_.*\.png$'
  }
  if ($forbidden) { throw "Forbidden vendored files: $($forbidden.FullName -join ', ')" }

  $htmlFiles = Get-ChildItem -LiteralPath $stagingRoot -Recurse -Filter index.html
  foreach ($htmlFile in $htmlFiles) {
    $html = Get-Content -Raw -LiteralPath $htmlFile.FullName
    if (($html.Split('/mygame/pwa/register.js').Count - 1) -ne 1 -or $html -notmatch 'data-playground-breadcrumb' -or $html -notmatch '/mygame/manifest.webmanifest' -or $html -match 'data-pwa-register') {
      throw "Invalid vendored HTML contract: $($htmlFile.FullName)"
    }
  }

  $appPaths = Get-ChildItem -LiteralPath $stagingRoot -Recurse -File | ForEach-Object {
    "apps/" + [IO.Path]::GetRelativePath($stagingRoot, $_.FullName).Replace('\', '/')
  } | Sort-Object
  $shellPaths = @(
    "./", "index.html", "styles.css", "app.js", "manifest.webmanifest", "offline.html", "pwa/register.js",
    "pwa/app-shell.js", "assets/icon.svg", "assets/icon-192.png", "assets/icon-512.png",
    "assets/icon-maskable-192.png", "assets/icon-maskable-512.png", "assets/apple-touch-icon.png",
    "assets/screenshots/playground-home.png", "assets/screenshots/playground-results.png"
  ) + $appPaths
  $fallbacks = @(
    @("apps/matematyka/Chapter1/", "apps/matematyka/Chapter1/index.html"),
    @("apps/matematyka/Chapter2/", "apps/matematyka/Chapter2/index.html"),
    @("apps/matematyka/Chapter3/", "apps/matematyka/Chapter3/index.html"),
    @("apps/matematyka/Chapter4/", "apps/matematyka/Chapter4/index.html"),
    @("apps/matematyka/Chapter5/", "apps/matematyka/Chapter5/index.html"),
    @("apps/matematyka/Chapter6/", "apps/matematyka/Chapter6/index.html"),
    @("apps/matematyka/Chapter7/", "apps/matematyka/Chapter7/index.html"),
    @("apps/matematyka/", "apps/matematyka/index.html"), @("apps/minesweeper/", "apps/minesweeper/index.html"),
    @("apps/blockfall/", "apps/blockfall/index.html"), @("apps/15puzzle/", "apps/15puzzle/index.html"),
    @("apps/sudoku/", "apps/sudoku/index.html"), @("apps/2048/", "apps/2048/index.html"), @("", "index.html")
  )
  $shellJson = $shellPaths | ConvertTo-Json -Compress
  $fallbackJson = $fallbacks | ForEach-Object { [ordered]@{ prefix = $_[0]; document = $_[1] } } | ConvertTo-Json -Compress
  $generated = "self.PLAYGROUND_APP_SHELL = Object.freeze($shellJson);`nself.PLAYGROUND_NAVIGATE_FALLBACKS = Object.freeze($fallbackJson);`n"

  if ($Check) {
    $current = Get-TreeDigest $appsRoot
    $staged = Get-TreeDigest $stagingRoot
    if (Compare-Object $current $staged) { throw "Vendored apps differ. Run scripts/sync-apps.ps1 and commit the result." }
    $shellFile = Join-Path $launcherRoot "pwa/app-shell.js"
    if (-not (Test-Path -LiteralPath $shellFile) -or (Get-Content -Raw -LiteralPath $shellFile) -cne $generated) { throw "pwa/app-shell.js is out of date." }
    Write-Host "Vendored apps and app shell are current."
    return
  }

  Assert-ChildPath $appsRoot $launcherRoot "Apps output" | Out-Null
  if (Test-Path -LiteralPath $appsRoot) { Remove-Item -LiteralPath $appsRoot -Recurse -Force }
  Move-Item -LiteralPath $stagingRoot -Destination $appsRoot
  $pwaDirectory = Join-Path $launcherRoot "pwa"
  New-Item -ItemType Directory -Force -Path $pwaDirectory | Out-Null
  Set-Content -LiteralPath (Join-Path $pwaDirectory "app-shell.js") -Value $generated -Encoding utf8NoBOM
  Write-Host "Synchronized $($appPaths.Count) runtime files into apps/."
} finally {
  if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
}
