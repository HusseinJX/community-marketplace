-- The vendor backend tables were created with open RLS policies but never
-- granted to the anon role (only `products` had an explicit grant). The app and
-- API routes access Supabase with the anon key, so without these grants every
-- read/write to these tables fails with 42501 (permission denied). Auth is
-- enforced at the app layer (Clerk + resolveActor), matching the open-RLS model.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_connect_accounts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_settings TO anon, authenticated;

GRANT ALL ON public.vendor_profiles TO service_role;
GRANT ALL ON public.stripe_connect_accounts TO service_role;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.vendor_settings TO service_role;
