# UCRManager Troubleshooting Guide
**Server:** UCManagerv2 (Windows Server 2025)
**Application:** Teams Voice Manager (UCRManager)

---

## 📋 Table of Contents
1. [Quick Health Check](#quick-health-check)
2. [Cannot Access Application Externally](#cannot-access-application-externally)
3. [Application Not Starting](#application-not-starting)
4. [Database Connection Issues](#database-connection-issues)
5. [PM2 Process Management Issues](#pm2-process-management-issues)
6. [Azure AD Authentication Issues](#azure-ad-authentication-issues)
7. [Performance Issues](#performance-issues)
8. [Debugging Commands Reference](#debugging-commands-reference)

---

## 🏥 Quick Health Check

Run these commands to check overall system health:

### 1. Check Application Status
```bash
pm2 status
```
**Expected output:** Status should be "online", restart count (↺) should be low

### 2. Check Application Logs
```bash
pm2 logs ucrmanager --lines 50
```
**What to look for:** No error messages, should see "serving on port 5000"

### 3. Check Port Binding
```powershell
powershell -Command "Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue"
```
**Expected output:** Should show port 5000 in LISTEN state

### 4. Test Local Connection
```bash
curl -I http://localhost:5000
```
**Expected output:** HTTP/1.1 200 OK

### 5. Check Database Connection
```bash
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager -c "\dt"
```
**Expected output:** List of tables (admin_users, customer_tenants, audit_logs, etc.)

---

## 🌐 Cannot Access Application Externally

### Symptom
- Application works locally (`http://localhost:5000`)
- Cannot access from external IP
- Browser shows "Connection refused" or timeout

### Diagnosis Steps

#### Step 1: Verify Application is Running
```bash
pm2 status
```
If status is not "online", see [Application Not Starting](#application-not-starting)

#### Step 2: Verify Port is Listening
```powershell
powershell -Command "Get-NetTCPConnection -LocalPort 5000"
```
**Expected:** LocalAddress 0.0.0.0, State Listen

If not listening on 0.0.0.0, check application configuration.

#### Step 3: Test Local Access
```bash
curl http://localhost:5000
```
If this fails, the application has an internal issue. Check logs:
```bash
pm2 logs ucrmanager --lines 100
```

#### Step 4: Check Windows Firewall
```powershell
powershell -Command "Get-NetFirewallRule -DisplayName 'UCRManager*'"
```
**Expected:** Enabled=True, Direction=Inbound, Action=Allow

If rule is missing:
```powershell
powershell -Command "New-NetFirewallRule -DisplayName 'UCRManager HTTP Port 5000' -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow"
```

#### Step 5: Check All Firewall Profiles
```powershell
powershell -Command "Get-NetFirewallProfile | Select-Object Name, Enabled"
```
All profiles (Domain, Private, Public) should be Enabled.

#### Step 6: Get Server IP Address
```bash
ipconfig | grep -A 3 "IPv4"
```
**Note the IP address** (e.g., 172.17.0.4 or 10.x.x.x)

#### Step 7: Check Azure Network Security Group (NSG) - **MOST COMMON ISSUE**

**Problem:** Azure NSG blocks inbound traffic by default

**Solution:**
1. Go to **Azure Portal** (https://portal.azure.com)
2. Navigate to: **Virtual Machines** → **UCManagerv2** → **Networking**
3. Click **Network Security Group** name
4. Go to **Inbound security rules**
5. Check if port 5000 is allowed

**If port 5000 rule doesn't exist:**
1. Click **Add** (+ Add inbound port rule)
2. Configure:
   ```
   Source: Any (or specific IP for security)
   Source port ranges: *
   Destination: Any
   Service: Custom
   Destination port ranges: 5000
   Protocol: TCP
   Action: Allow
   Priority: 1000
   Name: AllowPort5000
   ```
3. Click **Add**
4. Wait 1-2 minutes for Azure to apply
5. Test: `http://[your-public-ip]:5000`

#### Step 8: Get Public IP Address
In Azure Portal:
1. Go to **Virtual Machines** → **UCManagerv2**
2. Find **Public IP address** in Overview section
3. Test in browser: `http://[public-ip]:5000`

### Additional Network Diagnostics

#### Test from Server to Itself (External IP)
```bash
curl http://172.17.0.4:5000
```

#### Check Network Interface Status
```powershell
powershell -Command "Get-NetAdapter | Select-Object Name, Status, LinkSpeed"
```

#### Flush DNS Cache (if hostname not resolving)
```powershell
powershell -Command "Clear-DnsClientCache"
```

---

## 🚫 Application Not Starting

### Symptom
- PM2 shows status as "errored" or "stopped"
- High restart count (↺ > 5)
- Application crashes immediately after start

### Diagnosis Steps

#### Step 1: Check PM2 Status
```bash
pm2 status
```
Note the restart count and status.

#### Step 2: View Error Logs
```bash
pm2 logs ucrmanager --err --lines 50
```

#### Step 3: Common Errors and Solutions

##### Error: "Cannot find module"
**Cause:** Dependencies not installed
**Solution:**
```bash
cd C:\inetpub\wwwroot\UCRManager
npm install
pm2 restart ucrmanager
```

##### Error: "EADDRINUSE: address already in use"
**Cause:** Port 5000 already in use
**Solution:**
```powershell
# Find process using port 5000
powershell -Command "Get-NetTCPConnection -LocalPort 5000 | Select-Object OwningProcess"

# Kill process (replace PID with actual process ID)
taskkill /F /PID [PID]

# Or change port in .env file
# Edit C:\inetpub\wwwroot\UCRManager\.env
# Change PORT=5000 to PORT=5001
pm2 restart ucrmanager
```

##### Error: "DATABASE_URL is not defined"
**Cause:** .env file missing or not loaded
**Solution:**
```bash
# Check .env file exists
ls C:\inetpub\wwwroot\UCRManager\.env

# If missing, recreate it (see DEPLOYMENT_SUMMARY.md)
# Then restart
pm2 restart ucrmanager
```

##### Error: "Connection refused" to database
**Cause:** PostgreSQL not running
**Solution:**
```powershell
# Check PostgreSQL service
powershell -Command "Get-Service -Name postgresql*"

# If stopped, start it
powershell -Command "Start-Service postgresql-x64-16"

# Restart application
pm2 restart ucrmanager
```

##### Error: "listen ENOTSUP"
**Cause:** Windows incompatibility (reusePort option)
**Solution:** This should already be fixed. If it appears:
```bash
cd C:\inetpub\wwwroot\UCRManager
git pull origin main  # Get latest Windows-compatible code
npm run build
pm2 restart ucrmanager
```

#### Step 4: Try Manual Start (for debugging)
```bash
cd C:\inetpub\wwwroot\UCRManager
node --env-file=.env dist/index.js
```
This runs the app directly and shows errors in console.

Press Ctrl+C to stop, then restart with PM2:
```bash
pm2 start dist/index.js --name "ucrmanager" --node-args="--env-file=.env"
```

---

## 🗄️ Database Connection Issues

### Symptom
- Application starts but cannot query database
- Errors mentioning "connection refused" or "authentication failed"

### Diagnosis Steps

#### Step 1: Check PostgreSQL Service
```powershell
powershell -Command "Get-Service postgresql-x64-16"
```
**Expected:** Status = Running

If stopped:
```powershell
powershell -Command "Start-Service postgresql-x64-16"
```

#### Step 2: Test Direct Connection
```bash
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -d ucrmanager
```
**Expected:** PostgreSQL prompt (ucrmanager=#)

If connection fails:
- Check password in .env file matches
- Verify database exists: `\l` command in psql
- Check pg_hba.conf allows local connections

#### Step 3: Verify Database Exists
```bash
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -l | grep ucrmanager
```
**Expected:** Shows ucrmanager database

If database doesn't exist:
```bash
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE ucrmanager;"
cd C:\inetpub\wwwroot\UCRManager
npm run db:push
pm2 restart ucrmanager
```

#### Step 4: Check Database Schema
```bash
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager -c "\dt"
```
**Expected:** List of tables

If no tables:
```bash
cd C:\inetpub\wwwroot\UCRManager
npm run db:push
pm2 restart ucrmanager
```

#### Step 5: Check .env DATABASE_URL
```bash
grep DATABASE_URL C:\inetpub\wwwroot\UCRManager\.env
```
**Expected format:**
```
DATABASE_URL=postgresql://postgres:4FC4E215649C6EBF3A390BAFE4B2ECD7@localhost:5432/ucrmanager
```

---

## 🔄 PM2 Process Management Issues

### PM2 Not Starting on Boot

#### Verify Startup Configuration
```bash
pm2 startup
```
Should show: "PM2 startup already set"

If not configured:
```bash
pm2-startup install
pm2 save
```

#### Check Windows Registry Entry
```powershell
powershell -Command "Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run' | Select-Object pm2"
```

### PM2 Command Not Found After Reboot

**Cause:** PATH not updated globally
**Solution:**
1. Close all terminals
2. Open new PowerShell/CMD as Administrator
3. Try: `pm2 status`

If still not found:
```bash
# Add to PATH manually
$env:PATH += ";C:\Users\absolute-phillyrally\AppData\Roaming\npm"
```

### Cannot Save PM2 Process List

#### Error: "pm2 save" fails
**Solution:**
```bash
# Delete old dump file
rm C:\Users\absolute-phillyrally\.pm2\dump.pm2

# Resave
pm2 save
```

### High Memory Usage

#### Check Memory per Process
```bash
pm2 monit
```
Press Ctrl+C to exit.

#### Restart to Clear Memory
```bash
pm2 restart ucrmanager
```

---

## 🔐 Azure AD Authentication Issues

### Cannot Login with Microsoft Account

#### Symptom
- Login button redirects but returns error
- "Invalid redirect URI" error

#### Solution

1. **Check Redirect URI in Azure AD:**
   - Azure Portal → Azure AD → App Registrations → [Your App]
   - Go to Authentication
   - Verify Redirect URI matches: `http://[your-ip]:5000/api/auth/callback`

2. **Check Operator Config in Admin Panel:**
   - Login to: http://localhost:5000/admin-login
   - Settings → Operator Azure AD Configuration
   - Verify:
     - Tenant ID is correct
     - Client ID is correct
     - Client Secret is valid (not expired)
     - Redirect URI matches Azure AD

3. **Re-enter Credentials:**
   - SESSION_SECRET changed from Replit deployment
   - Need to re-enter Azure credentials in admin panel
   - They will be re-encrypted with new SESSION_SECRET

### "SESSION_SECRET not set" Error

**Cause:** .env file missing SESSION_SECRET
**Solution:**
```bash
# Generate new secret
powershell -Command "[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))"

# Add to .env file
# SESSION_SECRET=[generated value]

# Restart
pm2 restart ucrmanager
```

### API Permissions Missing

**Symptom:** Cannot fetch users or assign policies

**Required Permissions (Application):**
- User.Read.All
- TeamsUserConfiguration.Read.All
- TeamworkPolicy.ReadWrite.All

**Solution:**
1. Azure Portal → Azure AD → App Registrations → [Your App]
2. API Permissions → Add a permission → Microsoft Graph
3. Application permissions → Add above permissions
4. **Grant admin consent** (critical!)

---

## 🐌 Performance Issues

### Slow Response Times

#### Check CPU and Memory
```bash
pm2 monit
```

#### Check Database Connections
```bash
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager -c "SELECT count(*) FROM pg_stat_activity;"
```

#### Clear PM2 Logs (if very large)
```bash
pm2 flush
```

#### Restart Application
```bash
pm2 restart ucrmanager
```

### Database Query Performance

#### Check Slow Queries
```bash
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager -c "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

#### Vacuum Database
```bash
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager -c "VACUUM ANALYZE;"
```

---

## 🛠️ Debugging Commands Reference

### Application Debugging

#### View All Logs (Real-time)
```bash
pm2 logs ucrmanager
```

#### View Only Errors
```bash
pm2 logs ucrmanager --err
```

#### View Specific Number of Lines
```bash
pm2 logs ucrmanager --lines 100
```

#### Clear All Logs
```bash
pm2 flush
```

#### Restart Application
```bash
pm2 restart ucrmanager
```

#### Stop Application
```bash
pm2 stop ucrmanager
```

#### Delete Application from PM2
```bash
pm2 delete ucrmanager
```

#### Start Fresh
```bash
pm2 delete ucrmanager
cd C:\inetpub\wwwroot\UCRManager
pm2 start dist/index.js --name "ucrmanager" --node-args="--env-file=.env"
pm2 save
```

### Network Debugging

#### Show All Listening Ports
```powershell
powershell -Command "Get-NetTCPConnection -State Listen | Select-Object LocalAddress, LocalPort, OwningProcess | Sort-Object LocalPort"
```

#### Show Port 5000 Specifically
```powershell
powershell -Command "Get-NetTCPConnection -LocalPort 5000"
```

#### Test HTTP Response
```bash
curl -v http://localhost:5000
```

#### Test with Headers
```bash
curl -I http://localhost:5000
```

#### Show Network Adapters
```powershell
powershell -Command "Get-NetAdapter"
```

#### Show IP Configuration
```bash
ipconfig /all
```

### Firewall Debugging

#### List All Firewall Rules
```powershell
powershell -Command "Get-NetFirewallRule | Where-Object {$_.DisplayName -like '*UCR*'}"
```

#### Show Firewall Rule Details
```powershell
powershell -Command "Get-NetFirewallRule -DisplayName 'UCRManager HTTP Port 5000' | Get-NetFirewallPortFilter"
```

#### Disable Firewall (TEMPORARILY for testing)
```powershell
powershell -Command "Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False"
```

#### Re-enable Firewall (IMPORTANT!)
```powershell
powershell -Command "Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True"
```

### Database Debugging

#### Check PostgreSQL Service
```powershell
powershell -Command "Get-Service postgresql*"
```

#### Start PostgreSQL
```powershell
powershell -Command "Start-Service postgresql-x64-16"
```

#### Stop PostgreSQL
```powershell
powershell -Command "Stop-Service postgresql-x64-16"
```

#### Connect to Database
```bash
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager
```

#### List All Databases
```bash
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "\l"
```

#### List All Tables
```bash
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager -c "\dt"
```

#### Check Table Row Counts
```bash
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager -c "SELECT schemaname,relname,n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"
```

#### Backup Database
```bash
"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres -d ucrmanager -F c -f "C:\UCRManager-Backups\ucrmanager_%date%.backup"
```

#### Restore Database
```bash
"C:\Program Files\PostgreSQL\16\bin\pg_restore.exe" -U postgres -d ucrmanager -c "C:\UCRManager-Backups\ucrmanager_[date].backup"
```

### System Information

#### Get Server Hostname
```bash
hostname
```

#### Get Current User
```bash
whoami
```

#### Check Disk Space
```bash
df -h
```

#### Check System Uptime
```bash
uptime
```

#### Check Node Version
```bash
node --version
```

#### Check npm Version
```bash
npm --version
```

#### Check PM2 Version
```bash
pm2 --version
```

---

## 🆘 Emergency Recovery

### Complete Application Reset

If everything is broken and you need to start fresh:

```bash
# 1. Stop application
pm2 delete ucrmanager

# 2. Backup database (optional)
"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres -d ucrmanager -F c -f "C:\ucrmanager_backup.dump"

# 3. Delete repository
cd C:\inetpub\wwwroot
rm -rf UCRManager

# 4. Re-clone
git clone https://github.com/rbowlesUCR/UCRManager.git
cd UCRManager

# 5. Install dependencies
npm install

# 6. Recreate .env file (see DEPLOYMENT_SUMMARY.md for contents)

# 7. Rebuild
npm run build

# 8. Restart with PM2
pm2 start dist/index.js --name "ucrmanager" --node-args="--env-file=.env"
pm2 save
```

### Database Recovery

```bash
# 1. Drop and recreate database
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "DROP DATABASE ucrmanager;"
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE ucrmanager;"

# 2. Restore from backup (if available)
"C:\Program Files\PostgreSQL\16\bin\pg_restore.exe" -U postgres -d ucrmanager -c "C:\ucrmanager_backup.dump"

# Or run migrations
cd C:\inetpub\wwwroot\UCRManager
npm run db:push

# 3. Restart application
pm2 restart ucrmanager
```

---

## 📞 Getting Help

If issues persist:

1. **Collect Debug Information:**
   ```bash
   pm2 status > debug_info.txt
   pm2 logs ucrmanager --lines 200 >> debug_info.txt
   ipconfig >> debug_info.txt
   ```

2. **Check GitHub Issues:** https://github.com/rbowlesUCR/UCRManager/issues

3. **Create New Issue** with:
   - Error messages from logs
   - Steps to reproduce
   - Debug information collected above
   - Windows Server version
   - Node.js version (`node --version`)

---

**Last Updated:** October 31, 2025
**Application Version:** 1.0.0
**Server:** UCManagerv2 (Windows Server 2025)
