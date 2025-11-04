# Guide: Adding User Credentials with MFA for Testing

## Step 1: Get Your Admin Session Token

1. Sign in to the **Admin Panel** at: https://ucrmanager.westus3.cloudapp.azure.com/admin
2. Open browser **Developer Tools** (F12)
3. Go to **Console** tab
4. Run this command to get your JWT token:
   ```javascript
   document.cookie.split('; ').find(row => row.startsWith('admin_token=')).split('=')[1]
   ```
5. **Copy the token** - you'll use it in the next step

## Step 2: Encrypt Your Password

Use curl or PowerShell to call the encryption endpoint:

### Using PowerShell:
```powershell
$token = "YOUR_JWT_TOKEN_HERE"
$password = "YourActualPassword"

$headers = @{
    "Content-Type" = "application/json"
    "Cookie" = "admin_token=$token"
}

$body = @{
    password = $password
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "https://ucrmanager.westus3.cloudapp.azure.com/api/admin/encrypt-password" -Method Post -Headers $headers -Body $body

Write-Host "Encrypted Password:"
Write-Host $response.encryptedPassword
```

### Using curl:
```bash
curl -X POST https://ucrmanager.westus3.cloudapp.azure.com/api/admin/encrypt-password \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_token=YOUR_JWT_TOKEN_HERE" \
  -d '{"password":"YourActualPassword"}'
```

**Save the `encryptedPassword` value** from the response!

## Step 3: Create a Test Tenant (if needed)

If you don't have a second tenant yet, create one:

```sql
INSERT INTO customer_tenants (
  tenant_name,
  tenant_id,
  app_registration_id,
  app_registration_secret
) VALUES (
  'Test Tenant MFA',
  'your-azure-tenant-id',
  'dummy-app-id',
  'dummy-secret'
);
```

Get the generated ID:
```sql
SELECT id, tenant_name FROM customer_tenants WHERE tenant_name = 'Test Tenant MFA';
```

## Step 4: Insert User Credentials

Now insert the PowerShell credentials with the encrypted password:

```sql
INSERT INTO tenant_powershell_credentials (
  tenant_id,
  auth_type,
  username,
  encrypted_password,
  is_active,
  created_at
) VALUES (
  'YOUR-TENANT-ID-FROM-STEP-3',  -- UUID from customer_tenants table
  'user',
  'admin@yourdomain.onmicrosoft.com',  -- Your Microsoft 365 admin username
  'ENCRYPTED-PASSWORD-FROM-STEP-2',
  true,
  NOW()
);
```

**Important Field Explanations:**
- `tenant_id`: UUID from the `customer_tenants` table (NOT Azure tenant ID)
- `auth_type`: Must be `'user'` for username/password auth
- `username`: Your Microsoft 365 admin email that has MFA enabled
- `encrypted_password`: The encrypted value from Step 2
- `is_active`: `true` to make this the active credential set

## Step 5: Verify the Insert

```sql
SELECT
  tc.tenant_name,
  tpc.auth_type,
  tpc.username,
  tpc.is_active,
  tpc.created_at
FROM tenant_powershell_credentials tpc
JOIN customer_tenants tc ON tc.id = tpc.tenant_id
WHERE tpc.auth_type = 'user';
```

You should see your newly added user credentials.

## Step 6: Test the MFA Flow

1. Go to the **Dashboard**: https://ucrmanager.westus3.cloudapp.azure.com/
2. Select your test tenant (the one you just added credentials for)
3. You should see: "This tenant uses user authentication. Click the PowerShell button to connect interactively with MFA."
4. Click the **"PowerShell"** button in the top right
5. Watch for the MFA prompt in the modal
6. Check your authenticator app for the 6-digit code
7. Enter the code in the modal
8. If successful, you should connect to Teams PowerShell!

## Expected Behavior

### What Should Happen:
1. WebSocket connection established
2. PowerShell session starts
3. "⚠️ MFA Required: Please enter your 6-digit verification code" appears
4. You enter the code
5. "✓ Connected to Microsoft Teams PowerShell" appears
6. You can now click "Get Policies" or "Get Phone Numbers"

### What Might Go Wrong:

**"Failed to fetch PowerShell credentials"**
- Check that `is_active = true` in the database
- Verify the `tenant_id` UUID matches

**"PowerShell credentials not configured"**
- Ensure the record exists in `tenant_powershell_credentials`
- Check `auth_type = 'user'`

**MFA prompt never appears**
- Check server logs: `pm2 logs ucrmanager`
- Look for PowerShell spawn errors
- Verify username is correct

**MFA code rejected**
- Make sure you're using the code from the correct account
- Try a fresh code (they expire after 30 seconds)
- Verify the password was encrypted correctly

## Troubleshooting Commands

**Check server logs:**
```bash
pm2 logs ucrmanager --lines 50
```

**Verify encryption key is set:**
```bash
echo $ENCRYPTION_KEY
```

**Test PowerShell is available:**
```bash
pwsh --version
```

## Security Notes

- The encrypted password is stored using AES-256-GCM encryption
- The same encryption key is used for all credentials
- Admin authentication is required to access the encryption endpoint
- Passwords are never logged or transmitted in plaintext
- MFA adds an additional security layer even if credentials are compromised

## Next Steps After Testing

Once MFA is working:
1. Document any issues you encounter
2. I'll implement the admin UI to make this process easier
3. We'll add proper error messages and user guidance
4. Consider adding certificate auth for this tenant as primary (user auth as backup)

---

**Questions? Issues?** Share the console output, server logs, or database query results and I'll help debug!
