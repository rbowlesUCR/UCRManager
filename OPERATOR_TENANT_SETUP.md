# Operator Tenant App Registration Setup

This guide walks you through creating and configuring the Azure AD app registration in your **operator tenant** (the tenant where operators sign in to use this application).

## Prerequisites

- **Global Administrator** or **Application Administrator** role in your Azure AD tenant
- Access to [Azure Portal](https://portal.azure.com/)

---

## Step 1: Create App Registration

1. Sign in to the [Azure Portal](https://portal.azure.com/)

2. Navigate to **Microsoft Entra ID** (formerly Azure Active Directory)

3. Go to **App registrations** → Click **New registration**

4. Configure the registration:
   - **Name**: `Teams Voice Manager - Operator Portal` (or your preferred name)
   - **Supported account types**: Select **"Accounts in this organizational directory only (Single tenant)"**
     - This restricts authentication to your operator tenant only
   - **Redirect URI**:
     - Platform: **Web**
     - URI: `https://your-replit-app.replit.app/api/auth/callback`
     - For local development: `http://localhost:5000/api/auth/callback`

5. Click **Register**

6. **Save the following values** (you'll need them for environment variables):
   - **Application (client) ID** → Save as `AZURE_CLIENT_ID`
   - **Directory (tenant) ID** → Save as `AZURE_TENANT_ID`

---

## Step 2: Create Client Secret

1. In your app registration, go to **Certificates & secrets**

2. Click **Client secrets** → **New client secret**

3. Configure the secret:
   - **Description**: `Teams Voice Manager Secret`
   - **Expires**: Choose an appropriate duration (recommended: 12-24 months)

4. Click **Add**

5. **⚠️ CRITICAL**: Immediately copy the **Value** (not the Secret ID)
   - Save this as `AZURE_CLIENT_SECRET`
   - **This value will never be shown again!**

---

## Step 3: Configure API Permissions

This app only needs permissions to authenticate operators - **no Microsoft Graph permissions are required** for the operator tenant app registration.

### Why No Graph Permissions?

- The operator app registration is **only for authentication** (signing in operators)
- Voice configuration happens through **customer tenant** app registrations (configured separately)
- Operators authenticate here, then use customer tenant credentials to manage Teams

### Verify Default Permissions

1. Go to **API permissions**
2. You should see: `Microsoft Graph` → `User.Read` (Delegated)
3. This default permission is sufficient for operator sign-in

**✅ No additional permissions needed!**

---

## Step 4: Configure Authentication Settings

1. Go to **Authentication** in your app registration

2. Under **Platform configurations** → **Web**, verify:
   - Redirect URI: `https://your-replit-app.replit.app/api/auth/callback`

3. Under **Implicit grant and hybrid flows**:
   - ✅ Check **"ID tokens (used for implicit and hybrid flows)"** if not already checked

4. Under **Advanced settings**:
   - **Allow public client flows**: **No**
   - **Live SDK support**: **No**

5. Click **Save**

---

## Step 5: Add Environment Variables to Replit

Add these secrets to your Replit project:

1. In Replit, go to **Secrets** (lock icon in sidebar)

2. Add the following secrets:

   ```
   AZURE_TENANT_ID=<your-operator-tenant-id>
   AZURE_CLIENT_ID=<your-application-client-id>
   AZURE_CLIENT_SECRET=<your-client-secret-value>
   ```

3. These are already configured in your app, so just verify they exist

---

## Step 6: Test Operator Authentication

1. Start your application (should already be running)

2. Navigate to your app URL

3. Click **"Sign in with Microsoft"**

4. You should be redirected to Microsoft sign-in

5. Sign in with an operator account from your tenant

6. After successful authentication, you should be redirected to the dashboard

---

## Important Notes

### Voice Routing Policy Limitation

**⚠️ IMPORTANT**: Microsoft Graph API does **not support** voice routing policy assignment. 

Based on Microsoft's documentation:
- Voice routing policies can only be managed via **Teams PowerShell** module
- The Graph API endpoints for this functionality do not exist
- This is a known limitation that Microsoft has not yet addressed

**Impact on this application**:
- Phone number (Line URI) assignment **works** via Graph API ✅
- Voice routing policy assignment **is logged but not applied** via Graph API ❌
- You'll need to use PowerShell as a workaround:

```powershell
# Connect to Teams
Connect-MicrosoftTeams

# Assign policy to user
Grant-CsOnlineVoiceRoutingPolicy -Identity "user@domain.com" -PolicyName "PolicyName"
```

### Security Best Practices

1. **Rotate client secrets** regularly (set calendar reminders before expiration)
2. **Never commit secrets** to version control
3. **Use separate app registrations** for development and production
4. **Regularly review** API permissions and remove unused ones
5. **Enable monitoring** in Azure AD to track sign-ins and errors

---

## Troubleshooting

### "AADSTS50011: The reply URL specified in the request does not match"
- Verify redirect URI exactly matches in Azure Portal and your deployed app URL
- Check for trailing slashes or http vs https mismatches

### "AADSTS700016: Application not found in directory"
- Verify `AZURE_CLIENT_ID` matches the Application ID in Azure Portal
- Confirm you're signing in to the correct tenant

### "AADSTS7000215: Invalid client secret provided"
- Client secret may have expired - create a new one in Azure Portal
- Verify you copied the **Value** (not the Secret ID)
- Check for extra spaces when pasting the secret

### Operators can't sign in
- Verify the app registration is in the **operator tenant** (not customer tenant)
- Check that supported account types is set to single-tenant
- Confirm redirect URI includes the correct app URL

---

## Next Steps

After completing operator tenant setup:

1. ✅ **Operator Authentication** - Complete (this guide)
2. **Customer Tenant Setup** - Create app registrations in each customer tenant
   - Requires different permissions (User.Read.All, Policy.Read.All, Policy.ReadWrite.ApplicationConfiguration)
   - See `CUSTOMER_TENANT_SETUP.md` for detailed instructions
3. **Admin Panel Access** - Configure admin credentials (already seeded: admin/admin123)

---

## Summary

Your operator tenant app registration is configured for:
- ✅ Single-tenant authentication (operators from your tenant only)
- ✅ OAuth 2.0 authorization code flow with PKCE
- ✅ Secure client secret authentication
- ✅ Minimal required permissions (User.Read only)

**Remember**: This app registration is **only for operator authentication**. Customer tenant management happens through separate app registrations with Graph API permissions.
