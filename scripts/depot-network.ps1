function Get-DepotAddress {
    param([string]$BindAddress = '')
    $candidates = @(Get-NetIPConfiguration | Where-Object {
        $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up'
    } | ForEach-Object {
        $network = $_
        foreach ($address in $_.IPv4Address) {
            if ($address.IPAddress -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)') {
                [pscustomobject]@{ Address = $address.IPAddress; InterfaceIndex = $network.InterfaceIndex; Adapter = $network.InterfaceAlias }
            }
        }
    })
    if ($BindAddress) { $candidates = @($candidates | Where-Object { $_.Address -eq $BindAddress }) }
    if ($candidates.Count -ne 1) {
        $candidates | Format-Table Adapter, Address | Out-Host
        throw 'Connect to the depot network. If multiple networks are active, specify -BindAddress with the depot computer private IPv4 address.'
    }
    return $candidates[0]
}
