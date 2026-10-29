-- Work Mate 2026-10-24 — READ-ONLY PRODUCTION VERIFICATION
-- Run only AFTER the reviewed migration has been successfully applied.
SELECT table_name FROM information_schema.tables WHERE table_schema='public'
 AND table_name IN ('workmate_break_schedule','workmate_random_breaks','workmate_break_workplace_settings')
 ORDER BY table_name;
SELECT weekday, start_time, end_time FROM public.workmate_break_schedule ORDER BY weekday;
SELECT workplace_type,is_enabled FROM public.workmate_break_workplace_settings ORDER BY workplace_type;
SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname='public'
 AND tablename IN('workmate_break_schedule','workmate_random_breaks','workmate_break_workplace_settings')
 ORDER BY tablename,policyname;
SELECT proname,prosecdef AS security_definer FROM pg_proc
 JOIN pg_namespace n ON n.oid=pg_proc.pronamespace
 WHERE n.nspname='public' AND proname IN('workmate_random_break_guard','workmate_review_weekly_off_atomic');
SELECT has_function_privilege('authenticated', 'public.workmate_review_weekly_off_atomic(uuid,uuid,text,text)', 'EXECUTE') AS auth_can_execute_atomic;
SELECT has_function_privilege('service_role', 'public.workmate_review_weekly_off_atomic(uuid,uuid,text,text)', 'EXECUTE') AS service_can_execute_atomic;
-- Expected: 3 tables, 7 default schedule days (Friday 13:00–14:00),
-- 3 enabled workplaces, 8 RLS policies, atomic RPC definer=false,
-- authenticated cannot execute atomic; service_role can.
