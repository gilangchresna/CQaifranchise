#!/bin/bash
# CQaiFranchise Hermes Cron Setup Script
# Run this script to setup Hermes cron jobs for all ecosystem agents

# Set your Supabase Service Role Key
export SUPABASE_SERVICE_ROLE_KEY="your-key-here"

BASE_URL="https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1"
AUTH_HEADER="Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

echo "Setting up Hermes cron jobs for CQaiFranchise agents..."

# HOURLY
echo "Adding underwriter (hourly)..."
# cron add "underwriter" "0 * * * *" "curl -s -X POST '${BASE_URL}/underwriter-agent' -H 'Content-Type: application/json' -H '${AUTH_HEADER}'"

# DAILY @ 6AM
echo "Adding sentinel (daily 6AM)..."
# cron add "sentinel" "0 6 * * *" "curl -s -X POST '${BASE_URL}/sentinel-agent' -H 'Content-Type: application/json' -H '${AUTH_HEADER}'"

# DAILY @ 7AM
echo "Adding steward (daily 7AM)..."
# cron add "steward" "0 7 * * *" "curl -s -X POST '${BASE_URL}/steward-agent' -H 'Content-Type: application/json' -H '${AUTH_HEADER}'"

# DAILY @ 8AM
echo "Adding collector (daily 8AM)..."
# cron add "collector" "0 8 * * *" "curl -s -X POST '${BASE_URL}/collector-agent' -H 'Content-Type: application/json' -H '${AUTH_HEADER}'"

# DAILY @ 9AM
echo "Adding voice (daily 9AM)..."
# cron add "voice" "0 9 * * *" "curl -s -X POST '${BASE_URL}/voice-agent' -H 'Content-Type: application/json' -H '${AUTH_HEADER}'"

# DAILY @ 10AM
echo "Adding bridge (daily 10AM)..."
# cron add "bridge" "0 10 * * *" "curl -s -X POST '${BASE_URL}/bridge-agent' -H 'Content-Type: application/json' -H '${AUTH_HEADER}'"

# DAILY @ 5PM
echo "Adding shift (daily 5PM)..."
# cron add "shift" "0 17 * * *" "curl -s -X POST '${BASE_URL}/shift-agent' -H 'Content-Type: application/json' -H '${AUTH_HEADER}'"

# EVERY 15 MIN
echo "Adding gatekeeper (every 15min)..."
# cron add "gatekeeper" "*/15 * * * *" "curl -s -X POST '${BASE_URL}/gatekeeper-agent' -H 'Content-Type: application/json' -H '${AUTH_HEADER}'"

# MONDAY @ 8AM
echo "Adding coach (Monday 8AM)..."
# cron add "coach" "0 8 * * 1" "curl -s -X POST '${BASE_URL}/coach-agent' -H 'Content-Type: application/json' -H '${AUTH_HEADER}'"

# MONDAY @ 9AM
echo "Adding curator (Monday 9AM)..."
# cron add "curator" "0 9 * * 1" "curl -s -X POST '${BASE_URL}/curator-agent' -H 'Content-Type: application/json' -H '${AUTH_HEADER}'"

# MONDAY @ 10AM
echo "Adding ledger (Monday 10AM)..."
# cron add "ledger" "0 10 * * 1" "curl -s -X POST '${BASE_URL}/ledger-agent' -H 'Content-Type: application/json' -H '${AUTH_HEADER}'"

# MONDAY @ 11AM
echo "Adding royalty-auditor (Monday 11AM)..."
# cron add "royalty-auditor" "0 11 * * 1" "curl -s -X POST '${BASE_URL}/royalty-auditor-agent' -H 'Content-Type: application/json' -H '${AUTH_HEADER}'"

# TUESDAY @ 8AM
echo "Adding guardian (Tuesday 8AM)..."
# cron add "guardian" "0 8 * * 2" "curl -s -X POST '${BASE_URL}/guardian-agent' -H 'Content-Type: application/json' -H '${AUTH_HEADER}'"

# WEDNESDAY @ 8AM
echo "Adding benchmarker (Wednesday 8AM)..."
# cron add "benchmarker" "0 8 * * 3" "curl -s -X POST '${BASE_URL}/benchmarker-agent' -H 'Content-Type: application/json' -H '${AUTH_HEADER}'"

# 1ST OF MONTH @ 8AM
echo "Adding librarian (1st of month 8AM)..."
# cron add "librarian" "0 8 1 * *" "curl -s -X POST '${BASE_URL}/librarian-agent' -H 'Content-Type: application/json' -H '${AUTH_HEADER}'"

# 1ST OF MONTH @ 9AM
echo "Adding scout (1st of month 9AM)..."
# cron add "scout" "0 9 1 * *" "curl -s -X POST '${BASE_URL}/scout-agent' -H 'Content-Type: application/json' -H '${AUTH_HEADER}'"

echo ""
echo "Setup complete! Uncomment the cron commands above and run them."
echo "Or use the Hermes CLI directly:"
echo ""
echo "Example: hermes cron add sentinel '0 6 * * *' 'curl -s -X POST https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/sentinel-agent -H Content-Type:application/json -H Authorization:Bearer \$SUPABASE_SERVICE_ROLE_KEY'"
