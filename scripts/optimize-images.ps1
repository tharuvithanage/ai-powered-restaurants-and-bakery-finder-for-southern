param(
  [string]$SourceDir = "src/Images",
  [string]$BackupDir = "src/Images/_original",
  [int]$MaxSize = 1600,
  [int]$JpegQuality = 80,
  [switch]$ConvertPngWithoutAlphaToJpeg,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function Get-RelativePath([string]$basePath, [string]$fullPath) {
  try {
    $base = [System.IO.Path]::GetFullPath($basePath)
    $full = [System.IO.Path]::GetFullPath($fullPath)

    if (-not $base.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
      $base = $base + [System.IO.Path]::DirectorySeparatorChar
    }

    $baseUri = New-Object System.Uri($base)
    $fullUri = New-Object System.Uri($full)
    $relative = $baseUri.MakeRelativeUri($fullUri).ToString()
    return ([System.Uri]::UnescapeDataString($relative)).Replace("\", "/")
  } catch {
    return $fullPath.Replace("\", "/")
  }
}

function To-NativePath([string]$relativeOrPortablePath) {
  if (-not $relativeOrPortablePath) { return $relativeOrPortablePath }
  return $relativeOrPortablePath.Replace("/", [System.IO.Path]::DirectorySeparatorChar)
}

function New-ResizedBitmap {
  param(
    [System.Drawing.Image]$Image,
    [int]$TargetWidth,
    [int]$TargetHeight
  )

  $bmp = New-Object System.Drawing.Bitmap $TargetWidth, $TargetHeight
  $bmp.SetResolution($Image.HorizontalResolution, $Image.VerticalResolution)

  $graphics = [System.Drawing.Graphics]::FromImage($bmp)
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $rect = New-Object System.Drawing.Rectangle 0, 0, $TargetWidth, $TargetHeight
  $graphics.DrawImage($Image, $rect)
  $graphics.Dispose()
  return $bmp
}

function Get-JpegEncoder {
  return [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" } | Select-Object -First 1
}

function Save-Jpeg {
  param(
    [System.Drawing.Image]$Image,
    [string]$Path,
    [int]$Quality
  )

  $encoder = Get-JpegEncoder
  if (-not $encoder) {
    throw "JPEG encoder not found."
  }

  $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters 1
  $qualityParam = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]$Quality)
  $encoderParams.Param[0] = $qualityParam
  $Image.Save($Path, $encoder, $encoderParams)
  $encoderParams.Dispose()
  $qualityParam.Dispose()
}

function Has-AlphaChannel([System.Drawing.Image]$Image) {
  try {
    return [System.Drawing.Image]::IsAlphaPixelFormat($Image.PixelFormat)
  } catch {
    return $false
  }
}

function Has-NonOpaqueAlpha([System.Drawing.Bitmap]$Bitmap) {
  if (-not $Bitmap) { return $false }
  if (-not [System.Drawing.Image]::IsAlphaPixelFormat($Bitmap.PixelFormat)) { return $false }

  $stepX = [Math]::Max(1, [int][Math]::Floor($Bitmap.Width / 120))
  $stepY = [Math]::Max(1, [int][Math]::Floor($Bitmap.Height / 120))

  for ($y = 0; $y -lt $Bitmap.Height; $y += $stepY) {
    for ($x = 0; $x -lt $Bitmap.Width; $x += $stepX) {
      $pixel = $Bitmap.GetPixel($x, $y)
      if ($pixel.A -lt 255) {
        return $true
      }
    }
  }

  return $false
}

function Load-ImageUnlocked([string]$path) {
  $bytes = [System.IO.File]::ReadAllBytes($path)
  $ms = New-Object System.IO.MemoryStream (, $bytes)
  try {
    $img = [System.Drawing.Image]::FromStream($ms)
    try {
      return New-Object System.Drawing.Bitmap $img
    } finally {
      $img.Dispose()
    }
  } finally {
    $ms.Dispose()
  }
}

if (-not (Test-Path $SourceDir)) {
  throw "SourceDir not found: $SourceDir"
}

$sourceFull = [System.IO.Path]::GetFullPath($SourceDir)
$backupFull = [System.IO.Path]::GetFullPath($BackupDir)

if (-not $DryRun) {
  New-Item -ItemType Directory -Force -Path $backupFull | Out-Null
}

$convertPng = $ConvertPngWithoutAlphaToJpeg.IsPresent

$imageFiles = Get-ChildItem -Path $sourceFull -File -Recurse |
  Where-Object { $_.Extension -match '^\.(png|jpg|jpeg)$' -or $_.Extension -match '^\.(PNG|JPG|JPEG)$' }

$map = New-Object System.Collections.Generic.List[object]

foreach ($file in $imageFiles) {
  if ($file.FullName -like "$backupFull*") { continue }

  $ext = $file.Extension.ToLowerInvariant()
  $relativeSource = Get-RelativePath $sourceFull $file.FullName

  $targetPath = $file.FullName
  $targetExt = $ext

  $img = $null
  $resized = $null
  try {
    $img = Load-ImageUnlocked $file.FullName
    $width = $img.Width
    $height = $img.Height

    $needsResize = ($width -gt $MaxSize -or $height -gt $MaxSize) -and $MaxSize -gt 0
    $alpha = Has-AlphaChannel $img
    $hasNonOpaqueAlpha = if ($ext -eq ".png") { Has-NonOpaqueAlpha $img } else { $false }
    $opaquePng = ($ext -eq ".png") -and (-not $hasNonOpaqueAlpha)

    if ($ext -eq ".png" -and $convertPng -and $opaquePng) {
      $targetExt = ".jpg"
      $targetPath = [System.IO.Path]::ChangeExtension($file.FullName, $targetExt)
    }

    if ($needsResize) {
      $scale = [Math]::Min($MaxSize / $width, $MaxSize / $height)
      $newW = [Math]::Max(1, [int][Math]::Round($width * $scale))
      $newH = [Math]::Max(1, [int][Math]::Round($height * $scale))
      $resized = New-ResizedBitmap -Image $img -TargetWidth $newW -TargetHeight $newH
    }

    $relativeTarget = Get-RelativePath $sourceFull $targetPath
    $map.Add([PSCustomObject]@{
      source = $relativeSource
      target = $relativeTarget
      resized = $needsResize
      alpha = $alpha
      nonOpaqueAlpha = $hasNonOpaqueAlpha
    }) | Out-Null

    if ($DryRun) { continue }

    $shouldWrite =
      ($ext -ne ".png") -or
      ($targetPath -ne $file.FullName) -or
      $needsResize

    if (-not $shouldWrite) { continue }

    $backupPath = Join-Path $backupFull (To-NativePath $relativeSource)
    $backupDir = Split-Path -Parent $backupPath
    try {
      New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    } catch {
      Write-Host "Failed to create backup directory."
      Write-Host ("relativeSource: {0}" -f $relativeSource)
      Write-Host ("backupPath: {0}" -f $backupPath)
      Write-Host ("backupDir: {0}" -f $backupDir)
      throw
    }
    if (-not (Test-Path $backupPath)) {
      Copy-Item -LiteralPath $file.FullName -Destination $backupPath -Force
    }

    $outImage = if ($resized) { $resized } else { $img }

    if ($targetExt -eq ".jpg" -or $targetExt -eq ".jpeg") {
      Save-Jpeg -Image $outImage -Path $targetPath -Quality $JpegQuality
    } elseif ($targetExt -eq ".png") {
      $outImage.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } else {
      # fallback: keep original
      continue
    }

    if ($targetPath -ne $file.FullName -and (Test-Path $file.FullName)) {
      Remove-Item -LiteralPath $file.FullName -Force
    }
  } finally {
    if ($resized) { $resized.Dispose() }
    if ($img) { $img.Dispose() }
  }
}

$mapPath = "scripts/image-optimization-map.json"
if (-not $DryRun) {
  $json = $map | ConvertTo-Json -Depth 5
  $json | Set-Content -Path $mapPath -Encoding UTF8
}

Write-Host ("Processed {0} images." -f $map.Count)
Write-Host ("Backup dir: {0}" -f (Get-RelativePath (Get-Location).Path $backupFull))
Write-Host ("Map file: {0}" -f $mapPath)
if ($convertPng) {
  $converted = $map | Where-Object { $_.source -match '\.png$' -and $_.target -match '\.jpg$' }
  Write-Host ("Converted PNG->JPG: {0}" -f ($converted | Measure-Object).Count)
}
