# Customer Tenant App Registration Setup

This guide explains how to create Azure AD app registrations in **customer tenants** (the Microsoft 365 tenants where you manage Teams voice configurations).

## Overview

Each customer tenant requires its own app registration with Microsoft Graph permissions to:
- Query Teams voice-enabled users
- Retrieve voice routing policies
- Assign phone numbers (Line URI) to users

---

## Prerequisites

For **each customer tenant**, you need:
- **Global Administrator** or **Application Administrator** role
- Access to [Azure Portal](https://portal.azure.com/) for that tenant
- Customer tenant ID (found in Azure AD → Overview)

---

## Step 1: Create App Registration in Customer Tenant

1. Sign in to [Azure Portal](https://portal.azure.com/) **as a customer tenant admin**

2. Navigate to **Microsoft Entra ID** (Azure Active Directory)

3. Go to **App registrations** → Click **New registration**

4. Configure the registration:
   - **Name**: `Teams Voice Manager - Customer API Access` (or customer-specific name)
   - **Supported account types**: Select **"Accounts in this organizational directory only (Single tenant)"**
     - Restricts access to this customer tenant only
   - **Redirect URI**: Leave blank (not needed for application permissions)

5. Click **Register**

6. **Save the following values**:
   - **Application (client) ID** → You'll add this to the app when setting up the tenant
   - **Directory (tenant) ID** → Customer's tenant ID

---

## Step 2: Create Client Secret

1. In the app registration, go to **Certificates & secrets**

2. Click **Client secrets** → **New client secret**

3. Configure the secret:
   - **Description**: `Teams Voice Manager API Key`
   - **Expires**: Choose duration (recommended: 12-24 months)

4. Click **Add**

5. **⚠️ CRITICAL**: Immediately copy the **Value** (not the Secret ID)
   - You'll add this when configuring the tenant in the application
   - **This value will never be shown again!**

---

## Step 3: Configure Microsoft Graph API Permissions

### Required Permissions

The application needs these **Application permissions** (not delegated):

| Permission | Type | Purpose |
|------------|------|---------|
| `User.Read.All` | Application | Query Teams voice-enabled users (read-only) |
| `TeamsUserConfiguration.Read.All` | Application | Read Teams user phone configurations |
| `TeamSettings.ReadWrite.All` | Application | Assign and manage Teams telephone numbers (Line URI) |
| `TeamsPolicyUserAssign.ReadWrite.All` | Application | Assign voice routing policies to users |

**Important**: Microsoft requires **both** `TeamsUserConfiguration.Read.All` (for reading) and `TeamSettings.ReadWrite.All` (for writing) to fully manage Teams phone numbers.

**Note**: As of October 2025, Microsoft released Graph API beta endpoints for Teams administration, enabling native Teams telephone number and policy assignment via Graph API.

### Add Permissions

1. Go to **API permissions** in your app registration

2. Click **Add a permission**

3. Select **Microsoft Graph**

4. Choose **Application permissions** (not Delegated!)

5. Search for and select each permission:
   - Expand **User** → Check `User.Read.All`
   - Search for `TeamsUserConfiguration.Read.All` → Check it
   - Search for `TeamSettings.ReadWrite.All` → Check it (Beta endpoint)
   - Search for `TeamsPolicyUserAssign.ReadWrite.All` → Check it (Beta endpoint)

6. Click **Add permissions**

---

## Step 4: Grant Admin Consent (REQUIRED)

**⚠️ CRITICAL**: Application permissions require admin consent

1. On the **API permissions** page, click **Grant admin consent for [Organization Name]**

2. Click **Yes** to confirm

3. Verify all permissions show **green checkmarks** under the "Status" column

**Alternative method (for delegated admin access):**

If you need to generate an admin consent URL:
```
https://login.microsoftonline.com/{CUSTOMER_TENANT_ID}/adminconsent?client_id={APP_CLIENT_ID}
```

---

## Step 5: Add Customer Tenant to Application

Now add this customer tenant to the Teams Voice Manager:

### Using the Application

1. Sign in to Teams Voice Manager as an operator

2. On the dashboard, click **"Add New Tenant"** or the tenant selector

3. Click **"Add Customer Tenant"**

4. Fill in the wizard:
   - **Tenant Name**: Friendly name (e.g., "Contoso Corporation")
   - **Tenant ID**: Directory (tenant) ID from Azure
   - **App Registration ID**: Application (client) ID from Step 1
   - **App Registration Secret**: Client secret value from Step 2

5. Click **"Add Tenant"**

6. The application will encrypt and store the credentials securely

---

## Step 6: Verify Setup

### Use the Built-in Validation Feature

**NEW**: The application includes a permission validation tool to verify your setup:

1. Sign in to the **Admin Panel** (requires admin credentials)
2. Go to **Customer Tenants** section
3. Find your newly added tenant and click **"Validate Permissions"**
4. Review the validation results:
   - ✅ **User.Read.All**: Tests by querying users
   - ✅ **TeamsUserConfiguration.Read.All**: Tests by reading Teams user configurations
   - ✅ **TeamSettings.ReadWrite.All**: Cannot be tested without making changes (marked as success if permission is granted)
   - ✅ **TeamsPolicyUserAssign.ReadWrite.All**: Cannot be tested without making changes (marked as success if permission is granted)

5. All four permissions should show as "success"
   - If any show "Permission denied", check that admin consent was granted in Step 4
   - If authentication fails, verify the App Registration ID and Secret are correct

### Test User Query

1. In the Teams Voice Manager dashboard:
   - Select the newly added customer tenant
   - The user search dropdown should populate with voice-enabled users

2. If users don't appear:
   - Use the validation tool in the Admin Panel first
   - Check admin consent was granted (Step 4)
   - Verify the tenant has voice-enabled users
   - Check the audit logs for error messages

### Test Policy Retrieval

1. Select a user from the dropdown
2. The voice routing policy dropdown should populate

**Note**: If no policies appear, the tenant may not have any voice routing policies configured

---

## Graph API Voice Routing Policy Support

### Full Native Support (October 2025)

**✅ NEW**: Microsoft Graph API now **fully supports** voice routing policy assignment via beta endpoints.

**What works**:
- ✅ Phone number (Line URI) assignment via Graph API
- ✅ Voice routing policy assignment via Graph API
- ✅ Retrieve voice routing policies via Graph API
- ✅ All operations work natively without PowerShell

**API Endpoints Used**:
```
GET  /beta/teamwork/voiceRoutingPolicies - Retrieve policies
POST /beta/teamwork/teamsPolicyUserAssignments/assign - Assign policy
```

### PowerShell Alternative (Optional)

While PowerShell is no longer required, you can still use it for manual verification:

```powershell
# Connect to customer tenant
Connect-MicrosoftTeams -TenantId "customer-tenant-id"

# View current policy assignment
Get-CsOnlineUser -Identity "user@customer.com" | Select OnlineVoiceRoutingPolicy

# Manually assign policy (if needed)
Grant-CsOnlineVoiceRoutingPolicy -Identity "user@customer.com" -PolicyName "PolicyName"
```

---

## Security Best Practices

### Secret Management

1. **Rotate secrets** before expiration
   - Set calendar reminders 30 days before expiration
   - Create new secret, update in app, then delete old secret

2. **Encryption**
   - Application automatically encrypts secrets using AES-256-GCM
   - Secrets are never stored in plain text

3. **Least Privilege**
   - Only grant the two required permissions
   - Don't add extra permissions "just in case"

### Monitoring

1. **Azure AD Sign-in Logs**
   - Monitor for failed authentication attempts
   - Review unusual access patterns

2. **Application Audit Logs**
   - Track all voice configuration changes
   - Export regularly for compliance

3. **Permission Reviews**
   - Quarterly review of app permissions
   - Remove unused app registrations

---

## Multi-Tenant Management

### Naming Convention

Use consistent naming for easy management:
- **App Name**: `Teams Voice Manager - [Customer Name]`
- **Secret Description**: `Teams Voice Manager - [Expiry Date]`

### Documentation

Maintain a spreadsheet with:
- Customer tenant name and ID
- App registration ID
- Secret expiration dates
- Date added to application
- Primary contact for tenant

### Secret Rotation Schedule

| Tenant | App ID | Secret Expires | Rotation Date |
|--------|--------|----------------|---------------|
| Contoso | abc123... | 2025-12-01 | 2025-11-01 |
| Fabrikam | def456... | 2026-01-15 | 2025-12-15 |

---

## Troubleshooting

### "Failed to connect to tenant"
- Verify app registration ID and secret are correct
- Check admin consent was granted (green checkmarks)
- Ensure app registration is in the **customer tenant** (not operator tenant)

### "Insufficient privileges to complete the operation"
- Verify all 4 required Graph API permissions are added (User.Read.All, TeamsUserConfiguration.Read.All, TeamSettings.ReadWrite.All, TeamsPolicyUserAssign.ReadWrite.All)
- Confirm admin consent was granted
- Check the service principal exists in the tenant:
  ```powershell
  Get-AzureADServicePrincipal -Filter "AppId eq 'your-app-id'"
  ```

### "No users returned"
- Verify tenant has voice-enabled users:
  ```powershell
  Get-CsOnlineUser | Where-Object {$_.EnterpriseVoiceEnabled -eq $true}
  ```
- Check User.Read.All permission is granted with admin consent

### "No policies available"
- Verify tenant has voice routing policies configured:
  ```powershell
  Get-CsOnlineVoiceRoutingPolicy
  ```
- Note: Policy retrieval may require PowerShell as the Graph API for reading policies is still in development

### "Cannot assign phone number or policy"
- Verify TeamSettings.ReadWrite.All and TeamsPolicyUserAssign.ReadWrite.All permissions are granted with admin consent
- Check the phone number format (must be tel:+[E.164 format])
- Ensure the user is licensed for Phone System
- Verify the voice routing policy is correct (use Get-CsOnlineVoiceRoutingPolicy to see available policies)

---

## Next Steps After Setup

1. **Test basic operations**:
   - Query users ✅
   - Retrieve policies ✅
   - Assign phone number ✅
   - Verify audit logging ✅

2. **Configure profiles** (optional):
   - Create configuration profiles for common setups
   - Set default phone number prefixes
   - Set default routing policies

3. **Train operators**:
   - Show how to select tenants
   - Demonstrate user assignment
   - Explain bulk assignment features

4. **Set up monitoring**:
   - Review audit logs weekly
   - Track secret expiration dates
   - Monitor for failed assignments

---

## Summary

Each customer tenant requires:
- ✅ Dedicated app registration (single-tenant)
- ✅ Four Microsoft Graph Application permissions:
  - `User.Read.All` - Query Teams users
  - `TeamsUserConfiguration.Read.All` - Read Teams phone configurations
  - `TeamSettings.ReadWrite.All` - Manage telephone numbers (Beta)
  - `TeamsPolicyUserAssign.ReadWrite.All` - Assign policies (Beta)
- ✅ Admin consent granted (green checkmarks)
- ✅ Client secret (encrypted in application)
- ✅ Full Teams telephone number and policy management via Graph API beta (October 2025)

**Note**: TeamSettings.ReadWrite.All and TeamsPolicyUserAssign.ReadWrite.All are beta endpoints.

**Remember**: This setup must be repeated for **each customer tenant** you manage.
