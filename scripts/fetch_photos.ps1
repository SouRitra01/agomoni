# Downloads freely licensed Durga Puja photos from Wikimedia Commons, resizes them
# into public/img/, and writes public/js/photos.js (paths + credits for attribution).
# Usage (Windows PowerShell):  powershell -ExecutionPolicy Bypass -File scripts/fetch_photos.ps1
# To add or swap a photo, edit $slots below (key = file name, value = Commons title) and rerun.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$out  = Join-Path $root 'public/img'
New-Item -ItemType Directory -Force $out | Out-Null
$ua = @{ 'User-Agent' = 'agomoni-build/1.0 (github.com/SouRitra01/agomoni)' }

# key -> [Commons file title, max width]
$slots = [ordered]@{
  'hero'                    = @('A low angle shot of Goddess Durga in A Mandap in North Kolkata, 2017.jpg', 1600)
  # pandal-specific photos (key must be "p-" + pandal id)
  'p-bagbazar'              = @('Bagbazar Sarbojanin Durgotsav 2023 01.jpg', 900)
  'p-sovabazar-rajbari'     = @('Durga Puja of Sovabazar Rajbari-Kolkata-West Bengal-DSC 4750 00001.jpg', 900)
  'p-ekdalia-evergreen'     = @('Durga - Ekdalia Evergreen - Ekdalia Road - Kolkata 2015-10-21 6162.JPG', 900)
  'p-kumartuli-park'        = @('Making of Durga idol in Kumartuli 04.jpg', 900)
  'p-kumartuli-sarbojanin'  = @('Making of Durga idol in Kumartuli 11.jpg', 900)
  'p-santosh-mitra-square'  = @('Santosh Mitra square Durga Puja 2025 01.jpg', 900)
  'p-suruchi-sangha'        = @('Durga Puja Pandal - New Alipore Suruchi Sangha - Kolkata 2015-10-21 6519.JPG', 900)
  'p-deshapriya-park'       = @('Durga Puja Pandal - Ballygunge Sarbojanin Durgotsab - Deshapriya Park - Kolkata 2017-09-27 4498.JPG', 900)
  'p-belur-math'            = @('Durga Puja - Belur Math - 2015 Shasthi (21684401464).jpg', 900)
  'p-chetla-agrani'         = @('Shakti roopa at Chetla Agrani Club.jpg', 900)
  'p-sreebhumi'             = @('Durga Puja in Kolkata 2018 - Pandal of Sreebhumi Sporting Club 01jpg.jpg', 900)
  # representative photos by pandal type (used when a pandal has no photo of its own)
  'theme-1'  = @('Chalta Bagan Durga Puja 2019.jpg', 900)
  'theme-2'  = @('DurgaPuja2018 - Pandal of Ultadanga Pallyshree in Kolkata 03.jpg', 900)
  'theme-3'  = @('PXL 20241007 170802427.MP Durga Puja Pandal Lighting and deity at West Bengal Kachnapara India 12.jpg', 900)
  'theme-4'  = @('2019 Durga Idol and decoration of Puja at Kolkata 06.jpg', 900)
  'theme-5'  = @('Haridevpur 41 Pally Durga Puja 2019.jpg', 900)
  'theme-6'  = @('Haridevpur Athletic Club Durga Puja 2019.jpg', 900)
  'theme-7'  = @('Pandal at Durga Puja in Kolkata 2018 01.jpg', 900)
  'theme-8'  = @('2019 Durga Idol and decoration of Puja at Kolkata 07.jpg', 900)
  'theme-9'  = @('2019 Durga Idol and decoration of Puja at Kolkata 17.jpg', 900)
  'theme-10' = @('PXL 20241007 170802427.MP Durga Puja Pandal Lighting and deity at West Bengal Kachnapara India 14.jpg', 900)
  'sabeki-1' = @('2016 Durga Puja Kolkata Shobhabazar Sarbojonin (9).jpg', 900)
  'sabeki-2' = @('2019 Durga Idol and decoration of Puja at Kolkata 19.jpg', 900)
  'sabeki-3' = @('Bagbazar Sarbojanin Durgotsav 2023 02.jpg', 900)
  'bonedi-1' = @('Sovabazar Rajbari Pujo.jpg', 900)
  'bonedi-2' = @('Shobhabazar Rajbari Durga Puja.jpg', 900)
  'heritage-1' = @('Durga Puja - Belur Math - 2015 Shasthi (22119222880).jpg', 900)
  'blr-1'    = @('Durga Puja- Bongodhara Bangalore.jpg', 900)
  'blr-2'    = @('Durga Puja Bangalore (85263351).jpeg', 900)
  # food: "fp-<food id>" = photo of the place itself, "f-<food id>" = its signature dish (shown as representative)
  'food-hero'                     = @('Bengali style chicken biryani, Kolkata - West Bengal - DSC 0020.jpg', 1400)
  'f-mitra-cafe'                  = @('Chicken Kabiraji Cutlet - Kolkata 2013-12-15 5383.JPG', 800)
  'f-golbari'                     = @('Mutton curry in a table.jpg', 800)
  'fp-coffee-house'               = @('Inside view of the Indian Coffee House, Kolkata 03.jpg', 800)
  'f-paramount'                   = @('Daab Sharbat - Tender Coconut Drink.JPG', 800)
  'f-anadi-cabin'                 = @('Moglai Porota.jpg', 800)
  'f-nizams'                      = @('Making Kati Rolls - Millennium Park - Central Kolkata - India (12268604906).jpg', 800)
  'f-arsalan-park-circus'         = @('Kolkata mutton biryani.jpg', 800)
  'f-balaram-mullick'             = @('Baked Rasgulla.JPG', 800)
  'f-bijoli-grill'                = @('Fish Fry - Kolkata 2014-02-13 2642.JPG', 800)
  'f-vivekananda-park-phuchka'    = @('Indian cuisine-Panipuri-03.jpg', 800)
  'f-maharaj-sarat-bose'          = @('Koraishutir Kochuri by Tania Dey.jpg', 800)
  # home-page "moments" strip
  'm-kumartuli' = @('Making of Durga idol in Kumartuli 07.jpg', 900)
  'm-dhunuchi'  = @('Traditional Dhunuchi Dance.jpg', 900)
  'm-sindoor'   = @('Sindoor Khela-007.jpg', 900)
  'm-lights'    = @('A common low height electric chandelier in a Durga Puja Mandap in North Kolkata, 2016.jpg', 900)
}

function Strip($s) { if (-not $s) { return '' }; (($s -replace '<[^>]+>', '') -replace '\s+', ' ').Trim() }

# Look up metadata in batches (API allows 50 titles per call).
$meta = @{}
$titles = @($slots.Values | ForEach-Object { 'File:' + $_[0] } | Select-Object -Unique)
for ($i = 0; $i -lt $titles.Count; $i += 40) {
  $batch = $titles[$i..([Math]::Min($i + 39, $titles.Count - 1))] -join '|'
  $u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1920&iiextmetadatafilter=LicenseShortName|Artist|LicenseUrl&titles=' + [uri]::EscapeDataString($batch)
  $r = Invoke-RestMethod -Uri $u -Headers $ua -TimeoutSec 60
  $norm = @{}; foreach ($n in @($r.query.normalized)) { if ($n) { $norm[$n.to] = $n.from } }
  foreach ($p in $r.query.pages.PSObject.Properties.Value) {
    if (-not $p.imageinfo) { Write-Warning "missing: $($p.title)"; continue }
    $meta[$p.title] = $p.imageinfo[0]
    if ($norm[$p.title]) { $meta[$norm[$p.title]] = $p.imageinfo[0] }
  }
  Start-Sleep -Seconds 2
}

$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 78L

$entries = @()
foreach ($k in $slots.Keys) {
  $title = 'File:' + $slots[$k][0]; $w = $slots[$k][1]
  $ii = $meta[$title]; if (-not $ii) { $ii = $meta[$title.Replace('_', ' ')] }
  if (-not $ii) { Write-Warning "skip $k (no metadata)"; continue }
  $dest = Join-Path $out "$k.jpg"
  if (-not (Test-Path $dest)) {
    $tmp = Join-Path $env:TEMP "agomoni-$k.src"
    # Commons answers 429 when fetched too fast; back off and retry.
    $got = $false
    for ($try = 1; $try -le 4; $try++) {
      # small originals can refuse an up-sized thumbnail, so later tries fetch the original file
      $src = if ($try -eq 1) { $ii.thumburl } else { $ii.url }
      try { Invoke-WebRequest -Uri $src -Headers $ua -OutFile $tmp -TimeoutSec 120 -UseBasicParsing; $got = $true; break }
      catch { Write-Host "  rate-limited on $k, retrying in $(20 * $try)s"; Start-Sleep -Seconds (20 * $try) }
    }
    if (-not $got) { Write-Warning "skip $k (download failed; rerun later)"; continue }
    $img = [System.Drawing.Image]::FromFile($tmp)
    # honour EXIF orientation
    if ($img.PropertyIdList -contains 0x0112) {
      switch ([int]$img.GetPropertyItem(0x0112).Value[0]) { 3 { $img.RotateFlip('Rotate180FlipNone') } 6 { $img.RotateFlip('Rotate90FlipNone') } 8 { $img.RotateFlip('Rotate270FlipNone') } }
    }
    $scale = [Math]::Min(1.0, $w / $img.Width)
    $nw = [int]($img.Width * $scale); $nh = [int]($img.Height * $scale)
    $bmp = New-Object System.Drawing.Bitmap $nw, $nh
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'
    $g.DrawImage($img, 0, 0, $nw, $nh)
    $bmp.Save($dest, $jpeg, $ep)
    $g.Dispose(); $bmp.Dispose(); $img.Dispose(); Remove-Item $tmp
    Start-Sleep -Seconds 3
  }
  $m = $ii.extmetadata
  $entries += [ordered]@{
    key = $k; src = "img/$k.jpg"
    author = Strip $m.Artist.value; license = Strip $m.LicenseShortName.value
    source = $ii.descriptionurl
  }
  "{0,-24} {1,-12} {2}" -f $k, (Strip $m.LicenseShortName.value), (Strip $m.Artist.value)
}

$json = ConvertTo-Json @($entries) -Depth 4
$js = "// Generated by scripts/fetch_photos.ps1 - do not edit by hand.`n// Photos from Wikimedia Commons; credits are shown on the About page.`nwindow.PHOTOS = $json;`n"
[System.IO.File]::WriteAllText((Join-Path $root 'public/js/photos.js'), $js, (New-Object System.Text.UTF8Encoding $false))
"wrote $($entries.Count) photos"
