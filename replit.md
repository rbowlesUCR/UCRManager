# Teams Voice Manager

## Overview
A multi-tenant Microsoft Teams voice management application enabling operators to assign phone numbers and routing policies to Teams users across various customer tenants. It provides a centralized platform for voice configuration, comprehensive audit logging, and an admin panel for oversight. The project aims to streamline Teams voice management, reduce manual effort, and ensure compliance through detailed change tracking.

## User Preferences
None.

## System Architecture

### Design Principles
The application adheres to Microsoft Fluent Design System principles, utilizing the Segoe UI font family, Microsoft brand blue (`#0078D4`), and efficient, accessible layouts for a consistent user experience.

### Technical Stack
-   **Frontend**: React, TypeScript
-   **Backend**: Express, TypeScript
-   **Database**: PostgreSQL with Drizzle ORM
-   **Authentication**: Azure AD OAuth (MSAL) for operators, username/password (bcrypt) for admin panel, JWT for session management.
-   **API Integration**: Microsoft Graph API for Teams voice functionalities.

### Core Features
-   **Multi-tenant Management**: Operators can manage voice configurations for multiple customer tenants through a secure interface.
-   **User and Policy Assignment**: Assign phone numbers (Line URI) and voice routing policies to Teams users.
-   **Audit Logging**: Comprehensive logging of all changes, including operator, tenant, user, and modification details.
-   **Admin Panel**: Provides access to audit logs, customer tenant management, operator user management (RBAC), and system settings.
-   **Dynamic Configuration**: OAuth redirect URI, operator Azure AD credentials, and customer tenant app registration details are configurable and stored securely in the database.
-   **Security**: AES-256-GCM encryption for sensitive credentials and secrets.
-   **Role-Based Access Control (RBAC)**: Supports 'admin' and 'user' roles for operators, controlling access to administrative functions.
-   **Customer Tenant Permission Validation**: A built-in tool to validate required Microsoft Graph API permissions for customer tenants.

### Data Model Highlights
-   `admin_users`: Stores admin credentials.
-   `customer_tenants`: Holds Azure AD tenant information and app registration details.
-   `audit_logs`: Records all change history.
-   `operator_config`: Stores encrypted operator Azure AD credentials and global configuration settings like the OAuth redirect URI.
-   `configuration_profiles`: Tenant-specific templates for quick phone number and policy assignments.
-   `operator_users`: Manages operator accounts and assigned roles for RBAC.
-   `tenant_powershell_credentials`: Stores encrypted credentials for Microsoft Teams PowerShell operations on a per-tenant basis (optional for each tenant).

## External Dependencies

-   **Microsoft Graph API** (3 Application Permissions Required):
    -   `User.Read.All`: To query Teams voice-enabled users.
    -   `TeamsUserConfiguration.Read.All`: To read Teams user phone configurations (Graph API beta endpoint `/beta/admin/teams/userConfigurations`).
    -   `TeamworkPolicy.ReadWrite.All`: To assign voice routing policies (Graph API beta endpoint `/beta/teamwork/teamsPolicies/userAssignments/assign`).
-   **Microsoft Teams PowerShell** (Requires Non-Replit Hosting):
    -   **IMPORTANT**: PowerShell script execution does NOT work on Replit platform (development OR production)
        -   PowerShell requires TTY capabilities not available in Replit's containerized environment
        -   This applies to both Replit development workspaces and production deployments
        -   The application detects Replit environment and returns clear error messages
        -   **To use PowerShell features, deploy to: Azure App Service, AWS EC2, Digital Ocean, or any VPS**
    -   Phone number assignment: `Set-CsPhoneNumberAssignment` (Graph API not available yet)
    -   Policy listing: `Get-CsOnlineVoiceRoutingPolicy` (Graph API endpoint doesn't exist)
    -   **PowerShell 7.5.1** is installed on the system via Nix (channel: unstable)
    -   **MicrosoftTeams PowerShell Module**: Pre-installed in `~/.local/share/powershell/Modules/MicrosoftTeams/`
        -   Module downloaded directly from PowerShell Gallery (18MB, persists across sessions)
        -   Installation verified by checking manifest files exist
        -   Module import/execution will work in production deployment with proper TTY access
    -   **Per-Tenant Credentials**: Each customer tenant can have its own optional PowerShell credentials configured separately
    -   Credentials are securely stored encrypted in the database with AES-256-GCM
    -   Admin UI available in Customer Tenants management page for configuring PowerShell credentials per tenant
    -   **Development Environment Behavior**: All PowerShell operations return immediate error explaining limitation
    -   Operator endpoints (tenant-scoped, production only):
        -   `/api/powershell/assign-phone` - Assign phone numbers using PowerShell (requires tenantId)
        -   `/api/powershell/get-policies` - Get voice routing policies using PowerShell (requires tenantId)
        -   `/api/powershell/assign-policy` - Assign voice routing policies using PowerShell (requires tenantId)
    -   Admin endpoints (tenant-scoped):
        -   `GET/PUT /api/admin/tenants/:tenantId/powershell-credentials` - Manage PowerShell credentials per tenant
        -   `POST /api/admin/tenants/:tenantId/powershell/test-connection` - Test PowerShell connectivity (production only)
        -   `POST /api/admin/powershell/test-teams-module` - Shows environment limitation in dev, verifies module in production
-   **Azure AD**: Used for operator authentication and managing customer tenant application registrations.
-   **PostgreSQL**: Relational database for persistent storage.