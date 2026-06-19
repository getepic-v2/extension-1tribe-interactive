param(
  [Parameter(Mandatory = $true)]
  [string]$Folder,
  [string]$SourceFolder = '',
  [int]$PaddingX = 2,
  [string]$CleanTextManifest = '',
  [string]$OnlyBaseName = '',
  [string[]]$SinglePageSpreads = @()
)

$ErrorActionPreference = 'Stop'

function Get-PageRange {
  param([string]$FileName)

  $rangeMatch = [regex]::Match($FileName, 'spread_(\d+)[&-](\d+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($rangeMatch.Success) {
    return @([int]$rangeMatch.Groups[1].Value, [int]$rangeMatch.Groups[2].Value)
  }

  $singleMatch = [regex]::Match($FileName, 'spread_(\d+)(?:\.png)?$', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if (-not $singleMatch.Success) { return @() }

  $startPage = [int]$singleMatch.Groups[1].Value
  if (Test-SinglePageSpread $startPage) { return @($startPage) }
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

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Content
  )

  $encoding = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Get-CleanInstructionToken {
  param([string]$Text)

  return ([regex]::Replace($Text, '[^A-Za-z0-9''-]+', '')).ToLowerInvariant()
}

function Remove-InstructionWords {
  param([object[]]$Words)

  $kept = [System.Collections.Generic.List[object]]::new()
  $index = 0

  while ($index -lt $Words.Count) {
    $token = Get-CleanInstructionToken ([string]$Words[$index].text)
    if ($token -eq 'tap') {
      $endIndex = -1
      $sawInstructionPhrase = $false
      $limit = [math]::Min($Words.Count - 1, $index + 18)

      for ($scan = $index; $scan -le $limit; $scan += 1) {
        $scanToken = Get-CleanInstructionToken ([string]$Words[$scan].text)
        if ($scanToken -eq 'when' -or $scanToken -eq 'find') {
          $sawInstructionPhrase = $true
        }
        if (($scanToken -eq 'it' -or $scanToken -eq 'them') -and $sawInstructionPhrase) {
          $endIndex = $scan
          break
        }
      }

      if ($endIndex -ge $index) {
        $index = $endIndex + 1
        continue
      }
    }

    $kept.Add($Words[$index])
    $index += 1
  }

  return @($kept)
}

function Remove-NonStoryWords {
  param([object[]]$Words)

  return @(
    $Words | Where-Object {
      $token = Get-CleanInstructionToken ([string]$_.text)
      $token -and $token -ne 'oya' -and $token -notmatch '^\d+$'
    }
  )
}

function Repair-OcrWordText {
  param([string]$Text)

  switch -CaseSensitive ($Text) {
    '+0' { return 'to' }
    '+00' { return 'too' }
    '+he' { return 'the' }
    '+hey' { return 'they' }
    '*hey' { return 'they' }
    '*urn' { return 'turn' }
    'Af' { return 'At' }
    'Auni' { return 'Aunt' }
    'abouf' { return 'about' }
    'buf' { return 'but' }
    'caferpillar' { return 'caterpillar' }
    'criffers' { return 'critters' }
    'fake' { return 'take' }
    'fakes' { return 'takes' }
    'fails.' { return 'tails.' }
    'favorife' { return 'favorite' }
    'fells' { return 'tells' }
    'fhings' { return 'things' }
    'fo' { return 'to' }
    'foo' { return 'too' }
    'frail,' { return 'trail,' }
    'free' { return 'tree' }
    'free.' { return 'tree.' }
    'frees.' { return 'trees.' }
    'fronf' { return 'front' }
    'fwirly-whirly' { return 'twirly-whirly' }
    'gef' { return 'get' }
    'Iamb!' { return 'lamb!' }
    'ICan' { return 'I Can' }
    'Iasi' { return 'last' }
    'if' { return 'it' }
    'If' { return 'It' }
    'info' { return 'into' }
    'Nexf' { return 'Next' }
    'no}' { return 'not' }
    'nud' { return 'mud' }
    'Of' { return 'of' }
    'ouf' { return 'out' }
    'pic+ure' { return 'picture' }
    'picfures' { return 'pictures' }
    'plan}!' { return 'plant!' }
    'plan+ed' { return 'planted' }
    'puf' { return 'put' }
    'q' { return 'a' }
    'spofs.' { return 'spots.' }
    'Spring.' { return 'Spring' }
    'Springo' { return 'Spring' }
    'The' { return 'the' }
    'This' { return 'this' }
    'Tiny,' { return 'tiny,' }
    'waif' { return 'wait' }
    'wifh' { return 'with' }
    '{he' { return 'the' }
  }

  return $Text
}

function Repair-OcrWords {
  param([object[]]$Words)

  foreach ($word in $Words) {
    $word.text = Repair-OcrWordText ([string]$word.text)
  }

  return @($Words)
}

function Get-ManifestWordsByFile {
  param([string]$ManifestPath)

  $wordsByFile = @{}
  if (-not $ManifestPath) { return $wordsByFile }
  if (-not (Test-Path -LiteralPath $ManifestPath)) { return $wordsByFile }

  $manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
  foreach ($file in @($manifest.files)) {
    if (-not $file.file) { continue }
    $wordsByFile[[string]$file.file] = @($file.words)
  }

  return $wordsByFile
}

function Use-CleanTextWhenAligned {
  param(
    [object[]]$Words,
    [object[]]$CleanWords
  )

  if (-not $CleanWords -or $Words.Count -ne $CleanWords.Count) {
    return @($Words)
  }

  $firstWord = Get-CleanInstructionToken ([string]$Words[0].text)
  $firstCleanWord = Get-CleanInstructionToken ([string]$CleanWords[0].text)
  if ($firstWord -ne $firstCleanWord) {
    return @($Words)
  }

  for ($index = 0; $index -lt $Words.Count; $index += 1) {
    $cleanText = [string]$CleanWords[$index].text
    if ($cleanText.Trim()) {
      $Words[$index].text = $cleanText
    }
  }

  return @($Words)
}

function New-OcrWord {
  param(
    [string]$Text,
    [double]$X,
    [double]$Y,
    [double]$Width,
    [double]$Height
  )

  return [pscustomobject]@{
    text = $Text
    x = [math]::Round($X, 2)
    y = [math]::Round($Y, 2)
    width = [math]::Round($Width, 2)
    height = [math]::Round($Height, 2)
  }
}

function Add-MissingWords {
  param(
    [object[]]$Words,
    [string]$BaseName
  )

  $patched = [System.Collections.Generic.List[object]]::new()
  for ($index = 0; $index -lt $Words.Count; $index += 1) {
    $word = $Words[$index]
    $previous = if ($index -gt 0) { [string]$Words[$index - 1].text } else { '' }
    $current = [string]$word.text

    if ($BaseName -eq '83936_spread_01' -and $index -eq 0 -and $current -eq 'Can' -and [double]$word.y -lt 180) {
      $patched.Add((New-OcrWord -Text 'epic!' -X 842 -Y 62 -Width 84 -Height 38))
      $patched.Add((New-OcrWord -Text 'I' -X ([double]$word.x - 22) -Y ([double]$word.y) -Width 13 -Height ([double]$word.height)))
    }

    if ($BaseName -eq '83936_spread_06' -and $current -eq 'hatch.' -and $previous -eq 'eggs') {
      $patched.Add((New-OcrWord -Text 'to' -X ([double]$word.x - 31) -Y ([double]$word.y) -Width 23 -Height ([double]$word.height)))
    }

    if ($BaseName -eq '83936_spread_20' -and $current -eq 'house,' -and $previous -eq 'to') {
      $x = [double]$Words[$index - 1].x + [double]$Words[$index - 1].width + 8
      $width = [math]::Max(30, [double]$word.x - $x - 8)
      $patched.Add((New-OcrWord -Text 'the' -X $x -Y ([double]$word.y) -Width $width -Height ([double]$word.height)))
    }

    $patched.Add($word)
  }

  return @($patched)
}

$folderPath = (Resolve-Path -LiteralPath $Folder).Path
if (-not $SourceFolder) {
  $SourceFolder = Split-Path -Parent $folderPath
}
$sourceFolderPath = (Resolve-Path -LiteralPath $SourceFolder).Path
$cleanWordsByFile = Get-ManifestWordsByFile $CleanTextManifest

$pngFiles = Get-ChildItem -LiteralPath $folderPath -Filter '*.png' | Sort-Object Name
if ($OnlyBaseName.Trim()) {
  $onlyName = [System.IO.Path]::GetFileNameWithoutExtension($OnlyBaseName.Trim())
  $pngFiles = @($pngFiles | Where-Object { [System.IO.Path]::GetFileNameWithoutExtension($_.Name) -eq $onlyName })
}
if (-not $pngFiles.Count) {
  throw "No PNG files found in $folderPath"
}

$results = @()

foreach ($png in $pngFiles) {
  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($png.Name)
  $ocrPath = Join-Path $folderPath "$baseName.ocr.json"

  Write-Host "OCR $($png.Name)..."
  $ocrJsonLines = powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'ocr-image-windows.ps1') -ImagePath $png.FullName
  if (-not $ocrJsonLines) {
    throw "OCR produced no output for $($png.FullName)"
  }

  $ocr = ($ocrJsonLines -join [Environment]::NewLine) | ConvertFrom-Json
  $ocr.words = @(Remove-InstructionWords @($ocr.words))
  $ocr.words = @(Repair-OcrWords @($ocr.words))
  $ocr.words = @(Remove-NonStoryWords @($ocr.words))
  $ocr.words = @(Add-MissingWords @($ocr.words) $baseName)
  $ocr.words = @(Use-CleanTextWhenAligned @($ocr.words) @($cleanWordsByFile["$baseName.riv"]))
  $ocr.text = (@($ocr.words) | ForEach-Object { [string]$_.text }) -join ' '
  Write-Utf8NoBom -Path $ocrPath -Content ($ocr | ConvertTo-Json -Depth 8)

  $imageWidth = [double]$ocr.width
  $imageHeight = [double]$ocr.height
  if ($imageWidth -le 0 -or $imageHeight -le 0) {
    throw "OCR returned invalid image dimensions for $($png.FullName)"
  }

  $words = @()
  foreach ($word in @($ocr.words)) {
    $text = [string]$word.text
    if (-not $text.Trim()) { continue }

    $x = [double]$word.x
    $y = [double]$word.y
    $wordWidth = [double]$word.width
    $wordHeight = [double]$word.height
    if ($wordWidth -le 0 -or $wordHeight -le 0) { continue }

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
    file = "$baseName.riv"
    pages = Get-JsonArray @(Get-PageRange $png.Name)
    screenshot = $png.Name
    ocr = "$baseName.ocr.json"
    render = [pscustomobject]@{
      width = [int]$imageWidth
      height = [int]$imageHeight
    }
    text = [string]$ocr.text
    words = $words
  }
}

$firstOcr = Get-Content -LiteralPath (Join-Path $folderPath "$([System.IO.Path]::GetFileNameWithoutExtension($pngFiles[0].Name)).ocr.json") -Raw | ConvertFrom-Json
$manifest = [pscustomobject]@{
  generatedAt = (Get-Date).ToString('o')
  sourceFolder = $sourceFolderPath
  sourceImages = $folderPath
  render = [pscustomobject]@{
    width = [int]$firstOcr.width
    height = [int]$firstOcr.height
  }
  wordPadding = [pscustomobject]@{
    x = $PaddingX
    y = 0
  }
  files = $results
}

$manifestPath = Join-Path $folderPath 'word-hotspots.json'
if ($OnlyBaseName.Trim() -and (Test-Path -LiteralPath $manifestPath)) {
  $existingManifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  $updatedByFile = @{}
  foreach ($result in @($results)) {
    $updatedByFile[[string]$result.file] = $result
  }

  $mergedFiles = @()
  foreach ($file in @($existingManifest.files)) {
    $fileName = [string]$file.file
    if ($updatedByFile.ContainsKey($fileName)) {
      $mergedFiles += $updatedByFile[$fileName]
      $updatedByFile.Remove($fileName)
    } else {
      $mergedFiles += $file
    }
  }
  foreach ($remaining in $updatedByFile.Values) {
    $mergedFiles += $remaining
  }

  $manifest = [pscustomobject]@{
    generatedAt = (Get-Date).ToString('o')
    sourceFolder = $existingManifest.sourceFolder
    sourceImages = $existingManifest.sourceImages
    render = $existingManifest.render
    wordPadding = $existingManifest.wordPadding
    files = $mergedFiles
  }
}

Write-Utf8NoBom -Path $manifestPath -Content ($manifest | ConvertTo-Json -Depth 10)

Write-Host "Wrote $manifestPath"
