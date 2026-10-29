-- Follow-on to 01_WORKMATE_NOTIFICATION_INBOX.sql from the Approval Notifications package.
-- One 12:05 PM India-time notification per employee per HR / Super Admin, once per date.
-- No edits to existing employees, attendance, punches, or leave records.
-- Review and apply ONLY AFTER the notification inbox migration is live and UI is deployed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
 IF to_regclass('public.workmate_notifications') IS NULL THEN
  RAISE EXCEPTION 'Apply 01_WORKMATE_NOTIFICATION_INBOX.sql first.';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
  RAISE EXCEPTION 'pg_cron is not enabled.';
 END IF;
END $$;

ALTER TABLE public.workmate_notifications
 ADD COLUMN IF NOT EXISTS attendance_date date;
ALTER TABLE public.workmate_notifications
 DROP CONSTRAINT IF EXISTS workmate_notifications_category_check;
ALTER TABLE public.workmate_notifications
 ADD CONSTRAINT workmate_notifications_category_check
 CHECK (category IN ('PASSWORD_RESET','FACE_CHANGE','LEAVE','REGULARIZATION','MISSING_CLOCKIN'));
CREATE UNIQUE INDEX IF NOT EXISTS wm_noon_missing_once_per_day
 ON public.workmate_notifications (recipient_id, requester_id, attendance_date)
 WHERE category='MISSING_CLOCKIN';

CREATE OR REPLACE FUNCTION workmate_private.queue_noon_missing_clockins()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
 v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
 v_time time := (now() AT TIME ZONE 'Asia/Kolkata')::time;
 v_day text;
 v_count integer := 0;
BEGIN
 -- Do nothing on manual/out-of-window invocations; 12:05 IST cron is the intended trigger.
 IF v_time < time '12:00' OR v_time >= time '12:30' THEN RETURN 0; END IF;
 IF EXISTS (SELECT 1 FROM public.holidays h WHERE h.is_active AND h.holiday_date=v_today) THEN RETURN 0; END IF;
 v_day := upper(trim(to_char(v_today::timestamp, 'FMDay')));

 WITH missing AS (
  SELECT e.id,e.full_name,e.employee_code,e.work_location_id
  FROM public.profiles e
  LEFT JOIN LATERAL (
   SELECT candidates.start_time FROM (
     SELECT o.start_time, o.created_at,
       CASE o.scope::text WHEN 'EMPLOYEE' THEN 1 WHEN 'DEPARTMENT' THEN 2 ELSE 3 END AS priority
     FROM public.shift_overrides o
     WHERE o.is_active AND v_today BETWEEN o.start_date AND o.end_date
       AND ((o.scope::text='EMPLOYEE' AND o.employee_id=e.id)
       OR (o.scope::text='DEPARTMENT' AND o.department_id=e.department_id)
       OR o.scope::text='ORGANISATION')
     UNION ALL
     SELECT sh.start_time,sa.created_at,
       CASE sa.scope::text WHEN 'EMPLOYEE' THEN 4 WHEN 'DEPARTMENT' THEN 5 ELSE 6 END AS priority
     FROM public.shift_assignments sa
     JOIN public.shifts sh ON sh.id=sa.shift_id AND sh.is_active
     WHERE sa.is_active AND sa.effective_from<=v_today
      AND (sa.effective_to IS NULL OR sa.effective_to>=v_today)
      AND ((sa.scope::text='EMPLOYEE' AND sa.employee_id=e.id)
       OR (sa.scope::text='DEPARTMENT' AND sa.department_id=e.department_id)
       OR sa.scope::text='ORGANISATION')
   ) candidates ORDER BY candidates.priority,candidates.created_at DESC LIMIT 1
  ) effective ON true
  WHERE e.is_active
    AND e.role::text IN ('EMPLOYEE','DEPARTMENT_HEAD','HR')
    AND (e.date_of_joining IS NULL OR e.date_of_joining<=v_today)
    AND (e.weekly_off_day IS NULL OR upper(e.weekly_off_day)<>v_day)
    AND (effective.start_time IS NULL OR effective.start_time<=time '12:00')
    AND NOT EXISTS (SELECT 1 FROM public.attendance a
        WHERE a.employee_id=e.id AND a.attendance_date=v_today
          AND a.clock_in_at IS NOT NULL
          AND a.clock_in_at <= ((v_today + time '12:00') AT TIME ZONE 'Asia/Kolkata'))
    AND NOT EXISTS (SELECT 1 FROM public.leave_requests lr
        WHERE lr.employee_id=e.id AND lr.status::text='APPROVED'
          AND lr.start_date<=v_today AND lr.end_date>=v_today)
 ), inserted AS (
  INSERT INTO public.workmate_notifications
    (recipient_id,requester_id,category,request_id,event_type,title,body,href,attendance_date)
  SELECT reviewer.id,m.id,'MISSING_CLOCKIN',gen_random_uuid(),'SUBMITTED',
    '12 PM Clock In Missing',
    coalesce(nullif(m.full_name,''),'Employee') ||
      ' ('||coalesce(nullif(m.employee_code,''),'No code')||') has not clocked in by 12:00 PM IST.',
    '/attendance?date='||v_today::text||'&location='||coalesce(m.work_location_id::text,'all'),
    v_today
  FROM missing m CROSS JOIN public.profiles reviewer
  WHERE reviewer.is_active AND reviewer.role::text IN ('HR','SUPER_ADMIN') AND reviewer.id<>m.id
  ON CONFLICT (recipient_id,requester_id,attendance_date)
    WHERE category='MISSING_CLOCKIN'
  DO NOTHING
  RETURNING id
 )
 SELECT count(*) INTO v_count FROM inserted;
 RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION workmate_private.queue_noon_missing_clockins() FROM PUBLIC,anon,authenticated;

-- Supabase pg_cron timezone was verified as GMT; 06:35 UTC = 12:05 PM IST.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='workmate-noon-missing-clockins') THEN
  PERFORM cron.schedule(
    'workmate-noon-missing-clockins','35 6 * * *',
    'SELECT workmate_private.queue_noon_missing_clockins();'
  );
 END IF;
END $$;
COMMIT;
-- To pause only the new noon alerts:
-- SELECT cron.unschedule('workmate-noon-missing-clockins');
