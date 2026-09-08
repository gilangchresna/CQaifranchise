# CQaiFranchise Hermes Cron Scheduler
# Add these commands to your Hermes cron configuration

# ============================================
# CORE AGENTS (Already working via pg_cron)
# ============================================
# executor-cron: */5 min (keep in pg_cron)
# coordinator-pipeline: */15 min (keep in pg_cron)

# ============================================
# ECOSYSTEM AGENTS - Hermes Scheduler
# ============================================

# HOURLY
cron add "underwriter" "0 * * * *" "curl -s -X POST 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/underwriter-agent' -H 'Content-Type: application/json' -H 'Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}'"

# DAILY @ 6AM
cron add "sentinel" "0 6 * * *" "curl -s -X POST 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/sentinel-agent' -H 'Content-Type: application/json' -H 'Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}'"

# DAILY @ 7AM
cron add "steward" "0 7 * * *" "curl -s -X POST 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/steward-agent' -H 'Content-Type: application/json' -H 'Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}'"

# DAILY @ 8AM
cron add "collector" "0 8 * * *" "curl -s -X POST 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/collector-agent' -H 'Content-Type: application/json' -H 'Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}'"

# DAILY @ 9AM
cron add "voice" "0 9 * * *" "curl -s -X POST 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/voice-agent' -H 'Content-Type: application/json' -H 'Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}'"

# DAILY @ 10AM
cron add "bridge" "0 10 * * *" "curl -s -X POST 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/bridge-agent' -H 'Content-Type: application/json' -H 'Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}'"

# DAILY @ 5PM
cron add "shift" "0 17 * * *" "curl -s -X POST 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/shift-agent' -H 'Content-Type: application/json' -H 'Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}'"

# EVERY 15 MIN
cron add "gatekeeper" "*/15 * * * *" "curl -s -X POST 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/gatekeeper-agent' -H 'Content-Type: application/json' -H 'Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}'"

# ============================================
# WEEKLY AGENTS (Monday)
# ============================================

# MONDAY @ 8AM
cron add "coach" "0 8 * * 1" "curl -s -X POST 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/coach-agent' -H 'Content-Type: application/json' -H 'Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}'"

# MONDAY @ 9AM
cron add "curator" "0 9 * * 1" "curl -s -X POST 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/curator-agent' -H 'Content-Type: application/json' -H 'Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}'"

# MONDAY @ 10AM
cron add "ledger" "0 10 * * 1" "curl -s -X POST 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/ledger-agent' -H 'Content-Type: application/json' -H 'Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}'"

# MONDAY @ 11AM
cron add "royalty-auditor" "0 11 * * 1" "curl -s -X POST 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/royalty-auditor-agent' -H 'Content-Type: application/json' -H 'Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}'"

# ============================================
# WEEKLY AGENTS (Other days)
# ============================================

# TUESDAY @ 8AM
cron add "guardian" "0 8 * * 2" "curl -s -X POST 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/guardian-agent' -H 'Content-Type: application/json' -H 'Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}'"

# WEDNESDAY @ 8AM
cron add "benchmarker" "0 8 * * 3" "curl -s -X POST 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/benchmarker-agent' -H 'Content-Type: application/json' -H 'Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}'"

# ============================================
# MONTHLY AGENTS (1st of month)
# ============================================

# 1ST OF MONTH @ 8AM
cron add "librarian" "0 8 1 * *" "curl -s -X POST 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/librarian-agent' -H 'Content-Type: application/json' -H 'Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}'"

# 1ST OF MONTH @ 9AM
cron add "scout" "0 9 1 * *" "curl -s -X POST 'https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/scout-agent' -H 'Content-Type: application/json' -H 'Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}'"
