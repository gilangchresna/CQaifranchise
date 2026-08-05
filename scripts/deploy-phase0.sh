# Phase 0 Deployment Script
# AIFrCQ Security Hotfixes
# Date: August 5, 2026

# ============================================================
# BEFORE DEPLOYING: Set these secrets in Supabase
# ============================================================

# 1. Generate secure HMAC secret for POS webhook
POS_SECRET=$(openssl rand -hex 32)
echo "POS_WEBHOOK_SECRET=$POS_SECRET"

# 2. Generate secure secret for lender webhook
LENDER_SECRET=$(openssl rand -hex 32)
echo "LENDER_WEBHOOK_SECRET=$LENDER_SECRET"

# ============================================================
# STEP 1: Set Environment Secrets
# ============================================================

# Set POS Webhook HMAC Secret
# Purpose: Secure POS webhook from fake transaction injection
# Without this, anyone can send fake sales data
supabase secrets set POS_WEBHOOK_SECRET="$POS_SECRET" \
  --project-ref ploqeifazcgzwjzmukgp

# Set Lender Webhook Secret  
# Purpose: Secure lender webhook from fake EMI/repayment events
# Without this, anyone can inject fake payment data
supabase secrets set LENDER_WEBHOOK_SECRET="$LENDER_SECRET" \
  --project-ref ploqeifazcgzwjzmukgp

echo "✅ Secrets set successfully"
echo "⚠️  Save POS_SECRET and LENDER_SECRET somewhere safe!"

# ============================================================
# STEP 2: Deploy Changed Edge Functions
# ============================================================

# ────────────────────────────────────────────────────────────
# 1. pos-webhook
# ────────────────────────────────────────────────────────────
# What: POS data ingestion endpoint
# Why deploy: Added HMAC-SHA256 authentication
# Security: Now rejects requests without valid signature
echo "Deploying pos-webhook..."
supabase functions deploy pos-webhook \
  --project-ref ploqeifazcgzwjzmukgp
echo "✅ pos-webhook deployed"

# ────────────────────────────────────────────────────────────
# 2. lender-bridge
# ────────────────────────────────────────────────────────────
# What: Loan application + webhook handler
# Why deploy: Fixed webhook fail-open (was accepting requests without secret)
# Security: Now returns 503 if LENDER_WEBHOOK_SECRET not configured
echo "Deploying lender-bridge..."
supabase functions deploy lender-bridge \
  --project-ref ploqeifazcgzwjzmukgp
echo "✅ lender-bridge deployed"

# ────────────────────────────────────────────────────────────
# 3. agent-status
# ────────────────────────────────────────────────────────────
# What: Returns agent health status (monitor, analyst, etc.)
# Why deploy: Added JWT authentication
# Security: Was publicly accessible, now requires login
echo "Deploying agent-status..."
supabase functions deploy agent-status \
  --project-ref ploqeifazcgzwjzmukgp
echo "✅ agent-status deployed"

# ────────────────────────────────────────────────────────────
# 4. alerts-list
# ────────────────────────────────────────────────────────────
# What: Returns list of alerts with outlet info
# Why deploy: Added JWT authentication
# Security: Was publicly accessible, now requires login
echo "Deploying alerts-list..."
supabase functions deploy alerts-list \
  --project-ref ploqeifazcgzwjzmukgp
echo "✅ alerts-list deployed"

# ────────────────────────────────────────────────────────────
# 5. db-stats
# ────────────────────────────────────────────────────────────
# What: Returns monthly transaction statistics
# Why deploy: Added JWT authentication
# Security: Was publicly accessible, now requires login
echo "Deploying db-stats..."
supabase functions deploy db-stats \
  --project-ref ploqeifazcgzwjzmukgp
echo "✅ db-stats deployed"

# ────────────────────────────────────────────────────────────
# 6. debug-db
# ────────────────────────────────────────────────────────────
# What: Database state debugging (HQ_ADMIN only)
# Why deploy: Fixed authentication, removed sensitive info leakage
# Security: Now properly verifies HQ_ADMIN role
echo "Deploying debug-db..."
supabase functions deploy debug-db \
  --project-ref ploqeifazcgzwjzmukgp
echo "✅ debug-db deployed"

# ────────────────────────────────────────────────────────────
# 7. fix-rls
# ────────────────────────────────────────────────────────────
# What: RLS policy status checker
# Why deploy: Made READ-ONLY (cannot disable RLS anymore)
# Security: Was able to disable RLS, now only shows status
echo "Deploying fix-rls..."
supabase functions deploy fix-rls \
  --project-ref ploqeifazcgzwjzmukgp
echo "✅ fix-rls deployed"

# ────────────────────────────────────────────────────────────
# 8. apply-migration
# ────────────────────────────────────────────────────────────
# What: Migration execution
# Why deploy: DISABLED arbitrary SQL execution
# Security: Was dangerous, now returns error message only
echo "Deploying apply-migration..."
supabase functions deploy apply-migration \
  --project-ref ploqeifazcgzwjzmukgp
echo "✅ apply-migration deployed"

# ────────────────────────────────────────────────────────────
# 9. apply-rls-fix
# ────────────────────────────────────────────────────────────
# What: RLS fix execution
# Why deploy: Removed dangerous rpc("exec") call
# Security: Was allowing arbitrary SQL, now safe
echo "Deploying apply-rls-fix..."
supabase functions deploy apply-rls-fix \
  --project-ref ploqeifazcgzwjzmukgp
echo "✅ apply-rls-fix deployed"

# ============================================================
# STEP 3: Build & Deploy Frontend
# ============================================================

echo "Building frontend..."
npm run build

# Then deploy to Vercel or your hosting provider
# vercel --prod  # Uncomment if using Vercel

# ============================================================
# STEP 4: Update POS Integrations
# ============================================================

# ⚠️ IMPORTANT: Update POS webhook senders to include HMAC signature

# Example Node.js:
# const crypto = require('crypto');
# const signature = crypto
#   .createHmac('sha256', POS_SECRET)
#   .update(JSON.stringify(payload))
#   .digest('hex');
# fetch(webhookUrl, {
#   method: 'POST',
#   headers: {
#     'Content-Type': 'application/json',
#     'x-pos-signature': signature
#   },
#   body: JSON.stringify(payload)
# });

# ============================================================
# STEP 5: Update Lender Configuration
# ============================================================

# ⚠️ IMPORTANT: Configure lender to send secret header

# Lender must send:
# x-lender-webhook-secret: <LENDER_SECRET>
# Content-Type: application/json

# ============================================================
# STEP 6: Verify Deployment
# ============================================================

echo ""
echo "============================================================"
echo "✅ Deployment Complete!"
echo "============================================================"
echo ""
echo "Testing POS webhook (should return 401 without signature):"
curl -s -X POST \
  "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/pos-webhook" \
  -H "Content-Type: application/json" \
  -d '{"transaction_id":"test","outlet_id":1,"date":"2026-08-05","amount":100}'
echo ""
echo ""
echo "Testing lender webhook (should return 401/503 without secret):"
curl -s -X POST \
  "https://ploqeifazcgzwjzmukgp.supabase.co/functions/v1/lender-bridge/webhook" \
  -H "Content-Type: application/json" \
  -d '{"event_type":"EMI_PAID"}'
echo ""
echo ""
echo "============================================================"
echo "📝 NEXT STEPS:"
echo "============================================================"
echo "1. Update POS integrations with HMAC signature"
echo "2. Configure lender webhook secret"
echo "3. Test frontend: http://localhost:3000"
echo "4. Check Supabase Dashboard > Edge Functions > Logs"
echo ""
