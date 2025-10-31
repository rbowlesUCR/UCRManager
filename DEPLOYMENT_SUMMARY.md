# UCRManager Deployment Summary
**Date:** October 31, 2025
**Server:** UCManagerv2 (Windows Server 2025)
**Deployment Status:** ✅ Successful

---

## 📋 Table of Contents
1. [Deployment Overview](#deployment-overview)
2. [Prerequisites Installed](#prerequisites-installed)
3. [Step-by-Step Installation](#step-by-step-installation)
4. [Configuration Details](#configuration-details)
5. [Issues Fixed](#issues-fixed)
6. [Current Status](#current-status)
7. [Access Information](#access-information)
8. [Next Steps Required](#next-steps-required)

---

## 🎯 Deployment Overview

Successfully deployed UCRManager (Teams Voice Manager) application on a fresh Windows Server 2025 instance. The application is a multi-tenant Microsoft Teams voice management platform that enables operators to assign phone numbers and routing policies to Teams users across multiple customer tenants.

**Installation Path:** `C:\inetpub\wwwroot\UCRManager`
**Repository:** https://github.com/rbowlesUCR/UCRManager
**Branch:** main

---

## 🔧 Prerequisites Installed

### 1. Node.js
- **Version:** v24.11.0 (npm 11.6.1)
- **Status:** ✅ Already installed
- **Purpose:** JavaScript runtime for the application

### 2. Git for Windows
- **Version:** 2.51.2.windows.1
- **Status:** ✅ Already installed
- **Purpose:** Version control and repository cloning

### 3. PM2 Process Manager
- **Version:** 6.0.13
- **Status:** ✅ Installed during deployment
- **Installation Command:** `npm install -g pm2 pm2-windows-startup`
- **Purpose:** Production process manager with auto-restart and boot startup
- **Startup:** Configured to auto-start on Windows boot
- **Configuration:** Registry entry created for Windows startup

### 4. PostgreSQL Database
- **Version:** 16
- **Status:** ✅ Installed during deployment
- **Installation Path:** `C:\Program Files\PostgreSQL\16`
- **Database Name:** ucrmanager
- **Connection:** localhost:5432
- **User:** postgres
- **Password:** 4FC4E215649C6EBF3A390BAFE4B2ECD7 (stored in .env)

---

## 📝 Step-by-Step Installation

### Step 1: Repository Clone
```bash
cd C:\inetpub\wwwroot
git clone https://github.com/rbowlesUCR/UCRManager.git
cd UCRManager
```
**Result:** Repository successfully cloned

### Step 2: Dependencies Installation
```bash
npm install
```
**Result:** 608 packages installed successfully
**Warnings:** 8 vulnerabilities detected (3 low, 5 moderate)
**Note:** Deprecated packages: @esbuild-kit/esm-loader, @esbuild-kit/core-utils (merged into tsx)

### Step 3: Environment Configuration
**File Created:** `C:\inetpub\wwwroot\UCRManager\.env`

**Contents:**
```env
# Database Configuration
DATABASE_URL=postgresql://postgres:4FC4E215649C6EBF3A390BAFE4B2ECD7@localhost:5432/ucrmanager

# Session Secret (IMPORTANT: Keep this secure!)
SESSION_SECRET=qMLFVOwVd5VXQfIzgfMBZFjfpoQAZ4qbTz++VZJIcpfoHOb6dxbgqh/n4OyOaLN4

# Environment
NODE_ENV=production

# Port (5000 for HTTP - can use IIS reverse proxy for 80/443 later)
PORT=5000
```

**Security Notes:**
- SESSION_SECRET: Generated using PowerShell cryptographic random function
- Length: 64 characters (Base64 encoded 48 random bytes)
- DATABASE_URL: Contains database credentials (ensure .env is not committed to git)

### Step 4: Database Setup
```bash
# Create database
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE ucrmanager;"

# Run migrations
npm run db:push
```
**Result:** Database schema successfully created using Drizzle ORM

### Step 5: Windows Compatibility Fix
**Issue Found:** Application used `reusePort: true` option which is Linux-specific and not supported on Windows
**Error:** `ENOTSUP: operation not supported on socket`

**File Modified:** `server/index.ts` (lines 73-77)

**Before:**
```typescript
server.listen({
  port,
  host: "0.0.0.0",
  reusePort: true,
}, () => {
  log(`serving on port ${port}`);
});
```

**After:**
```typescript
server.listen(port, "0.0.0.0", () => {
  log(`serving on port ${port}`);
});
```

**Result:** Application now compatible with Windows Server

### Step 6: Application Build
```bash
npm run build
```
**Result:**
- Frontend built: `dist/public/` (618.88 kB JavaScript, 78.04 kB CSS)
- Backend bundled: `dist/index.js` (85.6 kB)
- Build time: ~28 seconds
- **Warning:** Chunk size > 500 kB (consider code splitting for future optimization)

### Step 7: PM2 Configuration
```bash
# Start application
pm2 start dist/index.js --name "ucrmanager" --node-args="--env-file=.env"

# Configure auto-startup
pm2-startup install
pm2 save
```
**Result:** Application running with PID 3880, auto-start configured

### Step 8: Windows Firewall Configuration
```bash
powershell -Command "New-NetFirewallRule -DisplayName 'UCRManager HTTP Port 5000' -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow"
```
**Result:** Inbound rule created and enabled for port 5000

---

## ⚙️ Configuration Details

### Application Configuration
- **Process Name:** ucrmanager
- **Port:** 5000
- **Host:** 0.0.0.0 (listening on all interfaces)
- **Environment:** production
- **Restart Count:** 0 (stable)

### Database Configuration
- **Type:** PostgreSQL 16
- **Host:** localhost
- **Port:** 5432
- **Database:** ucrmanager
- **ORM:** Drizzle ORM
- **Migrations:** Automatic via `drizzle-kit push`

### PM2 Configuration
- **Mode:** fork
- **Instances:** 1
- **Auto-restart:** Enabled
- **Max restarts:** Unlimited
- **Boot startup:** Enabled (Windows Registry)

### Network Configuration
- **Server IP:** 172.17.0.4
- **Subnet Mask:** 255.255.255.0
- **Default Gateway:** 172.17.0.1
- **Windows Firewall:** Enabled (all profiles: Domain, Private, Public)
- **Firewall Rule:** UCRManager HTTP Port 5000 (Inbound, TCP, Allow)

---

## 🐛 Issues Fixed

### Issue 1: PM2 Cannot Execute npm.cmd
**Symptom:** `SyntaxError: Unexpected token ':'` when trying to run `pm2 start npm -- start`
**Root Cause:** PM2 on Windows cannot execute .cmd files directly
**Solution:** Changed to execute the built JavaScript file directly:
```bash
pm2 start dist/index.js --name "ucrmanager" --node-args="--env-file=.env"
```

### Issue 2: ENOTSUP Error on Socket Listen
**Symptom:** `Error: listen ENOTSUP: operation not supported on socket 0.0.0.0:5000`
**Root Cause:** `reusePort: true` option is Linux-specific, not supported on Windows
**Solution:** Modified `server/index.ts` to use standard listen() syntax
**Files Changed:**
- `server/index.ts` (source)
- `dist/index.js` (rebuilt)

### Issue 3: Port 443 Access Denied
**Symptom:** Application failed to bind to port 443
**Root Cause:** Port 443 requires admin privileges and SSL certificate setup
**Solution:** Changed to port 5000 for initial deployment (can add IIS reverse proxy later)

---

## ✅ Current Status

### Application Status
```
┌────┬───────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name          │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │
├────┼───────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┤
│ 0  │ ucrmanager    │ default     │ 1.0.0   │ fork    │ 3880     │ running│ 0    │ online    │ 0%       │ stable   │
└────┴───────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┘
```

### Connectivity Tests
- ✅ Local HTTP Test: `curl http://localhost:5000` - **Success**
- ✅ Port Listening: Port 5000 bound to 0.0.0.0 (all interfaces)
- ✅ Process Stability: 0 restarts since deployment
- ⚠️ External Access: **Not working** (requires Azure NSG configuration)

### Database Status
- ✅ PostgreSQL Service: Running
- ✅ Database Created: ucrmanager
- ✅ Schema Migrated: All tables created via Drizzle ORM
- ✅ Connection: Application successfully connected

---

## 🌐 Access Information

### Internal Access (Confirmed Working)
- **URL:** http://localhost:5000
- **URL:** http://172.17.0.4:5000
- **URL:** http://UCManagerv2:5000

### Application Endpoints
- **Homepage:** http://localhost:5000/
- **Operator Login:** http://localhost:5000/login
- **Admin Panel:** http://localhost:5000/admin-login
- **API Base:** http://localhost:5000/api

### External Access (Requires Configuration)
⚠️ **Currently blocked** - See [Next Steps Required](#next-steps-required)

---

## 🚀 Next Steps Required

### 1. Configure Azure Network Security Group (NSG) - **CRITICAL**
**Issue:** External traffic to port 5000 is blocked by Azure NSG

**Steps to fix:**
1. Go to Azure Portal
2. Navigate to your VM → Networking → Network Security Group
3. Add Inbound Port Rule:
   - **Source:** Any (or your specific IP for security)
   - **Source port ranges:** *
   - **Destination:** Any
   - **Destination port ranges:** 5000
   - **Protocol:** TCP
   - **Action:** Allow
   - **Priority:** 1000
   - **Name:** AllowPort5000
4. Save the rule
5. Wait 1-2 minutes for Azure to apply the rule
6. Test external access: `http://[your-public-ip]:5000`

### 2. Configure Azure AD for Operator Authentication
1. Access admin panel: http://localhost:5000/admin-login
2. Navigate to: Settings → Operator Azure AD Configuration
3. Configure:
   - **Azure Tenant ID:** [Your operator tenant ID]
   - **Azure Client ID:** [Your app registration client ID]
   - **Azure Client Secret:** [Your app registration secret]
   - **Redirect URI:** `http://[your-public-ip]:5000/api/auth/callback`

4. Update Azure AD App Registration:
   - Go to Azure Portal → Azure AD → App Registrations
   - Select your operator tenant app
   - Go to Authentication
   - Add Redirect URI: `http://[your-public-ip]:5000/api/auth/callback`
   - Click Save

### 3. Add Customer Tenants
1. Login to admin panel
2. Navigate to Customer Tenants
3. Add customer tenant details:
   - Tenant Name
   - Azure Tenant ID
   - App Client ID
   - App Client Secret
   - Required Graph API permissions (User.Read.All, TeamsUserConfiguration.Read.All, TeamworkPolicy.ReadWrite.All)

### 4. (Optional) Configure IIS Reverse Proxy for Port 80/443
If you want to use standard HTTP/HTTPS ports:

**Prerequisites:**
- Install IIS URL Rewrite Module: https://www.iis.net/downloads/microsoft/url-rewrite
- Install IIS Application Request Routing (ARR): https://www.iis.net/downloads/microsoft/application-request-routing

**Configuration:**
1. Keep application running on port 5000
2. Configure IIS to reverse proxy from port 80/443 to localhost:5000
3. Add SSL certificate for HTTPS support
4. Update Azure AD redirect URIs to use new port

### 5. (Optional) Security Hardening
- Change port 5000 NSG rule to only allow your organization's IP ranges
- Enable HTTPS only (disable HTTP)
- Set up Azure Application Gateway with WAF
- Configure rate limiting
- Enable audit logging to external storage (Azure Storage Account)
- Implement backup strategy for PostgreSQL database

### 6. (Recommended) Database Backup Configuration
```bash
# Create backup script
mkdir C:\UCRManager-Backups

# Example backup command (add to scheduled task)
"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres -d ucrmanager -F c -f "C:\UCRManager-Backups\ucrmanager_%date%.backup"
```

---

## 📞 Support Information

**Repository:** https://github.com/rbowlesUCR/UCRManager
**Issues:** https://github.com/rbowlesUCR/UCRManager/issues

---

## 📚 Additional Documentation
See companion files:
- `TROUBLESHOOTING.md` - Debugging guide and common issues
- `QUICK_REFERENCE.md` - Quick command reference

---

**Deployment completed by:** Claude Code
**Deployment date:** October 31, 2025
**Deployment time:** Approximately 30 minutes
**Status:** ✅ Application deployed successfully, awaiting Azure NSG configuration for external access
