# ==============================================================================
# OriginTrace AI - Service Stopper Script
# ==============================================================================

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PidFile = Join-Path $ProjectRoot "data\origintrace_pids.txt"

# 1. Terminate recorded PIDs
if (Test-Path $PidFile) {
    Get-Content $PidFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -match "^(backend|frontend)=(\d+)$") {
            $name = $matches[1]
            $pidToKill = [int]$matches[2]
            try {
                $proc = Get-Process -Id $pidToKill -ErrorAction Stop
                Write-Host "Stopping recorded $name process (PID $pidToKill)..." -ForegroundColor Yellow
                Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
            } catch {
                # Process already stopped
            }
        }
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

# 2. Terminate any listeners remaining on ports 8000 and 5173
$targetPorts = @(8000, 5173)
foreach ($port in $targetPorts) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop
        foreach ($conn in $conns) {
            $owner = $conn.OwningProcess
            if ($owner -gt 4) {
                Write-Host "Stopping process on port $port (PID $owner)..." -ForegroundColor Yellow
                Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {
        # No listener on this port
    }
}

Write-Host "All OriginTrace AI services have been stopped." -ForegroundColor Green
