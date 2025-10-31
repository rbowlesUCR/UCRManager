$thumbprint = 'A8274FFABFB94AE158067260609E966235D0B441'
$cert = Get-ChildItem 'Cert:\LocalMachine\My' | Where-Object { $_.Thumbprint -eq $thumbprint }

if ($cert) {
    Write-Output "Certificate FOUND:"
    $cert | Select-Object Subject, Thumbprint, NotAfter, HasPrivateKey | Format-List
} else {
    Write-Output "Certificate NOT FOUND in LocalMachine\My"
    Write-Output "`nAll certificates in LocalMachine\My:"
    Get-ChildItem 'Cert:\LocalMachine\My' | Select-Object Subject, Thumbprint
}
