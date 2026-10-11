# ==============================================================================
# OriginTrace AI - Service Health Poller & PID Recorder
# ==============================================================================

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PidFile = Join-Path $ProjectRoot "data\origintrace_pids.txt"
$DataDir = Join-Path $ProjectRoot "data"
if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
}

$backendReady = $false
$frontendReady = $false
$retries = 0
$maxRetries = 40

while ((-not ($backendReady -and $frontendReady)) -and ($retries -lt $maxRetries)) {
    $retries++

    if (-not $backendReady) {
        try {
            $resp = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($resp.StatusCode -eq 200) {
                $backendReady = $true
                Write-Host "  [OK] Backend health check passed (http://127.0.0.1:8000/api/health)" -ForegroundColor Green
            }
        } catch {
            # Still initializing
        }
    }

    if (-not $frontendReady) {
        try {
            $resp = Invoke-WebRequest -Uri "http://127.0.0.1:5173" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($resp.StatusCode -eq 200) {
                $frontendReady = $true
                Write-Host "  [OK] Frontend server ready (http://127.0.0.1:5173)" -ForegroundColor Green
            }
        } catch {
            # Still initializing
        }
    }

    if (-not ($backendReady -and $frontendReady)) {
        Start-Sleep -Milliseconds 700
    }
}

# Record active PIDs
$pidsFound = @()
try {
    $bConn = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction Stop
    foreach ($c in $bConn) {
        if ($c.OwningProcess -gt 4) {
            $pidsFound += "backend=$($c.OwningProcess)"
        }
    }
} catch {}

try {
    $fConn = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction Stop
    foreach ($c in $fConn) {
        if ($c.OwningProcess -gt 4) {
            $pidsFound += "frontend=$($c.OwningProcess)"
        }
    }
} catch {}

if ($pidsFound.Count -gt 0) {
    $pidsFound | Out-File -FilePath $PidFile -Encoding ascii -Force
}

if ($backendReady -and $frontendReady) {
    exit 0
} else {
    exit 1
}
