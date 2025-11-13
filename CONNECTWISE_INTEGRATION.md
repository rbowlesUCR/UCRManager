# ConnectWise PSA Integration

**Feature Branch**: `feature/connectwise-integration`
**Date**: November 13, 2025
**Status**: In Progress

---

## Overview

This integration adds ConnectWise Manage PSA ticket tracking functionality to UCRManager. When enabled, operators can:

1. Search for ConnectWise tickets
2. Associate changes with tickets
3. Auto-log notes describing changes made
4. Auto-add time entries (default 15 minutes, configurable)
5. Optionally update ticket status

---

## Feature Flag

**Key**: `connectwise_integration`
**Default**: Disabled (`false`)
**Location**: Database table `feature_flags`

Enable/disable via Admin Features menu.

---

## Database Schema

### Table: `connectwise_credentials`

Stores encrypted ConnectWise API credentials per tenant.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR | Primary key |
| `tenant_id` | VARCHAR | FK to `customer_tenants(id)` |
| `base_url` | TEXT | CW API base URL (e.g., https://api-na.myconnectwise.net) |
| `company_id` | TEXT | ConnectWise company identifier |
| `public_key` | TEXT | Encrypted API public key |
| `private_key` | TEXT | Encrypted API private key |
| `client_id` | TEXT | Encrypted client ID (application GUID) |
| `default_time_minutes` | INTEGER | Default time entry (minutes, default: 15) |
| `auto_update_status` | BOOLEAN | Auto-update ticket status (default: false) |
| `default_status_id` | INTEGER | Default status ID if auto-update enabled |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |
| `created_by` | VARCHAR | FK to `admin_users(id)` |
| `updated_by` | VARCHAR | FK to `admin_users(id)` |

**Migration**: `migrations/0006_connectwise_integration.sql`

---

## API Architecture

### Backend Module: `server/connectwise.ts`

Core ConnectWise API client with functions:

- **`getConnectWiseCredentials(tenantId)`** - Get decrypted credentials for tenant
- **`storeConnectWiseCredentials(tenantId, credentials, adminUserId)`** - Store encrypted credentials
- **`searchTickets(tenantId, searchQuery, limit)`** - Search tickets by ID or summary
- **`getTicket(tenantId, ticketId)`** - Get specific ticket details
- **`addTicketNote(tenantId, ticketId, noteText, memberIdentifier, isInternal)`** - Add note to ticket
- **`addTimeEntry(tenantId, ticketId, memberIdentifier, hours, notes, workTypeId)`** - Add time entry
- **`updateTicketStatus(tenantId, ticketId, statusId)`** - Update ticket status
- **`isConnectWiseEnabled(tenantId)`** - Check if CW enabled for tenant

### Authentication

ConnectWise Manage uses Basic authentication with the format:

```
Authorization: Basic <base64(companyId+publicKey:privateKey)>
clientId: <client-id-guid>
```

All credentials are encrypted using AES-256-GCM before storage.

### API Endpoints (routes.ts)

All endpoints require admin authentication (`requireAdminAuth`).

#### Credentials Management

- `GET /api/admin/tenant/:tenantId/connectwise/credentials` - Get credentials (non-sensitive)
- `POST /api/admin/tenant/:tenantId/connectwise/credentials` - Store/update credentials
- `GET /api/admin/tenant/:tenantId/connectwise/enabled` - Check if enabled

#### Ticket Operations

- `GET /api/admin/tenant/:tenantId/connectwise/tickets/search?q=<query>&limit=<n>` - Search tickets
- `GET /api/admin/tenant/:tenantId/connectwise/tickets/:ticketId` - Get ticket details
- `POST /api/admin/tenant/:tenantId/connectwise/tickets/:ticketId/notes` - Add note
- `POST /api/admin/tenant/:tenantId/connectwise/tickets/:ticketId/time` - Add time entry
- `PATCH /api/admin/tenant/:tenantId/connectwise/tickets/:ticketId/status` - Update status

#### Combined Operation

- `POST /api/admin/tenant/:tenantId/connectwise/tickets/:ticketId/log-change` - Log change (note + time + optional status)

**Payload**:
```json
{
  "noteText": "Updated user voice configuration",
  "memberIdentifier": "operator@company.com",
  "hours": 0.25,
  "updateStatus": true,
  "statusId": 123
}
```

**Actions**:
1. Adds note to ticket
2. Adds time entry (uses `hours` or defaults to `default_time_minutes`)
3. Updates status if `updateStatus=true` (uses `statusId` or `default_status_id`)

---

## ConnectWise API Reference

### Base URL Formats

- **North America**: `https://api-na.myconnectwise.net`
- **Europe**: `https://api-eu.myconnectwise.net`
- **Australia**: `https://api-au.myconnectwise.net`
- **Staging**: `https://api-staging.myconnectwise.net`

### API Version

Currently using: `v4_6_release/apis/3.0`

### Endpoints Used

- `GET /service/tickets` - Search tickets
- `GET /service/tickets/{id}` - Get ticket
- `POST /service/tickets/{id}/notes` - Add note
- `POST /time/entries` - Add time entry
- `PATCH /service/tickets/{id}` - Update ticket (JSON Patch format)

### Documentation

- Official: https://developer.connectwise.com/Products/Manage/REST
- Community: https://github.com/ConnectWise/manage-api-docs

---

## UI Integration Points

### Planned Integrations

1. **Voice Configuration Page** (`client/src/pages/voice-configuration.tsx`)
   - Add "CW Ticket #" field
   - Ticket search/autocomplete
   - Auto-log changes when saving

2. **3CX Management Page** (`client/src/pages/3cx-management.tsx`)
   - Add "CW Ticket #" field to user/DID forms
   - Auto-log CRUD operations

3. **Admin Settings** (New page or existing features page)
   - ConnectWise credentials form
   - Configuration options (default time, auto-status, etc.)

### UI Components Needed

- **TicketSearch** - Autocomplete ticket search component
- **ConnectWiseConfig** - Credentials management form
- **TicketDisplay** - Show linked ticket info

---

## Workflow Example

### Voice Configuration Change

1. Operator opens voice configuration for user
2. If ConnectWise enabled for tenant:
   - Show "ConnectWise Ticket #" field
   - Operator searches/selects ticket
3. Operator makes changes (e.g., assign phone number, update policy)
4. On save:
   - Normal voice configuration update proceeds
   - If ticket selected:
     - Add note: "Voice configuration updated for user@domain.com by operator@company.com"
     - Add time entry: 0.25 hours (15 minutes default)
     - Update status if configured

---

## Security

- **Encryption**: All API keys encrypted with AES-256-GCM using `SESSION_SECRET`
- **Authentication**: RequireAdminAuth middleware on all endpoints
- **Validation**: Input validation on all API calls
- **Timeout**: 10-second timeout on all ConnectWise API requests
- **Error Handling**: Errors logged server-side, safe messages returned to client

---

## Configuration

### Required ConnectWise Setup

1. **API Keys**: Generate in ConnectWise Manage
   - Navigate to: System → Members → API Members
   - Create new API member
   - Note: Public Key, Private Key

2. **Client ID**: Register application
   - Navigate to: System → Settings → Integrator Login
   - Create new integration
   - Note: Client ID (GUID)

3. **Base URL**: Identify your ConnectWise instance region
   - Check your ConnectWise URL
   - Use corresponding API base URL

4. **Member Identifier**: Email address of ConnectWise member for time entries

### UCRManager Configuration

1. Enable feature flag: `connectwise_integration`
2. Navigate to tenant ConnectWise settings
3. Enter:
   - Base URL
   - Company ID
   - Public Key
   - Private Key
   - Client ID
   - Default time (minutes)
   - Auto-update status (optional)
   - Default status ID (if auto-update)

---

## Reversion / Rollback Plan

### Quick Rollback (Zero Data Loss)

1. **Disable Feature Flag**:
   ```sql
   UPDATE feature_flags
   SET is_enabled = false
   WHERE feature_key = 'connectwise_integration';
   ```
   - Integration becomes inactive immediately
   - All data preserved
   - No application restart needed

2. **Git Rollback**:
   ```bash
   cd /c/inetpub/wwwroot/UCRManager
   git checkout main
   npm run build
   pm2 restart ucrmanager
   ```
   - Returns to pre-integration state
   - Takes ~3 minutes
   - No database changes required

### Complete Removal (With Data Loss)

If you want to completely remove the integration and all data:

```sql
-- Drop table (removes all credentials)
DROP TABLE IF EXISTS connectwise_credentials;

-- Remove feature flag
DELETE FROM feature_flags WHERE feature_key = 'connectwise_integration';
```

Then remove code:
```bash
git branch -D feature/connectwise-integration
```

**Warning**: This will permanently delete all ConnectWise credentials and cannot be undone.

---

## Testing Checklist

### Backend Testing

- [ ] Credentials storage/retrieval
- [ ] Encryption/decryption working
- [ ] Ticket search (by ID and summary)
- [ ] Get ticket details
- [ ] Add note to ticket
- [ ] Add time entry to ticket
- [ ] Update ticket status
- [ ] Combined log-change operation
- [ ] Feature flag check
- [ ] Error handling (invalid credentials, network errors)

### Frontend Testing

- [ ] Credentials form (save/update)
- [ ] Ticket search UI
- [ ] Ticket autocomplete
- [ ] Voice config integration
- [ ] 3CX management integration
- [ ] Error messages display
- [ ] Loading states

### Integration Testing

- [ ] End-to-end: Voice config change → CW ticket update
- [ ] End-to-end: 3CX user update → CW ticket update
- [ ] Default time minutes applied correctly
- [ ] Auto-status update working
- [ ] Member identifier captured correctly

---

## Current Status

### ✅ Completed

- [x] Feature flag added to database
- [x] Database schema created (`connectwise_credentials` table)
- [x] ConnectWise API client module (`server/connectwise.ts`)
- [x] Backend API endpoints (routes.ts)
- [x] Build successful (no compilation errors)
- [x] Documentation created

### 🚧 In Progress

- [ ] Admin UI for credentials management
- [ ] Voice configuration integration
- [ ] 3CX management integration

### 📋 Pending

- [ ] Testing with live ConnectWise instance
- [ ] Error handling refinement
- [ ] User guide/documentation

---

## File Changes Summary

### New Files

- `migrations/0006_connectwise_integration.sql` - Database migration
- `server/connectwise.ts` - ConnectWise API client module (517 lines)
- `CONNECTWISE_INTEGRATION.md` - This documentation

### Modified Files

- `server/routes.ts` - Added CW API endpoints (+230 lines)

### Build Impact

- **Server bundle**: 302 KB → 319.9 KB (+17.9 KB)
- **Client bundle**: No change (834 KB)
- **Build time**: ~43 seconds

---

## API Request Examples

### Search Tickets

```bash
GET /api/admin/tenant/abc123/connectwise/tickets/search?q=printer&limit=10

Response:
{
  "tickets": [
    {
      "id": 12345,
      "summary": "Printer not working",
      "status": "In Progress",
      "company": "Acme Corp",
      "board": "Service Desk"
    }
  ]
}
```

### Log Change to Ticket

```bash
POST /api/admin/tenant/abc123/connectwise/tickets/12345/log-change

Body:
{
  "noteText": "Updated voice routing policy for john.doe@company.com",
  "memberIdentifier": "tech@company.com",
  "hours": 0.25
}

Response:
{
  "success": true,
  "message": "Change logged to ticket successfully",
  "actions": {
    "noteAdded": true,
    "timeAdded": true,
    "statusUpdated": false
  }
}
```

---

## Support & Troubleshooting

### Common Issues

1. **"ConnectWise credentials not configured"**
   - Solution: Configure credentials via admin settings

2. **"Failed to authenticate with ConnectWise"**
   - Check: Base URL, Company ID, API keys correct
   - Check: Client ID is valid GUID
   - Check: API member has proper permissions

3. **"Ticket not found"**
   - Verify ticket ID exists
   - Check API member can access ticket's board

4. **"Failed to add time entry"**
   - Check member identifier is valid
   - Verify member has time entry permissions
   - Check work type ID (if provided) is valid

### Debug Logging

All ConnectWise operations are logged with `[ConnectWise]` or `[ConnectWise API]` prefix.

Check PM2 logs:
```bash
pm2 logs ucrmanager --lines 100 | grep -i connectwise
```

---

**Last Updated**: November 13, 2025
**Branch**: feature/connectwise-integration
**Next Steps**: Build admin UI components
