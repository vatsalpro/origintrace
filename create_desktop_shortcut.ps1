# ==============================================================================
# OriginTrace AI - Windows Desktop Shortcut Creator
# ==============================================================================
# Creates an "OriginTrace AI" desktop shortcut pointing to start_origintrace.bat
# Sets working directory, icon, and description safely.
# ==============================================================================

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$TargetScript = Join-Path $ProjectRoot "start_origintrace.bat"

if (-not (Test-Path $TargetScript)) {
    Write-Error "Could not find start_origintrace.bat at '$TargetScript'."
    exit 1
}

$DesktopPath = [Environment]::GetFolderPath([Environment+SpecialFolder]::DesktopDirectory)
if (-not (Test-Path $DesktopPath)) {
    # Fallback to user profile desktop
    $DesktopPath = Join-Path $env:USERPROFILE "Desktop"
}

$ShortcutPath = Join-Path $DesktopPath "OriginTrace AI.lnk"

Write-Host "Creating OriginTrace AI desktop shortcut..." -ForegroundColor Cyan
Write-Host "  Project Directory : $ProjectRoot" -ForegroundColor Gray
Write-Host "  Target Launcher   : $TargetScript" -ForegroundColor Gray
Write-Host "  Shortcut Location : $ShortcutPath" -ForegroundColor Gray

try {
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = $TargetScript
    $Shortcut.WorkingDirectory = $ProjectRoot
    $Shortcut.Description = "OriginTrace AI - Multi-Platform Digital Forensics & Provenance Workbench"

    # Set icon: use project origintrace.ico if available, else Windows shell32 lens icon
    $CustomIcon = Join-Path $ProjectRoot "origintrace.ico"
    if (Test-Path $CustomIcon) {
        $Shortcut.IconLocation = "$CustomIcon,0"
        Write-Host "  Icon Assigned     : $CustomIcon" -ForegroundColor Gray
    } else {
        $SystemIcon = "$env:SystemRoot\System32\shell32.dll,22" # Detective/search icon
        $Shortcut.IconLocation = $SystemIcon
        Write-Host "  Icon Assigned     : $SystemIcon" -ForegroundColor Gray
    }

    $Shortcut.Save()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($Shortcut) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($WshShell) | Out-Null

    Write-Host ""
    Write-Host "SUCCESS: Desktop shortcut created successfully!" -ForegroundColor Green
    Write-Host "Path: $ShortcutPath" -ForegroundColor White
    Write-Host "You can now double-click 'OriginTrace AI' on your Desktop to launch the app." -ForegroundColor Green
} catch {
    Write-Error "Failed to create desktop shortcut: $_"
    exit 1
}
