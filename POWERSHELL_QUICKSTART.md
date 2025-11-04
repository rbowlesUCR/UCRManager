# PowerShell Quick Start Guide
## Certificate-Based Authentication in 5 Steps

Get up and running with Teams PowerShell certificate authentication quickly!

---

## 🚀 Quick Setup (15 minutes)

### Step 1: Generate Certificate (5 min)

On your Windows Server as Administrator:

```powershell
cd C:\inetpub\wwwroot\UCRManager\scripts
.\New-TeamsPowerShellCertificate.ps1 -TenantName "YourCustomerName"
```

**Output:**
- `TeamsPowerShell-YourCustomerName.cer` (upload to Azure)
- Certificate thumbprint (save this!)

---

### Step 2: Upload to Azure AD (3 min)

1. Go to [Azure Portal](https://portal.azure.com) (sign in to **customer tenant**)
2. Navigate: **App registrations** → Your app → **Certificates & secrets**
3. Click **Upload certificate** → Select the `.cer` file
4. Save the **Application (client) ID**

---

### Step 3: Grant Permissions (2 min)

In your Azure AD app registration:

1. Go to **API permissions**
2. Verify these are granted:
   - ✅ `User.Read.All` (Application)
   - ✅ `Organization.Read.All` (Application)
3. Click **"Grant admin consent"** → Confirm

---

### Step 4: Test Connection (2 min)

On your server, test the certificate works:

```powershell
Connect-MicrosoftTeams `
    -ApplicationId "YOUR-APP-ID" `
    -CertificateThumbprint "YOUR-THUMBPRINT" `
    -TenantId "CUSTOMER-TENANT-ID"

# Should see: Account, TenantId, Environment
# If successful, disconnect:
Disconnect-MicrosoftTeams
```

---

### Step 5: Configure Teams Voice Manager (3 min)

1. Sign in to Teams Voice Manager Admin Panel
2. Go to **Customer Tenants** → Select tenant
3. Click **PowerShell Settings**
4. Enter:
   - **Application ID**: (from Step 2)
   - **Certificate Thumbprint**: (from Step 1)
   - **Mark as Active**: ✅
5. Click **Save**
6. Click **Test Connection** → Should succeed!

---

## ✅ Done!

Your tenant now has automated PowerShell access. Teams Voice Manager can:
- Assign phone numbers
- Grant voice routing policies
- Query Teams configuration
- All without user credentials or MFA!

---

## 📚 Full Documentation

For detailed guides, see:
- **Server Setup:** `SERVER_CERTIFICATE_SETUP.md`
- **Azure AD Setup:** `CUSTOMER_TENANT_POWERSHELL_SETUP.md`
- **Migration Summary:** `CERTIFICATE_AUTH_MIGRATION_SUMMARY.md`

---

## 🔧 Common Commands

### Generate certificate for another tenant:
```powershell
.\New-TeamsPowerShellCertificate.ps1 -TenantName "AnotherCustomer"
```

### List all certificates:
```powershell
Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Subject -like "*TeamsPowerShell*" }
```

### Test a specific certificate:
```powershell
$cert = Get-ChildItem Cert:\LocalMachine\My\THUMBPRINT_HERE
$cert | Format-List Subject, Thumbprint, NotAfter, HasPrivateKey
```

---

## 🆘 Troubleshooting

**Connection fails?**
- ✅ Check app ID is correct
- ✅ Verify thumbprint has no spaces/typos
- ✅ Confirm admin consent was granted
- ✅ Ensure certificate exists on server

**Certificate not found?**
```powershell
# Re-run certificate script as Administrator
.\New-TeamsPowerShellCertificate.ps1 -TenantName "CustomerName"
```

**Permission denied in Azure?**
- Grant admin consent in Azure Portal
- Verify you're in the correct tenant
- Check API permissions are Application (not Delegated)

---

## 📞 Need Help?

See the full documentation files for:
- Detailed troubleshooting
- Security best practices
- Certificate renewal process
- Multi-tenant management

**Happy automating!** 🎉
