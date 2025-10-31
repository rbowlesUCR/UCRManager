# UCRManager Deployment - Current Status
**Date:** October 31, 2025 4:52 AM UTC
**Server:** UCManagerv2 (Windows Server 2025)
**Status:** ✅ Application Running - SSL Setup In Progress

---

## ✅ COMPLETED TASKS

### 1. Prerequisites Installed
- ✅ Node.js v24.11.0
- ✅ npm 11.6.1
- ✅ Git 2.51.2.windows.1
- ✅ PM2 v6.0.13 (with Windows startup configured)
- ✅ PostgreSQL 16

### 2. Application Deployed
- ✅ Repository cloned: https://github.com/rbowlesUCR/UCRManager.git
- ✅ Location: `C:\inetpub\wwwroot\UCRManager`
- ✅ Dependencies installed: 608 packages
- ✅ Database created: `ucrmanager`
- ✅ Database migrations applied
- ✅ Application built: `dist/` directory

### 3. Critical Fixes Applied
- ✅ **Windows Compatibility Fix**: Removed `reusePort: true` from `server/index.ts`
- ✅ **Database Driver Fix**: Changed from Neon serverless to standard PostgreSQL
  - Modified: `server/db.ts`
  - From: `@neondatabase/serverless`
  - To: `pg` with `drizzle-orm/node-postgres`
- ✅ **Cookie Security Fix**: Changed `NODE_ENV=development` for HTTP access
  - Issue: Production mode requires HTTPS for cookies
  - Fix: Development mode until SSL is configured

### 4. Database Configuration
- ✅ PostgreSQL 16 installed at: `C:\Program Files\PostgreSQL\16`
- ✅ Database: `ucrmanager`
- ✅ User: `postgres`
- ✅ Password: `4FC4E215649C6EBF3A390BAFE4B2ECD7`
- ✅ Port: 5432 (localhost)
- ✅ Admin user created: `admin` / `admin123`

### 5. Network Configuration
- ✅ Server Internal IP: `172.17.0.4`
- ✅ Server Public IP: `20.168.122.70`
- ✅ Azure DNS Name: `ucrmanager.westus3.cloudapp.azure.com`
- ✅ Windows Firewall: Port 5000 allowed
- ✅ Windows Firewall: Port 443 allowed
- ✅ Windows Firewall: Port 80 allowed (temporary for SSL)
- ✅ Azure NSG: Port 5000 allowed (should be IP-restricted by user)
- ⚠️ Azure NSG: Port 80 needs to be opened (user to configure)
- ⚠️ Azure NSG: Port 443 needs to be opened (user to configure)

### 6. Application Running
- ✅ Process Manager: PM2
- ✅ Process Name: `ucrmanager`
- ✅ Process ID: Running (check with `pm2 status`)
- ✅ Port: 5000 (HTTP)
- ✅ Status: Online and stable
- ✅ Auto-start on boot: Configured
- ✅ PM2 startup: Registry entry created

### 7. Admin Access
- ✅ Admin account created
- ✅ Admin login working
- ✅ Username: `admin`
- ✅ Password: `admin123` (⚠️ CHANGE AFTER FIRST LOGIN)
- ✅ Admin panel accessible at: http://localhost:5000/admin-login

### 8. Operator Configuration
- ✅ Operator config table initialized
- ✅ Azure Tenant ID: `905655b8-88f2-4fc8-9474-a4f2b0283b03`
- ✅ Azure Client ID: `84592808-09ee-4f20-9f92-c65f45f6451b`
- ✅ Redirect URI: `https://ucrmanager.westus3.cloudapp.azure.com/api/auth/callback`
- ✅ Client secret: Configured and encrypted in database

### 9. SSL Certificate Setup (IN PROGRESS)
- ✅ Win-ACME downloaded and extracted to: `C:\win-acme`
- ✅ Windows Firewall port 80: Open
- ✅ Windows Firewall port 443: Open
- ⚠️ Azure NSG port 80: Needs to be opened by user
- ⚠️ Azure NSG port 443: Needs to be opened by user
- ⚠️ Certificate: Not yet generated

---

## 🔧 CURRENT CONFIGURATION

### Environment Variables (.env)
**File:** `C:\inetpub\wwwroot\UCRManager\.env`

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:4FC4E215649C6EBF3A390BAFE4B2ECD7@localhost:5432/ucrmanager

# Session Secret (IMPORTANT: Keep this secure!)
SESSION_SECRET=qMLFVOwVd5VXQfIzgfMBZFjfpoQAZ4qbTz++VZJIcpfoHOb6dxbgqh/n4OyOaLN4

# Environment (set to development for HTTP, production for HTTPS)
NODE_ENV=development

# Port (5000 for HTTP - can use IIS reverse proxy for 80/443 later)
PORT=5000
```

### PM2 Configuration
```bash
Process Name: ucrmanager
Script: C:\inetpub\wwwroot\UCRManager\dist\index.js
Node Args: --env-file=.env
Restart Count: Low (stable)
Auto-restart: Enabled
Boot startup: Configured via registry
PM2 Home: C:\Users\absolute-phillyrally\.pm2
```

### Database Schema
Tables created:
- `admin_users` (1 row - admin account)
- `operator_config` (1 row - Azure AD config)
- `customer_tenants` (0 rows)
- `operator_users` (0 rows)
- `audit_logs` (0 rows)
- `configuration_profiles` (0 rows)
- `tenant_powershell_credentials` (0 rows)

---

## 🌐 ACCESS INFORMATION

### Current Access URLs (HTTP)
- **Local Admin:** http://localhost:5000/admin-login
- **External Admin:** http://20.168.122.70:5000/admin-login
- **DNS Admin:** http://ucrmanager.westus3.cloudapp.azure.com:5000/admin-login
- **Operator Login:** http://localhost:5000/login

### After HTTPS Setup (Pending)
- **HTTPS Admin:** https://ucrmanager.westus3.cloudapp.azure.com/admin-login
- **HTTPS Operator:** https://ucrmanager.westus3.cloudapp.azure.com/login

### Credentials
**Admin Panel:**
- Username: `admin`
- Password: `admin123`
- ⚠️ **CHANGE THIS PASSWORD AFTER FIRST LOGIN**

**Database:**
- Host: `localhost:5432`
- Database: `ucrmanager`
- User: `postgres`
- Password: `4FC4E215649C6EBF3A390BAFE4B2ECD7`

**Azure AD (Operator Authentication):**
- Tenant ID: `905655b8-88f2-4fc8-9474-a4f2b0283b03`
- Client ID: `84592808-09ee-4f20-9f92-c65f45f6451b`
- Client Secret: Encrypted in database
- Redirect URI: `https://ucrmanager.westus3.cloudapp.azure.com/api/auth/callback`

---

## 📂 IMPORTANT FILES & LOCATIONS

### Application Files
```
Application Root: C:\inetpub\wwwroot\UCRManager
Source Code: C:\inetpub\wwwroot\UCRManager\server, client, shared
Built Application: C:\inetpub\wwwroot\UCRManager\dist
Configuration: C:\inetpub\wwwroot\UCRManager\.env
Package Info: C:\inetpub\wwwroot\UCRManager\package.json
```

### Documentation Created
```
C:\inetpub\wwwroot\UCRManager\DEPLOYMENT_SUMMARY.md
C:\inetpub\wwwroot\UCRManager\TROUBLESHOOTING.md
C:\inetpub\wwwroot\UCRManager\QUICK_REFERENCE.md
C:\inetpub\wwwroot\UCRManager\SETUP_SSL_CERTIFICATE.md
C:\inetpub\wwwroot\UCRManager\CURRENT_STATUS_2025-10-31.md (this file)
```

### PM2 Files
```
PM2 Home: C:\Users\absolute-phillyrally\.pm2
PM2 Logs: C:\Users\absolute-phillyrally\.pm2\logs
PM2 Process List: C:\Users\absolute-phillyrally\.pm2\dump.pm2
Log Files:
  - C:\Users\absolute-phillyrally\.pm2\logs\ucrmanager-out.log
  - C:\Users\absolute-phillyrally\.pm2\logs\ucrmanager-error.log
```

### PostgreSQL
```
Installation: C:\Program Files\PostgreSQL\16
Binaries: C:\Program Files\PostgreSQL\16\bin
psql: C:\Program Files\PostgreSQL\16\bin\psql.exe
Data: C:\Program Files\PostgreSQL\16\data
```

### SSL Certificate (Pending)
```
Win-ACME: C:\win-acme
Certificates will be saved to: C:\win-acme\certificates\
Domain: ucrmanager.westus3.cloudapp.azure.com
```

---

## 🚧 IN PROGRESS

### SSL Certificate Setup
**Status:** Win-ACME downloaded, ready to run

**Waiting on:**
1. ⚠️ User needs to open port 80 in Azure NSG (temporary)
2. ⚠️ User needs to open port 443 in Azure NSG (permanent)
3. ⚠️ Run Win-ACME to generate certificate

**Next steps after certificate:**
1. Update `.env`: Change `PORT=443` and `NODE_ENV=production`
2. Configure Node.js to use HTTPS
3. Rebuild application
4. Restart PM2 process
5. Test HTTPS access
6. Remove port 80 from Azure NSG
7. Update Azure AD redirect URI to use HTTPS

---

## ⚡ QUICK RECOVERY COMMANDS

### If Application Stops
```bash
# Check status
pm2 status

# View logs
pm2 logs ucrmanager --lines 50

# Restart
pm2 restart ucrmanager

# If PM2 not responding, start fresh
pm2 delete ucrmanager
cd C:\inetpub\wwwroot\UCRManager
pm2 start dist/index.js --name "ucrmanager" --node-args="--env-file=.env"
pm2 save
```

### Database Access
```bash
# Connect to database
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager

# List tables
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager -c "\dt"

# Check admin users
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager -c "SELECT * FROM admin_users;"

# Check operator config
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager -c "SELECT azure_tenant_id, azure_client_id, redirect_uri FROM operator_config;"
```

### Rebuild Application
```bash
cd C:\inetpub\wwwroot\UCRManager
npm run build
pm2 restart ucrmanager
```

### Update from GitHub
```bash
cd C:\inetpub\wwwroot\UCRManager
git pull origin main
npm install
npm run build
pm2 restart ucrmanager
```

---

## 🔧 PENDING TASKS

### Immediate (SSL Setup)
1. [ ] Open port 80 in Azure NSG (temporary for Let's Encrypt validation)
2. [ ] Open port 443 in Azure NSG (permanent for HTTPS access)
3. [ ] Run Win-ACME: `cd C:\win-acme && .\wacs.exe`
4. [ ] Configure application for HTTPS
5. [ ] Update `.env` to use port 443 and production mode
6. [ ] Rebuild and restart application
7. [ ] Test HTTPS access
8. [ ] Remove port 80 from Azure NSG
9. [ ] Remove or restrict port 5000 from Azure NSG

### Post-SSL
1. [ ] Update Azure AD redirect URI to use HTTPS (in Azure Portal)
2. [ ] Test operator Microsoft login
3. [ ] Change admin password from default (`admin123`)
4. [ ] Add customer tenants
5. [ ] Add operator users
6. [ ] Test Teams voice operations
7. [ ] Set up database backups
8. [ ] Configure monitoring/alerts
9. [ ] Document ZTNA access for internal users

---

## 🐛 KNOWN ISSUES & FIXES APPLIED

### Issue 1: Neon Database Driver Incompatibility ✅ FIXED
**Problem:** Application used Neon serverless driver (for Replit) which requires WebSocket connections not available with local PostgreSQL.

**Symptoms:**
- Login fails with "Not authenticated"
- WebSocket ECONNREFUSED errors in logs
- Attempts to connect to `wss://localhost/v2`

**Fix Applied:**
- Modified `server/db.ts`
- Changed from: `import { Pool } from '@neondatabase/serverless'`
- Changed to: `import pg from 'pg'; const { Pool } = pg;`
- Changed driver from `drizzle-orm/neon-serverless` to `drizzle-orm/node-postgres`
- Rebuilt application
- Restarted PM2

**Files Modified:**
- `server/db.ts`
- `dist/index.js` (rebuilt)

### Issue 2: Windows Socket Compatibility ✅ FIXED
**Problem:** `reusePort: true` option is Linux-only, caused "ENOTSUP: operation not supported on socket" error.

**Fix Applied:**
- Modified `server/index.ts` line 74-77
- Removed `reusePort: true` option
- Changed from object-style listen to simple parameter listen
- Rebuilt application

**Files Modified:**
- `server/index.ts`
- `dist/index.js` (rebuilt)

### Issue 3: Cookie Not Saving (Session Lost) ✅ FIXED
**Problem:** Login succeeds but session immediately lost, redirects back to login page.

**Cause:** `NODE_ENV=production` sets cookies with `secure: true` flag, which requires HTTPS. Application running on HTTP, browser rejected cookies.

**Fix Applied:**
- Changed `NODE_ENV=production` to `NODE_ENV=development` in `.env`
- Recreated PM2 process to load new environment
- Cookies now work over HTTP

**Temporary:** Will change back to `production` after SSL is configured

### Issue 4: No Admin User ✅ FIXED
**Problem:** Admin login failed, no admin users in database.

**Cause:** Seed script didn't work with Neon driver on Windows/PostgreSQL setup.

**Fix Applied:**
- After fixing database driver, ran seed script successfully
- Admin user created with username `admin` and password `admin123`

### Issue 5: Operator Config Not Found ✅ FIXED
**Problem:** 404 error when accessing operator configuration in admin panel.

**Cause:** Empty `operator_config` table (requires exactly one record).

**Fix Applied:**
- Created initial operator config record in database
- User filled in Azure AD details via admin panel
- Configuration now working

---

## 📊 SYSTEM HEALTH

### Application Status
```
✅ Application: Running
✅ Database: Connected
✅ PM2: Managing process
✅ Auto-restart: Enabled
✅ Boot startup: Configured
✅ Admin login: Working
✅ Operator config: Configured
```

### Ports
```
✅ 5000 (HTTP): Open, application listening
✅ 5432 (PostgreSQL): Localhost only
✅ 80 (HTTP): Firewall open (for SSL validation)
✅ 443 (HTTPS): Firewall open (for SSL)
⚠️ Azure NSG: User managing IP whitelist
```

### DNS
```
✅ ucrmanager.westus3.cloudapp.azure.com
✅ Resolves to: 20.168.122.70
✅ Tested: DNS working
```

---

## 🔐 SECURITY NOTES

### Current Security Posture
- ✅ Database password: Strong random password
- ✅ Session secret: Cryptographically secure (Base64, 48 bytes)
- ✅ Azure AD credentials: Encrypted in database (AES-256-GCM)
- ⚠️ Admin password: Default (`admin123`) - **MUST CHANGE**
- ⚠️ HTTP only: No encryption in transit (SSL pending)
- ✅ Network access: User managing IP whitelist via Azure NSG
- ✅ ZTNA: User implementing for internal access

### Post-SSL Security Improvements
- [ ] Force HTTPS redirect
- [ ] Enable HSTS header
- [ ] Remove HTTP port (5000) from public access
- [ ] Only allow 443 with IP whitelist
- [ ] Change admin password
- [ ] Review operator user permissions

---

## 💡 TIPS FOR CONTINUATION

### If Server Crashes/Restarts
1. **Check PM2 startup**: `pm2 status` - should auto-start
2. **If not running**: `pm2 resurrect` or manually start
3. **Check PostgreSQL**: `powershell -Command "Get-Service postgresql-x64-16"`
4. **Check logs**: `pm2 logs ucrmanager`

### If Database Issues
1. **Check service**: `powershell -Command "Get-Service postgresql-x64-16"`
2. **Start if stopped**: `powershell -Command "Start-Service postgresql-x64-16"`
3. **Test connection**: Use psql commands from Quick Recovery section above

### If Application Won't Start
1. **Check .env file exists**: `ls C:\inetpub\wwwroot\UCRManager\.env`
2. **Check dist folder exists**: `ls C:\inetpub\wwwroot\UCRManager\dist`
3. **If missing, rebuild**: `cd C:\inetpub\wwwroot\UCRManager && npm run build`
4. **Check PM2 logs**: `pm2 logs ucrmanager --err --lines 50`

---

## 📞 SUPPORT RESOURCES

### Documentation Files
All documentation is in: `C:\inetpub\wwwroot\UCRManager\`
- `DEPLOYMENT_SUMMARY.md` - Complete deployment details
- `TROUBLESHOOTING.md` - Debugging guide
- `QUICK_REFERENCE.md` - Common commands
- `SETUP_SSL_CERTIFICATE.md` - SSL setup guide
- `CURRENT_STATUS_2025-10-31.md` - This file

### Repository
- URL: https://github.com/rbowlesUCR/UCRManager
- Branch: main
- Issues: https://github.com/rbowlesUCR/UCRManager/issues

### Key Commands Reference
```bash
# Application
pm2 status
pm2 logs ucrmanager
pm2 restart ucrmanager

# Database
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager

# Build
cd C:\inetpub\wwwroot\UCRManager && npm run build

# Network
curl http://localhost:5000
nslookup ucrmanager.westus3.cloudapp.azure.com
```

---

## 🎯 IMMEDIATE NEXT STEP

**TO RESUME SSL SETUP:**

1. Open Azure Portal
2. Open port 80 in NSG (temporary for Let's Encrypt):
   - VM → Networking → NSG → Inbound rules → Add
   - Source: Any, Port: 80, Protocol: TCP, Allow
3. Open port 443 in NSG (permanent for HTTPS):
   - Source: Your IP (or Any), Port: 443, Protocol: TCP, Allow
4. Run Win-ACME:
   ```powershell
   cd C:\win-acme
   .\wacs.exe
   ```
5. Follow prompts to get certificate for: `ucrmanager.westus3.cloudapp.azure.com`

---

**Last Updated:** October 31, 2025 4:52 AM UTC
**Application Version:** 1.0.0
**Server:** UCManagerv2 (Windows Server 2025, West US 3)
**Deployment Status:** ✅ Running on HTTP, SSL setup in progress
