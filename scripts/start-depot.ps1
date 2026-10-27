param([string]$BindAddress = '', [ValidateRange(1024,65535)][int]$Port = 8787, [switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'depot-network.ps1')
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskNode = (Get-Command node -ErrorAction Stop).Source
$taskMajor = [int]((& $taskNode --version).TrimStart('v').Split('.')[0])
if ($taskMajor -lt 24) { throw 'Install Node.js 24 or newer on the depot computer.' }
$taskNetwork = Get-DepotAddress -BindAddress $BindAddress
$taskURL = 'http://' + $taskNetwork.Address + ':' + $Port
Write-Output ('Depot network: ' + $taskNetwork.Adapter)
Write-Output ('Phone server address: ' + $taskURL)
Write-Output 'Use the same depot Wi-Fi on the computer and all phones.'
Write-Output 'No cloud hosting, domain purchase, or router port forwarding is needed.'
Write-Output ('Private first-run accounts: ' + (Join-Path $taskRoot 'server\data\initial-access.json'))
if ($CheckOnly) { Write-Output 'Check complete. Server and firewall were not changed.'; return }
$taskListener = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
if ($taskListener.Count) { throw ('Port ' + $Port + ' is already in use. Close the previous depot server window or choose another port.') }
$previousHost = $env:FLEET_HOST
$previousPort = $env:PORT
try {
    $env:FLEET_HOST = $taskNetwork.Address
    $env:PORT = [string]$Port
    Write-Output 'Starting depot server. Keep this window open; press Ctrl+C to stop.'
    & $taskNode (Join-Path $taskRoot 'server\server.js')
    if ($LASTEXITCODE -ne 0) { throw 'The depot server stopped with an error.' }
} finally {
    $env:FLEET_HOST = $previousHost
    $env:PORT = $previousPort
}
