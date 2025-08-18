#!/usr/bin/env bash
set -euo pipefail

# Support configurable base URLs for different environments
BASE="${SMOKE_BASE_URL:-http://localhost:3000/supichat}"
SIGNALING_URL="${SMOKE_SIGNALING_URL:-http://localhost:4001}"

# Track test results
FAILED_TESTS=0
TOTAL_TESTS=0

# Check for required dependencies
check_dependencies() {
  if ! command -v jq >/dev/null 2>&1; then
    echo "Error: jq is required but not installed"
    echo "Install with: apt-get install jq (Ubuntu) or brew install jq (macOS)"
    exit 1
  fi
  
  if ! command -v curl >/dev/null 2>&1; then
    echo "Error: curl is required but not installed"
    exit 1
  fi
}

# Run a test with error tracking
run_test() {
  local test_name="$1"
  local test_command="$2"
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  echo -n "[$TOTAL_TESTS] $test_name"
  
  if eval "$test_command" >/dev/null 2>&1; then
    echo " OK"
  else
    echo " FAILED"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
}

# Validate dependencies before running tests
check_dependencies

# Run smoke tests with proper error tracking
run_test "GET base page" "curl -fsS '$BASE'"
run_test "GET health" "curl -fsS '$BASE/api/health' | jq -r '.status' | grep -q '^ok$'"

# Create room test
echo -n "[3] POST room create"
if ROOM=$(curl -fsS -X POST "$BASE/api/room/create" 2>/dev/null | jq -r .id 2>/dev/null) && test -n "$ROOM"; then
  echo " id=$ROOM"
else
  echo " FAILED"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Translation test (optional if API key available)
if [ -n "${DEEPL_API_KEY:-}" ]; then
  run_test "POST translate en->de" "curl -fsS -H 'Content-Type: application/json' -d '{\"text\":\"Hello\",\"targetLang\":\"DE\"}' '$BASE/api/translate' | jq -r .translated | grep -qi 'hallo'"
else
  echo "[4] Skipping translate test (DEEPL_API_KEY not set)"
fi

run_test "Signaling health" "curl -fsS '$SIGNALING_URL/health' | jq -r '.status' | grep -q '^ok$'"

# Report final results
PASSED_TESTS=$((TOTAL_TESTS - FAILED_TESTS))
echo ""
echo "=== SMOKE TEST RESULTS ==="
echo "Passed: $PASSED_TESTS/$TOTAL_TESTS"

if [ $FAILED_TESTS -eq 0 ]; then
  echo "All smoke checks passed."
  exit 0
else
  echo "Failed: $FAILED_TESTS/$TOTAL_TESTS"
  echo "Some smoke checks failed."
  exit 1
fi