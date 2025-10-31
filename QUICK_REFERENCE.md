# UCRManager Quick Reference Guide

**Server:** UCManagerv2 | **Application:** Teams Voice Manager | **Port:** 5000

---

## 🚀 Quick Start Commands

### Check Application Status
```bash
pm2 status
```

### View Logs
```bash
pm2 logs ucrmanager
```

### Restart Application
```bash
pm2 restart ucrmanager
```

### Stop Application
```bash
pm2 stop ucrmanager
```

---

## 🌐 Access URLs

### Local Access (From Server)
```
http://localhost:5000
http://172.17.0.4:5000
http://UCManagerv2:5000
```

### External Access
```
http://[your-public-ip]:5000
```
⚠️ **Requires Azure NSG configuration** - See troubleshooting guide

### Application Endpoints
- **Homepage:** /
- **Operator Login:** /login
- **Admin Panel:** /admin-login
- **API Base:** /api

---

## 📂 Important Paths

```
Application Root:     C:\inetpub\wwwroot\UCRManager
Configuration File:   C:\inetpub\wwwroot\UCRManager\.env
Built Application:    C:\inetpub\wwwroot\UCRManager\dist
PM2 Logs:            C:\Users\absolute-phillyrally\.pm2\logs
PostgreSQL:          C:\Program Files\PostgreSQL\16
Database Backups:    C:\UCRManager-Backups (recommended location)
```

---

## 🔄 Common Tasks

### Update Application from GitHub
```bash
cd C:\inetpub\wwwroot\UCRManager
git pull origin main
npm install
npm run build
pm2 restart ucrmanager
```

### View Application Logs (Last 50 Lines)
```bash
pm2 logs ucrmanager --lines 50 --nostream
```

### Check if Port 5000 is Listening
```powershell
powershell -Command "Get-NetTCPConnection -LocalPort 5000"
```

### Test Local HTTP Connection
```bash
curl http://localhost:5000
```

### Rebuild Application
```bash
cd C:\inetpub\wwwroot\UCRManager
npm run build
pm2 restart ucrmanager
```

### Clear PM2 Logs
```bash
pm2 flush
```

---

## 🗄️ Database Operations

### Connect to Database
```bash
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager
```

### List All Tables
```bash
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager -c "\dt"
```

### Backup Database
```bash
"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres -d ucrmanager -F c -f "C:\UCRManager-Backups\ucrmanager_%date%.backup"
```

### Run Migrations
```bash
cd C:\inetpub\wwwroot\UCRManager
npm run db:push
```

### Check PostgreSQL Service
```powershell
powershell -Command "Get-Service postgresql-x64-16"
```

---

## 🔥 Firewall Commands

### Check Firewall Rule
```powershell
powershell -Command "Get-NetFirewallRule -DisplayName 'UCRManager*'"
```

### Add Firewall Rule (if missing)
```powershell
powershell -Command "New-NetFirewallRule -DisplayName 'UCRManager HTTP Port 5000' -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow"
```

---

## 🔧 Configuration

### Environment Variables (.env)
```env
DATABASE_URL=postgresql://postgres:4FC4E215649C6EBF3A390BAFE4B2ECD7@localhost:5432/ucrmanager
SESSION_SECRET=qMLFVOwVd5VXQfIzgfMBZFjfpoQAZ4qbTz++VZJIcpfoHOb6dxbgqh/n4OyOaLN4
NODE_ENV=production
PORT=5000
```

### Database Connection Details
```
Host: localhost
Port: 5432
Database: ucrmanager
User: postgres
Password: 4FC4E215649C6EBF3A390BAFE4B2ECD7
```

---

## 🚨 Troubleshooting Quick Checks

### Application Won't Start
```bash
# Check PM2 status
pm2 status

# View errors
pm2 logs ucrmanager --err --lines 50

# Try manual start to see errors
cd C:\inetpub\wwwroot\UCRManager
node --env-file=.env dist/index.js
```

### Cannot Access Externally
```bash
# 1. Verify app is running
pm2 status

# 2. Test local access
curl http://localhost:5000

# 3. Check firewall
powershell -Command "Get-NetFirewallRule -DisplayName 'UCRManager*'"

# 4. Most common: Check Azure NSG in portal
#    Go to: VM → Networking → Add inbound port rule for 5000
```

### Database Connection Failed
```bash
# Check PostgreSQL service
powershell -Command "Get-Service postgresql-x64-16"

# Start if stopped
powershell -Command "Start-Service postgresql-x64-16"

# Test connection
PGPASSWORD=4FC4E215649C6EBF3A390BAFE4B2ECD7 "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager
```

---

## 📊 Monitoring

### Real-time Process Monitor
```bash
pm2 monit
```
Press Ctrl+C to exit

### View CPU and Memory Usage
```bash
pm2 status
```

### Check System Resources
```powershell
powershell -Command "Get-Process node | Select-Object ProcessName, CPU, WorkingSet"
```

---

## 🔐 Security

### Generate New SESSION_SECRET
```powershell
powershell -Command "[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))"
```
Update in `.env` file and restart application

### Check Current User
```bash
whoami
```

### View Firewall Status
```powershell
powershell -Command "Get-NetFirewallProfile | Select-Object Name, Enabled"
```

---

## 📦 PM2 Management

### Save Current PM2 Processes
```bash
pm2 save
```

### List All PM2 Processes
```bash
pm2 list
```

### Delete Process from PM2
```bash
pm2 delete ucrmanager
```

### Re-add Process to PM2
```bash
cd C:\inetpub\wwwroot\UCRManager
pm2 start dist/index.js --name "ucrmanager" --node-args="--env-file=.env"
pm2 save
```

### Check PM2 Startup Configuration
```bash
pm2 startup
```

---

## 🌟 Pro Tips

### View Logs in Separate Terminal
```bash
# Terminal 1: Monitor logs
pm2 logs ucrmanager

# Terminal 2: Work normally
```

### Search Logs for Specific Error
```bash
pm2 logs ucrmanager --lines 1000 --nostream | grep -i "error"
```

### Quick Health Check
```bash
pm2 status && curl -I http://localhost:5000
```

### Get Server Info
```bash
echo "Server: $(hostname)" && echo "IP: $(ipconfig | grep 'IPv4' | head -1)"
```

---

## 🔗 Useful Links

- **Repository:** https://github.com/rbowlesUCR/UCRManager
- **Issues:** https://github.com/rbowlesUCR/UCRManager/issues
- **Azure Portal:** https://portal.azure.com

---

## 📖 Full Documentation

- `DEPLOYMENT_SUMMARY.md` - Complete deployment record
- `TROUBLESHOOTING.md` - Detailed debugging guide
- `QUICK_REFERENCE.md` - This file

---

**Application:** UCRManager v1.0.0
**Server:** UCManagerv2
**OS:** Windows Server 2025
**Last Updated:** October 31, 2025
