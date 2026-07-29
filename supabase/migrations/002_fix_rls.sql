-- Fix RLS policies for service_role access
-- Run this to allow service_role to insert data

-- Drop existing insert policies
DROP POLICY IF EXISTS "HQ can insert outlets" ON public.outlets;
DROP POLICY IF EXISTS "Service role can insert sales" ON public.sales_transactions;
DROP POLICY IF EXISTS "Service role can insert alerts" ON public.alerts;
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

-- Create new policies that allow service_role
CREATE POLICY "Service role can insert outlets"
    ON public.outlets FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "Service role can insert sales"
    ON public.sales_transactions FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "Service role can insert alerts"
    ON public.alerts FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "Service role can insert notifications"
    ON public.notifications FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "Service role can view all"
    ON public.outlets FOR SELECT
    TO service_role
    USING (true);

CREATE POLICY "Service role can view sales"
    ON public.sales_transactions FOR SELECT
    TO service_role
    USING (true);

CREATE POLICY "Service role can view alerts"
    ON public.alerts FOR SELECT
    TO service_role
    USING (true);
