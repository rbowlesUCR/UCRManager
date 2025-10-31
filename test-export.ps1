$thumbprint = 'A8274FFABFB94AE158067260609E966235D0B441'
$certPath = 'C:\inetpub\wwwroot\UCRManager\certificates'
$pfxFile = "$certPath\cert.pfx"

# Create directory if it doesn't exist
if (-not (Test-Path $certPath)) {
    New-Item -ItemType Directory -Path $certPath -Force | Out-Null
    Write-Output "Created directory: $certPath"
}

# Set password
$pwd = ConvertTo-SecureString -String "temppassword123" -Force -AsPlainText

# Get certificate
$cert = Get-Item "Cert:\LocalMachine\My\$thumbprint" -ErrorAction SilentlyContinue

if ($cert) {
    Write-Output "Certificate found. Attempting export..."

    # Check if certificate has private key
    if ($cert.HasPrivateKey) {
        Write-Output "Certificate has private key. Exporting..."

        try {
            Export-PfxCertificate -Cert $cert -FilePath $pfxFile -Password $pwd -Force | Out-Null

            if (Test-Path $pfxFile) {
                $fileInfo = Get-Item $pfxFile
                Write-Output "SUCCESS - PFX exported to: $pfxFile"
                Write-Output "File size: $($fileInfo.Length) bytes"
            } else {
                Write-Output "FAILED - File not created"
            }
        } catch {
            Write-Output "ERROR during export: $_"
        }
    } else {
        Write-Output "ERROR - Certificate does not have private key"
    }
} else {
    Write-Output "ERROR - Certificate not found"
}
