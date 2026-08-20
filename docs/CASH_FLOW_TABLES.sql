-- ============================================================
-- Cash Flow System Tables
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- Cash Flow Snapshots Table
CREATE TABLE IF NOT EXISTS public.cash_flow_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  source_type VARCHAR(20) NOT NULL DEFAULT 'EXCEL',
  source_file TEXT,
  total_balance DECIMAL(14,2),
  monthly_inflow DECIMAL(14,2) DEFAULT 0,
  monthly_outflow DECIMAL(14,2) DEFAULT 0,
  net_cash_flow DECIMAL(14,2) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  data_quality VARCHAR(20) DEFAULT 'MANUAL',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cash Flow Transactions Table
CREATE TABLE IF NOT EXISTS public.cash_flow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID REFERENCES public.cash_flow_snapshots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  description TEXT,
  amount DECIMAL(14,2) NOT NULL,
  category VARCHAR(50),
  category_detail VARCHAR(100),
  is_inflow BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cashflow_snapshots_user ON public.cash_flow_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_snapshots_date ON public.cash_flow_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_cashflow_transactions_snapshot ON public.cash_flow_transactions(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_transactions_user ON public.cash_flow_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_transactions_date ON public.cash_flow_transactions(transaction_date);

-- Enable RLS
ALTER TABLE public.cash_flow_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_flow_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users read own cashflow snapshots" ON public.cash_flow_snapshots;
CREATE POLICY "Users read own cashflow snapshots" ON public.cash_flow_snapshots FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own cashflow snapshots" ON public.cash_flow_snapshots;
CREATE POLICY "Users insert own cashflow snapshots" ON public.cash_flow_snapshots FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own cashflow transactions" ON public.cash_flow_transactions;
CREATE POLICY "Users read own cashflow transactions" ON public.cash_flow_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own cashflow transactions" ON public.cash_flow_transactions;
CREATE POLICY "Users insert own cashflow transactions" ON public.cash_flow_transactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin read all cashflow snapshots" ON public.cash_flow_snapshots;
CREATE POLICY "Admin read all cashflow snapshots" ON public.cash_flow_snapshots FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'HQ_ADMIN')
);

DROP POLICY IF EXISTS "Admin read all cashflow transactions" ON public.cash_flow_transactions;
CREATE POLICY "Admin read all cashflow transactions" ON public.cash_flow_transactions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'HQ_ADMIN')
);

-- Verify
SELECT 'cash_flow_snapshots' as table_name FROM public.cash_flow_snapshots LIMIT 1;
SELECT 'cash_flow_transactions' as table_name FROM public.cash_flow_transactions LIMIT 1;
