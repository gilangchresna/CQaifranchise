-- Remove FK constraint from user_profiles
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);
