# UCRManager - Production Deployment Quick Checklist

**For Detailed Instructions**: See `PRODUCTION_DEPLOYMENT_GUIDE.md`

---

## Pre-Deployment (Your Tasks)

### Server Provisioning
- [ ] Windows Server 2019+ provisioned
- [ ] 8+ GB RAM, 100+ GB disk space
- [ ] Internet connectivity established
- [ ] Remote access configured (RDP/SSH)

### Software Installation (Do This Before Claude Code Starts)
- [ ] **Node.js 18.x or 20.x** installed → Verify: `node --version`
- [ ] **PostgreSQL 16.x** installed → Note the password you set!
- [ ] **Git** installed → Verify: `git --version`
- [ ] **Administrator access** confirmed

### Access Setup
- [ ] Claude Code has access to terminal
- [ ] Firewall allows ports 80, 443, 5432
- [ ] PostgreSQL password documented

---

## Deployment (Claude Code Tasks)

### Phase 1: Clone & Setup (15 min)
- [ ] Clone repository from GitHub
- [ ] Checkout production branch
- [ ] Install npm dependencies
- [ ] Verify directory structure

### Phase 2: Database (15 min)
- [ ] Create `ucrmanager` database
- [ ] Run all 6 migration files
- [ ] Import country codes data
- [ ] Verify all tables created

### Phase 3: Configuration (10 min)
- [ ] Generate SESSION_SECRET
- [ ] Generate ENCRYPTION_KEY
- [ ] Create ecosystem.config.js or .env
- [ ] Configure DATABASE_URL

### Phase 4: Build & Deploy (15 min)
- [ ] Run `npm run build`
- [ ] Install PM2 globally
- [ ] Start application with PM2
- [ ] Configure PM2 startup script
- [ ] Verify app running

### Phase 5: Admin Setup (5 min)
- [ ] Create initial admin user
- [ ] Generate admin password hash
- [ ] Insert into database
- [ ] Test login

### Phase 6: SSL/Firewall (10 min)
- [ ] Configure HTTPS certificate
- [ ] Open firewall ports 80, 443
- [ ] Test HTTPS access
- [ ] Verify no certificate warnings (if proper cert)

---

## Post-Deployment (Your Tasks)

### Immediate Verification (5 min)
- [ ] Login as admin works
- [ ] Change default admin password
- [ ] Dashboard loads without errors
- [ ] Check PM2 logs for errors: `pm2 logs`

### Configuration (30 min)
- [ ] Enable feature flags (ConnectWise, 3CX)
- [ ] Create production tenants
- [ ] Add operator users
- [ ] Configure ConnectWise credentials (per tenant)
- [ ] Configure 3CX credentials (per tenant)
- [ ] Import phone numbers

### Backup Setup (15 min)
- [ ] Create backup directory
- [ ] Create backup script
- [ ] Schedule daily backups (Task Scheduler)
- [ ] Test backup/restore

### Security Hardening (15 min)
- [ ] Change PostgreSQL default password
- [ ] Enable Windows Firewall
- [ ] Restrict RDP access
- [ ] Review admin user permissions
- [ ] Enable MFA for admin users

### Monitoring (Ongoing)
- [ ] Monitor PM2 status: `pm2 status`
- [ ] Check logs: `pm2 logs ucrmanager-prod`
- [ ] Verify database connectivity
- [ ] Test core features (voice config, phone numbers)

---

## Migration Files Checklist

These will be run in order during deployment:

1. [ ] `migrations/0001_initial_schema.sql` - Core tables
2. [ ] `migrations/0002_feature_flags.sql` - Feature flag system
3. [ ] `migrations/0003_3cx_integration.sql` - 3CX credentials
4. [ ] `migrations/0004_country_codes.sql` - Country codes table
5. [ ] `migrations/add_country_codes.sql` - Country codes data
6. [ ] `migrations/0005_manual_phone_entry.sql` - Manual entry flag
7. [ ] `migrations/0006_connectwise_integration.sql` - ConnectWise tables

---

## Required Environment Variables

```env
# Will be configured during deployment
DATABASE_URL=postgresql://postgres:[PASSWORD]@localhost:5432/ucrmanager
SESSION_SECRET=[64_CHAR_RANDOM_STRING]
ENCRYPTION_KEY=[32_BYTE_BASE64_KEY]
NODE_ENV=production
PORT=443
```

---

## Quick Verification Commands

### After Deployment
```bash
# App status
pm2 status

# Recent logs
pm2 logs ucrmanager-prod --lines 50

# Database tables
PGPASSWORD='[PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager -c "\dt"

# Feature flags
PGPASSWORD='[PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager -c "SELECT * FROM feature_flags;"

# Admin users
PGPASSWORD='[PASSWORD]' "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager -c "SELECT username, is_local_admin FROM admin_users;"
```

---

## Rollback Plan (If Needed)

```bash
# Stop app
pm2 stop ucrmanager-prod

# Revert code
cd C:\inetpub\wwwroot\UCRManager
git log --oneline -10
git checkout [PREVIOUS_COMMIT]

# Rebuild
npm run build

# Restart
pm2 restart ucrmanager-prod
```

---

## Success Criteria

✅ Deployment successful when:
- [ ] PM2 shows app status: "online"
- [ ] No errors in PM2 logs
- [ ] Can access https://[SERVER_IP]
- [ ] Admin login works
- [ ] Dashboard loads
- [ ] Database has all tables
- [ ] Feature flags configurable

---

## Estimated Timeline

| Phase | Time | Who |
|-------|------|-----|
| Server provisioning | 30 min | You |
| Software installation | 30 min | You |
| Claude Code deployment | 60-90 min | Claude |
| Post-deployment config | 30-60 min | You |
| **Total** | **2.5-3.5 hours** | Both |

---

## When You're Ready

1. Provision the server
2. Install Node.js, PostgreSQL, Git
3. Connect Claude Code to the server terminal
4. Say: "Ready to deploy, here's the PostgreSQL password: [PASSWORD]"
5. Claude will handle the rest!

---

**Questions Before Starting?**
- Server specs OK?
- Software installed?
- Remote access working?
- PostgreSQL password noted?

**Let's do this! 🚀**
