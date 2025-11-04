<#
.SYNOPSIS
    Generates a self-signed certificate for Microsoft Teams PowerShell authentication.

.DESCRIPTION
    This script creates a self-signed certificate suitable for app registration authentication
    with Microsoft Teams PowerShell. The certificate is stored in the Windows certificate store
    and the public key (.cer file) is exported for upload to Azure AD app registration.

.PARAMETER TenantName
    Friendly name of the customer tenant (used in certificate subject and filename).

.PARAMETER ValidityYears
    Number of years the certificate should be valid (default: 2).

.PARAMETER OutputPath
    Directory where the .cer file will be saved (default: current directory).

.EXAMPLE
    .\New-TeamsPowerShellCertificate.ps1 -TenantName "Contoso"
    Creates a certificate for Contoso tenant, valid for 2 years.

.EXAMPLE
    .\New-TeamsPowerShellCertificate.ps1 -TenantName "Fabrikam" -ValidityYears 3 -OutputPath "C:\Certs"
    Creates a certificate for Fabrikam tenant, valid for 3 years, saves to C:\Certs.

.NOTES
    Author: Teams Voice Manager
    Version: 1.0
    Requires: Windows PowerShell 5.1 or PowerShell 7+ with admin rights
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$TenantName,

    [Parameter(Mandatory = $false)]
    [int]$ValidityYears = 2,

    [Parameter(Mandatory = $false)]
    [string]$OutputPath = "."
)

# Ensure running as administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Error "This script must be run as Administrator to install certificates in LocalMachine store."
    exit 1
}

# Sanitize tenant name for use in file paths
$safeTenantName = $TenantName -replace '[^\w\-]', ''

# Certificate subject
$subject = "CN=TeamsPowerShell-$safeTenantName"

# Calculate expiration date
$notAfter = (Get-Date).AddYears($ValidityYears)

Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Teams PowerShell Certificate Generator                    ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "Tenant Name:      $TenantName" -ForegroundColor White
Write-Host "Subject:          $subject" -ForegroundColor White
Write-Host "Validity Period:  $ValidityYears years (expires $($notAfter.ToString('yyyy-MM-dd')))" -ForegroundColor White
Write-Host "Output Directory: $OutputPath" -ForegroundColor White
Write-Host ""

# Create output directory if it doesn't exist
if (-not (Test-Path $OutputPath)) {
    Write-Host "[1/5] Creating output directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
    Write-Host "      ✓ Directory created: $OutputPath" -ForegroundColor Green
} else {
    Write-Host "[1/5] Output directory exists" -ForegroundColor Green
}

# Generate certificate
Write-Host "[2/5] Generating self-signed certificate..." -ForegroundColor Yellow

try {
    $cert = New-SelfSignedCertificate `
        -Subject $subject `
        -CertStoreLocation "Cert:\LocalMachine\My" `
        -KeyExportPolicy Exportable `
        -KeySpec Signature `
        -KeyLength 2048 `
        -KeyAlgorithm RSA `
        -HashAlgorithm SHA256 `
        -NotAfter $notAfter `
        -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider"

    Write-Host "      ✓ Certificate created successfully" -ForegroundColor Green
    Write-Host "      Thumbprint: $($cert.Thumbprint)" -ForegroundColor Cyan
} catch {
    Write-Error "Failed to create certificate: $_"
    exit 1
}

# Export public key (.cer file)
$cerFileName = "TeamsPowerShell-$safeTenantName.cer"
$cerFilePath = Join-Path $OutputPath $cerFileName

Write-Host "[3/5] Exporting public key (.cer file)..." -ForegroundColor Yellow

try {
    Export-Certificate -Cert $cert -FilePath $cerFilePath -Type CERT | Out-Null
    Write-Host "      ✓ Public key exported: $cerFilePath" -ForegroundColor Green
} catch {
    Write-Error "Failed to export certificate: $_"
    exit 1
}

# Verify certificate is in store
Write-Host "[4/5] Verifying certificate installation..." -ForegroundColor Yellow

$installedCert = Get-ChildItem "Cert:\LocalMachine\My" | Where-Object { $_.Thumbprint -eq $cert.Thumbprint }

if ($installedCert) {
    Write-Host "      ✓ Certificate installed in: Cert:\LocalMachine\My" -ForegroundColor Green
} else {
    Write-Warning "Certificate not found in certificate store!"
}

# Display certificate details
Write-Host "[5/5] Certificate Details:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Subject:       $($cert.Subject)" -ForegroundColor White
Write-Host "  Issuer:        $($cert.Issuer)" -ForegroundColor White
Write-Host "  Thumbprint:    $($cert.Thumbprint)" -ForegroundColor Cyan
Write-Host "  Serial Number: $($cert.SerialNumber)" -ForegroundColor White
Write-Host "  Valid From:    $($cert.NotBefore.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor White
Write-Host "  Valid Until:   $($cert.NotAfter.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor White
Write-Host ""

# Summary and next steps
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   Certificate Created Successfully!                          ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📋 NEXT STEPS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Upload Certificate to Azure AD App Registration:" -ForegroundColor Yellow
Write-Host "   - Go to Azure Portal → Azure AD → App registrations" -ForegroundColor White
Write-Host "   - Select your app registration" -ForegroundColor White
Write-Host "   - Go to 'Certificates & secrets'" -ForegroundColor White
Write-Host "   - Click 'Upload certificate'" -ForegroundColor White
Write-Host "   - Upload this file: $cerFilePath" -ForegroundColor Cyan
Write-Host ""

Write-Host "2. Configure Teams Voice Manager:" -ForegroundColor Yellow
Write-Host "   - Sign in to Teams Voice Manager Admin Panel" -ForegroundColor White
Write-Host "   - Go to 'Customer Tenants' section" -ForegroundColor White
Write-Host "   - Select the tenant and configure PowerShell credentials:" -ForegroundColor White
Write-Host ""
Write-Host "     Application ID:        <your-app-registration-client-id>" -ForegroundColor White
Write-Host "     Certificate Thumbprint: $($cert.Thumbprint)" -ForegroundColor Cyan
Write-Host ""

Write-Host "3. Test Connection:" -ForegroundColor Yellow
Write-Host "   - Use the 'Test Connection' button in the admin panel" -ForegroundColor White
Write-Host "   - Or test manually with:" -ForegroundColor White
Write-Host ""
Write-Host "     Connect-MicrosoftTeams ``" -ForegroundColor Gray
Write-Host "       -ApplicationId '<app-id>' ``" -ForegroundColor Gray
Write-Host "       -CertificateThumbprint '$($cert.Thumbprint)' ``" -ForegroundColor Gray
Write-Host "       -TenantId '<tenant-id>'" -ForegroundColor Gray
Write-Host ""

Write-Host "⚠️  SECURITY REMINDER:" -ForegroundColor Red
Write-Host "   - The private key is stored in: Cert:\LocalMachine\My" -ForegroundColor White
Write-Host "   - Only administrators on this server can access it" -ForegroundColor White
Write-Host "   - Do NOT delete the certificate from the certificate store" -ForegroundColor White
Write-Host "   - Keep the thumbprint secure (it's stored encrypted in database)" -ForegroundColor White
Write-Host ""

# Save summary to text file
$summaryFileName = "TeamsPowerShell-$safeTenantName-SETUP.txt"
$summaryFilePath = Join-Path $OutputPath $summaryFileName

$summaryContent = @"
Teams PowerShell Certificate Setup Summary
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
==========================================

CERTIFICATE DETAILS:
- Tenant Name:       $TenantName
- Subject:           $($cert.Subject)
- Thumbprint:        $($cert.Thumbprint)
- Serial Number:     $($cert.SerialNumber)
- Valid From:        $($cert.NotBefore.ToString('yyyy-MM-dd HH:mm:ss'))
- Valid Until:       $($cert.NotAfter.ToString('yyyy-MM-dd HH:mm:ss'))
- Certificate File:  $cerFilePath

CERTIFICATE LOCATION:
- Windows Store:     Cert:\LocalMachine\My\$($cert.Thumbprint)

NEXT STEPS:

1. Upload to Azure AD App Registration:
   - Portal: https://portal.azure.com
   - Navigate: Azure AD → App registrations → [Your App] → Certificates & secrets
   - Upload file: $cerFilePath

2. Configure in Teams Voice Manager:
   - Admin Panel → Customer Tenants → [Select Tenant] → PowerShell Settings
   - Application ID: <your-app-registration-client-id>
   - Certificate Thumbprint: $($cert.Thumbprint)

3. Test Connection:
   Connect-MicrosoftTeams ``
     -ApplicationId '<app-id>' ``
     -CertificateThumbprint '$($cert.Thumbprint)' ``
     -TenantId '<tenant-id>'

SECURITY NOTES:
- Private key location: Windows Certificate Store (LocalMachine\My)
- Access: Restricted to server administrators only
- Do NOT delete from certificate store while in use
- Certificate thumbprint is stored encrypted in Teams Voice Manager database

==========================================
"@

Set-Content -Path $summaryFilePath -Value $summaryContent
Write-Host "📄 Setup summary saved to: $summaryFilePath" -ForegroundColor Cyan
Write-Host ""
