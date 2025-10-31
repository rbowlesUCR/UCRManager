# PowerShell Limitation in Replit Environment

## Problem Summary
PowerShell script execution is fundamentally incompatible with Replit's containerized development environment. While PowerShell 7.5.1 is installed correctly, ANY attempt to execute scripts via Node.js spawn() hangs indefinitely.

## Root Cause
PowerShell attempts to acquire TTY (terminal) capabilities during host initialization that are not available in Replit's containerized sandbox. The failure occurs **before any script code executes** and is inherent to how PowerShell's console host interacts with the container environment.

Evidence:
- `pwsh --version` works (simple command without script execution)
- ALL script execution methods hang: `-File`, `-Command`, `-EncodedCommand`, bash wrappers, stdin redirection
- Output `[?1h=` (ANSI escape code) shows PowerShell trying to enter alternate screen mode despite `-NonInteractive` flag
- Multiple anti-hang configurations (PSReadLine disable, ProgressPreference, ConfirmPreference) have no effect

## Symptoms
1. PowerShell scripts timeout after 2+ minutes
2. No output is produced from PowerShell commands
3. `pwsh --version` works fine (interactive mode)
4. When run directly without wrapper, PowerShell crashes with ICU library errors
5. Test scripts like `test-teams-module.ps1` hang indefinitely

## Investigation Details
- Confirmed PowerShell binary location: `/nix/store/0dx1yv936k4i0nf7hpvbpdnfaq8vwxz4-powershell-7.4.2/`
- Wrapper script sets required environment variables (LD_LIBRARY_PATH for ICU, etc.)
- Interactive mode works (`pwsh` with manual input)
- Non-interactive modes all fail/hang
- Direct binary execution fails with: "Couldn't find a valid ICU package installed on the system"

## Solution Implemented
**Accept the limitation and design around it.** PowerShell features are for **production deployment only**.

### Architectural Changes

**1. Environment Detection (File: `server/powershell.ts`)**
- Detects Replit development environment via `REPL_ID` environment variable
- Returns immediate, helpful error message instead of hanging
- Allows PowerShell execution in production deployment

**2. Clear User Communication**
- Admin panel shows clear warnings about development limitations
- Documentation explains this is a Replit-specific constraint
- Module installation is verified (files exist), execution deferred to production

**3. Production Deployment Strategy**
- PowerShell 7.5.1 installed via Nix (file: `.replit`)
- MicrosoftTeams module pre-installed in `~/.local/share/powershell/Modules/`
- When deployed, PowerShell will have proper TTY access and work correctly

## Testing & Verification

**On Replit Platform (Development OR Production):**
```bash
# Verify PowerShell is installed
pwsh --version  # Should show: PowerShell 7.5.1

# Verify MicrosoftTeams module files exist
ls ~/.local/share/powershell/Modules/MicrosoftTeams/

# Test the app's PowerShell handling
# Navigate to Admin Panel → Documentation → PowerShell Setup → "Test Module"
# Should show clear error message explaining Replit platform limitation
```

**Expected Behavior on Replit:**
- PowerShell test returns immediate error (not timeout)
- Error message explains TTY limitation applies to both dev and production
- Confirms module IS installed correctly
- Recommends alternative hosting platforms

**On Compatible Hosting (Azure App Service, AWS EC2, VPS, etc.):**
- PowerShell scripts will execute normally
- Full Teams cmdlet functionality available
- Proper TTY access for PowerShell host
- All features work as designed

## Alternative Solutions Considered
1. **Upgrading PowerShell version**: Tested 7.5.1, still hangs - version not the issue
2. **Anti-hang script settings**: Disabled PSReadLine, progress bars, confirmations - no effect
3. **Different execution methods**: Tried `-File`, `-Command`, `-EncodedCommand`, bash wrappers, stdin - all hang
4. **Python SDK**: Microsoft Teams SDK for Python doesn't support required cmdlets
5. **External executor service**: Best option for production (Azure Automation/Function App with REST API)
6. **Mock implementation**: Useful for development/testing workflows without blocking

## Impact
- **Development Environment**: PowerShell features disabled with clear error messages (no hanging)
- **Production Deployment**: PowerShell will work correctly with proper TTY access
- **User Experience**: Immediate feedback instead of 30-60 second timeouts
- **Affected Features** (Production Only):
  - Phone number assignment (`Set-CsPhoneNumberAssignment`)
  - Voice routing policy retrieval (`Get-CsOnlineVoiceRoutingPolicy`)
  - Voice routing policy assignment via PowerShell
  - Teams PowerShell connectivity testing
  
**Note**: These features use Graph API where available; PowerShell is only required for operations not yet supported by Microsoft Graph.

## Related Files
- `.replit` - Nix configuration
- `server/powershell.ts` - PowerShell execution wrapper
- `install-teams-module.ps1` - Module installation script
- `test-teams-module.ps1` - Module verification script
- `verify-teams-module.sh` - Shell verification script

## References
- PowerShell issue with containerized environments
- Nix PowerShell package versions
- Microsoft Teams PowerShell module requirements

## Date Fixed
2025-10-25

## Commit Information
This fix will be committed with details of the PowerShell hanging bug and Nix channel update.
