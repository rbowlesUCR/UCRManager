# START HERE - UCRManager Deployment Status
**Date:** October 31, 2025
**Server:** Windows Server 2025
**Domain:** ucrmanager.westus3.cloudapp.azure.com
**Public IP:** 20.168.122.70

---

## ✅ WHAT'S WORKING

### HTTPS/SSL Certificate
- ✅ Let's Encrypt certificate installed and working
- ✅ Domain: ucrmanager.westus3.cloudapp.azure.com
- ✅ Certificate expires: January 29, 2026
- ✅ Auto-renewal configured (Win-ACME scheduled task)
- ✅ Certificate location: `C:\inetpub\wwwroot\UCRManager\certificates\`
  - ucrmanager.westus3.cloudapp.azure.com-crt.pem
  - ucrmanager.westus3.cloudapp.azure.com-key.pem
  - ucrmanager.westus3.cloudapp.azure.com-chain-only.pem

### Application
- ✅ Application built and deployed
- ✅ Backend running on port 443 with HTTPS
- ✅ Frontend built with esbuild (in dist/public/)
- ✅ PM2 process manager configured with auto-startup
- ✅ Database: PostgreSQL 16 (local)
- ✅ Admin user created: username='admin', password='admin123'
- ✅ Operator config created with Azure AD details

### Database
- ✅ PostgreSQL 16 installed locally
- ✅ Database name: ucrmanager
- ✅ Username: postgres
- ✅ Password: 4FC4E215649C6EBF3A390BAFE4B2ECD7
- ✅ Connection: localhost:5432

---

## 🔧 CRITICAL FILES & LOCATIONS

### Application Files
```
C:\inetpub\wwwroot\UCRManager\
├── .env                          # Environment variables
├── dist\
│   ├── index.js                  # Built backend
│   └── public\
│       ├── index.html            # Frontend HTML
│       ├── assets\
│       │   ├── main.js           # Frontend bundle
│       │   └── main.css          # Frontend styles
│       └── favicon.png
├── server\
│   ├── index.ts                  # Backend source
│   ├── db.ts                     # Database config (FIXED: uses pg driver)
│   └── https-config.ts           # HTTPS cert loading
├── certificates\                 # SSL PEM files
└── package.json
```

### Configuration Files
- **Environment:** `C:\inetpub\wwwroot\UCRManager\.env`
- **Win-ACME Settings:** `C:\win-acme\settings.json`
- **PM2 Config:** `C:\Users\absolute-phillyrally\.pm2\dump.pm2`
- **PM2 Startup:** Uses invisible.vbs to prevent terminal windows from showing

---

## 🔑 IMPORTANT CREDENTIALS

### Database
- **User:** postgres
- **Password:** 4FC4E215649C6EBF3A390BAFE4B2ECD7
- **Database:** ucrmanager
- **Port:** 5432

### Admin Login
- **Username:** admin
- **Password:** admin123
- **⚠️ CHANGE THIS PASSWORD ASAP**

### Azure AD Operator Config
- **Tenant ID:** 905655b8-88f2-4fc8-9474-a4f2b0283b03
- **Client ID:** 84592808-09ee-4f20-9f92-c65f45f6451b
- **Redirect URI:** https://ucrmanager.westus3.cloudapp.azure.com/api/auth/callback

### Session Secret
```
SESSION_SECRET=qMLFVOwVd5VXQfIzgfMBZFjfpoQAZ4qbTz++VZJIcpfoHOb6dxbgqh/n4OyOaLN4
```

---

## 📝 ENVIRONMENT VARIABLES (.env)

Current configuration in `C:\inetpub\wwwroot\UCRManager\.env`:
```env
DATABASE_URL=postgresql://postgres:4FC4E215649C6EBF3A390BAFE4B2ECD7@localhost:5432/ucrmanager
SESSION_SECRET=qMLFVOwVd5VXQfIzgfMBZFjfpoQAZ4qbTz++VZJIcpfoHOb6dxbgqh/n4OyOaLN4
NODE_ENV=production
PORT=443
```

**Note:** NODE_ENV is set to 'production' to serve built static files. The development value would cause Vite dev server to run, which fails in production.

---

## 🚀 HOW TO START/RESTART APPLICATION

### Check Status
```powershell
pm2 status
pm2 logs ucrmanager --lines 20
```

### Restart Application
```powershell
cd C:\inetpub\wwwroot\UCRManager
pm2 restart ucrmanager
```

### Rebuild Backend Only
```powershell
cd C:\inetpub\wwwroot\UCRManager
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
pm2 restart ucrmanager
```

### Rebuild Frontend (if needed)
```powershell
cd C:\inetpub\wwwroot\UCRManager
# Step 1: Build CSS with Tailwind
npx tailwindcss -i ./client/src/index.css -o ./dist/public/assets/main.css --minify
# Step 2: Build JavaScript with esbuild
npx esbuild client/src/main.tsx --bundle --outdir=dist/public/assets --minify --sourcemap --loader:.tsx=tsx --loader:.ts=ts --loader:.png=file --loader:.svg=dataurl --alias:@=client/src --jsx=automatic --jsx-import-source=react
```

### Rebuild Everything from Scratch
```powershell
cd C:\inetpub\wwwroot\UCRManager
# Backend
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
# Frontend CSS (Tailwind)
npx tailwindcss -i ./client/src/index.css -o ./dist/public/assets/main.css --minify
# Frontend JavaScript (esbuild)
npx esbuild client/src/main.tsx --bundle --outdir=dist/public/assets --minify --sourcemap --loader:.tsx=tsx --loader:.ts=ts --loader:.png=file --loader:.svg=dataurl --alias:@=client/src --jsx=automatic --jsx-import-source=react
# Restart
pm2 restart ucrmanager
```

---

## 🔍 TROUBLESHOOTING

### Application Not Starting
```powershell
pm2 logs ucrmanager --lines 50
```

### Database Connection Issues
```powershell
$env:PGPASSWORD='4FC4E215649C6EBF3A390BAFE4B2ECD7'
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager -c "SELECT * FROM admin_users;"
```

### Certificate Issues
Check certificate files exist:
```powershell
Get-ChildItem C:\inetpub\wwwroot\UCRManager\certificates
```

Check certificate in Windows store:
```powershell
Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Subject -like "*ucrmanager*" }
```

### HTTPS Not Working
1. Check certificate files exist in `C:\inetpub\wwwroot\UCRManager\certificates\`
2. Check PM2 logs for certificate loading errors
3. Verify port 443 is open in Azure NSG
4. Test: `curl https://ucrmanager.westus3.cloudapp.azure.com`

---

## 🐛 KNOWN ISSUES & FIXES

### Issue 1: Frontend Build Runs Out of Memory
**Problem:** `npm run build` fails with "out of memory" error
**Solution:** Use esbuild directly instead of Vite (see rebuild commands above)

### Issue 2: Database Driver Issue (FIXED)
**Problem:** Application was using Neon serverless driver (for Linux/Replit)
**Fix Applied:** Changed `server/db.ts` to use standard `pg` driver
```typescript
import pg from 'pg';
const { Pool } = pg;
```

### Issue 3: Windows Socket Error (FIXED)
**Problem:** `reusePort: true` not supported on Windows
**Fix Applied:** Removed reusePort option from server/index.ts

### Issue 4: Non-Exportable Certificate (FIXED)
**Problem:** Initial certificate had non-exportable private key
**Fix Applied:** Recreated certificate with exportable key, exported as PEM files

---

## 🔐 FIREWALL & NETWORK

### Azure NSG Rules (Required)
- **Port 443** (HTTPS) - OPEN - Required for application access
- **Port 80** (HTTP) - OPEN - Required for Let's Encrypt renewals
- **Port 5432** (PostgreSQL) - CLOSED - Local only

### Optional Cleanup
- Port 5000 - Can be closed (was used during development)

---

## 📋 TODO / NEXT STEPS

### High Priority
1. **Test the website** - Visit https://ucrmanager.westus3.cloudapp.azure.com
2. **Change admin password** from 'admin123' to something secure
3. **Update Azure AD App Registration** - Add redirect URI in Azure Portal:
   - https://ucrmanager.westus3.cloudapp.azure.com/api/auth/callback
4. **Test operator Microsoft login** after updating Azure AD

### Medium Priority
5. Remove port 80 from Azure NSG after confirming Let's Encrypt auto-renewal works
6. Close port 5000 in Azure NSG (no longer needed)
7. Configure database backups
8. Set up monitoring/alerting

### Low Priority
9. Optimize build process to work with less memory
10. Consider switching to production NODE_ENV if memory issues resolved

---

## 🔄 SSL CERTIFICATE RENEWAL

Win-ACME is configured to automatically renew certificates:
- **Renewal Task:** Windows Task Scheduler
- **Task Name:** "win-acme renew (acme-v02.api.letsencrypt.org)"
- **Schedule:** Daily at 9:00 AM
- **Next Renewal:** After December 25, 2025

### Manual Renewal (if needed)
```powershell
cd C:\win-acme
.\wacs.exe --renew --id oLQrJdGbVUCposv7bnm56Q
```

---

## 🗄️ DATABASE COMMANDS

### Connect to Database
```powershell
$env:PGPASSWORD='4FC4E215649C6EBF3A390BAFE4B2ECD7'
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager
```

### View Tables
```sql
\dt
```

### View Admin Users
```sql
SELECT * FROM admin_users;
```

### View Operator Config
```sql
SELECT * FROM operator_config;
```

### View Customer Tenants
```sql
SELECT * FROM customer_tenants;
```

---

## 📞 APPLICATION URLS

- **Main Application:** https://ucrmanager.westus3.cloudapp.azure.com
- **Admin Login:** https://ucrmanager.westus3.cloudapp.azure.com/admin/login
- **Operator Login:** https://ucrmanager.westus3.cloudapp.azure.com/auth/login

---

## 🔧 KEY FIXES APPLIED DURING DEPLOYMENT

1. **Database Driver:** Switched from Neon serverless to standard pg driver
2. **Windows Socket:** Removed reusePort option (not supported on Windows)
3. **Cookie Security:** Adjusted NODE_ENV for session cookies
4. **SSL Certificate:** Recreated with exportable private key as PEM files
5. **Frontend Build:** Used esbuild + Tailwind CLI instead of Vite to avoid memory issues
6. **HTTPS Configuration:** Created server/https-config.ts to load PEM certificates
7. **Terminal Windows:** PM2 startup now uses invisible.vbs to prevent terminal windows from appearing on boot
8. **NODE_ENV Fix:** Changed from 'development' to 'production' to serve static files instead of using Vite dev server
9. **JSX Runtime:** Added `--jsx=automatic --jsx-import-source=react` to esbuild to fix "React is not defined" error
10. **CSS Compilation:** Added separate Tailwind CSS compilation step to process Tailwind directives

---

## 📚 DOCUMENTATION FILES

- `DEPLOYMENT_SUMMARY.md` - Full deployment history
- `TROUBLESHOOTING.md` - Detailed troubleshooting guide
- `QUICK_REFERENCE.md` - Quick command reference
- `SETUP_SSL_CERTIFICATE.md` - SSL setup instructions
- `CURRENT_STATUS_2025-10-31.md` - Status snapshot

---

## 💡 IMPORTANT NOTES

1. **Memory Issues:** This server has limited RAM. Avoid running full `npm run build`. Use esbuild directly.
2. **PM2 Auto-Start:** PM2 is configured to start on boot via invisible.vbs (no terminal windows). Application will automatically restart after reboot.
3. **Database:** PostgreSQL runs as a Windows service and starts automatically.
4. **Certificates:** Let's Encrypt certificates auto-renew via Win-ACME scheduled task.
5. **NODE_ENV:** Set to 'production' to serve built static files instead of using Vite dev server.

---

## 🚨 IF SOMETHING BREAKS

1. Check PM2 logs: `pm2 logs ucrmanager`
2. Check if PostgreSQL is running: `Get-Service -Name postgresql-x64-16`
3. Restart application: `pm2 restart ucrmanager`
4. Restart PostgreSQL: `Restart-Service -Name postgresql-x64-16`
5. Check firewall rules in Azure Portal
6. Verify certificate files exist in certificates folder

---

## 📝 VERSION INFO

- **Node.js:** v24.11.0
- **npm:** 11.6.1
- **PostgreSQL:** 16
- **PM2:** Latest (installed globally)
- **Win-ACME:** 2.2.9.1701
- **OS:** Windows Server 2025

---

**Last Updated:** October 31, 2025
**Status:** Application deployed and running with HTTPS on port 443
**Access:** https://ucrmanager.westus3.cloudapp.azure.com
