# Customer Tenant PowerShell Setup Guide
## Configuring Azure AD App Registration with Certificate Authentication

This guide walks you through configuring Microsoft Teams PowerShell access for each customer tenant using certificate-based authentication. This enables Teams Voice Manager to automatically manage phone numbers and voice routing policies without user credentials or MFA.

---

## 📋 Prerequisites

Before you begin, ensure you have:

- ✅ **Completed server certificate setup** (see `SERVER_CERTIFICATE_SETUP.md`)
- ✅ **Certificate .cer file** from your server
- ✅ **Certificate thumbprint** recorded
- ✅ **Global Administrator** or **Application Administrator** role in customer's Azure AD
- ✅ **Access to Azure Portal** (https://portal.azure.com)

---

## 🎯 Overview: What You'll Configure

For each customer tenant, you'll:

1. Create or use existing **Azure AD App Registration**
2. **Upload certificate** to the app registration
3. **Grant API permissions** for Teams PowerShell operations
4. **Admin consent** to the permissions
5. **Configure in Teams Voice Manager** with app ID and thumbprint

---

## 🚀 Step-by-Step Wizard

### Step 1: Sign In to Customer's Azure Portal

1. Navigate to **https://portal.azure.com**

2. Sign in with an account that has **Global Administrator** or **Application Administrator** role in the **customer tenant**

   ⚠️ **Important:** Make sure you're signed into the **customer's tenant**, not your operator tenant!

3. Verify the correct tenant:
   - Look at the top-right corner for the tenant name
   - Click your profile → "Switch directory" if needed

---

### Step 2: Navigate to App Registrations

1. In the Azure Portal, search for **"App registrations"** in the top search bar

2. Click **"App registrations"** (under Services)

3. You'll see a list of existing app registrations

**Choose one of these options:**

### Option A: Use Existing App Registration (Recommended)

If you already have an app registration for Teams Voice Manager (for Graph API), you can **reuse it** by adding certificate authentication.

1. Click on your existing app registration (e.g., "Teams Voice Manager - Customer API Access")

2. Proceed to **Step 3: Upload Certificate**

### Option B: Create New App Registration

Create a dedicated app registration just for PowerShell operations.

1. Click **"+ New registration"**

2. Configure the registration:
   - **Name**: `Teams Voice Manager - PowerShell Access`
   - **Supported account types**: **"Accounts in this organizational directory only (Single tenant)"**
   - **Redirect URI**: Leave blank (not needed for app authentication)

3. Click **"Register"**

4. **Save these values** (you'll need them later):
   - **Application (client) ID** → Copy this
   - **Directory (tenant) ID** → Copy this

---

### Step 3: Upload Certificate to App Registration

Now upload the public key (.cer file) from your server.

1. In your app registration, go to **"Certificates & secrets"** (left menu)

2. Click the **"Certificates"** tab (not "Client secrets")

3. Click **"Upload certificate"**

4. **Select the .cer file** from your server:
   - File name: `TeamsPowerShell-[CustomerName].cer`
   - This file was generated in the server setup step

5. **Optional:** Add a description (e.g., "Teams PowerShell Production - Expires 2027-11-03")

6. Click **"Add"**

7. **Verify the upload:**
   - You should see the certificate listed with its thumbprint
   - Confirm the thumbprint matches what you recorded from the server
   - Note the expiration date

**✅ Certificate uploaded successfully!**

---

### Step 4: Configure API Permissions

The app registration needs specific permissions to manage Teams via PowerShell.

**Required Permissions for Teams PowerShell:**

| Permission | Type | Purpose |
|-----------|------|---------|
| `User.Read.All` | Application | Read user information |
| `Organization.Read.All` | Application | Read tenant information |

**Note:** Teams PowerShell cmdlets use these base permissions. The actual Teams operations are authorized through the certificate, not Graph API permissions.

#### Add Permissions:

1. In your app registration, go to **"API permissions"** (left menu)

2. You likely already have `User.Read.All` from Graph API setup. Verify it's present.

3. If `Organization.Read.All` is missing, add it:
   - Click **"+ Add a permission"**
   - Select **"Microsoft Graph"**
   - Choose **"Application permissions"** (not Delegated)
   - Search for and select: `Organization.Read.All`
   - Click **"Add permissions"**

4. **Review your permissions list:**
   ```
   ✓ Microsoft Graph - User.Read.All (Application)
   ✓ Microsoft Graph - Organization.Read.All (Application)
   ```

---

### Step 5: Grant Admin Consent (CRITICAL!)

Application permissions **require admin consent** to work.

1. On the **"API permissions"** page, click:
   **"✓ Grant admin consent for [Organization Name]"**

2. Click **"Yes"** in the confirmation dialog

3. **Verify the consent was granted:**
   - Each permission should show a **green checkmark** in the "Status" column
   - Status should say: "Granted for [Organization Name]"

**⚠️ Without admin consent, PowerShell connections will fail!**

---

### Step 6: Assign Azure AD Directory Role to Service Principal (CRITICAL!)

This is the most important step for Teams PowerShell to work with certificate-based authentication.

**Why this is needed:**
- Graph API permissions (like User.Read.All) are for REST API calls
- Azure AD directory roles are for PowerShell cmdlet operations
- Without this role, the app can authenticate but cannot modify Teams settings

#### Assign Teams Administrator Role:

1. In Azure Portal, navigate to **"Microsoft Entra ID"** (or "Azure Active Directory")

2. In the left menu, click **"Roles and administrators"**

3. In the search box, type: **"Teams Administrator"**

4. Click on **"Teams Administrator"** in the list

5. Click **"+ Add assignments"** at the top

6. In the "Select members" dialog:
   - Search for your app registration name (e.g., "Teams Voice Manager - PowerShell Access")
   - **Important:** You're looking for the **service principal**, not the app registration itself
   - Select your app from the list
   - Click **"Add"**

7. **Verify the role assignment:**
   - You should see your app listed under "Active assignments"
   - Role: Teams Administrator
   - Assignment type: Assigned

**Alternative role options:**

| Role | Recommended | Capabilities |
|------|------------|--------------|
| **Teams Administrator** | ✅ Yes | Full Teams management including voice routing, phone numbers, policies |
| **Skype for Business Administrator** | ⚠️ Legacy | Still grants voice-related permissions (legacy role) |
| **Global Administrator** | ❌ No | Too broad - avoid for principle of least privilege |
| **Teams Communications Support** | ❌ No | Read-only - cannot modify LineURI or policies |

**✅ Choose Teams Administrator for best practice!**

#### What this role enables:

With the Teams Administrator role, your app can now:
- ✅ Assign phone numbers to users (`Set-CsPhoneNumberAssignment`)
- ✅ Grant voice routing policies (`Grant-CsOnlineVoiceRoutingPolicy`)
- ✅ Manage Teams users and settings
- ✅ Query Teams configuration
- ✅ Execute all Teams PowerShell cmdlets

**⚠️ Without this role assignment:**
- ❌ PowerShell connection may succeed but commands will fail
- ❌ You'll get "insufficient privileges" or "access denied" errors
- ❌ Phone number assignments will be rejected
- ❌ Policy grants will fail

---

### Step 7: Verify App Registration Configuration

Before proceeding, double-check your setup:

#### Checklist:

- [ ] Certificate uploaded (visible in "Certificates & secrets")
- [ ] Certificate thumbprint matches your server certificate
- [ ] `User.Read.All` permission granted (green checkmark)
- [ ] `Organization.Read.All` permission granted (green checkmark)
- [ ] **Teams Administrator role assigned to service principal** ⭐ CRITICAL
- [ ] Application (client) ID copied
- [ ] Directory (tenant) ID copied

---

### Step 8: Test Certificate Authentication (Optional but Recommended)

Before configuring Teams Voice Manager, test the connection manually using PowerShell on your server.

**On your Windows Server**, run:

```powershell
# Replace with your actual values
$appId = "YOUR-APPLICATION-CLIENT-ID"
$thumbprint = "YOUR-CERTIFICATE-THUMBPRINT"
$tenantId = "CUSTOMER-TENANT-ID"

# Import MicrosoftTeams module
Import-Module MicrosoftTeams

# Connect using certificate
Connect-MicrosoftTeams `
    -ApplicationId $appId `
    -CertificateThumbprint $thumbprint `
    -TenantId $tenantId

# Verify connection
$tenant = Get-CsTenant
Write-Host "✓ Successfully connected to: $($tenant.DisplayName)"
Write-Host "  Tenant ID: $($tenant.TenantId)"

# Disconnect
Disconnect-MicrosoftTeams
```

**Expected output:**
```
✓ Successfully connected to: Contoso Corporation
  Tenant ID: 12345678-1234-1234-1234-123456789012
```

**If connection fails:**
- Verify certificate thumbprint is correct
- Ensure app ID and tenant ID are correct
- Check that admin consent was granted (green checkmarks)
- Confirm certificate exists in `Cert:\LocalMachine\My`
- Verify Teams Administrator role is assigned to the service principal

---

### Step 9: Configure Teams Voice Manager

Now add the certificate credentials to Teams Voice Manager.

1. **Sign in to Teams Voice Manager** as an administrator

2. Navigate to **Admin Panel** → **Customer Tenants**

3. Find your customer tenant in the list

4. Click **"PowerShell Settings"** or **"Configure PowerShell Credentials"**

5. **Enter the certificate details:**
   - **Application ID**: (from Step 2 - your app registration client ID)
   - **Certificate Thumbprint**: (from server setup - the full thumbprint)
   - **Description**: (optional, e.g., "Production PowerShell - Expires Nov 2027")
   - **Mark as Active**: Check this box

6. Click **"Save"**

**✅ Certificate credentials saved and encrypted in database!**

---

### Step 10: Test Connection from Teams Voice Manager

Verify the integration works end-to-end:

1. In the Teams Voice Manager Admin Panel, find your configured tenant

2. Click **"Test PowerShell Connection"**

3. **Expected result:**
   ```
   ✓ Connection successful
   Connected to: Contoso Corporation
   Tenant ID: 12345678-1234-1234-1234-123456789012
   ```

4. **If the test fails**, check:
   - Application ID is correct
   - Certificate thumbprint is correct (no spaces or typos)
   - Tenant ID matches the customer's Azure AD
   - Certificate is installed on the server
   - Admin consent was granted in Azure AD
   - **Teams Administrator role is assigned** to the service principal in Azure AD

---

## 🔧 Advanced Configuration

### Using Multiple Certificates per Tenant

You can add multiple certificates for:
- **High availability** (backup certificate)
- **Certificate rotation** (old + new during transition)
- **Different environments** (dev, staging, production)

**To add a second certificate:**

1. Generate another certificate on the server with a different name:
   ```powershell
   .\New-TeamsPowerShellCertificate.ps1 -TenantName "Contoso-Backup"
   ```

2. Upload the new .cer file to the **same app registration**

3. Azure AD will list both certificates

4. In Teams Voice Manager, you can have multiple credentials configured (mark one as "Active")

---

### Restricting Certificate Permissions

For enhanced security, create a dedicated app registration with minimal permissions:

**Option 1: PowerShell-Only App Registration**

1. Create new app registration: "Teams Voice Manager - PowerShell Only"
2. Upload certificate
3. Grant only `Organization.Read.All` (User.Read.All is auto-included)
4. Do NOT add Graph API write permissions

**Option 2: Separate Service Accounts**

For extra isolation:
1. Create different app registrations per function:
   - "Teams Voice Manager - Graph API" (for user queries)
   - "Teams Voice Manager - PowerShell" (for policy management)
2. Use different certificates for each

---

### Certificate-Based Authentication vs Service Principal

**What you configured:**
- ✅ Certificate-based authentication (recommended)
- ✅ No user credentials stored
- ✅ No MFA prompts
- ✅ Fully automated

**Alternative (not recommended):**
- ❌ Service principal with client secret
- ❌ Secrets expire and must be rotated
- ❌ Less secure than certificate-based auth

**Stick with certificate authentication!**

---

## 🔄 Certificate Rotation & Renewal

Certificates expire! Plan ahead to avoid service disruptions.

### Renewal Timeline (Example: 2-year certificate)

| Days Before Expiration | Action |
|----------------------|--------|
| **60 days** | Generate new certificate on server |
| **45 days** | Upload new certificate to Azure AD (both old and new are now active) |
| **30 days** | Update Teams Voice Manager with new thumbprint |
| **15 days** | Test thoroughly with new certificate |
| **7 days** | Set new certificate as active, monitor for issues |
| **0 days (after)** | Remove old certificate from Azure AD and server |

### Renewal Step-by-Step

**1. Generate new certificate** (same tenant name is fine):
```powershell
.\New-TeamsPowerShellCertificate.ps1 -TenantName "Contoso" -ValidityYears 2
```

**2. Upload new certificate** to Azure AD (existing app registration):
- Certificates & secrets → Upload certificate
- Both old and new certificates will be listed

**3. Update Teams Voice Manager**:
- Admin Panel → Customer Tenants → PowerShell Settings
- Add new credential with new thumbprint
- Keep old credential active for now

**4. Test new certificate**:
- Use "Test Connection" button
- Verify successful connection

**5. Activate new certificate**:
- Mark new credential as "Active"
- Mark old credential as inactive

**6. Monitor for 7 days**:
- Check audit logs for any issues
- Confirm all PowerShell operations succeed

**7. Clean up old certificate**:
- Delete old credential from Teams Voice Manager
- Remove old certificate from Azure AD
- Remove old certificate from server:
  ```powershell
  Remove-Item Cert:\LocalMachine\My\OLD_THUMBPRINT_HERE
  ```

---

## 🚨 Troubleshooting

### Connection Error: "AADSTS700016: Application not found"

**Cause:** Application ID is incorrect

**Solution:**
1. Go to Azure Portal → App registrations
2. Find your app and copy the **Application (client) ID**
3. Update Teams Voice Manager with correct app ID

---

### Connection Error: "Certificate with thumbprint [...] not found"

**Cause:** Certificate not installed on server, or thumbprint mismatch

**Solution:**
1. On server, verify certificate exists:
   ```powershell
   Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Subject -like "*TeamsPowerShell*" }
   ```
2. Compare thumbprint with what's in Teams Voice Manager
3. If missing, re-run certificate generation script

---

### Connection Error: "Insufficient privileges" or "Access Denied"

**Cause #1:** Teams Administrator role not assigned to service principal (most common)

**Solution:**
1. Go to Azure Portal → Microsoft Entra ID → Roles and administrators
2. Search for "Teams Administrator"
3. Click on it and verify your app's service principal is listed under "Active assignments"
4. If not listed, click "Add assignments" and add your app

**Cause #2:** Admin consent not granted for API permissions

**Solution:**
1. Go to Azure Portal → App registrations → Your app → API permissions
2. Click "Grant admin consent for [Organization]"
3. Verify all permissions show green checkmarks

---

### Connection Works Manually but Fails in Application

**Cause:** Application server account doesn't have access to certificate private key

**Solution:**
1. Ensure application runs as Local System or Administrator
2. Verify certificate is in `LocalMachine\My` (not `CurrentUser\My`)
3. Check certificate ACLs:
   ```powershell
   $cert = Get-ChildItem Cert:\LocalMachine\My\THUMBPRINT
   $privateKeyPath = $cert.PrivateKey.CspKeyContainerInfo.UniqueKeyContainerName
   Get-Acl "C:\ProgramData\Microsoft\Crypto\Keys\$privateKeyPath" | Format-List
   ```

---

### PowerShell Commands Fail: "The term 'Get-CsOnlineVoiceRoutingPolicy' is not recognized"

**Cause:** MicrosoftTeams module not installed or old version

**Solution:**
```powershell
# Check installed version
Get-Module -ListAvailable MicrosoftTeams

# Update to latest version
Update-Module MicrosoftTeams -Force

# Verify version (need 5.0.0 or higher)
Import-Module MicrosoftTeams
Get-Module MicrosoftTeams
```

---

### Permissions Error: "You do not have permission to access this resource"

**Cause:** Missing required API permissions or lack of admin consent

**Solution:**
1. Verify these permissions are granted with admin consent:
   - `User.Read.All`
   - `Organization.Read.All`
2. Check that the app registration is in the **customer tenant** (not operator tenant)

---

## 📊 Multi-Tenant Management

### Tracking Multiple Customer Tenants

Use a spreadsheet to track all customer configurations:

| Customer | Tenant ID | App ID | Thumbprint | Cert Expires | Last Tested | Status |
|----------|----------|--------|------------|--------------|-------------|--------|
| Contoso | abc-123 | def-456 | A1B2C3... | 2027-11-03 | 2025-11-03 | ✅ Active |
| Fabrikam | ghi-789 | jkl-012 | D4E5F6... | 2027-11-03 | 2025-11-03 | ✅ Active |
| Northwind | mno-345 | pqr-678 | G7H8I9... | 2026-05-15 | 2025-10-28 | ⚠️ Renew Soon |

---

### Bulk Setup Script

For setting up multiple tenants at once:

```powershell
# Customer tenant configuration data
$tenants = @(
    @{
        Name = "Contoso"
        TenantId = "12345678-1234-1234-1234-123456789012"
        AppId = "87654321-4321-4321-4321-210987654321"
    },
    @{
        Name = "Fabrikam"
        TenantId = "abcdefgh-abcd-abcd-abcd-abcdefghijkl"
        AppId = "hgfedcba-dcba-dcba-dcba-lkjihgfedcba"
    }
)

# Generate certificates and test connections
foreach ($tenant in $tenants) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "Processing: $($tenant.Name)" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    # Generate certificate
    .\New-TeamsPowerShellCertificate.ps1 -TenantName $tenant.Name

    # Get thumbprint of newly created cert
    $cert = Get-ChildItem Cert:\LocalMachine\My |
        Where-Object { $_.Subject -eq "CN=TeamsPowerShell-$($tenant.Name)" } |
        Sort-Object NotAfter -Descending |
        Select-Object -First 1

    Write-Host "`n📋 Next steps for $($tenant.Name):" -ForegroundColor Yellow
    Write-Host "1. Upload: TeamsPowerShell-$($tenant.Name).cer to Azure AD" -ForegroundColor White
    Write-Host "2. App ID: $($tenant.AppId)" -ForegroundColor White
    Write-Host "3. Thumbprint: $($cert.Thumbprint)" -ForegroundColor Cyan
    Write-Host "4. Grant admin consent in Azure Portal" -ForegroundColor White
}
```

---

## 🔐 Security Best Practices

### Certificate Security

1. **Private keys never leave the server**
   - Stored securely in Windows Certificate Store
   - Only accessible to administrators

2. **Public keys can be safely shared**
   - .cer files contain no secrets
   - Safe to email or transfer

3. **Separate certificates per tenant**
   - Isolates access
   - Easier to revoke if compromised

4. **Regular rotation**
   - Renew certificates before expiration
   - Use 2-year validity (good balance)

### App Registration Security

1. **Least privilege principle**
   - Only grant required permissions
   - Don't add extra "just in case" permissions

2. **Monitor sign-in logs**
   - Azure AD → Sign-in logs
   - Look for service principal sign-ins
   - Review for unusual patterns

3. **Conditional access policies**
   - Can be applied to service principals
   - Require connections from specific IP ranges
   - Enable only during business hours

4. **Regular audits**
   - Quarterly review of app registrations
   - Remove unused certificates
   - Verify permissions are still needed

---

## ✅ Configuration Checklist

Before completing setup, verify:

### Azure AD Configuration:
- [ ] App registration created or identified
- [ ] Certificate uploaded (.cer file)
- [ ] Certificate thumbprint matches server
- [ ] `User.Read.All` permission granted
- [ ] `Organization.Read.All` permission granted
- [ ] Admin consent granted (green checkmarks)
- [ ] **Teams Administrator role assigned to service principal** ⭐ CRITICAL
- [ ] Application ID recorded
- [ ] Tenant ID recorded

### Teams Voice Manager Configuration:
- [ ] Certificate credentials added
- [ ] Application ID entered correctly
- [ ] Certificate thumbprint entered correctly
- [ ] Credential marked as active
- [ ] Connection test passed

### Documentation:
- [ ] Certificate expiration date noted
- [ ] Calendar reminder set for renewal
- [ ] Configuration details recorded in tracking spreadsheet
- [ ] Backup of certificate created (optional)

---

## 🔗 Next Steps

After completing customer tenant setup:

1. ✅ **Server Certificate** - Complete (SERVER_CERTIFICATE_SETUP.md)
2. ✅ **Azure AD Configuration** - Complete (this guide)
3. ✅ **Teams Voice Manager Config** - Complete (this guide)
4. **Test Operations** - Assign phone numbers and policies
5. **Train Operators** - Show how to use PowerShell features
6. **Monitor & Maintain** - Regular health checks and certificate renewal

---

## 📚 Additional Resources

**Microsoft Documentation:**
- Teams PowerShell Overview: https://learn.microsoft.com/microsoftteams/teams-powershell-overview
- Certificate-based authentication: https://learn.microsoft.com/azure/active-directory/develop/howto-create-service-principal-portal
- Teams cmdlet reference: https://learn.microsoft.com/powershell/teams/

**Teams Voice Manager:**
- Main documentation: See `replit.md`
- Graph API setup: See `CUSTOMER_TENANT_SETUP.md`
- Operator setup: See `OPERATOR_TENANT_SETUP.md`

---

## 🆘 Support

**Common Issues:**
- Certificate not found → Check server installation
- Permission denied → Grant admin consent
- App not found → Verify application ID
- Connection timeout → Check network/firewall

**For help:**
- Review troubleshooting section above
- Check audit logs in Teams Voice Manager
- Review Azure AD sign-in logs
- Test connection manually with PowerShell

---

## 🎉 Setup Complete!

Congratulations! Your customer tenant is now configured for certificate-based PowerShell authentication.

**What you achieved:**
- ✅ Secure, automated Teams management
- ✅ No user credentials stored
- ✅ No MFA prompts required
- ✅ Full PowerShell cmdlet support

**You can now:**
- Assign phone numbers to users
- Grant voice routing policies
- Query Teams configuration
- Automate bulk operations

**Start using Teams Voice Manager to manage your Teams voice infrastructure efficiently!**
