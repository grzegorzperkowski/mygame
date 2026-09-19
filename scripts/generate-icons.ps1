[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$sourcesRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$items = @(
  @{ Repository = "15puzzle"; Directory = "assets/icons"; Label = "15"; Background = "#f2efe8"; Accent = "#25a9a2" },
  @{ Repository = "2048"; Directory = "assets/icons"; Label = "2048"; Background = "#faf8ef"; Accent = "#edc22e" },
  @{ Repository = "Blockfall"; Directory = "assets/icons"; Label = "B"; Background = "#101416"; Accent = "#9ee46a" },
  @{ Repository = "Minesweeper"; Directory = "assets/icons"; Label = "M"; Background = "#111a26"; Accent = "#fa6f88" },
  @{ Repository = "Sudoku"; Directory = "assets/icons"; Label = "S"; Background = "#f7f5ef"; Accent = "#7664d8" },
  @{ Repository = "Matemetyka"; Directory = "assets/icons"; Label = "+"; Background = "#fffaf2"; Accent = "#f47721" }
)

function New-Icon([string]$Path, [int]$Size, [string]$Label, [string]$Background, [string]$Accent, [bool]$Maskable) {
  $bitmap = [Drawing.Bitmap]::new($Size, $Size, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
      $graphics.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
      $graphics.Clear([Drawing.ColorTranslator]::FromHtml($Background))
      $margin = if ($Maskable) { [int]($Size * .22) } else { [int]($Size * .12) }
      $diameter = $Size - 2 * $margin
      $brush = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml($Accent))
      try { $graphics.FillEllipse($brush, $margin, $margin, $diameter, $diameter) } finally { $brush.Dispose() }
      $fontSize = if ($Label.Length -ge 4) { $Size * .18 } elseif ($Label.Length -ge 2) { $Size * .28 } else { $Size * .38 }
      $font = [Drawing.Font]::new("Segoe UI", $fontSize, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
      $textBrush = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml($Background))
      $format = [Drawing.StringFormat]::new()
      try {
        $format.Alignment = [Drawing.StringAlignment]::Center
        $format.LineAlignment = [Drawing.StringAlignment]::Center
        $graphics.DrawString($Label, $font, $textBrush, [Drawing.RectangleF]::new(0, 0, $Size, $Size), $format)
      } finally { $format.Dispose(); $textBrush.Dispose(); $font.Dispose() }
    } finally { $graphics.Dispose() }
    $parent = Split-Path -Parent $Path
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    $bitmap.Save($Path, [Drawing.Imaging.ImageFormat]::Png)
  } finally { $bitmap.Dispose() }
}

foreach ($item in $items) {
  $directory = Join-Path (Join-Path $sourcesRoot $item.Repository) $item.Directory
  New-Icon (Join-Path $directory "icon-192.png") 192 $item.Label $item.Background $item.Accent $false
  New-Icon (Join-Path $directory "icon-512.png") 512 $item.Label $item.Background $item.Accent $false
  New-Icon (Join-Path $directory "icon-maskable-192.png") 192 $item.Label $item.Background $item.Accent $true
  New-Icon (Join-Path $directory "icon-maskable-512.png") 512 $item.Label $item.Background $item.Accent $true
  New-Icon (Join-Path $directory "apple-touch-icon.png") 180 $item.Label $item.Background $item.Accent $false
}

Write-Host "Generated standalone PWA icon sets. Playground launcher icons are drawn from assets/icon.svg."
