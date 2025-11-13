# Rollback Guide - 3CX CRUD Operations

**Date**: November 13, 2025
**Feature Branch**: `feature/3cx-crud-operations`
**Commit**: `9bafd34`
**Previous Stable**: `main` branch at commit `c954697`

---

## 🚨 Quick Rollback (If Issues Found)

### Option 1: Switch Back to Main Branch (Fastest)

```bash
cd /c/inetpub/wwwroot/UCRManager

# Switch back to main branch
git checkout main

# Rebuild application
npm run build

# Restart server
pm2 restart ucrmanager

# Verify status
pm2 status
```

**Time**: ~2-3 minutes
**Impact**: Immediately reverts to previous stable version
**Data Loss**: None (database not affected)

### Option 2: Revert Specific Files (Partial Rollback)

If only certain files have issues:

```bash
cd /c/inetpub/wwwroot/UCRManager

# Revert frontend only
git checkout main -- client/src/pages/3cx-management.tsx

# OR revert backend only
git checkout main -- server/routes.ts

# Rebuild and restart
npm run build && pm2 restart ucrmanager
```

### Option 3: Delete Feature Branch (Nuclear Option)

If you want to completely remove the feature:

```bash
cd /c/inetpub/wwwroot/UCRManager

# Switch to main
git checkout main

# Delete feature branch locally
git branch -D feature/3cx-crud-operations

# If pushed to remote, delete there too
git push origin --delete feature/3cx-crud-operations

# Rebuild and restart
npm run build && pm2 restart ucrmanager
```

---

## 📋 What Changed (For Reference)

### Files Modified
1. **server/routes.ts** (+290 lines)
   - Lines 3983-4479: 3CX CRUD endpoints
   - Rollback: Removes POST/PATCH/DELETE endpoints for users and DIDs

2. **client/src/pages/3cx-management.tsx** (+714 lines)
   - Complete UI rewrite with dialogs and forms
   - Rollback: Returns to read-only view

### Files Created (Can be safely deleted)
1. **3CX_CRUD_IMPLEMENTATION.md** (+688 lines)
2. **SESSION_2025_11_13.md** (+336 lines)

### Database Changes
**NONE** - No database schema changes, no data migrations needed

---

## 🔍 Verifying Successful Rollback

After rollback, verify these things work:

```bash
# 1. Check application is running
pm2 status
# Should show: online

# 2. Check build logs for errors
pm2 logs ucrmanager --lines 50

# 3. Test basic functionality
# - Navigate to https://localhost/admin/3cx-management
# - Should show read-only view (no Add/Edit/Delete buttons)
# - Verify users and DIDs display correctly
```

---

## 🛡️ Safety Checks Before Rollback

### Check Current State

```bash
cd /c/inetpub/wwwroot/UCRManager

# What branch are you on?
git branch --show-current

# What are uncommitted changes?
git status

# What commits are on this branch?
git log main..HEAD --oneline
```

### Backup Current State (Optional)

If you want to preserve work before rollback:

```bash
# Create a backup branch
git branch backup/3cx-crud-$(date +%Y%m%d_%H%M%S)

# Or create a patch file
git diff main > /c/logs/3cx-crud-rollback-$(date +%Y%m%d_%H%M%S).patch
```

---

## 🔄 Step-by-Step Rollback Process

### Full Rollback Procedure

**Step 1: Check Current Status**
```bash
cd /c/inetpub/wwwroot/UCRManager
git status
pm2 status
```

**Step 2: Stash Any Uncommitted Changes (if needed)**
```bash
git stash save "Before rollback - 3CX CRUD"
```

**Step 3: Switch to Main Branch**
```bash
git checkout main
```

**Step 4: Verify You're on Main**
```bash
git branch --show-current
# Should output: main

git log --oneline -1
# Should show: c954697 Enhanced bulk edit dialog and fixed route ordering bug
```

**Step 5: Clean Build Directory**
```bash
rm -rf dist/
```

**Step 6: Rebuild Application**
```bash
npm run build
```

Expected output:
```
✓ built in ~2 minutes
Client: 799.82 kB
Server: 291.8 kB
```

**Step 7: Restart Server**
```bash
pm2 restart ucrmanager
```

**Step 8: Verify Application Started**
```bash
pm2 status
# Status should be: online
# Restarts should increment by 1
```

**Step 9: Check Logs for Errors**
```bash
pm2 logs ucrmanager --lines 50 --nostream
```

Look for:
- ✅ "Server listening on port 443"
- ❌ Any error messages

**Step 10: Test Web Interface**
```bash
# Open browser to https://localhost/admin/3cx-management
# Verify:
# - Page loads without errors
# - Users table shows data (read-only)
# - DIDs table shows data (read-only)
# - NO "Add User" or "Add DID" buttons (these are the new features)
```

---

## ⚠️ Common Issues During Rollback

### Issue 1: Build Fails After Checkout

**Symptom**: `npm run build` fails with errors

**Solution**:
```bash
# Clean node_modules and reinstall
rm -rf node_modules
rm package-lock.json
npm install
npm run build
```

### Issue 2: PM2 Won't Restart

**Symptom**: `pm2 restart` fails or shows error status

**Solution**:
```bash
# Stop and start instead of restart
pm2 stop ucrmanager
pm2 start ucrmanager

# Or delete and recreate
pm2 delete ucrmanager
pm2 start dist/index.js --name ucrmanager
```

### Issue 3: Application Shows Old Cached UI

**Symptom**: Browser still shows new UI after rollback

**Solution**:
```bash
# Hard refresh in browser
# Chrome/Edge: Ctrl + Shift + R
# Firefox: Ctrl + F5

# Or clear browser cache:
# Chrome: Settings → Privacy → Clear browsing data → Cached images and files
```

### Issue 4: Git Checkout Conflicts

**Symptom**: `git checkout main` shows conflicts

**Solution**:
```bash
# Force checkout (loses uncommitted changes)
git checkout main -f

# Or stash and checkout
git stash
git checkout main
```

---

## 📊 Rollback Decision Matrix

| Severity | Issue | Recommended Action | Time |
|----------|-------|-------------------|------|
| 🟢 Low | Minor UI bug | Fix in feature branch | ~15 min |
| 🟡 Medium | Feature not working | Switch to main, fix, retest | ~30 min |
| 🔴 High | Application crashes | Immediate rollback to main | ~5 min |
| ⚫ Critical | Database corruption | Rollback + restore DB backup | ~1 hour |

**Critical**: Database corruption is **unlikely** as this feature makes NO database changes to UCRManager database.

---

## 🔙 Re-applying Changes After Rollback

If you rolled back and want to try again:

```bash
cd /c/inetpub/wwwroot/UCRManager

# Switch back to feature branch
git checkout feature/3cx-crud-operations

# Rebuild
npm run build

# Restart
pm2 restart ucrmanager
```

---

## 📞 Emergency Contacts

If rollback fails and you need help:

1. **Check PM2 Logs**: `pm2 logs ucrmanager --lines 100`
2. **Check Build Logs**: Look for error messages during `npm run build`
3. **Check Git Status**: `git status` and `git log --oneline -5`
4. **System Logs**: Check `C:\logs\` for session logs if enabled

---

## 🗄️ Backup Information

### What's Backed Up Automatically

1. **Git History**: All changes are in git, can always revert
2. **Feature Branch**: `feature/3cx-crud-operations` is preserved unless deleted
3. **Main Branch**: Unchanged, always available

### What's NOT Backed Up

1. **Uncommitted Changes**: Use `git stash` before rollback
2. **Build Artifacts**: `dist/` folder (regenerated on build)
3. **Node Modules**: `node_modules/` (regenerated on `npm install`)

### Manual Backup Commands

```bash
# Backup entire project (before rollback)
cd /c/inetpub/wwwroot
tar -czf UCRManager-backup-$(date +%Y%m%d_%H%M%S).tar.gz UCRManager/

# Backup only source code
cd /c/inetpub/wwwroot/UCRManager
git archive --format=zip --output=/c/logs/ucrmanager-source-$(date +%Y%m%d_%H%M%S).zip HEAD
```

---

## ✅ Rollback Verification Checklist

After rollback, verify:

- [ ] Application running: `pm2 status` shows "online"
- [ ] No errors in logs: `pm2 logs ucrmanager --lines 50`
- [ ] Web interface loads: `https://localhost/admin/3cx-management`
- [ ] Read-only mode: No Add/Edit/Delete buttons visible
- [ ] Users table displays: Shows existing 3CX users
- [ ] DIDs table displays: Shows existing 3CX phone numbers
- [ ] Other features work: Number Management, Audit Logs, etc.
- [ ] On correct branch: `git branch --show-current` shows "main"

---

## 🎯 Quick Reference

### Rollback Commands (Copy-Paste Ready)

```bash
# FAST ROLLBACK (5 minutes)
cd /c/inetpub/wwwroot/UCRManager && \
git checkout main && \
npm run build && \
pm2 restart ucrmanager && \
pm2 status

# VERIFY ROLLBACK
pm2 logs ucrmanager --lines 20 --nostream
git branch --show-current
```

### Return to Feature Branch

```bash
# GO BACK TO FEATURE
cd /c/inetpub/wwwroot/UCRManager && \
git checkout feature/3cx-crud-operations && \
npm run build && \
pm2 restart ucrmanager && \
pm2 status
```

---

## 📝 Rollback Log Template

When you perform a rollback, document it:

```
Date: YYYY-MM-DD HH:MM
Reason: [Why rollback was needed]
Issue: [What went wrong]
Rollback Method: [Option 1/2/3]
Time Taken: [X minutes]
Success: [Yes/No]
Notes: [Any additional information]
```

Save to: `C:\logs\rollback_log.txt`

---

## 🔐 Safety Guarantees

### What CANNOT Break

- ✅ **Database**: No schema changes, no data modifications
- ✅ **Credentials**: 3CX credentials remain unchanged
- ✅ **Other Features**: Teams management, Number Management, Audit Logs unaffected
- ✅ **Tenant Data**: Customer tenant configuration intact
- ✅ **User Accounts**: Admin and operator accounts unchanged

### What Changes

- ✅ **3CX Management UI**: Returns to read-only view
- ✅ **3CX API Endpoints**: POST/PATCH/DELETE endpoints disabled
- ✅ **Application Files**: Source code reverted to previous version

---

## 📞 Support Resources

### Documentation
- **Implementation Guide**: `3CX_CRUD_IMPLEMENTATION.md`
- **Session Notes**: `SESSION_2025_11_13.md`
- **This Guide**: `ROLLBACK_GUIDE.md`

### Git References
- **Feature Branch**: `feature/3cx-crud-operations`
- **Feature Commit**: `9bafd34`
- **Main Branch**: `main`
- **Previous Stable**: `c954697`

### File Locations
- **Source**: `/c/inetpub/wwwroot/UCRManager/`
- **Logs**: `C:\logs\`
- **Build Output**: `/c/inetpub/wwwroot/UCRManager/dist/`

---

**Remember**: Rollback is **safe** and **fast**. This feature adds code only, doesn't modify existing functionality or data structures.

**When in doubt, roll back first, investigate later.**

---

**End of Rollback Guide**
