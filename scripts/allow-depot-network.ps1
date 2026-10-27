#Requires -RunAsAdministrator
param([string]$BindAddress = '', [ValidateRange(1024,65535)][int]$Port = 8787)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'depot-network.ps1')
$taskNetwork = Get-DepotAddress -BindAddress $BindAddress
$taskProfile = Get-NetConnectionProfile -InterfaceIndex $taskNetwork.InterfaceIndex
if ($taskProfile.NetworkCategory -eq 'Public') {
    throw 'This network is marked Public. Have your IT administrator mark the trusted depot network Private before allowing depot access. No rule was added.'
}
$taskNode = (Get-Command node -ErrorAction Stop).Source
$taskRule = 'SmartFleet-Depot-' + $Port
if (Get-NetFirewallRule -Name $taskRule -ErrorAction SilentlyContinue) {
    Get-NetFirewallRule -Name $taskRule | Set-NetFirewallRule -Enabled True -Profile Private,Domain -Direction Inbound -Action Allow
    Get-NetFirewallRule -Name $taskRule | Get-NetFirewallAddressFilter | Set-NetFirewallAddressFilter -LocalAddress $taskNetwork.Address -RemoteAddress LocalSubnet
    Get-NetFirewallRule -Name $taskRule | Get-NetFirewallPortFilter | Set-NetFirewallPortFilter -Protocol TCP -LocalPort $Port
    Get-NetFirewallRule -Name $taskRule | Get-NetFirewallApplicationFilter | Set-NetFirewallApplicationFilter -Program $taskNode
} else {
    New-NetFirewallRule -Name $taskRule -DisplayName 'Smart Fleet - depot network only' -Direction Inbound -Action Allow -Enabled True -Profile Private,Domain -Protocol TCP -LocalPort $Port -LocalAddress $taskNetwork.Address -RemoteAddress LocalSubnet -Program $taskNode | Out-Null
}
Write-Output ('Allowed depot subnet access to ' + $taskNetwork.Address + ':' + $Port + ' on Private/Domain networks only.')
