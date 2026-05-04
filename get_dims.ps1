Add-Type -AssemblyName System.Drawing
$files = Get-ChildItem public/houses/*.jpg
foreach ($file in $files) {
    $img = [System.Drawing.Image]::FromFile($file.FullName)
    Write-Host "$($file.Name): $($img.Width)x$($img.Height)"
    $img.Dispose()
}
