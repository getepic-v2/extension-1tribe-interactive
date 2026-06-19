param(
  [string]$Folder = 'public\rive\Test_June2_4-5',
  [string]$OutputDir = '',
  [int]$Width = 1600,
  [int]$Height = 900,
  [string]$Animation = 'idle',
  [string]$StateMachine = '',
  [string]$Fit = 'contain',
  [int]$SettleMs = 1800,
  [string]$BaseUrl = 'http://localhost:8080',
  [string]$BrowserPath = '',
  [string]$OnlyBaseName = '',
  [string[]]$SinglePageSpreads = @()
)

$ErrorActionPreference = 'Stop'

function Get-BrowserPath {
  param([string]$PreferredPath)

  if ($PreferredPath) {
    if (Test-Path -LiteralPath $PreferredPath) {
      return (Resolve-Path -LiteralPath $PreferredPath).Path
    }

    throw "BrowserPath was provided but does not exist: $PreferredPath"
  }

  $candidates = @(
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  $command = Get-Command chrome.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  $command = Get-Command msedge.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  throw 'Could not find Microsoft Edge or Google Chrome.'
}

function Test-DevServer {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -Uri "$Url/word-hotspot-render.html" -UseBasicParsing -Method Head -TimeoutSec 3
    return [int]$response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Get-PageRange {
  param([string]$FileName)

  $match = [regex]::Match($FileName, 'spread_(\d+)[&-](\d+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($match.Success) {
    return @([int]$match.Groups[1].Value, [int]$match.Groups[2].Value)
  }

  $singleMatch = [regex]::Match($FileName, 'spread_(\d+)(?:\.riv)?$', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if (-not $singleMatch.Success) { return $null }

  $startPage = [int]$singleMatch.Groups[1].Value
  if (Test-SinglePageSpread $startPage) { return @($startPage) }
  if ($startPage -eq 0) { return @(0, 1) }
  if ($startPage -eq 1) { return @(0, 1) }
  if ($startPage -lt 1) { return @($startPage) }

  return @($startPage, ($startPage + 1))
}

function Get-JsonArray {
  param([object[]]$Values)

  return [object[]]@($Values)
}

function Test-SinglePageSpread {
  param([int]$Page)

  foreach ($entry in @($SinglePageSpreads)) {
    foreach ($part in ([string]$entry).Split(',')) {
      $value = 0
      if ([int]::TryParse($part.Trim(), [ref]$value) -and $value -eq $Page) {
        return $true
      }
    }
  }

  return $false
}

function Get-EventSafeWord {
  param([string]$Text)

  $clean = $Text.Trim().ToLowerInvariant()
  $clean = [regex]::Replace($clean, '[^\p{L}\p{Nd}]+', '_')
  $clean = $clean.Trim('_')
  if ($clean.Length -eq 0) { return 'word' }

  return $clean
}

function Wait-ForFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [int]$TimeoutMs = 15000
  )

  $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMs)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (Test-Path -LiteralPath $Path) {
      $item = Get-Item -LiteralPath $Path
      if ($item.Length -gt 0) {
        return $true
      }
    }

    Start-Sleep -Milliseconds 250
  }

  return $false
}

function Invoke-WindowsOcr {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ImagePath
  )

  $ocrJsonLines = powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'ocr-image-windows.ps1') -ImagePath $ImagePath
  if (-not $ocrJsonLines) {
    throw "OCR produced no output for $ImagePath"
  }

  $ocrJson = $ocrJsonLines -join [Environment]::NewLine
  return [pscustomobject]@{
    json = $ocrJson
    ocr = $ocrJson | ConvertFrom-Json
  }
}

function Add-OcrWord {
  param(
    [Parameter(Mandatory = $true)]
    [System.Collections.ArrayList]$Words,
    [Parameter(Mandatory = $true)]
    [hashtable]$Seen,
    [Parameter(Mandatory = $true)]
    $Word,
    [double]$OffsetX = 0,
    [double]$OffsetY = 0
  )

  $text = ([string]$Word.text).Trim()
  if (-not $text) { return }

  $x = [double]$Word.x + $OffsetX
  $y = [double]$Word.y + $OffsetY
  $width = [double]$Word.width
  $height = [double]$Word.height
  $key = '{0}|{1}|{2}' -f $text.ToLowerInvariant(), [math]::Round($x / 8), [math]::Round($y / 8)
  if ($Seen.ContainsKey($key)) { return }

  $Seen[$key] = $true
  [void]$Words.Add([pscustomobject]@{
    text = $text
    x = [math]::Round($x, 2)
    y = [math]::Round($y, 2)
    width = [math]::Round($width, 2)
    height = [math]::Round($height, 2)
  })
}

function Invoke-TiledOcr {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ImagePath,
    [Parameter(Mandatory = $true)]
    [string]$BaseName
  )

  Add-Type -AssemblyName System.Drawing

  $resolvedImagePath = (Resolve-Path -LiteralPath $ImagePath).Path
  $cropRoot = Join-Path ([System.IO.Path]::GetTempPath()) 'one-tribe-word-hotspot-crops'
  New-Item -ItemType Directory -Force -Path $cropRoot | Out-Null

  $image = [System.Drawing.Bitmap]::FromFile($resolvedImagePath)
  $words = [System.Collections.ArrayList]::new()
  $seen = @{}
  $textParts = [System.Collections.Generic.List[string]]::new()

  try {
    $imageWidth = [int]$image.Width
    $imageHeight = [int]$image.Height
    $columns = @(
      @{ X = 0; Width = [math]::Min($imageWidth, [math]::Ceiling($imageWidth * 0.54)) },
      @{ X = [math]::Floor($imageWidth * 0.46); Width = $imageWidth - [math]::Floor($imageWidth * 0.46) }
    )
    $cropHeight = [math]::Ceiling($imageHeight * 0.42)
    $rowStarts = @(
      0,
      [math]::Floor($imageHeight * 0.28),
      [math]::Floor($imageHeight * 0.56)
    )
    $cropIndex = 0

    foreach ($rowStart in $rowStarts) {
      foreach ($column in $columns) {
        $cropX = [int]$column.X
        $cropY = [int]$rowStart
        $cropWidth = [int]$column.Width
        $cropBottom = [math]::Min($imageHeight, $cropY + $cropHeight)
        $cropActualHeight = [int]($cropBottom - $cropY)
        if ($cropWidth -le 0 -or $cropActualHeight -le 0) { continue }

        $cropIndex += 1
        $cropPath = Join-Path $cropRoot "$BaseName-$cropIndex.png"
        $rect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropWidth, $cropActualHeight)
        $cropBitmap = $image.Clone($rect, $image.PixelFormat)

        try {
          $cropBitmap.Save($cropPath, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
          $cropBitmap.Dispose()
        }

        try {
          $cropResult = Invoke-WindowsOcr $cropPath
          $cropOcr = $cropResult.ocr
          if ([string]$cropOcr.text) {
            $textParts.Add([string]$cropOcr.text)
          }

          foreach ($word in @($cropOcr.words)) {
            Add-OcrWord -Words $words -Seen $seen -Word $word -OffsetX $cropX -OffsetY $cropY
          }
        } catch {
          Write-Warning "Tiled OCR failed for $cropPath`: $($_.Exception.Message)"
        }
      }
    }

    return [pscustomobject]@{
      image = $resolvedImagePath
      text = ($textParts -join ' ')
      width = $imageWidth
      height = $imageHeight
      words = @($words)
    }
  } finally {
    $image.Dispose()
  }
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$folderPath = (Resolve-Path -LiteralPath (Join-Path $repoRoot $Folder)).Path
$folderName = Split-Path -Leaf $folderPath

if (-not $OutputDir) {
  $OutputDir = Join-Path $folderPath 'word-hotspots'
} elseif (-not [System.IO.Path]::IsPathRooted($OutputDir)) {
  $OutputDir = Join-Path $repoRoot $OutputDir
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$OutputDir = (Resolve-Path -LiteralPath $OutputDir).Path

if (-not (Test-DevServer $BaseUrl)) {
  throw "The dev server is not reachable at $BaseUrl. Start it with npm run dev:serve first."
}

$browser = Get-BrowserPath $BrowserPath
$browserProfileRoot = Join-Path ([System.IO.Path]::GetTempPath()) 'one-tribe-word-hotspots'
New-Item -ItemType Directory -Force -Path $browserProfileRoot | Out-Null
$files = Get-ChildItem -LiteralPath $folderPath -Filter '*.riv' | Sort-Object Name
if ($OnlyBaseName.Trim()) {
  $onlyName = [System.IO.Path]::GetFileNameWithoutExtension($OnlyBaseName.Trim())
  $files = @($files | Where-Object { [System.IO.Path]::GetFileNameWithoutExtension($_.Name) -eq $onlyName })
}
if (-not $files.Count) {
  throw "No .riv files found in $folderPath"
}

$results = @()

foreach ($file in $files) {
  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
  $safeBaseName = [regex]::Replace($baseName, '[^\w.-]+', '_')
  $screenshotPath = Join-Path $OutputDir "$baseName.png"
  $ocrPath = Join-Path $OutputDir "$baseName.ocr.json"
  $browserProfileDir = Join-Path $browserProfileRoot "$safeBaseName-$([System.Guid]::NewGuid().ToString('N').Substring(0, 8))"
  $rivePath = "/rive/$folderName/$([uri]::EscapeDataString($file.Name))"
  $url = "$BaseUrl/word-hotspot-render.html?file=$([uri]::EscapeDataString($rivePath))&animation=$([uri]::EscapeDataString($Animation))&stateMachine=$([uri]::EscapeDataString($StateMachine))&fit=$([uri]::EscapeDataString($Fit))&w=$Width&h=$Height&settleMs=$SettleMs"

  New-Item -ItemType Directory -Force -Path $browserProfileDir | Out-Null
  if (Test-Path -LiteralPath $screenshotPath) {
    Remove-Item -LiteralPath $screenshotPath -Force
  }
  if (Test-Path -LiteralPath $ocrPath) {
    Remove-Item -LiteralPath $ocrPath -Force
  }

  Write-Host "Rendering $($file.Name)..."
  $arguments = @(
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-breakpad',
    '--disable-component-update',
    '--disable-crash-reporter',
    '--disable-crashpad',
    '--disable-default-apps',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    '--disable-features=NetworkServiceSandbox',
    '--disable-sync',
    '--hide-scrollbars',
    '--no-default-browser-check',
    '--no-first-run',
    '--run-all-compositor-stages-before-draw',
    "--user-data-dir=$browserProfileDir",
    "--window-size=$Width,$Height",
    "--virtual-time-budget=$([math]::Max(2500, $SettleMs + 1200))",
    "--screenshot=$screenshotPath",
    $url
  )

  & $browser @arguments
  $browserExitCode = [int]$LASTEXITCODE
  $hasScreenshot = Wait-ForFile $screenshotPath -TimeoutMs ([math]::Max(60000, $SettleMs + 45000))
  if ($browserExitCode -ne 0 -and -not $hasScreenshot) {
    throw "Browser screenshot failed for $($file.Name) with exit code $browserExitCode."
  }
  if (-not $hasScreenshot) {
    throw "Browser did not create screenshot: $screenshotPath"
  }
  if ($browserExitCode -ne 0) {
    Write-Warning "Browser returned exit code $browserExitCode after creating $screenshotPath; continuing."
  }

  Write-Host "OCR $($file.Name)..."
  $ocrResult = Invoke-WindowsOcr $screenshotPath
  $ocr = $ocrResult.ocr
  $ocrJson = $ocrResult.json
  if (@($ocr.words).Count -lt 5) {
    Write-Host "OCR found only $(@($ocr.words).Count) word(s); retrying with tiled crops..."
    $tiledOcr = Invoke-TiledOcr -ImagePath $screenshotPath -BaseName $safeBaseName
    if (@($tiledOcr.words).Count -gt @($ocr.words).Count) {
      $ocr = $tiledOcr
      $ocrJson = $ocr | ConvertTo-Json -Depth 6
    }
  }

  $ocrJson | Set-Content -Path $ocrPath -Encoding UTF8
  $imageWidth = [double]$ocr.width
  $imageHeight = [double]$ocr.height
  $words = @()

  foreach ($word in @($ocr.words)) {
    $text = [string]$word.text
    if (-not $text.Trim()) { continue }

    $x = [double]$word.x
    $y = [double]$word.y
    $wordWidth = [double]$word.width
    $wordHeight = [double]$word.height
    $safeWord = Get-EventSafeWord $text

    $words += [pscustomobject]@{
      text = $text
      bbox = [pscustomobject]@{
        x = [math]::Round($x, 2)
        y = [math]::Round($y, 2)
        width = [math]::Round($wordWidth, 2)
        height = [math]::Round($wordHeight, 2)
      }
      normalized = [pscustomobject]@{
        x = [math]::Round($x / $imageWidth, 6)
        y = [math]::Round($y / $imageHeight, 6)
        width = [math]::Round($wordWidth / $imageWidth, 6)
        height = [math]::Round($wordHeight / $imageHeight, 6)
      }
      rive = [pscustomobject]@{
        eventName = 'lookup_word'
        property = [pscustomobject]@{ word = $text }
        encodedEventName = "lookup_word_$safeWord"
      }
    }
  }

  $results += [pscustomobject]@{
    file = $file.Name
    pages = Get-JsonArray @(Get-PageRange $file.Name)
    screenshot = "$baseName.png"
    ocr = "$baseName.ocr.json"
    render = [pscustomobject]@{
      width = [int]$imageWidth
      height = [int]$imageHeight
    }
    text = [string]$ocr.text
    words = $words
  }
}

$manifest = [pscustomobject]@{
  generatedAt = (Get-Date).ToString('o')
  sourceFolder = $folderPath
  render = [pscustomobject]@{
    width = $Width
    height = $Height
    animation = $Animation
    stateMachine = $StateMachine
    fit = $Fit
    settleMs = $SettleMs
  }
  files = $results
}

$manifestPath = Join-Path $OutputDir 'word-hotspots.json'
$manifest | ConvertTo-Json -Depth 10 | Set-Content -Path $manifestPath -Encoding UTF8

Write-Host "Wrote $manifestPath"
