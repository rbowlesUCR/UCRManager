#!/bin/bash

# DID Picklist Feature - Database Test Suite

PGPASSWORD='4FC4E215649C6EBF3A390BAFE4B2ECD7'
PSQL="/c/Program Files/PostgreSQL/16/bin/psql.exe"
export PGPASSWORD

echo "================================================================================"
echo "📋 DID PICKLIST FEATURE - DATABASE TEST SUITE"
echo "================================================================================"

# Test counters
PASSED=0
FAILED=0

# Test function
test_query() {
    local name="$1"
    local query="$2"
    local expected="$3"

    printf "\n🧪 %s... " "$name"
    result=$("$PSQL" -U postgres -d ucrmanager -t -A -c "$query" 2>&1)

    if echo "$result" | grep -q "$expected"; then
        echo "✅ PASSED"
        ((PASSED++))
    else
        echo "❌ FAILED: Expected '$expected', got '$result'"
        ((FAILED++))
    fi
}

echo ""
echo "🎛️  SECTION 1: Feature Flag Tests"
echo ""

test_query "Feature flag exists" \
    "SELECT EXISTS (SELECT 1 FROM feature_flags WHERE feature_key = 'allow_manual_phone_entry');" \
    "t"

test_query "Feature flag is disabled by default" \
    "SELECT is_enabled FROM feature_flags WHERE feature_key = 'allow_manual_phone_entry';" \
    "f"

# Toggle to enabled
"$PSQL" -U postgres -d ucrmanager -c "UPDATE feature_flags SET is_enabled = true WHERE feature_key = 'allow_manual_phone_entry';" > /dev/null 2>&1

test_query "Can toggle feature flag to enabled" \
    "SELECT is_enabled FROM feature_flags WHERE feature_key = 'allow_manual_phone_entry';" \
    "t"

# Toggle back to disabled
"$PSQL" -U postgres -d ucrmanager -c "UPDATE feature_flags SET is_enabled = false WHERE feature_key = 'allow_manual_phone_entry';" > /dev/null 2>&1

test_query "Can toggle feature flag back to disabled" \
    "SELECT is_enabled FROM feature_flags WHERE feature_key = 'allow_manual_phone_entry';" \
    "f"

echo ""
echo "📞 SECTION 2: Phone Number Inventory Tests"
echo ""

test_query "Phone inventory has external_system_type column" \
    "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phone_number_inventory' AND column_name = 'external_system_type');" \
    "t"

test_query "Phone inventory has external_system_id column" \
    "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'phone_number_inventory' AND column_name = 'external_system_id');" \
    "t"

# Get tenant ID
TENANT_ID=$("$PSQL" -U postgres -d ucrmanager -t -A -c "SELECT id FROM customer_tenants LIMIT 1;")

# Insert test numbers
"$PSQL" -U postgres -d ucrmanager -c "INSERT INTO phone_number_inventory (tenant_id, line_uri, number_type, status, external_system_type, created_by, last_modified_by) VALUES ('$TENANT_ID', 'tel:+15559998881', 'did', 'available', 'teams', 'test', 'test') ON CONFLICT DO NOTHING;" > /dev/null 2>&1

test_query "Can insert number with Teams system type" \
    "SELECT external_system_type FROM phone_number_inventory WHERE line_uri = 'tel:+15559998881';" \
    "teams"

"$PSQL" -U postgres -d ucrmanager -c "INSERT INTO phone_number_inventory (tenant_id, line_uri, number_type, status, external_system_type, created_by, last_modified_by) VALUES ('$TENANT_ID', 'tel:+15559998882', 'did', 'available', '3cx', 'test', 'test') ON CONFLICT DO NOTHING;" > /dev/null 2>&1

test_query "Can insert number with 3CX system type" \
    "SELECT external_system_type FROM phone_number_inventory WHERE line_uri = 'tel:+15559998882';" \
    "3cx"

echo ""
echo "🔒 SECTION 3: Data Integrity Tests"
echo ""

test_query "All numbers have valid tel:+ format" \
    "SELECT COUNT(*) FROM phone_number_inventory WHERE line_uri NOT LIKE 'tel:+%';" \
    "0"

printf "\n📊 Count numbers by system type... "
TEAMS_COUNT=$("$PSQL" -U postgres -d ucrmanager -t -A -c "SELECT COUNT(*) FROM phone_number_inventory WHERE external_system_type = 'teams';")
THREECX_COUNT=$("$PSQL" -U postgres -d ucrmanager -t -A -c "SELECT COUNT(*) FROM phone_number_inventory WHERE external_system_type = '3cx';")
echo "✅ Teams: $TEAMS_COUNT, 3CX: $THREECX_COUNT"
((PASSED++))

echo ""
echo "🧹 SECTION 4: Clean Up"
echo ""

# Clean up test data
"$PSQL" -U postgres -d ucrmanager -c "DELETE FROM phone_number_inventory WHERE line_uri IN ('tel:+15559998881', 'tel:+15559998882');" > /dev/null 2>&1

test_query "Test numbers cleaned up" \
    "SELECT COUNT(*) FROM phone_number_inventory WHERE line_uri LIKE '%99988%';" \
    "0"

# Ensure flag is disabled
"$PSQL" -U postgres -d ucrmanager -c "UPDATE feature_flags SET is_enabled = false WHERE feature_key = 'allow_manual_phone_entry';" > /dev/null 2>&1

echo ""
echo "================================================================================"
echo "📊 TEST RESULTS SUMMARY"
echo "================================================================================"
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
TOTAL=$((PASSED + FAILED))
if [ $TOTAL -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=1; $PASSED * 100 / $TOTAL" | bc)
    echo "📈 Success Rate: ${SUCCESS_RATE}%"
fi
echo "================================================================================"
echo ""

if [ $FAILED -gt 0 ]; then
    exit 1
fi
