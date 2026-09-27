[CmdletBinding()]
param(
  [string]$SiteRoot = (Join-Path $PSScriptRoot "..")
)

$ErrorActionPreference = "Stop"
$siteRoot = [IO.Path]::GetFullPath($SiteRoot)
$shellPath = Join-Path $siteRoot "pwa/app-shell.js"
if (-not (Test-Path -LiteralPath $shellPath -PathType Leaf)) {
  throw "Missing generated app shell. Run scripts/sync-apps.ps1 first."
}

$shell = [IO.File]::ReadAllText($shellPath)
$match = [regex]::Match($shell, 'PLAYGROUND_CACHE_VERSION\s*=\s*"([0-9a-f]{12})"')
if (-not $match.Success) { throw "Could not read the generated content hash from $shellPath" }

$hash = $match.Groups[1].Value
$warsaw = [TimeZoneInfo]::FindSystemTimeZoneById("Europe/Warsaw")
$builtAt = [TimeZoneInfo]::ConvertTime([DateTimeOffset]::UtcNow, $warsaw)
$localTime = $builtAt.ToString("yyyy-MM-dd HH:mm", [Globalization.CultureInfo]::InvariantCulture)
$zoneName = if ($warsaw.IsDaylightSavingTime($builtAt)) { "CEST" } else { "CET" }
$label = "Build $localTime $zoneName · $hash"
$badge = '<small data-playground-build aria-label="Playground ' + $label + '" style="display:block;margin:.5rem 1rem;padding-bottom:env(safe-area-inset-bottom);color:inherit;opacity:.45;text-align:right;font:10px/1.3 system-ui,sans-serif;letter-spacing:.01em">' + $label + '</small>'
$utf8 = [Text.UTF8Encoding]::new($false)
$pages = @((Join-Path $siteRoot "index.html")) + @(
  Get-ChildItem -LiteralPath (Join-Path $siteRoot "apps") -Recurse -File |
    Where-Object { $_.Name -in @("index.html", "postepy.html") } |
    Select-Object -ExpandProperty FullName
)

foreach ($page in $pages) {
  $html = [IO.File]::ReadAllText($page)
  if ($html.Contains('data-playground-build')) { throw "Page was already stamped: $page" }
  $closingBody = [regex]::Matches($html, '</body\s*>', [Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($closingBody.Count -ne 1) { throw "Expected one closing body tag: $page" }
  $html = $html.Insert($closingBody[0].Index, "  $badge`n")
  [IO.File]::WriteAllText($page, $html, $utf8)
}

Write-Host "Stamped $($pages.Count) pages: $label"
