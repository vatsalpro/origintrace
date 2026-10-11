# ==============================================================================
# OriginTrace AI - Port Binding Checker
# ==============================================================================
# Exit codes:
# 10 = Both backend (8000) and frontend (5173) are listening
# 1  = Only backend (8000) is listening
# 2  = Only frontend (5173) is listening
# 0  = Neither is listening
# ==============================================================================

$b = [bool](Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue)
$f = [bool](Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue)

if ($b -and $f) {
    exit 10
} elseif ($b) {
    exit 1
} elseif ($f) {
    exit 2
} else {
    exit 0
}
