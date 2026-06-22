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
  [switch]$UseArtboardRenderSize,
  [int]$RenderScale = 2,
  [int]$ArtboardWidth = 0,
  [int]$ArtboardHeight = 0,
  [double]$OcrWordPaddingX = 0,
  [double]$OcrWordPaddingY = 0,
  [string]$StylizedTitleBaseName = '',
  [string[]]$StylizedTitleWords = @(),
  [double]$StylizedTitleMinXRatio = 0.42,
  [double]$StylizedTitleMaxYRatio = 0.42,
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

function Get-RiveArtboardMetadata {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Browser,
    [Parameter(Mandatory = $true)]
    [string]$BrowserProfileRoot,
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,
    [Parameter(Mandatory = $true)]
    [string]$FolderName,
    [Parameter(Mandatory = $true)]
    [string]$FileName,
    [string]$Animation = 'idle',
    [string]$StateMachine = '',
    [string]$Fit = 'contain'
  )

  $profileName = 'metadata-' + ([System.Guid]::NewGuid().ToString('N').Substring(0, 8))
  $browserProfileDir = Join-Path $BrowserProfileRoot $profileName
  New-Item -ItemType Directory -Force -Path $browserProfileDir | Out-Null

  $rivePath = "/rive/$FolderName/$([uri]::EscapeDataString($FileName))"
  $url = "$BaseUrl/word-hotspot-render.html?file=$([uri]::EscapeDataString($rivePath))&animation=$([uri]::EscapeDataString($Animation))&stateMachine=$([uri]::EscapeDataString($StateMachine))&fit=$([uri]::EscapeDataString($Fit))&w=800&h=600&settleMs=100&status=1&metadata=1"
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
    '--window-size=800,600',
    '--virtual-time-budget=4000',
    '--dump-dom',
    $url
  )

  try {
    $domLines = & $Browser @arguments
    $browserExitCode = [int]$LASTEXITCODE
    if ($browserExitCode -ne 0) {
      throw "Browser metadata probe failed for $FileName with exit code $browserExitCode."
    }

    $dom = $domLines -join [Environment]::NewLine
    $match = [regex]::Match(
      $dom,
      '<script[^>]*id=["'']word-hotspot-metadata["''][^>]*>(.*?)</script>',
      [System.Text.RegularExpressions.RegexOptions]::IgnoreCase -bor [System.Text.RegularExpressions.RegexOptions]::Singleline
    )
    if (-not $match.Success) {
      throw "Could not find Rive artboard metadata in render output for $FileName."
    }

    $json = [System.Net.WebUtility]::HtmlDecode($match.Groups[1].Value)
    return $json | ConvertFrom-Json
  } finally {
    if (Test-Path -LiteralPath $browserProfileDir) {
      Remove-Item -LiteralPath $browserProfileDir -Recurse -Force -ErrorAction SilentlyContinue
    }
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

function Add-StylizedTitleWordsFromImage {
  param(
    [Parameter(Mandatory = $true)]
    $Ocr,
    [Parameter(Mandatory = $true)]
    [string]$ImagePath,
    [Parameter(Mandatory = $true)]
    [string[]]$TitleWords,
    [double]$MinXRatio = 0.45,
    [double]$MaxYRatio = 0.38
  )

  if (-not @($TitleWords).Count) { return $Ocr }

  Add-Type -AssemblyName System.Drawing

  $resolvedImagePath = (Resolve-Path -LiteralPath $ImagePath).Path
  $image = [System.Drawing.Bitmap]::FromFile($resolvedImagePath)
  try {
    $imageWidth = [int]$image.Width
    $imageHeight = [int]$image.Height
    $minX = [math]::Max(0, [math]::Floor($imageWidth * $MinXRatio))
    $maxY = [math]::Min($imageHeight - 1, [math]::Ceiling($imageHeight * $MaxYRatio))
    $rowCounts = New-Object int[] ($maxY + 1)

    for ($y = 0; $y -le $maxY; $y += 1) {
      $count = 0
      for ($x = $minX; $x -lt $imageWidth; $x += 1) {
        $color = $image.GetPixel($x, $y)
        if ($color.G -gt 95 -and ($color.G - [math]::Max($color.R, $color.B)) -gt 24) {
          $count += 1
        }
      }
      $rowCounts[$y] = $count
    }

    $bands = [System.Collections.ArrayList]::new()
    $bandStart = $null
    $rowThreshold = [math]::Max(8, [math]::Floor($imageWidth * 0.003))
    for ($y = 0; $y -le $maxY; $y += 1) {
      if ($rowCounts[$y] -ge $rowThreshold) {
        if ($null -eq $bandStart) { $bandStart = $y }
      } elseif ($null -ne $bandStart) {
        if (($y - $bandStart) -ge 20) {
          [void]$bands.Add([pscustomobject]@{ Start = [int]$bandStart; End = [int]($y - 1) })
        }
        $bandStart = $null
      }
    }
    if ($null -ne $bandStart -and (($maxY - $bandStart) -ge 20)) {
      [void]$bands.Add([pscustomobject]@{ Start = [int]$bandStart; End = [int]$maxY })
    }

    $boxes = [System.Collections.ArrayList]::new()
    foreach ($band in @($bands)) {
      $left = $imageWidth
      $right = 0
      $top = $imageHeight
      $bottom = 0
      for ($y = [int]$band.Start; $y -le [int]$band.End; $y += 1) {
        for ($x = $minX; $x -lt $imageWidth; $x += 1) {
          $color = $image.GetPixel($x, $y)
          if ($color.G -gt 95 -and ($color.G - [math]::Max($color.R, $color.B)) -gt 24) {
            if ($x -lt $left) { $left = $x }
            if ($x -gt $right) { $right = $x }
            if ($y -lt $top) { $top = $y }
            if ($y -gt $bottom) { $bottom = $y }
          }
        }
      }

      $boxWidth = $right - $left + 1
      $boxHeight = $bottom - $top + 1
      if ($boxWidth -ge 80 -and $boxHeight -ge 24) {
        $padX = [math]::Max(6, [math]::Round($boxWidth * 0.015))
        $padY = [math]::Max(5, [math]::Round($boxHeight * 0.045))
        [void]$boxes.Add([pscustomobject]@{
          x = [math]::Max(0, $left - $padX)
          y = [math]::Max(0, $top - $padY)
          width = [math]::Min($imageWidth, $right + $padX) - [math]::Max(0, $left - $padX)
          height = [math]::Min($imageHeight, $bottom + $padY) - [math]::Max(0, $top - $padY)
        })
      }
    }

    if ($boxes.Count -lt @($TitleWords).Count -and @($TitleWords).Count -eq 2) {
      $activeRows = @()
      for ($y = 0; $y -le $maxY; $y += 1) {
        if ($rowCounts[$y] -ge $rowThreshold) {
          $activeRows += $y
        }
      }

      if ($activeRows.Count -gt 20) {
        $startY = [int]($activeRows | Select-Object -First 1)
        $endY = [int]($activeRows | Select-Object -Last 1)
        $spanY = $endY - $startY
        $splitStart = [int]($startY + $spanY * 0.35)
        $splitEnd = [int]($startY + $spanY * 0.7)
        $splitY = $splitStart
        $bestCount = [int]::MaxValue

        for ($y = $splitStart; $y -le $splitEnd; $y += 1) {
          if ($rowCounts[$y] -lt $bestCount) {
            $bestCount = $rowCounts[$y]
            $splitY = $y
          }
        }

        $boxes.Clear()
        foreach ($range in @(
          @{ Start = $startY; End = $splitY },
          @{ Start = $splitY + 1; End = $endY }
        )) {
          $left = $imageWidth
          $right = 0
          $top = $imageHeight
          $bottom = 0
          for ($y = [int]$range.Start; $y -le [int]$range.End; $y += 1) {
            for ($x = $minX; $x -lt $imageWidth; $x += 1) {
              $color = $image.GetPixel($x, $y)
              if ($color.G -gt 95 -and ($color.G - [math]::Max($color.R, $color.B)) -gt 24) {
                if ($x -lt $left) { $left = $x }
                if ($x -gt $right) { $right = $x }
                if ($y -lt $top) { $top = $y }
                if ($y -gt $bottom) { $bottom = $y }
              }
            }
          }

          $boxWidth = $right - $left + 1
          $boxHeight = $bottom - $top + 1
          if ($boxWidth -ge 80 -and $boxHeight -ge 24) {
            $padX = [math]::Max(6, [math]::Round($boxWidth * 0.015))
            $padY = [math]::Max(5, [math]::Round($boxHeight * 0.045))
            [void]$boxes.Add([pscustomobject]@{
              x = [math]::Max(0, $left - $padX)
              y = [math]::Max(0, $top - $padY)
              width = [math]::Min($imageWidth, $right + $padX) - [math]::Max(0, $left - $padX)
              height = [math]::Min($imageHeight, $bottom + $padY) - [math]::Max(0, $top - $padY)
            })
          }
        }
      }
    }

    $wordList = [System.Collections.ArrayList]::new()
    foreach ($word in @($Ocr.words)) {
      [void]$wordList.Add($word)
    }
    $existingWords = @{}
    foreach ($word in @($Ocr.words)) {
      $existingWords[((([string]$word.text).Trim()).ToLowerInvariant())] = $true
    }

    $selectedBoxes = @($boxes | Sort-Object y | Select-Object -First @($TitleWords).Count)
    for ($index = 0; $index -lt @($TitleWords).Count -and $index -lt $selectedBoxes.Count; $index += 1) {
      $titleWord = ([string]$TitleWords[$index]).Trim()
      if (-not $titleWord) { continue }
      if ($existingWords.ContainsKey($titleWord.ToLowerInvariant())) { continue }

      $box = $selectedBoxes[$index]
      [void]$wordList.Add([pscustomobject]@{
        text = $titleWord
        x = [math]::Round([double]$box.x, 2)
        y = [math]::Round([double]$box.y, 2)
        width = [math]::Round([double]$box.width, 2)
        height = [math]::Round([double]$box.height, 2)
      })
    }

    $Ocr.words = @($wordList)
    $Ocr.text = ((@($TitleWords) + @([string]$Ocr.text)) -join ' ').Trim()
    return $Ocr
  } finally {
    $image.Dispose()
  }
}

function Get-StylizedTitleWordList {
  param([string[]]$Values)

  $words = [System.Collections.Generic.List[string]]::new()
  foreach ($value in @($Values)) {
    foreach ($part in ([string]$value).Split(',')) {
      $word = $part.Trim()
      if ($word) { $words.Add($word) }
    }
  }

  return [string[]]$words.ToArray()
}

function Expand-OcrWordBoxes {
  param(
    [Parameter(Mandatory = $true)]
    $Ocr,
    [double]$PaddingX = 0,
    [double]$PaddingY = 0
  )

  $imageWidth = [double]$Ocr.width
  $imageHeight = [double]$Ocr.height
  if (
    [double]::IsNaN($imageWidth) -or
    [double]::IsInfinity($imageWidth) -or
    [double]::IsNaN($imageHeight) -or
    [double]::IsInfinity($imageHeight) -or
    $imageWidth -le 0 -or
    $imageHeight -le 0
  ) {
    return $Ocr
  }

  $padX = [math]::Max(0, [double]$PaddingX)
  $padY = [math]::Max(0, [double]$PaddingY)
  if ($padX -le 0 -and $padY -le 0) { return $Ocr }

  foreach ($word in @($Ocr.words)) {
    $x = [double]$word.x
    $y = [double]$word.y
    $width = [double]$word.width
    $height = [double]$word.height
    if (
      [double]::IsNaN($x) -or
      [double]::IsInfinity($x) -or
      [double]::IsNaN($y) -or
      [double]::IsInfinity($y) -or
      [double]::IsNaN($width) -or
      [double]::IsInfinity($width) -or
      [double]::IsNaN($height) -or
      [double]::IsInfinity($height) -or
      $width -le 0 -or
      $height -le 0
    ) {
      continue
    }

    $left = [math]::Max(0, $x - $padX)
    $top = [math]::Max(0, $y - $padY)
    $right = [math]::Min($imageWidth, $x + $width + $padX)
    $bottom = [math]::Min($imageHeight, $y + $height + $padY)
    $word.x = [math]::Round($left, 2)
    $word.y = [math]::Round($top, 2)
    $word.width = [math]::Round([math]::Max(1, $right - $left), 2)
    $word.height = [math]::Round([math]::Max(1, $bottom - $top), 2)
  }

  return $Ocr
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

$renderSizeSource = 'explicit'
$artboardMetadata = $null
$stylizedTitleWordList = Get-StylizedTitleWordList $StylizedTitleWords
if ($UseArtboardRenderSize) {
  $artboardMetadata = Get-RiveArtboardMetadata `
    -Browser $browser `
    -BrowserProfileRoot $browserProfileRoot `
    -BaseUrl $BaseUrl `
    -FolderName $folderName `
    -FileName $files[0].Name `
    -Animation $Animation `
    -StateMachine $StateMachine `
    -Fit $Fit
  $ArtboardWidth = [int][math]::Round([double]$artboardMetadata.artboardWidth)
  $ArtboardHeight = [int][math]::Round([double]$artboardMetadata.artboardHeight)
  $renderSizeSource = 'rive-artboard'
}

if (($ArtboardWidth -gt 0) -or ($ArtboardHeight -gt 0)) {
  if ($ArtboardWidth -le 0 -or $ArtboardHeight -le 0) {
    throw 'Both ArtboardWidth and ArtboardHeight are required when using artboard render sizing.'
  }
  if ($RenderScale -le 0) {
    throw 'RenderScale must be greater than 0.'
  }

  $Width = [int][math]::Round($ArtboardWidth * $RenderScale)
  $Height = [int][math]::Round($ArtboardHeight * $RenderScale)
  if ($renderSizeSource -eq 'explicit') {
    $renderSizeSource = 'artboard-params'
  }
  Write-Host "Using $renderSizeSource render size $Width x $Height from artboard $ArtboardWidth x $ArtboardHeight at ${RenderScale}x."
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

  $stylizedTitleBase = [System.IO.Path]::GetFileNameWithoutExtension($StylizedTitleBaseName.Trim())
  if (@($stylizedTitleWordList).Count -gt 0 -and (-not $stylizedTitleBase -or $stylizedTitleBase -eq $baseName)) {
    $ocr = Add-StylizedTitleWordsFromImage `
      -Ocr $ocr `
      -ImagePath $screenshotPath `
      -TitleWords $stylizedTitleWordList `
      -MinXRatio $StylizedTitleMinXRatio `
      -MaxYRatio $StylizedTitleMaxYRatio
  }

  $ocr = Expand-OcrWordBoxes -Ocr $ocr -PaddingX $OcrWordPaddingX -PaddingY $OcrWordPaddingY
  $ocrJson = $ocr | ConvertTo-Json -Depth 6

  $ocrJson | Set-Content -Path $ocrPath -Encoding UTF8
  $imageWidth = [double]$ocr.width
  $imageHeight = [double]$ocr.height
  if ($imageWidth -le 0 -or $imageHeight -le 0) {
    throw "OCR returned invalid image dimensions for $($screenshotPath)"
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
  }
}

$manifest = [pscustomobject]@{
  generatedAt = (Get-Date).ToString('o')
  sourceFolder = $folderPath
  render = [pscustomobject]@{
    width = $Width
    height = $Height
    source = $renderSizeSource
    artboardWidth = if ($ArtboardWidth -gt 0) { $ArtboardWidth } else { $null }
    artboardHeight = if ($ArtboardHeight -gt 0) { $ArtboardHeight } else { $null }
    renderScale = if ($ArtboardWidth -gt 0 -and $ArtboardHeight -gt 0) { $RenderScale } else { $null }
    metadataFile = if ($artboardMetadata) { $files[0].Name } else { $null }
    ocrWordPaddingX = $OcrWordPaddingX
    ocrWordPaddingY = $OcrWordPaddingY
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
