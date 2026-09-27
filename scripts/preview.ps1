[CmdletBinding()]
param(
  [ValidateRange(1, 65535)][int]$Port = 8765,
  [switch]$BuildOnly
)

$ErrorActionPreference = "Stop"
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$previewBase = [IO.Path]::GetFullPath((Join-Path $repoRoot ".preview"))
$previewSite = [IO.Path]::GetFullPath((Join-Path $previewBase "mygame"))
$expectedPrefix = $repoRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
if (-not $previewSite.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Preview output escaped the repository: $previewSite"
}

& (Join-Path $PSScriptRoot "sync-apps.ps1")
& (Join-Path $PSScriptRoot "sync-apps.ps1") -Check

if (Test-Path -LiteralPath $previewSite) {
  Remove-Item -LiteralPath $previewSite -Recurse -Force
}
New-Item -ItemType Directory -Path $previewSite -Force | Out-Null
foreach ($item in @("index.html", "styles.css", "app.js", "manifest.webmanifest", "offline.html", "service-worker.js", "pwa", "assets", "apps", ".nojekyll")) {
  Copy-Item -LiteralPath (Join-Path $repoRoot $item) -Destination (Join-Path $previewSite $item) -Recurse
}
& (Join-Path $PSScriptRoot "stamp-pages.ps1") -SiteRoot $previewSite

$url = "http://127.0.0.1:$Port/mygame/"
Write-Host "Preview ready at $url"
if ($BuildOnly) { return }
Write-Host "Press Ctrl+C to stop the local server."
& python -m http.server $Port --bind 127.0.0.1 --directory $previewBase
