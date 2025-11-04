# MFA "Get Phone Numbers" Button Flow - Investigation Report

**Date:** November 4, 2025
**Investigation:** How MFA authentication was working when "Get Phone Numbers" button was pressed

---

## 🔍 Key Finding

The "Get Phone Numbers" button was part of the **PowerShell MFA Modal** interface that appeared AFTER successful MFA authentication. The button did NOT trigger MFA - instead, MFA happened first, then the button became available.

---

## 📋 The Complete Flow (As It Was Working)

### Step 1: User Initiates PowerShell Session
**File:** `client/src/pages/dashboard.tsx` (line 60-61)
- User sees a **"PowerShell"** button on the dashboard (next to Bulk Assign)
- User clicks the button
- Opens the **PowerShell MFA Modal**

### Step 2: Modal Auto-Connects
**File:** `client/src/components/powershell-mfa-modal.tsx` (lines 76-82)
```typescript
// Connect when modal opens
useEffect(() => {
  if (isOpen && !isConnected && !isConnecting) {
    setOutput(["Initializing PowerShell session..."]);
    connect();
  }
}, [isOpen]);
```

**What happens:**
- Modal opens
- Automatically calls `connect()` function
- Shows: "Initializing PowerShell session..."

### Step 3: WebSocket Connection Established
**File:** `client/src/hooks/use-powershell-session.ts` (lines 75-124)

**Connection Process:**
1. **Fetch credentials** from API: `GET /api/tenant/{tenantId}/powershell-credentials`
   - Returns encrypted username and password
2. **Get WebSocket JWT token**: `GET /api/auth/ws-token`
   - Returns authentication token for WebSocket
3. **Connect to WebSocket**: `wss://{host}/ws/powershell?token={jwt}`
4. **Create PowerShell session**: Send `create_session` message with credentials

```typescript
ws.send(JSON.stringify({
  type: "create_session",
  tenantId,
  credentials, // { username, encryptedPassword }
}));
```

### Step 4: Backend Creates PowerShell Session
**File:** `server/websocket.ts` (lines 141-227)

**Server Actions:**
1. Receives `create_session` message
2. Calls `powershellSessionManager.createSession()`
3. Spawns interactive PowerShell process (NOT using `-NonInteractive` flag)
4. Initializes Teams connection

**File:** `server/powershell-session.ts` (lines 146-171)

**PowerShell Commands Sent:**
```powershell
# Import MicrosoftTeams module
Import-Module MicrosoftTeams -ErrorAction Stop

# Create credential object
$username = "user@domain.com"
$password = ConvertTo-SecureString "password" -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential($username, $password)

# Connect to Microsoft Teams (this will prompt for MFA if enabled)
Connect-MicrosoftTeams -Credential $credential

# Display connection status
Get-CsTenant | Select-Object TenantId, DisplayName

Write-Host "Teams PowerShell session ready. Type commands or 'exit' to quit."
```

### Step 5: MFA Prompt Detection
**File:** `server/powershell-session.ts` (lines 95-111)

**MFA Detection Logic:**
```typescript
session.process.stdout.on("data", (data: Buffer) => {
  const output = data.toString();

  // Detect MFA prompt
  if (this.isMfaPrompt(output)) {
    console.log('[PowerShell] MFA PROMPT DETECTED!');
    session.state = "awaiting_mfa";
    session.emitter.emit("mfa_required", { output });
  }
});

private isMfaPrompt(output: string): boolean {
  const mfaPatterns = [
    /enter.*code/i,
    /verification.*code/i,
    /authentication.*code/i,
    /mfa/i,
    /two.*factor/i,
    /\d{6}/i, // Looking for 6-digit code mention
  ];
  return mfaPatterns.some(pattern => pattern.test(output));
}
```

**What happens:**
- PowerShell outputs text asking for MFA code
- Server detects the prompt using regex patterns
- Changes session state to `"awaiting_mfa"`
- Emits `mfa_required` event to WebSocket client

### Step 6: User Sees MFA Input Form
**File:** `client/src/components/powershell-mfa-modal.tsx` (lines 210-244)

**UI Updates:**
1. **WebSocket receives `mfa_required` message** (line 144-147)
   ```typescript
   case "mfa_required":
     setSessionState("awaiting_mfa");
     onMfaRequired?.(msg);
     break;
   ```

2. **MFA input form appears** (line 211)
   ```typescript
   {sessionState === "awaiting_mfa" && (
     <form onSubmit={handleSubmitMfa}>
       <Input
         id="mfa-code"
         type="text"
         inputMode="numeric"
         pattern="\d{6}"
         maxLength={6}
         placeholder="000000"
         value={mfaCode}
         onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
         autoFocus
         required
       />
       <Button type="submit">Submit</Button>
     </form>
   )}
   ```

**User Experience:**
- Terminal shows: "⚠️ MFA Required: Please enter your 6-digit verification code"
- Yellow form box appears with large 6-digit input
- User can type only numbers
- Submit button enabled when 6 digits entered

### Step 7: User Submits MFA Code
**File:** `client/src/components/powershell-mfa-modal.tsx` (lines 93-100)

```typescript
const handleSubmitMfa = (e: React.FormEvent) => {
  e.preventDefault();
  if (mfaCode.length === 6 && /^\d{6}$/.test(mfaCode)) {
    sendMfaCode(mfaCode);
    setOutput(prev => [...prev, `> Submitting MFA code: ${mfaCode}`]);
    setMfaCode("");
  }
};
```

**WebSocket Hook:** `client/src/hooks/use-powershell-session.ts` (lines 241-253)
```typescript
const sendMfaCode = useCallback((code: string) => {
  if (!wsRef.current || !isConnected) {
    console.error("WebSocket not connected");
    return false;
  }

  wsRef.current.send(JSON.stringify({
    type: "send_mfa_code",
    code,
  }));

  return true;
}, [isConnected]);
```

**Backend Handles MFA Code:** `server/websocket.ts` (lines 250-274)
```typescript
function handleSendMfaCode(client: WebSocketClient, data: { code: string }): void {
  if (!client.sessionId) {
    sendMessage(client.ws, {
      type: "error",
      error: "No active session. Create a session first."
    });
    return;
  }

  const success = powershellSessionManager.sendMfaCode(client.sessionId, data.code);

  if (!success) {
    sendMessage(client.ws, {
      type: "error",
      error: "Failed to send MFA code. Session may have closed."
    });
  } else {
    sendMessage(client.ws, {
      type: "info",
      message: "MFA code submitted. Waiting for verification..."
    });
  }
}
```

**PowerShell Session Manager:** `server/powershell-session.ts` (lines 213-215)
```typescript
sendMfaCode(sessionId: string, code: string): boolean {
  return this.sendCommand(sessionId, code);
}
```

**What happens:**
- Code is sent to PowerShell stdin
- PowerShell processes the MFA code
- If valid, authentication completes
- If invalid, PowerShell shows error

### Step 8: Authentication Success
**File:** `server/powershell-session.ts` (lines 104-107)

```typescript
} else if (output.includes("Account Id") || output.includes("TenantId")) {
  // Successfully connected
  session.state = "connected";
  session.emitter.emit("connected", { output });
}
```

**WebSocket Client Receives:** `client/src/hooks/use-powershell-session.ts` (lines 149-152)
```typescript
case "connected":
  setSessionState("connected");
  onConnected?.();
  break;
```

**Modal Updates:** `client/src/components/powershell-mfa-modal.tsx` (line 54-57)
```typescript
onConnected: () => {
  setOutput(prev => [...prev, "✓ Connected to Microsoft Teams PowerShell"]);
  onSuccess?.();
},
```

**User Experience:**
- Terminal shows: "✓ Connected to Microsoft Teams PowerShell"
- Status bar turns green: "Connected"
- MFA input form disappears
- **Quick Actions buttons appear**

### Step 9: "Get Phone Numbers" Button Appears
**File:** `client/src/components/powershell-mfa-modal.tsx` (lines 173-208)

```typescript
{/* Quick Actions */}
{sessionState === "connected" && (
  <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
    <span className="text-sm font-medium text-muted-foreground mr-2 self-center">
      Quick Actions:
    </span>

    <Button
      variant="outline"
      size="sm"
      onClick={() => getPhoneNumbers()}
      disabled={!isConnected}
    >
      <Phone className="h-3 w-3 mr-1" />
      Get Phone Numbers
    </Button>

    <Button
      variant="outline"
      size="sm"
      onClick={() => getPolicies()}
      disabled={!isConnected}
    >
      <FileText className="h-3 w-3 mr-1" />
      Get Policies
    </Button>

    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const upn = prompt("Enter User Principal Name (e.g., user@domain.com):");
        if (upn) getTeamsUser(upn);
      }}
      disabled={!isConnected}
    >
      <UsersIcon className="h-3 w-3 mr-1" />
      Get User Info
    </Button>
  </div>
)}
```

**What shows:**
- Three buttons appear in a gray box labeled "Quick Actions:"
  1. **Get Phone Numbers** (with phone icon)
  2. **Get Policies** (with document icon)
  3. **Get User Info** (with users icon)

### Step 10: User Clicks "Get Phone Numbers"
**File:** `client/src/hooks/use-powershell-session.ts` (lines 255-267)

```typescript
const getPhoneNumbers = useCallback((userPrincipalName?: string) => {
  if (!wsRef.current || !isConnected) {
    console.error("WebSocket not connected");
    return false;
  }

  wsRef.current.send(JSON.stringify({
    type: "get_phone_numbers",
    userPrincipalName,
  }));

  return true;
}, [isConnected]);
```

**Backend would handle:** `server/websocket.ts` (would have a handler for `get_phone_numbers`)
- Sends PowerShell command: `Get-CsPhoneNumberAssignment`
- Returns results to client
- Displays in terminal output

---

## 🎯 Summary: The Complete User Experience

1. **User clicks "PowerShell" button** on dashboard
2. **Modal opens** with terminal-style console
3. **"Initializing PowerShell session..."** appears
4. **"Connecting to Microsoft Teams..."** appears
5. **MFA prompt detected!**
6. **Yellow input box appears:** "Enter 6-Digit MFA Code"
7. **User types 6-digit code** from authenticator app
8. **User clicks Submit**
9. **"Submitting MFA code: 123456"** appears in terminal
10. **"MFA code submitted. Waiting for verification..."**
11. **"✓ Connected to Microsoft Teams PowerShell"**
12. **Status changes to green "Connected"**
13. **"Quick Actions" buttons appear**
14. **User clicks "Get Phone Numbers"**
15. **Phone numbers retrieved and displayed in terminal**

---

## 🔧 Key Components

### Frontend Files
1. **`client/src/components/powershell-mfa-modal.tsx`**
   - Main UI component
   - Terminal display
   - MFA input form
   - Quick action buttons
   - Line 183-185: Get Phone Numbers button

2. **`client/src/hooks/use-powershell-session.ts`**
   - WebSocket connection management
   - Message handling
   - Command functions (getPhoneNumbers, getPolicies, etc.)
   - Line 255-267: getPhoneNumbers() function

3. **`client/src/pages/dashboard.tsx`**
   - PowerShell button (triggers modal)

### Backend Files
1. **`server/websocket.ts`**
   - WebSocket server
   - Message routing
   - Session management
   - Lines 141-227: handleCreateSession
   - Lines 250-274: handleSendMfaCode

2. **`server/powershell-session.ts`**
   - PowerShell process management
   - MFA detection (lines 176-187)
   - Session state tracking
   - Command execution
   - Lines 146-171: initializeTeamsConnection

3. **`server/routes.ts`**
   - API endpoints
   - Credentials retrieval
   - WebSocket token generation

---

## 📊 Git History Context

### When It Was Implemented
**Commit:** `704d0b3` - "Implement PowerShell interactive session management with MFA support (Backend)"
**Date:** October 31, 2025

**What was added:**
- PowerShell session manager
- WebSocket server
- MFA detection
- Real-time output streaming
- Helper methods for Teams commands

### When Certificate Auth Was Added (When It May Have Broken)
**Commits:**
- `40fb7bb` - Add comprehensive MFA user credentials implementation documentation
- `c11e1f7` - Add admin endpoint for password encryption and user credentials guide
- `f18dfd2` - Add admin UI for dual PowerShell authentication (certificate and user)
- `ea349a9` - Fix dual authentication - add database columns and update endpoints
- `792053b` - feat: Implement WebSocket dual authentication with MFA support

**Current Branch:** `CERT_AUTH_WORKS_START_HERE` (commit `e2bc003`)
- This is BEFORE the dual auth changes
- This is BEFORE certificate auth was added
- This should have the working MFA flow

---

## ✅ What We Know Now

1. **The "Get Phone Numbers" button did NOT trigger MFA**
   - It was only available AFTER MFA completed
   - MFA happened automatically when modal opened

2. **MFA Flow Was:**
   - Modal opens → Auto-connect → MFA prompt → User enters code → Connected → Buttons appear

3. **The Working Version:**
   - Commit `e2bc003` (current CERT_AUTH_WORKS_START_HERE branch)
   - Has full MFA support
   - Has PowerShell modal with quick actions
   - Has WebSocket infrastructure

4. **What Changed After (That May Have Broken It):**
   - Added `auth_type` column to database
   - Split authentication paths (user vs certificate)
   - Modified WebSocket handler to route based on authType
   - Modified credentials endpoint to return different formats

---

## 🎯 Next Steps to Restore Working MFA

The current branch (`CERT_AUTH_WORKS_START_HERE` at commit `e2bc003`) should have the working MFA flow. Test it by:

1. **Open the application** (already deployed)
2. **Navigate to dashboard**
3. **Click "PowerShell" button**
4. **Watch for MFA prompt**
5. **Enter 6-digit code**
6. **Click "Get Phone Numbers" button**

If this works, then we know commit `e2bc003` is the correct working version, and the dual authentication changes that came after broke it.

---

## 📝 Documentation References

- **POWERSHELL_INTEGRATION_PROGRESS.md** - Detailed implementation status (as of Oct 31)
- **SESSION_SUMMARY_2025-11-03.md** - Certificate auth migration (when dual auth was added)
- **This file** - Complete MFA flow investigation

---

**Report completed:** November 4, 2025
**Current deployed version:** `CERT_AUTH_WORKS_START_HERE` (commit `e2bc003`)
**Ready for testing:** Yes
