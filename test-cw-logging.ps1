# Test ConnectWise Logging with Debug Output
# This script tests logging to ConnectWise and shows debug output

$tenantId = "83f508e2-0b8b-41da-9dba-8a329305c13e"
$ticketId = 55104
$baseUrl = "https://localhost"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "ConnectWise Logging Test with Debug" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: Without member identifier (should use default)
Write-Host "TEST 1: Log change WITHOUT member identifier override" -ForegroundColor Yellow
Write-Host "Expected: Should use default (rbowles) from credentials`n" -ForegroundColor Gray

try {
    $body = @{
        ticketId = $ticketId
        noteText = "TEST 1: Testing default member identifier - " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        hours = 0.5
    } | ConvertTo-Json

    Write-Host "Request body:" -ForegroundColor DarkGray
    Write-Host $body -ForegroundColor DarkGray
    Write-Host ""

    $response = Invoke-RestMethod -Uri "$baseUrl/api/admin/tenant/$tenantId/connectwise/log-change" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -UseDefaultCredentials `
        -SkipCertificateCheck

    Write-Host "✓ TEST 1 SUCCESS" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    Write-Host ($response | ConvertTo-Json -Depth 3) -ForegroundColor Gray
} catch {
    Write-Host "✗ TEST 1 FAILED" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

Write-Host "`n---`n"

# Test 2: With member identifier override
Write-Host "TEST 2: Log change WITH member identifier override" -ForegroundColor Yellow
Write-Host "Expected: Should use provided member (rbowles)`n" -ForegroundColor Gray

try {
    $body = @{
        ticketId = $ticketId
        noteText = "TEST 2: Testing member identifier override - " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        memberIdentifier = "rbowles"
        hours = 0.25
    } | ConvertTo-Json

    Write-Host "Request body:" -ForegroundColor DarkGray
    Write-Host $body -ForegroundColor DarkGray
    Write-Host ""

    $response = Invoke-RestMethod -Uri "$baseUrl/api/admin/tenant/$tenantId/connectwise/log-change" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -UseDefaultCredentials `
        -SkipCertificateCheck

    Write-Host "✓ TEST 2 SUCCESS" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    Write-Host ($response | ConvertTo-Json -Depth 3) -ForegroundColor Gray
} catch {
    Write-Host "✗ TEST 2 FAILED" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Check PM2 logs for detailed debug output:" -ForegroundColor Cyan
Write-Host "  pm2 logs ucrmanager --lines 50" -ForegroundColor Gray
Write-Host "========================================`n" -ForegroundColor Cyan
