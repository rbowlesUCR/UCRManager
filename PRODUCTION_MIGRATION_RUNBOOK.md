# Production Migration Runbook

**Last Updated**: November 15, 2025
**Version**: 1.0
**Purpose**: Step-by-step guide for deploying UCRManager to production servers

---

## Prerequisites

Before starting the migration, ensure you have:

- [ ] Windows Server with Git Bash installed
- [ ] Node.js installed (check with `node --version`)
- [ ] PostgreSQL 18+ installed
- [ ] PostgreSQL password (if using Chocolatey: check install output)
- [ ] GitHub access token (if needed for private repo)
- [ ] Domain name configured (for SSL certificates)
- [ ] Azure NSG rules configured (ports 80 and 443)
- [ ] Windows Firewall rules configured

---

## Step 1: Install PostgreSQL

If PostgreSQL is not already installed:

```bash
# Install PostgreSQL via Chocolatey
choco install postgresql -y

# Note the auto-generated password from the output
# Example: Password: de026eed3c534297bf25eb8c21073f2d

# Set environment variable for subsequent commands
export PGPASSWORD='YOUR_PASSWORD_HERE'
```

**Verify Installation:**
```bash
"/c/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -c "SELECT version();"
```

---

## Step 2: Clone Repository

```bash
cd /c/inetpub/wwwroot

# If using Personal Access Token:
git clone https://USERNAME:TOKEN@github.com/rbowlesUCR/UCRManager.git

# Or if using SSH:
git clone git@github.com:rbowlesUCR/UCRManager.git

cd UCRManager
git checkout feature/connectwise-integration
```

**Verify:**
```bash
git branch
# Should show: * feature/connectwise-integration
```

---

## Step 3: Create Database

```bash
export PGPASSWORD='YOUR_PASSWORD_HERE'

# Create database
"/c/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -c "CREATE DATABASE ucrmanager;"

# Verify creation
"/c/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -c "\l" | grep ucrmanager
```

---

## Step 4: Apply Database Migrations

**IMPORTANT**: Apply migrations in this exact order:

### 4.1 - Fix Production Schema (Main Migration)
```bash
"/c/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -d ucrmanager \
  -f migrations/FIX_PRODUCTION_SCHEMA.sql
```

**What this does:**
- Creates all core tables (admin_users, customer_tenants, operator_users, etc.)
- Fixes ConnectWise credentials schema
- Fixes 3CX credentials schema
- Creates feature flags
- Inserts default admin user
- Inserts operator config placeholder

### 4.2 - Phone Number Inventory
```bash
"/c/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -d ucrmanager \
  -f migrations/ADD_PHONE_NUMBER_INVENTORY.sql
```

**What this does:**
- Creates phone_number_inventory table with complete schema (31 columns)
- Adds all required indexes
- Sets up check constraints

### 4.3 - Country Codes (Optional but Recommended)
```bash
"/c/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -d ucrmanager \
  -f migrations/add_country_codes.sql
```

**What this does:**
- Loads 93 country codes for phone number management

---

## Step 5: Verify Database Schema

Run these verification queries to ensure all tables and columns exist:

```bash
# Check all tables exist
"/c/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -d ucrmanager -c "\dt"
```

**Expected tables (14 total):**
- admin_users
- audit_logs
- configuration_profiles
- connectwise_credentials
- country_codes
- customer_tenants
- feature_flags
- operator_config
- operator_users
- phone_number_inventory
- tenant_3cx_config
- tenant_3cx_credentials
- tenant_powershell_credentials
- threecx_audit_logs

### Verify Critical Columns

**ConnectWise Credentials (15 columns expected):**
```bash
"/c/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -d ucrmanager -c "
SELECT column_name FROM information_schema.columns
WHERE table_name = 'connectwise_credentials'
ORDER BY column_name;"
```

**Must include:** base_url, public_key, private_key, auto_update_status, default_status_id

**3CX Credentials (12 columns expected):**
```bash
"/c/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -d ucrmanager -c "
SELECT column_name FROM information_schema.columns
WHERE table_name = 'tenant_3cx_credentials'
ORDER BY column_name;"
```

**Must include:** created_by, updated_by, last_modified_by, last_modified_at

**Phone Number Inventory (31 columns expected):**
```bash
"/c/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -d ucrmanager -c "
SELECT COUNT(*) as column_count FROM information_schema.columns
WHERE table_name = 'phone_number_inventory';"
```

**Feature Flags (5 flags expected):**
```bash
"/c/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -d ucrmanager -c "
SELECT feature_key, is_enabled FROM feature_flags ORDER BY feature_key;"
```

**Must include:**
- 3cx_integration
- 3cx_grafana
- allow_manual_phone_entry
- connectwise_integration
- number_management

---

## Step 6: Install Application Dependencies

```bash
cd /c/inetpub/wwwroot/UCRManager

# Clean install
npm install

# Should install ~522 packages
```

**If you encounter ENOTEMPTY errors:**
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## Step 7: Build Application

```bash
npm run build
```

**Expected output:**
- `dist/index.js` created (~340KB)
- `dist/public/` directory with frontend assets

**Verify:**
```bash
ls -lh dist/index.js
ls dist/public/
```

---

## Step 8: Configure Environment Variables

Create PM2 ecosystem configuration:

```bash
# File: ecosystem.config.cjs
cat > ecosystem.config.cjs << 'EOF'
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
      DATABASE_URL: 'postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/ucrmanager',
      SESSION_SECRET: 'GENERATE_RANDOM_STRING_HERE',
      ENCRYPTION_KEY: 'GENERATE_BASE64_KEY_HERE'
    }
  }]
};
EOF
```

**Generate Random Secrets:**
```bash
# Session Secret (64 character random string)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Encryption Key (32 byte base64 string)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Update the file** with your actual values.

---

## Step 9: SSL Certificate Setup

### Option A: Self-Signed Certificate (Testing Only)

```bash
mkdir -p certificates

openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout certificates/YOUR_DOMAIN-key.pem \
  -out certificates/YOUR_DOMAIN-crt.pem \
  -days 365 \
  -subj "/CN=YOUR_DOMAIN"
```

### Option B: Let's Encrypt Certificate (Production)

**Prerequisites:**
- Port 80 must be open in Azure NSG
- Port 80 must be open in Windows Firewall

**Install Win-ACME:**
```bash
choco install win-acme -y
```

**Open Firewall:**
```powershell
powershell.exe -Command "New-NetFirewallRule -DisplayName 'Let''s Encrypt HTTP' -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow"
powershell.exe -Command "New-NetFirewallRule -DisplayName 'UCRManager HTTPS' -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow"
```

**Obtain Certificate:**
```bash
cd "C:/tools/win-acme"

./wacs.exe --target manual --host YOUR_DOMAIN \
  --validation http-01 --webroot "C:/inetpub/wwwroot/UCRManager/public" \
  --certificatestore My --installation script \
  --script "./Scripts/ExportPemFiles.ps1" \
  --scriptparameters "C:/inetpub/wwwroot/UCRManager/certificates"
```

**Update server/https-config.ts:**
```typescript
const domain = 'YOUR_DOMAIN';
```

---

## Step 10: Install and Configure PM2

```bash
# Install PM2 globally
npm install -g pm2

# Install PM2 Windows startup
npm install -g pm2-windows-startup
pm2-startup install

# Start application
pm2 start ecosystem.config.cjs

# Save PM2 configuration
pm2 save
```

**Verify PM2 Status:**
```bash
pm2 status
pm2 logs ucrmanager-prod --lines 50
```

---

## Step 11: Network Configuration

### Azure NSG Rules

Create two inbound rules in your Azure Network Security Group:

**Port 80 (Let's Encrypt validation):**
- Name: Lets_Encrypt
- Priority: 100
- Source: Any
- Source port ranges: *
- Destination: Your VM's IP
- Destination port ranges: 80
- Protocol: TCP
- Action: Allow

**Port 443 (HTTPS):**
- Name: HTTPS
- Priority: 200
- Source: Your admin IP addresses (or Any for testing)
- Source port ranges: *
- Destination: Any
- Destination port ranges: 443
- Protocol: TCP
- Action: Allow

### Windows Firewall Rules

Already created in Step 9 if using Let's Encrypt.

If not:
```powershell
powershell.exe -Command "New-NetFirewallRule -DisplayName 'UCRManager HTTPS' -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow"
```

---

## Step 12: Post-Deployment Validation

### Test Admin Login

```bash
curl -k -X POST https://localhost/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**Expected:** `{"success":true}`

### Test Database Connectivity

```bash
curl -k https://localhost/api/admin/customer-tenants
```

**Expected:** `[]` (empty array)

### Test Feature Flags

```bash
curl -k https://localhost/api/feature-flags
```

**Expected:** JSON array with 5 feature flags

### Test Debug Endpoints

```bash
curl -k https://localhost/api/debug/status
```

**Expected:** `{"debugEnabled":true,"timestamp":"..."}`

### Test PowerShell Integration

```bash
curl -k -X POST https://localhost/api/admin/powershell/test-basic
```

**Expected:** `{"success":true,"output":"PowerShell Test Successful..."}`

### External Access Test

```bash
curl -I https://YOUR_DOMAIN
```

**Expected:** `HTTP/1.1 200 OK`

---

## Step 13: Install PowerShell Modules

```powershell
powershell.exe -Command "Install-Module -Name MicrosoftTeams -Force -AllowClobber"
```

**Verify:**
```powershell
powershell.exe -Command "Get-Module -ListAvailable MicrosoftTeams"
```

---

## Step 14: Configure Application

### Change Default Admin Password

1. Login to admin panel: https://YOUR_DOMAIN/admin
2. Navigate to Settings
3. Change password from default `admin123`

### Configure Operator Azure AD

1. Login to admin panel
2. Navigate to Operator Settings
3. Enter your Azure AD credentials:
   - Tenant ID
   - Client ID
   - Client Secret
   - Redirect URI: https://YOUR_DOMAIN/auth/callback

### Create First Customer Tenant

1. Navigate to Customer Tenants
2. Click "Add Tenant"
3. Fill in tenant details

---

## Troubleshooting Common Issues

### Issue: npm install fails with ENOTEMPTY

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Issue: PM2 module error

**Solution:**
Rename `ecosystem.config.js` to `ecosystem.config.cjs`

### Issue: Database connection refused

**Solution:**
```bash
# Check PostgreSQL is running
"/c/Program Files/PostgreSQL/18/bin/pg_ctl.exe" status -D "C:/Program Files/PostgreSQL/18/data"

# Restart if needed
"/c/Program Files/PostgreSQL/18/bin/pg_ctl.exe" restart -D "C:/Program Files/PostgreSQL/18/data"
```

### Issue: Column does not exist errors

**Solution:**
Re-run the migration scripts in order (Step 4)

### Issue: Let's Encrypt validation fails

**Solution:**
```bash
# Verify port 80 is open
netstat -an | grep :80

# Check Windows Firewall
powershell.exe -Command "Get-NetFirewallRule -DisplayName '*Encrypt*'"

# Check Azure NSG allows port 80 from internet
```

### Issue: HTTPS not accessible externally

**Solution:**
1. Check Azure NSG allows port 443
2. Check Windows Firewall allows port 443
3. Verify PM2 is running on port 443
4. Check certificate files exist in `certificates/` directory

---

## Monitoring & Maintenance

### View Application Logs

```bash
# Real-time logs
pm2 logs ucrmanager-prod

# Last 100 lines
pm2 logs ucrmanager-prod --lines 100

# Error logs only
pm2 logs ucrmanager-prod --err

# Output logs only
pm2 logs ucrmanager-prod --out
```

### View PM2 Status

```bash
pm2 status
pm2 show ucrmanager-prod
```

### Restart Application

```bash
pm2 restart ucrmanager-prod
```

### Database Backup

```bash
export PGPASSWORD='YOUR_PASSWORD'
"/c/Program Files/PostgreSQL/18/bin/pg_dump.exe" -U postgres -d ucrmanager > backup_$(date +%Y%m%d).sql
```

### Certificate Renewal

Certificates auto-renew via Win-ACME Task Scheduler.

**Check renewal task:**
- Open Task Scheduler
- Navigate to Task Scheduler Library → Win-ACME
- Verify task is enabled and scheduled

---

## Security Checklist

After deployment, complete these security tasks:

- [ ] Change default admin password
- [ ] Update Azure NSG to restrict source IPs
- [ ] Backup `ecosystem.config.cjs` (contains secrets)
- [ ] Backup database regularly
- [ ] Backup SSL certificates
- [ ] Configure Azure AD for operator login
- [ ] Review and disable debug mode if needed (set `DEBUG_MODE=false`)
- [ ] Document all credentials in secure password manager

---

## Quick Reference

### Important Paths

- Application: `C:/inetpub/wwwroot/UCRManager`
- Certificates: `C:/inetpub/wwwroot/UCRManager/certificates`
- PM2 Config: `C:/inetpub/wwwroot/UCRManager/ecosystem.config.cjs`
- PostgreSQL: `C:/Program Files/PostgreSQL/18`
- PM2 Logs: `C:/Users/[USER]/.pm2/logs`

### Important URLs

- Admin Panel: https://YOUR_DOMAIN/admin
- Operator Login: https://YOUR_DOMAIN
- API Base: https://YOUR_DOMAIN/api
- Debug Status: https://YOUR_DOMAIN/api/debug/status

### Default Credentials

- **Admin**: username=`admin`, password=`admin123` (CHANGE THIS!)
- **PostgreSQL**: username=`postgres`, password=(from install output)

### Migration Files Order

1. `migrations/FIX_PRODUCTION_SCHEMA.sql` - Core tables and fixes
2. `migrations/ADD_PHONE_NUMBER_INVENTORY.sql` - Phone number management
3. `migrations/add_country_codes.sql` - Country codes (optional)

---

## Rollback Procedure

If deployment fails and you need to rollback:

```bash
# Stop PM2
pm2 stop ucrmanager-prod
pm2 delete ucrmanager-prod

# Drop database
export PGPASSWORD='YOUR_PASSWORD'
"/c/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -c "DROP DATABASE ucrmanager;"

# Remove application files
cd /c/inetpub/wwwroot
rm -rf UCRManager

# Start from Step 2
```

---

## Support & Documentation

- **Deployment Log**: `PRODUCTION_DEPLOYMENT_LOG.md`
- **Schema Guide**: `SCHEMA_MIGRATION_GUIDE.md`
- **Migration Updates**: `MIGRATION_UPDATE_SUMMARY.md`
- **This Runbook**: `PRODUCTION_MIGRATION_RUNBOOK.md`

---

## Success Criteria

Deployment is successful when:

- ✅ All 14 database tables exist
- ✅ All critical columns verified (ConnectWise, 3CX, phone inventory)
- ✅ 5 feature flags exist
- ✅ PM2 status shows "online"
- ✅ Admin login works
- ✅ HTTPS accessible externally
- ✅ SSL certificate valid (if using Let's Encrypt)
- ✅ PowerShell test passes
- ✅ No errors in PM2 logs
- ✅ All validation tests pass (Step 12)

**Estimated Total Time**: 60-90 minutes for experienced admin, 2-3 hours for first-time deployment

---

**Last Tested**: November 15, 2025
**Server**: ucrmanager01.westus3.cloudapp.azure.com
**Status**: ✅ Successful deployment
