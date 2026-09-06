-- Fix: disable RLS on system_status so REST API bulk inserts bypass trigger lock
ALTER TABLE public.system_status DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_status_read_all" ON public.system_status;
DROP POLICY IF EXISTS "system_status_update_service" ON public.system_status;
