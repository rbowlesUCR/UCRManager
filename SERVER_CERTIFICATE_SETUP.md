# Server Certificate Setup Guide
## PowerShell Certificate-Based Authentication for Teams Voice Manager

This guide walks you through generating self-signed certificates on your Windows Server for Microsoft Teams PowerShell authentication. These certificates enable secure, automated connections to Microsoft Teams without requiring user credentials or MFA.

---

## 📋 Prerequisites

Before you begin, ensure you have:

- ✅ **Windows Server** with PowerShell 5.1 or PowerShell 7+
- ✅ **Administrator access** to the server
- ✅ **MicrosoftTeams PowerShell module** installed (v5.0.0 or higher)
- ✅ **Access to Azure Portal** for each customer tenant

---

## 🎯 Overview: How Certificate Authentication Works

Certificate-based authentication uses public/private key cryptography:

1. **Server generates** a certificate with a private key (stored securely in Windows Certificate Store)
2. **Public key** (.cer file) is uploaded to Azure AD App Registration
3. **Teams Voice Manager** connects using:
   - Application ID (from Azure)
   - Certificate Thumbprint (from Windows cert store)
   - Tenant ID (customer's Azure AD)
4. **No user credentials or MFA needed** - fully automated!

---

## 🔧 Step-by-Step Setup Wizard

### Step 1: Connect to Your Server

1. **Open PowerShell as Administrator** on your Windows Server
   - Press `Win + X`, select **"Windows PowerShell (Admin)"**
   - Or Remote Desktop to your server and open PowerShell

2. **Navigate to the scripts directory:**
   ```powershell
   cd C:\inetpub\wwwroot\UCRManager\scripts
   ```

3. **Verify the certificate script exists:**
   ```powershell
   Get-Item .\New-TeamsPowerShellCertificate.ps1
   ```

   If you see the file path, you're ready to proceed!

---

### Step 2: Generate Certificate for a Customer Tenant

You'll need to generate **one certificate per customer tenant**.

**Example: Generating a certificate for Contoso Corporation**

```powershell
.\New-TeamsPowerShellCertificate.ps1 -TenantName "Contoso"
```

**What happens:**
- ✅ Creates a 2048-bit RSA certificate
- ✅ Installs it in Windows Certificate Store (`LocalMachine\My`)
- ✅ Exports the public key to `TeamsPowerShell-Contoso.cer`
- ✅ Displays the certificate thumbprint (you'll need this!)
- ✅ Creates a setup summary file

**Optional Parameters:**

```powershell
# Certificate valid for 3 years instead of default 2
.\New-TeamsPowerShellCertificate.ps1 -TenantName "Fabrikam" -ValidityYears 3

# Save certificate to a custom directory
.\New-TeamsPowerShellCertificate.ps1 -TenantName "Northwind" -OutputPath "C:\Certificates"
```

---

### Step 3: Locate Your Certificate Files

After running the script, you'll find these files in the output directory (default: current directory):

1. **`TeamsPowerShell-[TenantName].cer`**
   - Public key certificate
   - **Upload this to Azure AD**
   - Safe to transfer via email or file share

2. **`TeamsPowerShell-[TenantName]-SETUP.txt`**
   - Summary with thumbprint and next steps
   - Keep for reference

**Example output:**
```
📁 C:\inetpub\wwwroot\UCRManager\scripts\
   ├── TeamsPowerShell-Contoso.cer
   └── TeamsPowerShell-Contoso-SETUP.txt
```

---

### Step 4: Record the Certificate Thumbprint

The script displays the **certificate thumbprint** at the end. This is critical!

**Example output:**
```
╔══════════════════════════════════════════════════════════════╗
║   Certificate Created Successfully!                          ║
╚══════════════════════════════════════════════════════════════╝

Certificate Details:
  Thumbprint:    A1B2C3D4E5F6789012345678901234567890ABCD
```

**⚠️ Important:**
- Copy and save this thumbprint securely
- You'll need it when configuring Teams Voice Manager
- It's also saved in the `*-SETUP.txt` file

---

### Step 5: Verify Certificate Installation

Confirm the certificate is installed in the Windows Certificate Store:

```powershell
# View all Teams PowerShell certificates
Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Subject -like "*TeamsPowerShell*" }
```

**Expected output:**
```
Thumbprint                                Subject
----------                                -------
A1B2C3D4E5F6789012345678901234567890ABCD  CN=TeamsPowerShell-Contoso
```

**Detailed view of a specific certificate:**
```powershell
$thumbprint = "A1B2C3D4E5F6789012345678901234567890ABCD"
Get-ChildItem Cert:\LocalMachine\My\$thumbprint | Format-List *
```

---

### Step 6: Test Certificate Access

Verify that the Teams Voice Manager application server can access the certificate:

```powershell
# Test if certificate is accessible
$thumbprint = "A1B2C3D4E5F6789012345678901234567890ABCD"
$cert = Get-ChildItem Cert:\LocalMachine\My\$thumbprint

if ($cert) {
    Write-Host "✓ Certificate found and accessible" -ForegroundColor Green
    Write-Host "  Subject: $($cert.Subject)"
    Write-Host "  Expires: $($cert.NotAfter)"
    Write-Host "  Has Private Key: $($cert.HasPrivateKey)"
} else {
    Write-Warning "Certificate not found!"
}
```

**Expected output:**
```
✓ Certificate found and accessible
  Subject: CN=TeamsPowerShell-Contoso
  Expires: 11/3/2027 2:30:00 PM
  Has Private Key: True
```

---

### Step 7: Secure the Certificate

The private key is stored in the Windows Certificate Store and is accessible only to administrators.

**Security best practices:**

1. **Access Control:**
   ```powershell
   # Verify only administrators can access certificates
   Get-Acl "C:\ProgramData\Microsoft\Crypto\Keys" | Format-List
   ```

2. **Backup the certificate** (optional, for disaster recovery):
   ```powershell
   # Export with private key (password protected)
   $cert = Get-ChildItem Cert:\LocalMachine\My\$thumbprint
   $password = ConvertTo-SecureString -String "YourStrongPassword123!" -Force -AsPlainText
   Export-PfxCertificate -Cert $cert -FilePath "C:\Backup\TeamsPowerShell-Contoso.pfx" -Password $password
   ```

   ⚠️ **Store the .pfx file securely** - it contains the private key!

3. **Document certificate details:**
   - Keep a record of thumbprints in a secure location
   - Note expiration dates (set calendar reminders)
   - Document which tenant uses which certificate

---

### Step 8: Transfer Certificate to Azure Portal

Now you need to upload the **public key** (.cer file) to Azure AD.

**Two methods:**

**Method 1: Direct Upload (Recommended)**
1. Copy the `.cer` file to your local machine
2. Proceed to the Customer Tenant Setup Guide (see `CUSTOMER_TENANT_POWERSHELL_SETUP.md`)

**Method 2: Use Azure Cloud Shell**
```powershell
# Upload .cer file to Azure Cloud Shell, then view contents
$certPath = "./TeamsPowerShell-Contoso.cer"
$certContent = [Convert]::ToBase64String([IO.File]::ReadAllBytes($certPath))
Write-Output $certContent
# Copy this base64 string to upload in Azure Portal
```

---

## 📊 Managing Multiple Customer Certificates

For multiple customer tenants, use a consistent naming scheme:

### Recommended Directory Structure

```
C:\inetpub\wwwroot\UCRManager\
├── scripts\
│   └── New-TeamsPowerShellCertificate.ps1
└── certificates\
    ├── Contoso\
    │   ├── TeamsPowerShell-Contoso.cer
    │   └── TeamsPowerShell-Contoso-SETUP.txt
    ├── Fabrikam\
    │   ├── TeamsPowerShell-Fabrikam.cer
    │   └── TeamsPowerShell-Fabrikam-SETUP.txt
    └── Northwind\
        ├── TeamsPowerShell-Northwind.cer
        └── TeamsPowerShell-Northwind-SETUP.txt
```

### Batch Certificate Generation Script

Create certificates for multiple tenants at once:

```powershell
# Create certificates for multiple customers
$customers = @("Contoso", "Fabrikam", "Northwind", "AdventureWorks")

foreach ($customer in $customers) {
    Write-Host "`nGenerating certificate for $customer..." -ForegroundColor Cyan

    $outputPath = "C:\inetpub\wwwroot\UCRManager\certificates\$customer"
    New-Item -ItemType Directory -Path $outputPath -Force | Out-Null

    .\New-TeamsPowerShellCertificate.ps1 `
        -TenantName $customer `
        -OutputPath $outputPath `
        -ValidityYears 2

    Write-Host "✓ Completed $customer" -ForegroundColor Green
}

Write-Host "`n✓ All certificates generated!" -ForegroundColor Green
```

---

## 🔄 Certificate Renewal Process

Certificates expire! Plan to renew them **30 days before expiration**.

### Check Certificate Expiration Dates

```powershell
# List all Teams PowerShell certificates with expiration dates
Get-ChildItem Cert:\LocalMachine\My |
    Where-Object { $_.Subject -like "*TeamsPowerShell*" } |
    Select-Object Subject, Thumbprint, NotAfter |
    Sort-Object NotAfter |
    Format-Table -AutoSize
```

### Renew a Certificate

1. **Generate a new certificate** (same tenant name):
   ```powershell
   .\New-TeamsPowerShellCertificate.ps1 -TenantName "Contoso" -ValidityYears 2
   ```

2. **Upload new .cer file** to Azure AD App Registration

3. **Update Teams Voice Manager** with new thumbprint (in Admin Panel)

4. **Test the connection** before removing old certificate

5. **Remove old certificate** (after confirming new one works):
   ```powershell
   $oldThumbprint = "OLD_THUMBPRINT_HERE"
   Remove-Item Cert:\LocalMachine\My\$oldThumbprint
   ```

---

## 🚨 Troubleshooting

### Certificate Not Found

**Problem:** `Get-ChildItem Cert:\LocalMachine\My` doesn't show your certificate

**Solutions:**
1. Re-run the script as Administrator
2. Check if you're looking in the correct store:
   ```powershell
   # Check CurrentUser store (wrong location)
   Get-ChildItem Cert:\CurrentUser\My

   # Should be in LocalMachine store (correct)
   Get-ChildItem Cert:\LocalMachine\My
   ```

### Access Denied When Creating Certificate

**Problem:** "Access denied" or "Insufficient privileges"

**Solution:**
- Ensure PowerShell is running **as Administrator**
- Right-click PowerShell icon → "Run as administrator"

### Certificate Has No Private Key

**Problem:** `HasPrivateKey` shows `False`

**Solutions:**
1. Re-generate the certificate as Administrator
2. Ensure certificate was created with `-KeyExportPolicy Exportable`

### MicrosoftTeams Module Not Found

**Problem:** "Module 'MicrosoftTeams' not found"

**Solution:**
```powershell
# Install MicrosoftTeams module
Install-Module -Name MicrosoftTeams -Force -AllowClobber

# Verify installation
Get-Module -ListAvailable MicrosoftTeams
```

### Can't Find .cer File

**Problem:** Don't see the exported .cer file

**Solution:**
```powershell
# Check current directory
Get-Location

# Find all .cer files
Get-ChildItem -Path C:\ -Filter "TeamsPowerShell*.cer" -Recurse -ErrorAction SilentlyContinue

# Specify explicit output path
.\New-TeamsPowerShellCertificate.ps1 -TenantName "Contoso" -OutputPath "C:\Temp"
```

---

## 📖 Certificate Management Reference

### Quick Command Reference

```powershell
# List all Teams certs
Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Subject -like "*TeamsPowerShell*" }

# View specific cert details
Get-ChildItem Cert:\LocalMachine\My\[THUMBPRINT] | Format-List *

# Export cert with private key (backup)
$cert = Get-ChildItem Cert:\LocalMachine\My\[THUMBPRINT]
$pwd = ConvertTo-SecureString -String "Password123!" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "backup.pfx" -Password $pwd

# Import cert from backup
$pwd = ConvertTo-SecureString -String "Password123!" -Force -AsPlainText
Import-PfxCertificate -FilePath "backup.pfx" -CertStoreLocation Cert:\LocalMachine\My -Password $pwd

# Remove expired cert
Remove-Item Cert:\LocalMachine\My\[THUMBPRINT]
```

---

## 🔗 Next Steps

After completing server certificate setup:

1. ✅ **Server Certificate Created** - Complete (this guide)
2. **Upload to Azure AD** - See `CUSTOMER_TENANT_POWERSHELL_SETUP.md`
3. **Configure Teams Voice Manager** - Add certificate credentials in Admin Panel
4. **Test Connection** - Verify PowerShell connectivity
5. **Deploy to Production** - Start managing Teams voice configurations!

---

## 📊 Certificate Tracking Spreadsheet Template

Keep track of your certificates:

| Customer Tenant | Certificate Subject | Thumbprint | Created Date | Expiration Date | App Registration ID | Status |
|----------------|-------------------|-----------|--------------|-----------------|-------------------|--------|
| Contoso | TeamsPowerShell-Contoso | A1B2C3D4... | 2025-11-03 | 2027-11-03 | abc-123-def | Active |
| Fabrikam | TeamsPowerShell-Fabrikam | E5F6789... | 2025-11-03 | 2027-11-03 | ghi-456-jkl | Active |

**Set calendar reminders** 30 days before expiration!

---

## 🆘 Need Help?

**Common Issues:**
- Certificate access problems → Check administrator privileges
- Private key issues → Re-generate certificate as admin
- Module not found → Install MicrosoftTeams module

**Documentation:**
- Microsoft Teams PowerShell: https://docs.microsoft.com/powershell/teams/
- Certificate-based auth: https://docs.microsoft.com/azure/active-directory/develop/

---

## ✅ Completion Checklist

Before moving to the next step, confirm:

- [ ] PowerShell script executed successfully
- [ ] Certificate installed in `Cert:\LocalMachine\My`
- [ ] Certificate has private key (`HasPrivateKey: True`)
- [ ] `.cer` file exported and accessible
- [ ] Certificate thumbprint recorded
- [ ] Setup summary file saved
- [ ] Ready to upload to Azure AD

**✨ Great! You're ready to configure your customer tenant in Azure AD.**

Proceed to: `CUSTOMER_TENANT_POWERSHELL_SETUP.md`
