# DID Picker Troubleshooting - Instructions for Production Claude

## Issue Description

Numbers are not appearing in the DID picker dropdown even though they are:
- Not assigned to any Teams user
- Marked as "unavailable" in number management
- Should be available for selection

## Troubleshooting Branch Created

**Dev Branch**: `troubleshoot/dev-did-picker-nov15`
- Current commit: 617edc8
- Pushed to GitHub: ✅ Yes
- Based on: main branch (latest code)

## Instructions for Production Claude

### Step 1: Create Production Troubleshooting Branch

```powershell
cd C:\inetpub\wwwroot\UCRManager

# Check current branch and status
git branch
git status

# Create troubleshooting branch from current state
git checkout -b troubleshoot/prod-did-picker-nov15

# Show last 20 commits for comparison
git log --oneline -20

# Push to GitHub
git push origin troubleshoot/prod-did-picker-nov15
```

### Step 2: Report Current State

Please provide:

1. **Current branch name** before creating troubleshoot branch
2. **Last commit hash and message** on production
3. **Git log output** (last 20 commits)
4. **Any uncommitted changes** from `git status`

### Step 3: Key Files to Compare

Once both branches are pushed, we'll compare these files:

**DID Picker Component**:
- `client/src/components/phone-number-picker-dialog.tsx`

**Backend API Routes**:
- `server/routes.ts` (specifically the `/api/numbers` endpoint)
- `server/storage.ts` (getPhoneNumbers function)

**Teams Sync Logic**:
- `server/routes.ts` (line 1648: `/api/numbers/sync-from-teams/:tenantId`)

### Step 4: Database Query Check

After creating branch, please run this query to check number status:

```sql
SELECT
  line_uri,
  display_name,
  user_principal_name,
  status,
  number_type,
  created_at,
  updated_at
FROM phone_number_inventory
WHERE tenant_id = '83f508e2-0b8b-41da-9dba-8a329305c13e'
  AND line_uri LIKE '%[the number not showing]%'
ORDER BY updated_at DESC;
```

This will show:
- Current status in database
- When it was last updated
- Who/what it's assigned to

## Expected Differences

We expect to find differences in one of these areas:

1. **Branch divergence**: Production may be on an older branch with different sync logic
2. **DID picker query**: Different status filtering between environments
3. **Sync behavior**: Production sync may be overwriting status differently
4. **Database state**: Numbers may have different status values than expected

## Next Steps

After both branches are created and pushed:

1. Compare commits: `git log troubleshoot/prod-did-picker-nov15..troubleshoot/dev-did-picker-nov15`
2. Compare specific files: `git diff troubleshoot/prod-did-picker-nov15 troubleshoot/dev-did-picker-nov15 -- client/src/components/phone-number-picker-dialog.tsx`
3. Identify the root cause
4. Apply fix to production

---

**Created by**: Dev Claude
**Date**: November 15, 2025
**Dev Branch**: troubleshoot/dev-did-picker-nov15
**Waiting for**: Production troubleshoot branch creation
