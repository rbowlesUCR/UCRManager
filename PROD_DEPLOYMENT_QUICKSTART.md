# Production Deployment Quick Start - November 15, 2025

## For Production Claude: TL;DR

**What**: Deploy ConnectWise work role selection + phone number management enhancements
**Where**: Production server 20.168.122.70
**Risk**: LOW (no DB changes, additive features only, fully tested)
**Downtime**: ~2 minutes

## The Commands (Copy/Paste Ready)

```powershell
# 1. Navigate to app
cd C:\inetpub\wwwroot\UCRManager

# 2. Create backup
git branch backup-before-nov-15-deploy

# 3. Stop app
pm2 stop ucrmanager01

# 4. Pull latest code
git checkout main
git pull origin main

# 5. Build
npm run build

# 6. Start app
pm2 start ucrmanager01

# 7. Verify
pm2 logs ucrmanager01--lines 50
```

## Expected Results

**After git pull**:
- ~68 files changed
- Should pull to commit `2a8902e` or later
- Shows "Fast-forward" merge

**After npm run build**:
- Vite builds in ~8-9 seconds
- esbuild builds in ~50ms
- No errors

**After pm2 start**:
- Status shows "online"
- Logs show "serving on port 443 (HTTPS)"

## Quick Verification

1. Browse to https://20.168.122.70
2. Login as admin
3. Dashboard → Select tenant → Select user → Enter ticket number
4. **Success**: See "Select Work Role" dropdown below status
5. Number Management → Click "Customize Columns"
6. **Success**: Panel opens with column options

## If Something Goes Wrong

```powershell
# Rollback
pm2 stop ucrmanager01
git checkout backup-before-nov-15-deploy
npm run build
pm2 start ucrmanager01
```

## What This Deployment Adds

1. **Work Role Selection**: Operators can select billing rate for ConnectWise time entries
2. **Column Customization**: Show/hide/reorder columns in number inventory
3. **Number History**: Auto-track phone number assignments in notes

## Files You'll See Changed

Key files:
- `server/connectwise.ts` - Work roles API
- `server/routes.ts` - New endpoints
- `client/src/pages/dashboard.tsx` - Work role UI
- `client/src/pages/number-management.tsx` - Column customization

## Database Impact

**NONE** - No migrations needed, no schema changes.

## Read Full Details

See `HANDOFF_TO_PROD_CLAUDE_NOV15.md` for complete context, troubleshooting, and testing procedures.

---

**Ready to deploy?** Just run the commands above on the production server.
