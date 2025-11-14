# UCRManager - Consolidated TODO List

**Last Updated**: November 14, 2025
**Current Branch**: `feature/connectwise-integration`

---

## 🔴 HIGH PRIORITY - ConnectWise Integration

### Status Dropdown Issues (Just Fixed ✅)
- [x] ✅ **FIXED**: Empty string in SelectItem causing page crash
  - Changed value from `""` to `"0"`
  - Status dropdown now renders correctly
  - Committed: `29b5d0b`, `3624243`

### 1. Filter ConnectWise Statuses 🔴 URGENT
**Estimated Time**: 15-30 minutes
**Impact**: High - Users seeing invalid status options

**Issue**: All 23 statuses shown, including closed/inactive ones

**Files to Change**:
- `client/src/pages/dashboard.tsx` (line ~1044)

**Code Change**:
```typescript
// Current:
{cwStatuses?.statuses?.map((status: any) => ...)}

// Change to:
{cwStatuses?.statuses
  ?.filter((status: any) => (
    !status.closedStatus &&
    !status.inactive &&
    !status.timeEntryNotAllowed
  ))
  .map((status: any) => ...)}
```

**Testing**:
- [ ] Verify closed statuses hidden ("Closed", "Closed by Customer")
- [ ] Verify common statuses visible ("New", "In Progress", "Responded")
- [ ] Test with different tickets/boards

---

### 2. Fix Hardcoded Work Role 🔴 URGENT
**Estimated Time**: 45-60 minutes (includes migration)
**Impact**: Critical - Causes time entry failures

**Issue**: Work role hardcoded as "UCRight Engineer III" causes errors

**Current Code** (`server/connectwise.ts:448`):
```typescript
workRole: {
  name: 'UCRight Engineer III',  // ⚠️ HARDCODED
}
```

**Error Message**:
```
"The default Work Role is not valid for the selected location"
```

**Proposed Solution**: Make configurable per tenant

**Steps**:
1. Create database migration
2. Add columns to `connectwise_credentials` table
3. Update `server/connectwise.ts` to use configured work role
4. Update API route to save work role setting
5. (Optional) Add UI field in admin settings

**Files to Modify**:
- `migrations/` - New migration file
- `server/connectwise.ts` - Update `addTimeEntry` function
- `server/routes.ts` - Update credentials save endpoint
- `connectwise_credentials` table schema

**Migration SQL**:
```sql
ALTER TABLE connectwise_credentials
ADD COLUMN default_work_role_id INTEGER,
ADD COLUMN default_work_role_name TEXT;

-- Set default for existing row
UPDATE connectwise_credentials
SET default_work_role_name = 'UCRight Engineer III'
WHERE default_work_role_name IS NULL;
```

**Testing**:
- [ ] Time entries succeed with configured work role
- [ ] Time entries work when work role is NULL (use ConnectWise default)
- [ ] Error handling for invalid work role

---

## 🟡 MEDIUM PRIORITY - ConnectWise Enhancements

### 3. Show Current Ticket Status in UI
**Estimated Time**: 15 minutes
**Impact**: Medium - UX improvement

**Change** (`dashboard.tsx:976`):
```typescript
{selectedTicket && (
  <div className="text-xs text-muted-foreground space-y-1">
    <p>Ticket #{selectedTicket.id}: {selectedTicket.summary}</p>
    <p className="flex items-center gap-2">
      <span className="px-2 py-0.5 bg-secondary rounded-sm">
        {selectedTicket.status}
      </span>
      <span>{selectedTicket.company}</span>
    </p>
  </div>
)}
```

---

### 4. Pre-select Common Status
**Estimated Time**: 20 minutes
**Impact**: Low - UX convenience

**Implementation**:
```typescript
useEffect(() => {
  if (selectedTicket && cwStatuses?.statuses) {
    const inProgressStatus = cwStatuses.statuses.find(
      (s: any) => s.name.toLowerCase().includes('in progress')
    );
    if (inProgressStatus) {
      setCwStatusId(inProgressStatus.id);
    }
  }
}, [selectedTicket, cwStatuses]);
```

---

### 5. Work Type Configuration
**Estimated Time**: Similar to work role (~45 min)
**Impact**: Medium - Currently hardcoded to "Regular - Remote"

**Current** (`server/connectwise.ts:463`):
```typescript
workType: {
  id: 3,
  name: 'Regular - Remote',  // ⚠️ HARDCODED
}
```

**Same approach as work role** - make configurable

---

## 🟢 LOW PRIORITY - 3CX Integration

### From STATUS_2025_11_13_FINAL.md

### 6. Test Untested 3CX Operations
**Status**: ⚠️ Not Tested

Operations that work but haven't been tested:
- [ ] User creation (expected to work)
- [ ] User deletion (expected to work)
- [ ] DID update (may work)
- [ ] DID deletion (unknown)
- [ ] Trunk update (expected to work)

**Priority**: Low - Core functionality (update) is working

---

### 7. DID Creation Limitation
**Status**: ❌ CONFIRMED API LIMITATION

**Issue**: Cannot create DIDs via REST API (405 Method Not Allowed)

**Current State**:
- "Add DID" button disabled with "(Future)" label ✅
- Users must add DIDs via 3CX admin console

**Possible Investigation**:
- [ ] Test legacy WebAPI endpoint `/webapi/{accessKey}/did.create`
- [ ] Document workaround in user guide

**Priority**: Low - Workaround documented

---

## 🔵 DOCUMENTATION & CLEANUP

### 8. Update User Documentation
**Files Needing Updates**:
- User guide with ConnectWise workflow
- DID management workaround
- Work role configuration instructions
- Release notes with known limitations

---

### 9. Clean Up Debug Logging
**Temporary Debug Code Added**:

`dashboard.tsx`:
```typescript
console.log('[Dashboard] ConnectWise statuses received:', data);
console.log('[Dashboard] Selected ticket:', selectedTicket);
console.log('[Dashboard] CW Statuses data:', cwStatuses);
console.log('[Dashboard] onSelect called with:', { ticketId, ticket });
```

`server/routes.ts`:
```typescript
console.log(`[ConnectWise API] Returning ${statuses.length} statuses for board ${boardId}`);
```

**Decision**:
- Keep for now (helpful for debugging)
- OR remove before production deploy
- OR convert to conditional debug logging

---

### 10. Remove Test Files
**Test files created for debugging**:
- `test-status-api.html`
- `fetch-ticket-data.cjs`
- `test-status-endpoint.cjs`

**Action**: Delete or move to `scripts/` directory

---

## 📊 Priority Matrix

| Task | Priority | Effort | Impact | Status |
|------|----------|--------|--------|--------|
| Filter statuses | 🔴 HIGH | 15m | High | ⏳ Pending |
| Fix work role | 🔴 HIGH | 60m | Critical | ⏳ Pending |
| Show ticket status | 🟡 MED | 15m | Medium | ⏳ Pending |
| Pre-select status | 🟡 MED | 20m | Low | ⏳ Pending |
| Work type config | 🟡 MED | 45m | Medium | ⏳ Pending |
| Test 3CX ops | 🟢 LOW | 30m | Low | ⏳ Pending |
| DID investigation | 🟢 LOW | 60m | Low | ⏳ Pending |
| Documentation | 🔵 DOC | 60m | Medium | ⏳ Pending |
| Clean up logging | 🔵 DOC | 15m | Low | ⏳ Pending |
| Remove test files | 🔵 DOC | 5m | Low | ⏳ Pending |

---

## 🎯 Recommended Implementation Order

### Session 1: Critical Fixes (1-2 hours)
1. Filter ConnectWise statuses (15m)
2. Fix hardcoded work role (60m)
3. Test status updates end-to-end (15m)
4. Commit and push

### Session 2: UX Improvements (1 hour)
1. Show current ticket status (15m)
2. Pre-select common status (20m)
3. Work type configuration (45m)
4. Test and commit

### Session 3: Testing & Docs (1-2 hours)
1. Test untested 3CX operations (30m)
2. Update documentation (60m)
3. Clean up debug logging (15m)
4. Remove test files (5m)

### Session 4: Investigation (Optional)
1. Investigate legacy DID API (60m)
2. Document findings

---

## 🚀 Current System Status

**Branch**: `feature/connectwise-integration`
**Application**: ✅ Running (PM2)
**Build**: ✅ Success
**Latest Commits**:
- `3624243` - ConnectWise TODO documentation
- `29b5d0b` - Status dropdown fix

**Production Ready**:
- ⚠️ Needs critical fixes (filter statuses, work role)
- ✅ Core functionality working
- ✅ Well documented

---

## 📝 Notes

### ConnectWise Integration Status
- ✅ Backend API complete and working
- ✅ Ticket search working
- ✅ Status dropdown rendering (just fixed)
- ⚠️ Status filtering needed
- ⚠️ Work role needs configuration
- ⏳ Full workflow testing pending

### 3CX Integration Status
- ✅ User CRUD fully functional
- ✅ DID read-only (API limitation documented)
- ⚠️ Some operations not tested
- ✅ Production ready with documented limitations

### Technical Debt
- Debug logging (decide to keep or remove)
- Test files cleanup
- Documentation updates
- Work role/type hardcoding

---

## 🔗 Related Documentation

- `CONNECTWISE_STATUS_FIX.md` - Recent fix details
- `CONNECTWISE_TODO.md` - Detailed ConnectWise tasks
- `CONNECTWISE_STATUS.md` - Integration status
- `STATUS_2025_11_13_FINAL.md` - 3CX implementation status
- `3CX_CRUD_IMPLEMENTATION.md` - 3CX documentation

---

**Next Action**: Address high-priority items (filter statuses, fix work role)
**ETA to Production Ready**: 1-2 hours of focused work
