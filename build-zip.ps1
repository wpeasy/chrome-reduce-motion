# build-zip.ps1 — Package Chrome extension into a Linux-compatible ZIP

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputDir  = Join-Path $projectDir "plugin"
$zipName    = "reduced-motion-toggle.zip"
$zipPath    = Join-Path $outputDir $zipName

# Files/folders to exclude from the ZIP
$exclude = @(
    '.git',
    '.claude',
    '.cursorrules',
    'CLAUDE.md',
    'build-zip.ps1',
    'plugin'
)

# Ensure output directory exists
if (!(Test-Path $outputDir)) { New-Item -ItemType Directory -Path $outputDir | Out-Null }

# Remove old ZIP if present
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

# Gather files, filtering out excluded items
$files = Get-ChildItem -Path $projectDir -Recurse -File | Where-Object {
    $rel = $_.FullName.Substring($projectDir.Length + 1)
    $skip = $false
    foreach ($ex in $exclude) {
        if ($rel -eq $ex -or $rel.StartsWith("$ex\") -or $rel.StartsWith("$ex/")) {
            $skip = $true
            break
        }
    }
    -not $skip
}

# Build ZIP using .NET to ensure forward slashes (Linux-compatible)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')

foreach ($file in $files) {
    $entryName = $file.FullName.Substring($projectDir.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $zip, $file.FullName, $entryName, 'Optimal'
    ) | Out-Null
    Write-Host "  + $entryName"
}

$zip.Dispose()
Write-Host "`nCreated: $zipPath"
