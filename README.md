# UCR Manager - Microsoft Teams Voice & Policy Management

A comprehensive web application for managing Microsoft Teams voice configurations and policies across customer tenants.

## Current Version: v1.1.0 (November 2025)

**Restore Point:** `v1.1.0-multi-policy-support`

---

## Features

### 🎯 Core Functionality

#### Voice Configuration Management
- **Phone Number Assignment**: Assign and manage phone numbers (Line URIs) for Teams users
- **Voice Routing Policies**: Configure voice routing policies with E.164 format validation
- **User Search**: Fast user lookup with combobox interface
- **Bulk Assignment**: Upload CSV files to assign phone numbers and policies to multiple users
- **Configuration Profiles**: Save and reuse common configuration templates
- **Current Configuration Display**: View existing user settings before making changes

#### Multi-Policy Support (NEW in v1.1.0)
Support for **10 Microsoft Teams policy types**:

1. **Voice Routing Policy** - Controls voice call routing
2. **Audio Conferencing Policy** - Manages audio conferencing settings
3. **Call Hold Policy** - Controls call hold behavior
4. **Caller ID Policy** - Manages caller ID presentation
5. **Calling Policy** - Controls calling capabilities
6. **Emergency Call Routing Policy** - Routes emergency calls
7. **Emergency Calling Policy** - Manages emergency calling features
8. **Meeting Policy** - Controls meeting features and settings
9. **Voice Applications Policy** - Manages voice application access
10. **Voicemail Policy** - Controls voicemail features

Each policy type includes:
- Policy retrieval via PowerShell
- Policy assignment to users
- Description display (where supported)
- Type-safe validation

### 🔐 Authentication & Authorization

#### Operator Authentication
- **Azure AD OAuth 2.0** integration for operator login
- Role-based access control (Admin/User roles)
- Session management with secure cookies

#### PowerShell Authentication
- **Certificate-based authentication** for Teams PowerShell
- Per-tenant credential storage
- Secure certificate thumbprint management
- AES-256-GCM encryption for sensitive data

### 🏢 Multi-Tenant Support

- Manage multiple customer tenants from one interface
- Per-tenant Azure AD app registrations
- Per-tenant PowerShell credentials
- Tenant isolation and data security

### 📊 Admin Panel (Admin Role Required)

- **Customer Tenants**: Manage customer tenant configurations
- **Operator Users**: Manage operator accounts and roles
- **Audit Logs**: Track all configuration changes with full audit trail
- **PowerShell Credentials**: Configure certificate-based authentication per tenant
- **Settings**: Configure operator Azure AD integration
- **Documentation**: Access built-in setup guides and API documentation

### 🔍 Audit & Compliance

- Comprehensive audit logging for all operations
- Track operator actions, target users, and changes
- Store previous values for rollback capability
- Success/failure status tracking
- Timestamp and operator identification

---

## Architecture

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- TanStack Query for data fetching
- Wouter for routing
- Tailwind CSS + shadcn/ui components
- Vite build system

**Backend:**
- Node.js with Express
- TypeScript
- PostgreSQL database via Drizzle ORM
- PowerShell integration via child processes
- WebSocket support for real-time PowerShell sessions

**PowerShell Integration:**
- MicrosoftTeams PowerShell module
- Certificate-based authentication
- Session management with connection pooling
- Generic policy cmdlet execution

### Database Schema

Key tables:
- `customer_tenants` - Customer tenant configurations
- `operator_users` - Operator accounts with roles
- `operator_config` - Azure AD configuration for operator authentication
- `tenant_powershell_credentials` - Certificate-based PowerShell credentials
- `audit_logs` - Comprehensive audit trail
- `configuration_profiles` - Saved configuration templates
- `admin_users` - Local admin accounts (deprecated, use operator users)

---

## API Endpoints

### Voice Configuration
- `GET /api/teams/users` - Get Teams voice-enabled users
- `POST /api/teams/assign-voice` - Assign phone number and voice routing policy
- `GET /api/teams/user-voice-config` - Get current user voice configuration
- `POST /api/teams/bulk-assign-voice` - Bulk assign configurations via CSV

### Multi-Policy Management
- `POST /api/teams/policies/:type` - Get policies for any policy type
- `POST /api/teams/assign-policy` - Assign any policy type to a user

Supported policy types: `voiceRouting`, `audioConferencing`, `callHold`, `callerId`, `calling`, `emergencyCallRouting`, `emergencyCalling`, `meeting`, `voiceApplications`, `voicemail`

### PowerShell Management
- `POST /api/powershell/get-policies` - Get voice routing policies via PowerShell (certificate auth)
- `POST /api/powershell/grant-policy` - Grant policy via PowerShell (certificate auth)
- `GET /api/powershell/test-connection/:tenantId` - Test PowerShell connectivity
- WebSocket `/ws/powershell/:sessionId` - Real-time PowerShell session

### Authentication
- `GET /api/auth/login` - Initiate Azure AD OAuth flow
- `GET /api/auth/callback` - OAuth callback handler
- `GET /api/auth/session` - Get current operator session
- `POST /api/auth/logout` - End operator session

### Admin Endpoints
- `GET /api/admin/tenants` - List customer tenants
- `POST /api/admin/tenants` - Create customer tenant
- `PUT /api/admin/tenants/:id` - Update customer tenant
- `GET /api/admin/operator-users` - List operator users
- `POST /api/admin/operator-users` - Create operator user
- `PUT /api/admin/operator-users/:id` - Update operator role
- `GET /api/admin/audit-logs` - Get audit logs with filtering
- `GET /api/admin/operator-config` - Get operator Azure AD config
- `PUT /api/admin/operator-config` - Update operator Azure AD config

---

## User Interface

### Navigation Structure

**Main Navigation Bar:**
- 📞 **Voice Configuration** - Phone number and voice routing policy assignment
- 🛡️ **Policy Management** - Manage all 10 policy types

**Admin Panel** (visible to admins only):
- Audit Logs
- Customer Tenants
- Operator Users
- Documentation
- Settings

### Voice Configuration Page (Dashboard)

**User Configuration Tab:**
- Tenant selector
- User search with combobox
- Phone number input with E.164 validation
- Voice routing policy selector
- Current configuration display
- Save/Cancel actions
- PowerShell and Bulk Assign buttons

**Configuration Profiles Tab:**
- List of saved configuration templates
- Create new profiles
- Apply profiles to form
- Edit/Delete existing profiles

### Policy Management Page (NEW)

**Tabbed Interface:**
- 10 tabs, one for each policy type
- Per-tab policy list with descriptions
- User selection
- Policy assignment
- Real-time feedback

---

## Setup & Configuration

### Prerequisites

1. **Windows Server** with PowerShell 5.1+
2. **Node.js** 18+ and npm
3. **PostgreSQL** 14+
4. **MicrosoftTeams PowerShell Module**
5. **Azure AD App Registrations** (one for operators, one per customer tenant)

### Certificate Setup for PowerShell

Each customer tenant requires a certificate for PowerShell authentication:

1. Run the PowerShell script: `scripts/New-TeamsPowerShellCertificate.ps1`
2. Install certificate in Windows Certificate Store (LocalMachine\My)
3. Upload certificate (.cer) to Azure AD App Registration
4. Configure in Admin Panel → Customer Tenants → PowerShell Credentials

See `CUSTOMER_TENANT_POWERSHELL_SETUP.md` for detailed instructions.

### Environment Variables

Create `.env` file:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/ucrmanager
NODE_ENV=production
PORT=443

# HTTPS Certificates
HTTPS_CERT_PATH=C:/path/to/cert.pem
HTTPS_KEY_PATH=C:/path/to/key.pem

# Encryption key for sensitive data (32-byte hex string)
ENCRYPTION_KEY=your-64-character-hex-string

# Debug mode (set to false in production)
DEBUG_MODE=false
```

### Installation

```bash
# Clone repository
git clone https://github.com/rbowlesUCR/UCRManager.git
cd UCRManager

# Install dependencies
npm install

# Run database migrations
npm run db:push

# Build application
npm run build

# Start with PM2
pm2 start npm --name "ucrmanager" -- start
pm2 save
```

---

## Restore Points

To restore to a specific version:

```bash
# View available tags
git tag -l

# Restore to v1.1.0
git checkout v1.1.0-multi-policy-support

# Or restore to a specific branch
git checkout main
```

### Available Restore Points

- **v1.1.0-multi-policy-support** (2025-11-04)
  - Multi-policy support for 10 policy types
  - New Policy Management page
  - Dashboard tabs reorganization
  - Generic policy API endpoints

---

## Development

### Project Structure

```
UCRManager/
├── client/src/           # React frontend
│   ├── components/       # Reusable UI components
│   ├── pages/           # Page components
│   ├── hooks/           # Custom React hooks
│   └── lib/             # Utilities and API client
├── server/              # Express backend
│   ├── index.ts         # Main server entry point
│   ├── routes.ts        # API route handlers
│   ├── powershell.ts    # PowerShell integration
│   ├── powershell-session.ts  # Session management
│   ├── websocket.ts     # WebSocket handlers
│   ├── storage.ts       # Database operations
│   └── debug-routes.ts  # Debug endpoints (dev only)
├── shared/              # Shared TypeScript types
│   └── schema.ts        # Database schema and types
├── migrations/          # Database migrations
└── scripts/            # Setup and utility scripts
```

### Building

```bash
# Development mode with hot reload
npm run dev

# Type checking
npm run check

# Production build
npm run build
```

### Database Migrations

```bash
# Push schema changes to database
npm run db:push
```

---

## Security Considerations

### Authentication
- OAuth 2.0 with Azure AD for operator authentication
- Certificate-based authentication for PowerShell
- Secure session cookies with httpOnly and sameSite flags

### Data Protection
- AES-256-GCM encryption for client secrets and passwords
- Certificate thumbprints stored (not private keys)
- HTTPS enforced for all connections
- CORS restricted to same-origin

### Audit Trail
- All configuration changes logged
- Operator identification for accountability
- Previous values stored for rollback
- Timestamp and status tracking

---

## Troubleshooting

### Debug Endpoints

When `DEBUG_MODE=true`, the following debug endpoints are available:

- `GET /api/debug/status` - System status
- `GET /api/debug/powershell/credentials/:tenantId` - View credentials (masked)
- `POST /api/debug/powershell/test-cert-connection/:tenantId` - Test PowerShell connection
- `POST /api/debug/powershell/get-policies/:tenantId` - Test policy retrieval
- `GET /api/debug/powershell/list-certificates` - List available certificates

⚠️ **Disable debug mode in production!**

### Common Issues

**PowerShell Connection Fails:**
- Verify certificate is installed in Windows Certificate Store
- Check certificate thumbprint matches Azure AD app
- Ensure MicrosoftTeams module is installed
- Verify Azure AD app permissions

**Policies Not Loading:**
- Check PowerShell credentials are configured
- Verify tenant ID is correct
- Check audit logs for error messages
- Test connection via debug endpoints

**Users Not Appearing:**
- Verify Microsoft Graph API permissions
- Check app registration client ID and secret
- Ensure tenant ID is correct

---

## Contributing

This is a proprietary application for UCR. For questions or support, contact the development team.

---

## License

Proprietary - All Rights Reserved

---

## Changelog

### v1.1.0 - Multi-Policy Support (2025-11-04)

**Added:**
- Support for 10 Microsoft Teams policy types
- New Policy Management page with tabbed interface
- Generic API endpoints for policy operations (`/api/teams/policies/:type`, `/api/teams/assign-policy`)
- PolicyType enum and policyTypeConfig mapping in schema
- Generic PowerShell methods for policy retrieval and assignment
- Dashboard reorganized with tabs (User Configuration and Configuration Profiles)

**Technical:**
- Extended `shared/schema.ts` with policy type definitions
- Added `getTeamsPolicies()`, `assignTeamsPolicy()`, `getUserPolicy()` to PowerShell session manager
- Added `getTeamsPoliciesCert()`, `grantTeamsPolicyCert()` helper functions
- Created `policy-management.tsx` page component
- Updated navigation layout with Policy Management link

**Commits:**
- f972bcf: Schema updates with policy type definitions
- 4876575: PowerShell session manager extensions
- b5db202: PowerShell helper functions
- e309e07: Generic API endpoints
- 59ad9a1: Frontend UI with Policy Management page
- 88d0925: Dashboard reorganized with tabs

### v1.0.0 - Certificate Authentication (2025-11-03)

**Initial stable release with:**
- Voice configuration management
- Certificate-based PowerShell authentication
- Multi-tenant support
- Azure AD operator authentication
- Bulk assignment
- Configuration profiles
- Admin panel
- Audit logging

---

**Last Updated:** November 4, 2025
**Current Version:** v1.1.0-multi-policy-support
