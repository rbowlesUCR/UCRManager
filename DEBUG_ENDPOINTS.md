# Debug Endpoints Documentation

## Overview

Debug endpoints provide testing and troubleshooting capabilities for PowerShell certificate-based authentication. These endpoints are protected and can be toggled on/off via admin panel or environment variable.

**Status:** Debug mode is **ENABLED** by default (can be toggled)
**Last Updated:** November 4, 2025

---

## Enabling/Disabling Debug Mode

### Via Environment Variable
```bash
# Enable debug mode (default)
set DEBUG_MODE=true

# Disable debug mode
set DEBUG_MODE=false
```

### Via Admin API
```bash
# Check debug status
GET /api/admin/debug/status

# Enable debug mode
POST /api/admin/debug/enable

# Disable debug mode
POST /api/admin/debug/disable

# Toggle debug mode
POST /api/admin/debug/toggle
```

**Note:** Admin authentication required for all debug management endpoints.

---

## Available Debug Endpoints

All debug endpoints require debug mode to be enabled. When disabled, they return 403 Forbidden.

### 1. Check Debug Status
```http
GET /api/debug/status
```

**Response:**
```json
{
  "debugEnabled": true,
  "timestamp": "2025-11-04T02:35:00.000Z",
  "environment": {
    "NODE_ENV": "production",
    "DEBUG_MODE": "true"
  }
}
```

---

### 2. Get PowerShell Credentials
```http
GET /api/debug/powershell/credentials/:tenantId
```

**Purpose:** Verify that PowerShell credentials are configured for a tenant.

**Example:**
```bash
curl -k https://localhost/api/debug/powershell/credentials/83f508e2-0b8b-41da-9dba-8a329305c13e
```

**Response:**
```json
{
  "tenant": {
    "id": "83f508e2-0b8b-41da-9dba-8a329305c13e",
    "tenantId": "905655b8-88f2-4fc8-9474-a4f2b0283b03",
    "tenantName": "Dev Tenant"
  },
  "credentials": {
    "id": "36a50845-245d-45e1-90b9-47ecd905fad1",
    "hasAppId": true,
    "appId": "49a0a397...",
    "hasCertificateThumbprint": true,
    "certificateThumbprint": "F22B698B...",
    "isActive": true
  }
}
```

---

### 3. Test Certificate Connection
```http
POST /api/debug/powershell/test-cert-connection/:tenantId
```

**Purpose:** Test that certificate authentication works with Microsoft Teams PowerShell.

**Example:**
```bash
curl -k -X POST https://localhost/api/debug/powershell/test-cert-connection/83f508e2-0b8b-41da-9dba-8a329305c13e
```

**Success Response:**
```json
{
  "success": true,
  "output": "Successfully connected to tenant: ucrdev\r\nTenant ID: 905655b8-88f2-4fc8-9474-a4f2b0283b03\r\n",
  "exitCode": 0,
  "credentials": {
    "azureTenantId": "905655b8-88f2-4fc8-9474-a4f2b0283b03",
    "appIdPartial": "49a0a397...",
    "thumbprintPartial": "F22B698B..."
  }
}
```

**Failure Response:**
```json
{
  "success": false,
  "output": "",
  "error": "Certificate not found in cert store",
  "exitCode": 1
}
```

---

### 4. Get Voice Routing Policies
```http
POST /api/debug/powershell/get-policies/:tenantId
```

**Purpose:** Test retrieving voice routing policies via PowerShell.

**Example:**
```bash
curl -k -X POST https://localhost/api/debug/powershell/get-policies/83f508e2-0b8b-41da-9dba-8a329305c13e
```

**Response:**
```json
{
  "success": true,
  "output": "[{\"Identity\":\"Global\",\"Description\":null,\"OnlinePstnUsages\":[]},{\"Identity\":\"Tag:Test Policy\",\"Description\":null,\"OnlinePstnUsages\":[]}]\r\n"
}
```

---

### 5. Execute Arbitrary PowerShell Script
```http
POST /api/debug/powershell/execute/:tenantId
Content-Type: application/json

{
  "script": "Get-CsOnlineUser | Select-Object DisplayName, UserPrincipalName"
}
```

**Purpose:** Execute any PowerShell script with certificate authentication.

**Example:**
```bash
curl -k -X POST https://localhost/api/debug/powershell/execute/83f508e2-0b8b-41da-9dba-8a329305c13e \
  -H "Content-Type: application/json" \
  -d '{"script":"Get-CsTenant | Select-Object DisplayName, TenantId"}'
```

**Response:**
```json
{
  "success": true,
  "output": "DisplayName    TenantId\r\n-----------    --------\r\nucrdev         905655b8-88f2-4fc8-9474-a4f2b0283b03\r\n",
  "exitCode": 0
}
```

**⚠️ WARNING:** This endpoint executes arbitrary PowerShell. Use with caution!

---

### 6. Check Certificate in Windows Store
```http
POST /api/debug/powershell/check-certificate/:tenantId
```

**Purpose:** Verify that the certificate exists in Windows Certificate Store with private key.

**Example:**
```bash
curl -k -X POST https://localhost/api/debug/powershell/check-certificate/83f508e2-0b8b-41da-9dba-8a329305c13e
```

**Success Response:**
```json
{
  "success": true,
  "certificateInfo": {
    "Found": true,
    "Subject": "CN=TeamsPowerShell-DevTenant",
    "Thumbprint": "F22B698B451D46E802B7D92DA9FDC2F8A4A71867",
    "NotBefore": "2025-11-03 22:17:56",
    "NotAfter": "2027-11-03 22:27:49",
    "HasPrivateKey": true
  }
}
```

**Not Found Response:**
```json
{
  "success": true,
  "certificateInfo": {
    "Found": false,
    "Thumbprint": "F22B698B451D46E802B7D92DA9FDC2F8A4A71867"
  }
}
```

---

### 7. List All Certificates
```http
GET /api/debug/powershell/list-certificates
```

**Purpose:** List all certificates in LocalMachine\My store.

**Example:**
```bash
curl -k https://localhost/api/debug/powershell/list-certificates
```

**Response:**
```json
{
  "success": true,
  "certificates": [
    {
      "Subject": "CN=TeamsPowerShell-DevTenant",
      "Thumbprint": "F22B698B451D46E802B7D92DA9FDC2F8A4A71867",
      "NotAfter": "2027-11-03 22:27:49",
      "HasPrivateKey": true
    },
    {
      "Subject": "CN=localhost",
      "Thumbprint": "A1B2C3D4E5F6789012345678901234567890ABCD",
      "NotAfter": "2026-01-01 00:00:00",
      "HasPrivateKey": true
    }
  ]
}
```

---

## Common Troubleshooting Workflows

### 1. Test Full Certificate Setup

```bash
# Step 1: Check credentials exist in database
curl -k https://localhost/api/debug/powershell/credentials/:tenantId

# Step 2: Check certificate in Windows store
curl -k -X POST https://localhost/api/debug/powershell/check-certificate/:tenantId

# Step 3: Test Teams connection
curl -k -X POST https://localhost/api/debug/powershell/test-cert-connection/:tenantId

# Step 4: Test policy retrieval
curl -k -X POST https://localhost/api/debug/powershell/get-policies/:tenantId
```

### 2. Diagnose Certificate Issues

If certificate connection fails:

1. **Check certificate exists:**
   ```bash
   curl -k -X POST https://localhost/api/debug/powershell/check-certificate/:tenantId
   ```
   - Verify `Found: true`
   - Verify `HasPrivateKey: true`
   - Check expiration date

2. **List all certificates:**
   ```bash
   curl -k https://localhost/api/debug/powershell/list-certificates
   ```
   - Confirm thumbprint matches database

3. **Test manual PowerShell connection:**
   ```powershell
   Connect-MicrosoftTeams -ApplicationId "APP_ID" -CertificateThumbprint "THUMBPRINT" -TenantId "TENANT_ID"
   ```

### 3. Test Custom Scripts

```bash
# Test getting users
curl -k -X POST https://localhost/api/debug/powershell/execute/:tenantId \
  -H "Content-Type: application/json" \
  -d '{"script":"Get-CsOnlineUser | Select-Object DisplayName, LineURI | ConvertTo-Json"}'

# Test phone number assignment
curl -k -X POST https://localhost/api/debug/powershell/execute/:tenantId \
  -H "Content-Type: application/json" \
  -d '{"script":"Set-CsPhoneNumberAssignment -Identity user@domain.com -PhoneNumber +15551234567 -PhoneNumberType DirectRouting"}'
```

---

## Security Considerations

### Access Control
- ✅ Debug endpoints require debug mode to be enabled
- ✅ Admin endpoints require admin authentication
- ✅ Credentials are partially masked in responses (shows only first 8 chars)
- ✅ Private keys never exposed via API

### Production Use
- ⚠️ **Disable debug mode in production** after troubleshooting
- ⚠️ **Arbitrary script execution** endpoint is powerful - use carefully
- ⚠️ Monitor debug endpoint access in audit logs
- ⚠️ Rotate certificates before expiration

---

## Error Responses

All debug endpoints return consistent error formats:

```json
{
  "error": "Tenant not found",
  "stack": "Error: Tenant not found\n    at ..."
}
```

Common errors:
- `404 Not Found` - Tenant or credentials not found
- `403 Forbidden` - Debug mode disabled
- `500 Internal Server Error` - PowerShell execution failed
- `400 Bad Request` - Missing required parameters

---

## Debug Mode Console Output

When debug mode is enabled, the following banner appears in logs:

```
⚠️  DEBUG MODE ENABLED - Debug routes are active

  ┌─────────────────────────────────────────────────────┐
  │  🔧 DEBUG ENDPOINTS AVAILABLE                       │
  ├─────────────────────────────────────────────────────┤
  │  GET  /api/debug/status                             │
  │  GET  /api/debug/powershell/credentials/:tenantId   │
  │  POST /api/debug/powershell/test-cert-connection/:tenantId │
  │  POST /api/debug/powershell/get-policies/:tenantId  │
  │  POST /api/debug/powershell/execute/:tenantId       │
  │  POST /api/debug/powershell/check-certificate/:tenantId │
  │  GET  /api/debug/powershell/list-certificates       │
  ├─────────────────────────────────────────────────────┤
  │  To disable: Set DEBUG_MODE=false                   │
  └─────────────────────────────────────────────────────┘
```

---

## Quick Reference

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/admin/debug/status` | GET | Check debug mode status | Admin |
| `/api/admin/debug/enable` | POST | Enable debug mode | Admin |
| `/api/admin/debug/disable` | POST | Disable debug mode | Admin |
| `/api/admin/debug/toggle` | POST | Toggle debug mode | Admin |
| `/api/debug/status` | GET | Get debug info | Debug Mode |
| `/api/debug/powershell/credentials/:id` | GET | Get credentials | Debug Mode |
| `/api/debug/powershell/test-cert-connection/:id` | POST | Test connection | Debug Mode |
| `/api/debug/powershell/get-policies/:id` | POST | Get policies | Debug Mode |
| `/api/debug/powershell/execute/:id` | POST | Execute script | Debug Mode |
| `/api/debug/powershell/check-certificate/:id` | POST | Check cert exists | Debug Mode |
| `/api/debug/powershell/list-certificates` | GET | List all certs | Debug Mode |

---

**Related Documentation:**
- `server/debug-routes.ts` - Debug endpoint implementation
- `CERTIFICATE_AUTH_MIGRATION_SUMMARY.md` - Certificate migration overview
- `SERVER_CERTIFICATE_SETUP.md` - Certificate generation guide
- `CUSTOMER_TENANT_POWERSHELL_SETUP.md` - Azure AD configuration

---

**Last Updated:** November 4, 2025
**Maintained By:** Development Team
