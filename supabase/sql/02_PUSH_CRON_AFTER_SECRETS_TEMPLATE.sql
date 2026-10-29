-- OPTIONAL. RUN ONLY AFTER app deployment, dispatcher smoke-test,
-- Vercel WORKMATE_PUSH_DISPATCH_SECRET, and Supabase vault secret creation.
-- No secret should be pasted into a committed source file.
-- First enable the pg_net extension in Supabase Dashboard → Database → Extensions.
-- In Supabase Vault create:
--    name = workmate_push_dispatch_secret    value = SAME LONG SECRET AS VERCEL
-- Then replace YOUR_WORKMATE_LIVE_DOMAIN in the next query.
-- Supabase Free pg_cron can run every minute; Vercel Hobby native cron cannot.
-- WARNING: Vault secret must be accessible only via service jobs; DB net queue contains a transient request header.
SELECT cron.schedule('workmate-dispatch-push','* * * * *', $job$
 SELECT net.http_post(
   url:='https://YOUR_WORKMATE_LIVE_DOMAIN/api/notifications/dispatch',
   headers:=jsonb_build_object(
     'Content-Type','application/json',
     'Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='workmate_push_dispatch_secret' LIMIT 1)
   ),
   body:='{}'::jsonb,
   timeout_milliseconds:=10000
 );
$job$);
-- To disable: SELECT cron.unschedule('workmate-dispatch-push');
