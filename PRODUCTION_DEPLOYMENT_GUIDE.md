# UCRManager - Production Deployment Guide

**Version**: 1.0
**Date**: November 14, 2025
**Target Environment**: New Windows Server (Production)
**Source Environment**: Current Development Server

---

## Overview

This guide covers deploying UCRManager to a fresh Windows Server for production use. The deployment will be handled by Claude Code once the server is provisioned and access is established.

### Deployment Strategy

- **Development Server** (current): Remains active for feature development and bug fixes
- **Production Server** (new): Clean installation for operator use
- **Code Base**: Deploy from `feature/connectwise-integration` branch
- **Deployment Method**: Automated by Claude Code

---

## Prerequisites Checklist

### Server Requirements

#### Hardware Minimum
- [ ] CPU: 4 cores or more
- [ ] RAM: 8 GB minimum (16 GB recommended)
- [ ] Disk: 100 GB free space (SSD recommended)
- [ ] Network: Internet connectivity required

#### Software Requirements
- [ ] **OS**: Windows Server 2019 or later
- [ ] **Administrator Access**: Full admin rights required
- [ ] **Remote Access**: RDP, SSH, or terminal access for Claude Code
- [ ] **Firewall**: Ports 80, 443, 5432 accessible

#### Required Software Installations

**Before Claude Code Begins**:
- [ ] **Node.js**: Version 18.x or 20.x LTS
  - Download: https://nodejs.org/
  - Verify: `node --version` (should show v18.x or v20.x)
  - Verify: `npm --version`

- [ ] **PostgreSQL**: Version 16.x
  - Download: https://www.postgresql.org/download/windows/
  - Install with default settings
  - **IMPORTANT**: Note the postgres password you set during installation
  - Verify: Check "PostgreSQL 16" in Start Menu

- [ ] **Git**: Latest version
  - Download: https://git-scm.com/download/win
  - Install with default settings
  - Verify: `git --version`

- [ ] **PM2**: Process manager (Claude Code will install via npm)

- [ ] **IIS**: Optional (if using IIS as reverse proxy)
  - Claude Code can configure if needed

#### Optional (Recommended)
- [ ] **SSL Certificate**: For HTTPS (can use self-signed or proper cert)
- [ ] **Backup Solution**: Database backup tool
- [ ] **Monitoring**: Server monitoring software

---

## Pre-Deployment Preparation (Development Server)

These steps will be completed on the current development server before deployment.

### Step 1: Merge to Main Branch

**Option A: Merge feature branch to main** (Recommended if ready)
```bash
git checkout main
git pull origin main
git merge feature/connectwise-integration
git push origin main
```

**Option B: Deploy from feature branch** (If continuing development on main)
- Deploy directly from `feature/connectwise-integration`
- Production uses feature branch
- Dev continues on main or new branches

### Step 2: Build Production Artifacts

```bash
# On development server
cd /c/inetpub/wwwroot/UCRManager
npm run build
```

**Verify**:
- [ ] Build completes without errors
- [ ] `dist/` folder contains compiled code
- [ ] `dist/index.js` exists

### Step 3: Document Environment Variables

Current environment variables from dev server (sanitized):

```env
# Database
DATABASE_URL=postgresql://postgres:[PASSWORD]@localhost:5432/ucrmanager

# Session
SESSION_SECRET=[RANDOM_SECRET_64_CHARS]

# Encryption (for ConnectWise/3CX credentials)
ENCRYPTION_KEY=[RANDOM_KEY_32_BYTES]

# Application
NODE_ENV=production
PORT=443

# Optional: Microsoft Graph (if using)
GRAPH_CLIENT_ID=[IF_CONFIGURED]
GRAPH_CLIENT_SECRET=[IF_CONFIGURED]
GRAPH_TENANT_ID=[IF_CONFIGURED]
```

**ACTION**: Claude Code will generate new secrets for production during deployment.

### Step 4: Export Database Schema

```bash
# Export schema only (no data)
PGPASSWORD='4FC4E215649C6EBF3A390BAFE4B2ECD7' "/c/Program Files/PostgreSQL/16/bin/pg_dump.exe" \
  -U postgres \
  -d ucrmanager \
  --schema-only \
  -f ucrmanager_schema.sql

# Export migrations folder
# (Already in git repository)
```

### Step 5: Package Application Code

**Option A: Git Clone** (Recommended)
- Production server will clone from GitHub
- Ensures clean, version-controlled deployment

**Option B: Direct Copy**
- Zip the application folder
- Transfer to production server
- Less preferred (doesn't maintain git history)

---

## Deployment Process (Production Server)

These steps will be executed by Claude Code on the new production server.

### Phase 1: Environment Setup

#### 1.1 Verify Prerequisites
```bash
# Check Node.js
node --version
npm --version

# Check PostgreSQL
psql --version

# Check Git
git --version
```

#### 1.2 Create Application Directory
```bash
# Create deployment directory
mkdir C:\inetpub\wwwroot
cd C:\inetpub\wwwroot
```

#### 1.3 Clone Repository
```bash
# Clone from GitHub
git clone https://github.com/rbowlesUCR/UCRManager.git
cd UCRManager

# Checkout production branch
git checkout feature/connectwise-integration  # or main, depending on strategy
```

### Phase 2: Database Setup

#### 2.1 Create Database
```bash
# Connect to PostgreSQL
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres

# In PostgreSQL prompt:
CREATE DATABASE ucrmanager;
\q
```

#### 2.2 Run Migrations
```bash
# Apply all migrations in order
PGPASSWORD='[PRODUCTION_PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -f migrations/0001_initial_schema.sql

PGPASSWORD='[PRODUCTION_PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -f migrations/0002_feature_flags.sql

PGPASSWORD='[PRODUCTION_PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -f migrations/0003_3cx_integration.sql

PGPASSWORD='[PRODUCTION_PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -f migrations/0004_country_codes.sql

# Add country codes data
PGPASSWORD='[PRODUCTION_PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -f migrations/add_country_codes.sql

PGPASSWORD='[PRODUCTION_PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -f migrations/0005_manual_phone_entry.sql

PGPASSWORD='[PRODUCTION_PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -f migrations/0006_connectwise_integration.sql
```

#### 2.3 Verify Database
```bash
# Check tables created
PGPASSWORD='[PRODUCTION_PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -c "\dt"

# Should show:
# - admin_users
# - customer_tenants
# - phone_number_inventory
# - feature_flags
# - tenant_3cx_credentials
# - connectwise_credentials
# - audit_logs
# - country_codes
```

### Phase 3: Application Configuration

#### 3.1 Install Dependencies
```bash
cd C:\inetpub\wwwroot\UCRManager
npm install --production
```

#### 3.2 Generate Secrets
```bash
# Generate SESSION_SECRET (64 random characters)
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# Generate ENCRYPTION_KEY (32 random bytes, base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### 3.3 Configure Environment Variables

**Option A: Create .env file** (Simple)
```bash
# Create .env file
cat > .env << 'EOF'
DATABASE_URL=postgresql://postgres:[PRODUCTION_PASSWORD]@localhost:5432/ucrmanager
SESSION_SECRET=[GENERATED_SECRET]
ENCRYPTION_KEY=[GENERATED_KEY]
NODE_ENV=production
PORT=443
EOF
```

**Option B: PM2 ecosystem file** (Recommended)
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'ucrmanager-prod',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 443,
      DATABASE_URL: 'postgresql://postgres:[PRODUCTION_PASSWORD]@localhost:5432/ucrmanager',
      SESSION_SECRET: '[GENERATED_SECRET]',
      ENCRYPTION_KEY: '[GENERATED_KEY]'
    }
  }]
};
```

#### 3.4 Build Application
```bash
npm run build
```

**Verify**:
- [ ] Build completes successfully
- [ ] `dist/index.js` exists
- [ ] No errors in output

### Phase 4: Application Deployment

#### 4.1 Install PM2 Globally
```bash
npm install -g pm2
pm2 --version
```

#### 4.2 Start Application
```bash
# Using ecosystem file
pm2 start ecosystem.config.js

# OR using inline config
DATABASE_URL="postgresql://postgres:[PASSWORD]@localhost:5432/ucrmanager" \
SESSION_SECRET="[SECRET]" \
ENCRYPTION_KEY="[KEY]" \
NODE_ENV="production" \
PORT="443" \
pm2 start dist/index.js --name ucrmanager-prod
```

#### 4.3 Verify Application Running
```bash
# Check PM2 status
pm2 status

# Should show:
# ┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┐
# │ id │ name               │ mode     │ ↺    │ status    │ cpu      │
# ├────┼────────────────────┼──────────┼──────┼───────────┼──────────┤
# │ 0  │ ucrmanager-prod    │ fork     │ 0    │ online    │ 0%       │
# └────┴────────────────────┴──────────┴──────┴───────────┴──────────┘

# Check logs
pm2 logs ucrmanager-prod --lines 50

# Should see:
# [Server] UCRManager starting...
# [Database] Connected to PostgreSQL
# [Server] Listening on port 443
```

#### 4.4 Configure PM2 Startup
```bash
# Generate startup script (runs on Windows boot)
pm2 startup

# Save current PM2 configuration
pm2 save
```

### Phase 5: SSL/TLS Configuration

#### Option A: Self-Signed Certificate (Development/Testing)
```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout server.key -out server.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=ucrmanager.local"
```

#### Option B: Proper SSL Certificate (Production)
- Use existing certificate from certificate authority
- Or: Use Let's Encrypt (requires public domain)
- Claude Code will configure based on your certificate files

#### Configure Application for HTTPS
- Application already listens on port 443
- Ensure Windows Firewall allows port 443
- Update server code to use SSL cert (if not already configured)

### Phase 6: Firewall Configuration

```powershell
# Allow HTTPS (443)
New-NetFirewallRule -DisplayName "UCRManager HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow

# Allow HTTP (80) - optional, for redirect
New-NetFirewallRule -DisplayName "UCRManager HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow

# Allow PostgreSQL (localhost only - default)
# No action needed if PostgreSQL only listens on localhost
```

### Phase 7: Initial Admin User Setup

#### 7.1 Create Initial Admin
```bash
# Create admin user via Node.js script
node -e "
const bcrypt = require('bcrypt');
const password = 'CHANGE_ME_IMMEDIATELY';
bcrypt.hash(password, 10).then(hash => {
  console.log('Run this SQL to create admin user:');
  console.log(\`INSERT INTO admin_users (username, password_hash, is_local_admin, created_at) VALUES ('admin', '\${hash}', true, NOW());\`);
});
"

# Then run the generated SQL in PostgreSQL
PGPASSWORD='[PRODUCTION_PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -c "INSERT INTO admin_users (username, password_hash, is_local_admin, created_at) VALUES ('admin', '[HASH_FROM_ABOVE]', true, NOW());"
```

#### 7.2 Verify Admin Login
- Open browser: https://[SERVER_IP]
- Login with: admin / CHANGE_ME_IMMEDIATELY
- Immediately change password via UI
- Configure MFA if enabled

---

## Post-Deployment Verification

### Checklist

#### Database
- [ ] Database connection working
- [ ] All tables exist
- [ ] Admin user can login
- [ ] No errors in PM2 logs

#### Application
- [ ] PM2 shows status "online"
- [ ] Application accessible via HTTPS
- [ ] Login page loads
- [ ] Admin can authenticate
- [ ] No JavaScript errors in browser console

#### Features
- [ ] Can create/view tenants
- [ ] Can create/view operators
- [ ] Dashboard loads
- [ ] Phone number inventory loads

#### Security
- [ ] HTTPS working (not showing certificate errors if proper cert)
- [ ] Session management working (can logout/login)
- [ ] Admin routes protected (can't access without login)
- [ ] Database credentials secured

#### Performance
- [ ] Page load times acceptable (<2 seconds)
- [ ] No memory leaks (monitor PM2 for several hours)
- [ ] CPU usage normal (<20% idle)

---

## Configuration Steps After Deployment

### 1. Feature Flags

Enable features as needed:

```sql
-- Enable ConnectWise integration
UPDATE feature_flags SET is_enabled = true WHERE feature_key = 'connectwise_integration';

-- Enable 3CX integration
UPDATE feature_flags SET is_enabled = true WHERE feature_key = '3cx_integration';

-- Enable manual phone entry (if needed)
UPDATE feature_flags SET is_enabled = true WHERE feature_key = 'allow_manual_phone_entry';
```

### 2. Create Production Tenants

Via UI:
1. Login as admin
2. Navigate to Admin → Tenants
3. Create tenant for each customer
4. Configure tenant settings

### 3. Configure ConnectWise Integration

For each tenant using ConnectWise:
1. Navigate to Admin → ConnectWise Settings
2. Enter ConnectWise credentials:
   - Server URL: `https://[company].connectwise.com`
   - Company ID: Your ConnectWise company identifier
   - Public Key: From ConnectWise API members
   - Private Key: From ConnectWise API members
   - Client ID: Your registered API client
3. Test connection
4. Configure defaults:
   - Default time minutes: 15 or 30
   - Member identifier: Your ConnectWise username

### 4. Configure 3CX Integration

For each tenant using 3CX:
1. Navigate to Admin → 3CX Settings
2. Enter 3CX credentials:
   - Server URL: `https://[3cx-server]:5001`
   - Username: 3CX admin username
   - Password: 3CX admin password
   - MFA Code: (if MFA enabled)
3. Test connection

### 5. Import Phone Numbers

Via UI or SQL:
1. Navigate to Admin → Phone Numbers
2. Bulk import numbers from Teams
3. Or: Insert via SQL:

```sql
INSERT INTO phone_number_inventory (
  tenant_id,
  line_uri,
  external_system_type,
  status,
  created_at
) VALUES (
  '[TENANT_ID]',
  'tel:+12125551234',
  'teams',
  'available',
  NOW()
);
```

### 6. Create Operators

For each tenant:
1. Navigate to Operators
2. Add operator users
3. Assign roles/permissions

---

## Backup Strategy

### Database Backups

#### Daily Backup Script
```bash
# Create backup script: C:\Scripts\backup-ucrmanager.bat
@echo off
set BACKUP_DIR=C:\Backups\UCRManager
set TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_FILE=%BACKUP_DIR%\ucrmanager_%TIMESTAMP%.sql

"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" ^
  -U postgres ^
  -d ucrmanager ^
  -f "%BACKUP_FILE%"

# Keep last 7 days
forfiles /p "%BACKUP_DIR%" /m *.sql /d -7 /c "cmd /c del @path"
```

#### Schedule via Task Scheduler
```powershell
# Run as Administrator
$Action = New-ScheduledTaskAction -Execute "C:\Scripts\backup-ucrmanager.bat"
$Trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount
Register-ScheduledTask -TaskName "UCRManager Backup" -Action $Action -Trigger $Trigger -Principal $Principal
```

### Application Backups
- Git repository is backup of code
- `.env` or `ecosystem.config.js` should be backed up separately (contains secrets)
- PM2 process list: `pm2 save` (backed up automatically)

---

## Monitoring & Maintenance

### Daily Monitoring
```bash
# Check application status
pm2 status

# Check logs for errors
pm2 logs ucrmanager-prod --lines 100 | findstr "ERROR"

# Check database connections
PGPASSWORD='[PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = 'ucrmanager';"
```

### Weekly Maintenance
- Review PM2 logs for patterns
- Check disk space
- Review backup status
- Check for Windows updates

### Monthly Maintenance
- Review database performance
- Optimize database (VACUUM, ANALYZE)
- Review audit logs
- Update dependencies (if security patches available)

---

## Troubleshooting Guide

### Application Won't Start

**Symptom**: PM2 shows "errored" or "stopped"

**Check**:
```bash
# View logs
pm2 logs ucrmanager-prod --err --lines 50

# Common issues:
# - Database connection failed (check DATABASE_URL)
# - Port 443 already in use (check: netstat -ano | findstr :443)
# - Missing environment variables (check ecosystem.config.js or .env)
# - Build artifacts missing (run: npm run build)
```

### Database Connection Errors

**Symptom**: "ECONNREFUSED" or "password authentication failed"

**Check**:
```bash
# Test PostgreSQL connection
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager

# Verify DATABASE_URL format:
# postgresql://username:password@host:port/database

# Check PostgreSQL service running:
# Services → PostgreSQL 16 → Status: Running
```

### Page Load Errors (404, blank page)

**Symptom**: Application running but pages don't load

**Check**:
- Build artifacts present: `ls dist/`
- Static files served: Check `dist/` contains `index.html`, `assets/`
- Browser console for errors (F12)
- Network tab shows 200 OK for main resources

### Performance Issues

**Symptom**: Slow response times

**Check**:
```bash
# CPU usage
pm2 monit

# Memory usage
pm2 status

# Database performance
PGPASSWORD='[PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" \
  -U postgres \
  -d ucrmanager \
  -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
```

---

## Rollback Procedure

If deployment fails or critical issues arise:

### Quick Rollback
```bash
# Stop application
pm2 stop ucrmanager-prod

# Revert to previous git commit
git log --oneline -10
git checkout [PREVIOUS_COMMIT_HASH]

# Rebuild
npm run build

# Restart
pm2 restart ucrmanager-prod
```

### Database Rollback
```bash
# Drop database
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "DROP DATABASE ucrmanager;"

# Restore from backup
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE ucrmanager;"
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager -f C:\Backups\UCRManager\ucrmanager_[TIMESTAMP].sql
```

---

## Security Hardening (Post-Deployment)

### Windows Server
- [ ] Enable Windows Firewall
- [ ] Disable unnecessary services
- [ ] Enable automatic Windows updates (security patches only)
- [ ] Configure RDP access restrictions
- [ ] Review event logs regularly

### Application
- [ ] Change default admin password immediately
- [ ] Enable MFA for all admin users
- [ ] Review and restrict admin user access
- [ ] Configure session timeout (default: 24 hours)
- [ ] Review audit logs regularly

### Database
- [ ] Change postgres password from default
- [ ] Restrict PostgreSQL to localhost only
- [ ] Enable PostgreSQL logging
- [ ] Regular backup verification
- [ ] Encrypt backups

### Network
- [ ] Use proper SSL certificate (not self-signed)
- [ ] Configure reverse proxy if needed (IIS, nginx)
- [ ] Enable HSTS (HTTP Strict Transport Security)
- [ ] Disable unnecessary ports
- [ ] Use VPN for administrative access

---

## Known Issues & Workarounds

### 1. ConnectWise Work Role Hardcoded
**Issue**: Work role is hardcoded as "UCRight Engineer III"
**Impact**: Time entries may fail with "invalid work role" error
**Workaround**: Log time directly in ConnectWise, or configure manually in code
**Fix ETA**: Next release (1-2 hours development time)

### 2. ConnectWise Status Dropdown Shows All Statuses
**Issue**: Includes closed/inactive statuses
**Impact**: Users might accidentally close tickets
**Workaround**: Train users to avoid closed statuses
**Fix ETA**: Next release (15 minutes development time)

### 3. 3CX DID Creation Not Available
**Issue**: REST API doesn't support DID creation (405 Method Not Allowed)
**Impact**: Must add DIDs via 3CX admin console
**Workaround**: Use 3CX web interface to add DIDs
**Fix ETA**: Under investigation

---

## Development → Production Workflow

Going forward, here's the recommended workflow:

### Development Server (Current)
1. Develop new features on feature branches
2. Test thoroughly
3. Commit and push to GitHub
4. Document changes

### Production Server (New)
1. When ready to deploy:
   ```bash
   cd C:\inetpub\wwwroot\UCRManager
   git pull origin main  # or feature branch
   npm install
   npm run build
   pm2 restart ucrmanager-prod
   ```

2. Monitor for issues:
   ```bash
   pm2 logs ucrmanager-prod
   ```

3. Rollback if needed (see Rollback Procedure above)

### Recommended Release Cycle
- **Development**: Continuous on dev server
- **Staging**: Test on dev server before production push
- **Production**: Weekly or bi-weekly releases
- **Hotfixes**: As needed for critical bugs

---

## Support & Contact

### If Issues Occur During Deployment

**Claude Code is handling deployment**:
- Claude will troubleshoot and resolve issues in real-time
- Monitor the terminal output for progress
- Claude will ask questions if decisions are needed

**Post-Deployment Issues**:
- Check this guide's Troubleshooting section
- Review PM2 logs: `pm2 logs ucrmanager-prod`
- Check database connectivity
- Review Windows Event Logs

### Documentation References
- `PRODUCTION_READINESS_ASSESSMENT.md` - Detailed readiness analysis
- `CONSOLIDATED_TODO.md` - Known issues and pending tasks
- `CONNECTWISE_INTEGRATION.md` - ConnectWise setup guide
- `3CX_CRUD_IMPLEMENTATION.md` - 3CX setup guide

---

## Deployment Checklist Summary

### Before Starting (You)
- [ ] Provision new Windows Server
- [ ] Install Node.js, PostgreSQL, Git
- [ ] Establish remote access for Claude Code
- [ ] Note PostgreSQL password set during installation

### During Deployment (Claude Code)
- [ ] Clone repository
- [ ] Create and configure database
- [ ] Run all migrations
- [ ] Install dependencies
- [ ] Configure environment variables
- [ ] Build application
- [ ] Start with PM2
- [ ] Configure startup scripts
- [ ] Create admin user
- [ ] Verify deployment

### After Deployment (You)
- [ ] Test admin login
- [ ] Change default admin password
- [ ] Configure feature flags
- [ ] Add production tenants
- [ ] Configure integrations (ConnectWise, 3CX)
- [ ] Import phone numbers
- [ ] Create operator users
- [ ] Set up backups
- [ ] Monitor for 24-48 hours

---

**Estimated Deployment Time**: 1-2 hours
**Complexity**: Medium
**Risk Level**: Low (fresh installation, no data migration)

**Ready to proceed when you are!**

---

**Document Version**: 1.0
**Last Updated**: November 14, 2025
**Next Review**: After production deployment
