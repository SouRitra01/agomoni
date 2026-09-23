# Minimal static server for previewing public/ on Windows without Node or Python.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/serve.ps1 [-Port 8788]
# The live-crowd API (/api/*) is not served here; the site falls back gracefully.
param([int]$Port = 8788)
$root = Join-Path (Split-Path -Parent $PSScriptRoot) 'public'
$types = @{ '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.js'='text/javascript; charset=utf-8'
  '.json'='application/json; charset=utf-8'; '.jpg'='image/jpeg'; '.png'='image/png'; '.svg'='image/svg+xml'; '.webp'='image/webp' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/"); $l.Start()
Write-Host "Serving $root at http://localhost:$Port/"
while ($l.IsListening) {
  $ctx = $l.GetContext(); $res = $ctx.Response
  try {
    $path = [uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($path -eq '') { $path = 'index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $root $path))
    if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $res.ContentType = $types[[IO.Path]::GetExtension($file).ToLower()]
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else { $res.StatusCode = 404 }
  } catch { $res.StatusCode = 500 } finally { $res.Close() }
}
