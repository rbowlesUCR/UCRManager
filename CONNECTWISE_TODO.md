# ConnectWise Integration - Follow-Up Tasks

**Date**: November 14, 2025
**Status**: 🔄 In Progress

---

## High Priority Items

### 1. Filter ConnectWise Statuses

**Issue**: Currently showing all 23 statuses from the board, including:
- Closed statuses (e.g., "Closed", "Closed by Customer")
- Internal/system statuses that shouldn't be user-selectable
- Inactive statuses

**Current Behavior**:
```typescript
// Shows ALL statuses from board
{cwStatuses?.statuses?.map((status: any) => (
  <SelectItem key={status.id} value={status.id.toString()}>
    {status.name}
  </SelectItem>
))}
```

**Proposed Solution**:
Filter out statuses based on ConnectWise status properties:
- `closedStatus: true` - Skip closed statuses
- `inactive: true` - Skip inactive statuses
- `timeEntryNotAllowed: true` - Skip statuses that don't allow time entries

**Implementation**:
```typescript
{cwStatuses?.statuses
  ?.filter((status: any) => {
    // Filter out closed, inactive, or time-entry-blocked statuses
    return !status.closedStatus &&
           !status.inactive &&
           !status.timeEntryNotAllowed;
  })
  .map((status: any) => (
    <SelectItem key={status.id} value={status.id.toString()}>
      {status.name}
    </SelectItem>
  ))
}
```

**Files to Modify**:
- `client/src/pages/dashboard.tsx` - Add filter logic
- `server/connectwise.ts` - Potentially return filter flags in status objects

**Testing Required**:
- Verify closed statuses don't appear in dropdown
- Ensure common statuses (New, In Progress, etc.) still appear
- Test with different ConnectWise boards

---

### 2. Dynamic Work Role Configuration

**Issue**: Work role is statically defined in the code as "UCRight Engineer III"

**Current Implementation** (`server/connectwise.ts:448`):
```typescript
const timeEntry: ConnectWiseTimeEntry = {
  chargeToId: ticketId,
  chargeToType: 'ServiceTicket',
  member: {
    identifier: finalMemberIdentifier,
  },
  workRole: {
    name: 'UCRight Engineer III',  // ⚠️ HARDCODED
  },
  // ...
};
```

**Known Issues**:
- Static work role may not be valid for all locations/boards
- Causes error: "The default Work Role is not valid for the selected location"
- Different tenants may need different work roles
- Work roles may vary by ticket type or service board

**Proposed Solutions**:

#### Option A: Make Work Role Configurable Per Tenant
Store default work role in `connectwise_credentials` table:
```sql
ALTER TABLE connectwise_credentials
ADD COLUMN default_work_role_id INTEGER,
ADD COLUMN default_work_role_name TEXT;
```

**Pros**:
- Each tenant can have their own default
- Simple to configure
- Matches existing pattern for other defaults

**Cons**:
- Requires database migration
- Still a single default per tenant

#### Option B: Fetch Work Roles from ConnectWise API
Query available work roles and let user select:
```typescript
// GET /v4_6_release/apis/3.0/time/workRoles
export async function getWorkRoles(tenantId: string): Promise<WorkRole[]> {
  // Fetch from ConnectWise API
}
```

**Pros**:
- Always up-to-date with ConnectWise
- Can select appropriate role per ticket
- More flexible

**Cons**:
- Additional API call
- More complex UI
- May overwhelm users with choices

#### Option C: Make Work Role Optional
Don't send work role in time entry, let ConnectWise use its default:
```typescript
const timeEntry: ConnectWiseTimeEntry = {
  chargeToId: ticketId,
  chargeToType: 'ServiceTicket',
  member: { identifier: finalMemberIdentifier },
  // workRole: omitted - let CW use default
  timeStart: formatCWDate(startTime),
  // ...
};
```

**Pros**:
- Simplest solution
- No configuration needed
- Relies on ConnectWise defaults

**Cons**:
- May not work if ConnectWise requires work role
- Less control over time entry details

**Recommended Approach**: **Option A** (Tenant-level configuration)
- Add to `connectwise_credentials` table
- Add to admin ConnectWise settings form
- Fallback to omitting if not set (Option C)

**Files to Modify**:
- `migrations/` - New migration to add work_role columns
- `server/connectwise.ts` - Update `addTimeEntry` function
- `server/routes.ts` - Update credentials save endpoint
- `client/src/pages/admin-connectwise-credentials.tsx` - Add work role field (if form exists)

---

## Additional Improvements

### 3. Show Current Ticket Status in UI

**Enhancement**: Display the ticket's current status when ticket is selected

**Current**:
```
Ticket #55104: Test ticket - please delete
```

**Proposed**:
```
Ticket #55104: Test ticket - please delete
Status: New | Board: Primary Triage
```

**Implementation**:
```typescript
{selectedTicket && (
  <div className="text-xs text-muted-foreground space-y-1">
    <p>Ticket #{selectedTicket.id}: {selectedTicket.summary}</p>
    <p className="flex items-center gap-2">
      <span className="px-2 py-0.5 bg-secondary rounded-sm">
        {selectedTicket.status}
      </span>
      <span>•</span>
      <span>{selectedTicket.board}</span>
      <span>•</span>
      <span>{selectedTicket.company}</span>
    </p>
  </div>
)}
```

---

### 4. Pre-select Common Status

**Enhancement**: When dropdown appears, pre-select a commonly used status (e.g., "In Progress")

**Implementation**:
```typescript
// When ticket is selected, set default status
useEffect(() => {
  if (selectedTicket && cwStatuses?.statuses) {
    // Find "In Progress" status
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

### 5. Validate Status Selection

**Enhancement**: Warn user if they select a closed or final status

**Implementation**:
```typescript
{cwStatusId && cwStatuses?.statuses && (() => {
  const selectedStatus = cwStatuses.statuses.find(
    (s: any) => s.id === cwStatusId
  );
  if (selectedStatus?.closedStatus) {
    return (
      <Alert variant="warning">
        <AlertDescription>
          ⚠️ You are about to close this ticket. Are you sure?
        </AlertDescription>
      </Alert>
    );
  }
})()}
```

---

### 6. Work Type Configuration

**Current Issue**: Work type is also hardcoded in `addTimeEntry`:
```typescript
workType: {
  id: 3,
  name: 'Regular - Remote',
}
```

**Recommendation**: Same approach as work role
- Make configurable per tenant
- Or fetch from API and let user select
- Or omit and let ConnectWise use default

---

## Implementation Priority

1. **HIGH**: Filter statuses (blocks users from selecting invalid statuses)
2. **HIGH**: Fix work role (causes errors in time entry creation)
3. **MEDIUM**: Show current ticket status (improves UX)
4. **LOW**: Pre-select common status (nice to have)
5. **LOW**: Validate status selection (safety check)
6. **LOW**: Work type configuration (if causing errors)

---

## Migration Plan

### Phase 1: Status Filtering (Quick Win)
- Add filter to dashboard.tsx
- Test with existing data
- No database changes needed

### Phase 2: Work Role Configuration
- Create migration to add work_role columns
- Update server functions
- Update admin UI (or use default for now)
- Test time entry creation

### Phase 3: UI Enhancements
- Show ticket status details
- Add pre-selection logic
- Add validation warnings

---

## Testing Checklist

### Status Filtering:
- [ ] Closed statuses are hidden
- [ ] Inactive statuses are hidden
- [ ] Only valid, selectable statuses appear
- [ ] At least one status is available
- [ ] Dropdown works across different boards

### Work Role:
- [ ] Work role can be configured per tenant
- [ ] Time entries succeed with configured work role
- [ ] Time entries work when work role is omitted
- [ ] Error handling for invalid work role

### Edge Cases:
- [ ] Board with no valid statuses
- [ ] Ticket with no work role configured
- [ ] Multiple tenants with different configurations
- [ ] API errors are handled gracefully

---

## Notes

**Current Status Properties Available** (from ConnectWise API):
```json
{
  "id": 867,
  "name": "New",
  "sortOrder": 0,
  "displayOnBoard": true,
  "inactive": false,
  "closedStatus": false,
  "timeEntryNotAllowed": false,
  "escalationStatus": "NotResponded",
  "customerPortalFlag": true
}
```

**Useful Filters**:
- `closedStatus: false` - Active tickets only
- `inactive: false` - Active statuses only
- `timeEntryNotAllowed: false` - Can log time
- `customerPortalFlag: true` - Customer-visible (optional)

---

## Related Documentation

- `CONNECTWISE_STATUS_FIX.md` - Recent status dropdown fix
- `CONNECTWISE_INTEGRATION.md` - Full integration documentation
- `server/connectwise.ts` - ConnectWise API functions
- `client/src/pages/dashboard.tsx` - Main UI implementation
