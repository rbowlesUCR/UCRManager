# ConnectWise Integration Test Script
# This script tests the ConnectWise integration using the debug endpoints

param(
    [Parameter(Mandatory=$true)]
    [string]$TenantId,

    [Parameter(Mandatory=$false)]
    [string]$TicketId,

    [Parameter(Mandatory=$false)]
    [string]$MemberIdentifier
)

$baseUrl = "https://localhost"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "ConnectWise Integration Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: Connection Test
Write-Host "1. Testing ConnectWise API Connection..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/debug/connectwise/test-connection/$TenantId" `
        -Method POST `
        -UseDefaultCredentials `
        -SkipCertificateCheck

    if ($response.success) {
        Write-Host "   ✓ Connection successful!" -ForegroundColor Green
        Write-Host "   Base URL: $($response.details.baseUrl)" -ForegroundColor Gray
        Write-Host "   Company ID: $($response.details.companyId)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Connection failed: $($response.message)" -ForegroundColor Red
        Write-Host "   Details: $($response.details)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Search Tickets
Write-Host "`n2. Searching for tickets..." -ForegroundColor Yellow
try {
    $searchQuery = if ($TicketId) { $TicketId } else { "" }
    $response = Invoke-RestMethod -Uri "$baseUrl/api/debug/connectwise/tickets/search/${TenantId}?q=$searchQuery&limit=5" `
        -Method GET `
        -UseDefaultCredentials `
        -SkipCertificateCheck

    Write-Host "   ✓ Found $($response.count) ticket(s)" -ForegroundColor Green
    foreach ($ticket in $response.tickets) {
        Write-Host "      - Ticket #$($ticket.id): $($ticket.summary)" -ForegroundColor Gray
        Write-Host "        Status: $($ticket.status) | Company: $($ticket.company)" -ForegroundColor DarkGray
    }
} catch {
    Write-Host "   ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Get Statuses
Write-Host "`n3. Fetching available statuses..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/debug/connectwise/statuses/$TenantId" `
        -Method GET `
        -UseDefaultCredentials `
        -SkipCertificateCheck

    Write-Host "   ✓ Found $($response.count) status(es)" -ForegroundColor Green
    $response.statuses | Select-Object -First 10 | ForEach-Object {
        Write-Host "      - Status ID $($_.id): $($_.name) (Board: $($_.boardName))" -ForegroundColor Gray
    }

    if ($response.count -eq 0) {
        Write-Host "   ⚠ WARNING: No statuses found! This explains why the dropdown is empty." -ForegroundColor Red
    }
} catch {
    Write-Host "   ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   This error explains why the status dropdown is empty!" -ForegroundColor Red
}

# Test 4: Comprehensive Test (if ticket ID and member provided)
if ($TicketId -and $MemberIdentifier) {
    Write-Host "`n4. Running comprehensive test..." -ForegroundColor Yellow
    Write-Host "   This will add a test note and time entry to ticket #$TicketId" -ForegroundColor Gray
    Write-Host "   Press any key to continue or Ctrl+C to skip..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

    try {
        $body = @{
            ticketId = $TicketId
            memberIdentifier = $MemberIdentifier
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri "$baseUrl/api/debug/connectwise/comprehensive-test/$TenantId" `
            -Method POST `
            -Body $body `
            -ContentType "application/json" `
            -UseDefaultCredentials `
            -SkipCertificateCheck

        Write-Host "   ✓ Comprehensive test completed!" -ForegroundColor Green
        Write-Host "`n   Test Results:" -ForegroundColor Cyan

        # Connection
        if ($response.results.tests.connection.success) {
            Write-Host "      ✓ Connection: PASS" -ForegroundColor Green
        } else {
            Write-Host "      ✗ Connection: FAIL - $($response.results.tests.connection.message)" -ForegroundColor Red
        }

        # Search
        if ($response.results.tests.search.success) {
            Write-Host "      ✓ Search: PASS ($($response.results.tests.search.ticketsFound) tickets)" -ForegroundColor Green
        } else {
            Write-Host "      ✗ Search: FAIL" -ForegroundColor Red
        }

        # Get Ticket
        if ($response.results.tests.getTicket.success) {
            Write-Host "      ✓ Get Ticket: PASS" -ForegroundColor Green
        } else {
            Write-Host "      ✗ Get Ticket: FAIL" -ForegroundColor Red
        }

        # Add Note
        if ($response.results.tests.addNote) {
            if ($response.results.tests.addNote.success) {
                Write-Host "      ✓ Add Note: PASS" -ForegroundColor Green
            } else {
                Write-Host "      ✗ Add Note: FAIL" -ForegroundColor Red
            }
        }

        # Add Time
        if ($response.results.tests.addTime) {
            if ($response.results.tests.addTime.success) {
                Write-Host "      ✓ Add Time Entry: PASS" -ForegroundColor Green
            } else {
                Write-Host "      ✗ Add Time Entry: FAIL" -ForegroundColor Red
            }
        }

        # Statuses
        if ($response.results.tests.statuses.success) {
            Write-Host "      ✓ Get Statuses: PASS ($($response.results.tests.statuses.count) statuses)" -ForegroundColor Green
        } else {
            Write-Host "      ✗ Get Statuses: FAIL" -ForegroundColor Red
        }

        Write-Host "`n   ⚠ NOTE: Check ConnectWise ticket #$TicketId to verify note and time entry were added!" -ForegroundColor Yellow

    } catch {
        Write-Host "   ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Test Complete!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

if (-not $TicketId) {
    Write-Host "TIP: Run with -TicketId and -MemberIdentifier to test note/time entry:" -ForegroundColor Yellow
    Write-Host "  .\test-connectwise.ps1 -TenantId 'YOUR_TENANT_ID' -TicketId '123' -MemberIdentifier 'user@domain.com'" -ForegroundColor Gray
}
