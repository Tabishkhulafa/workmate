-- WORK MATE PRODUCTION BACKEND REVIEW PACKAGE — 2026-10-24
-- Intended target: oshehhznsrbumiguvhbf ONLY.
-- IMPORTANT: NOT EXECUTED. Production database backup/rollback plan first.
-- Additive creation of 3 new tables, RLS + triggers, and isolated weekly-off RPC.
-- No changes to existing attendance or employee rows during installation.
-- Review this combined script before using SQL Editor. Do not run against other databases.
BEGIN;
-- PHASE 1 — new break schedule and independent break history.
-- No changes to attendance, shifts, profiles, holidays or payroll calculations.

CREATE TABLE IF NOT EXISTS public.workmate_break_schedule (
  weekday smallint PRIMARY KEY CHECK (weekday BETWEEN 1 AND 7),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id),
  CONSTRAINT workmate_break_window_valid CHECK (
    end_time > start_time AND
    extract(epoch FROM (end_time - start_time)) BETWEEN 300 AND 14400
  )
);
COMMENT ON TABLE public.workmate_break_schedule IS 'Display-only daily lunch-break windows in Asia/Kolkata. No automatic attendance deduction.';

INSERT INTO public.workmate_break_schedule (weekday,start_time,end_time)
SELECT n, '13:00'::time, CASE WHEN n=5 THEN '14:00'::time ELSE '13:45'::time END
FROM generate_series(1,7) AS n
ON CONFLICT (weekday) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.workmate_random_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  reason text NOT NULL DEFAULT 'OTHER' CHECK (reason IN ('FOOD','PERSONAL','OTHER')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workmate_break_end_after_start CHECK (ended_at IS NULL OR ended_at >= started_at)
);
COMMENT ON TABLE public.workmate_random_breaks IS 'Independent break audit log. Never modifies attendance punch time or worked minutes.';

CREATE UNIQUE INDEX IF NOT EXISTS workmate_one_open_random_break
  ON public.workmate_random_breaks (employee_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS workmate_random_breaks_employee_date
  ON public.workmate_random_breaks (employee_id,started_at DESC);
CREATE INDEX IF NOT EXISTS workmate_random_breaks_date
  ON public.workmate_random_breaks (started_at DESC);

CREATE OR REPLACE FUNCTION public.workmate_random_break_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Authentication required to start a random break';
    END IF;
    NEW.employee_id := auth.uid();
    NEW.started_at := statement_timestamp();
    NEW.ended_at := NULL;
    NEW.created_at := statement_timestamp();
    NEW.updated_at := statement_timestamp();
    IF NOT EXISTS (
      SELECT 1 FROM public.attendance a
      WHERE a.employee_id = auth.uid()
        AND a.clock_in_at IS NOT NULL AND a.clock_out_at IS NULL
        AND a.clock_in_at >= statement_timestamp() - interval '24 hours'
    ) THEN
      RAISE EXCEPTION 'CLOCK_IN_REQUIRED: Clock in first, then start Random Break';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF auth.uid() IS DISTINCT FROM OLD.employee_id THEN
      RAISE EXCEPTION 'Only the owner can end their random break';
    END IF;
    IF OLD.ended_at IS NOT NULL THEN
      RAISE EXCEPTION 'Completed random breaks are immutable';
    END IF;
    IF NEW.employee_id IS DISTINCT FROM OLD.employee_id
       OR NEW.started_at IS DISTINCT FROM OLD.started_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.reason IS DISTINCT FROM OLD.reason THEN
      RAISE EXCEPTION 'Break identity, reason and start time cannot be modified';
    END IF;
    IF NEW.ended_at IS NULL THEN
      RAISE EXCEPTION 'Use Break Out to end an active random break';
    END IF;
    NEW.ended_at := statement_timestamp();
    NEW.updated_at := statement_timestamp();
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Invalid break operation';
END;
$$;

DROP TRIGGER IF EXISTS workmate_random_break_guard_trigger ON public.workmate_random_breaks;
CREATE TRIGGER workmate_random_break_guard_trigger
BEFORE INSERT OR UPDATE ON public.workmate_random_breaks
FOR EACH ROW EXECUTE FUNCTION public.workmate_random_break_guard();

CREATE OR REPLACE FUNCTION public.workmate_break_schedule_guard()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.weekday <> OLD.weekday THEN
    RAISE EXCEPTION 'Break schedule weekday cannot be changed';
  END IF;
  NEW.updated_by := auth.uid();
  NEW.updated_at := statement_timestamp();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS workmate_break_schedule_guard_trigger ON public.workmate_break_schedule;
CREATE TRIGGER workmate_break_schedule_guard_trigger
BEFORE UPDATE ON public.workmate_break_schedule
FOR EACH ROW EXECUTE FUNCTION public.workmate_break_schedule_guard();

ALTER TABLE public.workmate_break_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workmate_random_breaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workmate_break_schedule_read ON public.workmate_break_schedule;
CREATE POLICY workmate_break_schedule_read ON public.workmate_break_schedule
FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.profiles p
         WHERE p.id=(SELECT auth.uid()) AND p.is_active=true)
);
DROP POLICY IF EXISTS workmate_break_schedule_manager ON public.workmate_break_schedule;
CREATE POLICY workmate_break_schedule_manager ON public.workmate_break_schedule
FOR UPDATE TO authenticated USING (
 EXISTS (SELECT 1 FROM public.profiles p
  WHERE p.id=(SELECT auth.uid()) AND p.is_active=true
    AND p.must_change_password=false AND p.role::text IN ('HR','SUPER_ADMIN'))
) WITH CHECK (
 EXISTS (SELECT 1 FROM public.profiles p
  WHERE p.id=(SELECT auth.uid()) AND p.is_active=true
    AND p.must_change_password=false AND p.role::text IN ('HR','SUPER_ADMIN'))
);

DROP POLICY IF EXISTS workmate_random_breaks_own_read ON public.workmate_random_breaks;
CREATE POLICY workmate_random_breaks_own_read ON public.workmate_random_breaks
FOR SELECT TO authenticated USING (employee_id=(SELECT auth.uid()));

DROP POLICY IF EXISTS workmate_random_breaks_scoped_read ON public.workmate_random_breaks;
CREATE POLICY workmate_random_breaks_scoped_read ON public.workmate_random_breaks
FOR SELECT TO authenticated USING (
 EXISTS (
   SELECT 1 FROM public.profiles viewer
   JOIN public.profiles subject ON subject.id=workmate_random_breaks.employee_id
   WHERE viewer.id=(SELECT auth.uid()) AND viewer.is_active=true
     AND subject.is_active=true
     AND (
       viewer.role::text='SUPER_ADMIN'
       OR (viewer.role::text='HR' AND subject.role::text IN ('EMPLOYEE','DEPARTMENT_HEAD'))
       OR (viewer.role::text='DEPARTMENT_HEAD' AND subject.role::text='EMPLOYEE'
           AND viewer.department_id IS NOT NULL AND viewer.department_id=subject.department_id)
     )
 )
);

DROP POLICY IF EXISTS workmate_random_breaks_own_insert ON public.workmate_random_breaks;
CREATE POLICY workmate_random_breaks_own_insert ON public.workmate_random_breaks
FOR INSERT TO authenticated WITH CHECK (
 employee_id=(SELECT auth.uid())
 AND EXISTS (SELECT 1 FROM public.profiles p
  WHERE p.id=(SELECT auth.uid()) AND p.is_active=true
   AND p.must_change_password=false AND p.role::text IN ('EMPLOYEE','DEPARTMENT_HEAD','HR'))
);

DROP POLICY IF EXISTS workmate_random_breaks_own_end ON public.workmate_random_breaks;
CREATE POLICY workmate_random_breaks_own_end ON public.workmate_random_breaks
FOR UPDATE TO authenticated USING (
 employee_id=(SELECT auth.uid()) AND ended_at IS NULL
 AND EXISTS (SELECT 1 FROM public.profiles p
  WHERE p.id=(SELECT auth.uid()) AND p.is_active=true
   AND p.must_change_password=false AND p.role::text IN ('EMPLOYEE','DEPARTMENT_HEAD','HR'))
) WITH CHECK (employee_id=(SELECT auth.uid()));

-- No DELETE policy, no random-break admin update, no schedule insert/delete policy.
-- Data API needs grants AND RLS. Never grant service-role credentials to the browser.
GRANT SELECT ON public.workmate_break_schedule TO authenticated;
GRANT UPDATE ON public.workmate_break_schedule TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.workmate_random_breaks TO authenticated;

-- PHASE 2 — per-workplace Random Break controls.
-- No modifications to existing attendance/clock-in/clock-out, shifts, face/GPS or payroll.
-- All three workplaces initially ENABLED, preserving prior Random Break availability.

CREATE TABLE IF NOT EXISTS public.workmate_break_workplace_settings (
  workplace_type text PRIMARY KEY CHECK (workplace_type IN ('OFFICE','STORE','WAREHOUSE')),
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

INSERT INTO public.workmate_break_workplace_settings(workplace_type,is_enabled)
VALUES ('OFFICE',true),('STORE',true),('WAREHOUSE',true)
ON CONFLICT (workplace_type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.workmate_break_workplace_settings_guard()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.workplace_type IS DISTINCT FROM OLD.workplace_type THEN
    RAISE EXCEPTION 'Workplace cannot be renamed';
  END IF;
  NEW.updated_at := statement_timestamp();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS workmate_break_workplace_settings_guard_trigger ON public.workmate_break_workplace_settings;
CREATE TRIGGER workmate_break_workplace_settings_guard_trigger
BEFORE UPDATE ON public.workmate_break_workplace_settings
FOR EACH ROW EXECUTE FUNCTION public.workmate_break_workplace_settings_guard();

ALTER TABLE public.workmate_break_workplace_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workmate_break_workplace_read ON public.workmate_break_workplace_settings;
CREATE POLICY workmate_break_workplace_read ON public.workmate_break_workplace_settings
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id=(SELECT auth.uid()) AND p.is_active=true)
);

DROP POLICY IF EXISTS workmate_break_workplace_manager ON public.workmate_break_workplace_settings;
CREATE POLICY workmate_break_workplace_manager ON public.workmate_break_workplace_settings
FOR UPDATE TO authenticated USING (
 EXISTS (SELECT 1 FROM public.profiles p
  WHERE p.id=(SELECT auth.uid()) AND p.is_active=true
    AND p.must_change_password=false AND p.role::text IN ('HR','SUPER_ADMIN'))
) WITH CHECK (
 EXISTS (SELECT 1 FROM public.profiles p
  WHERE p.id=(SELECT auth.uid()) AND p.is_active=true
    AND p.must_change_password=false AND p.role::text IN ('HR','SUPER_ADMIN'))
);

GRANT SELECT, UPDATE ON public.workmate_break_workplace_settings TO authenticated;

-- Patch the EXISTING database break guard so direct API/database INSERT attempts
-- cannot bypass the workplace toggle. KEEP existing timestamp and clock-in guards.
CREATE OR REPLACE FUNCTION public.workmate_random_break_guard()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
DECLARE
  actual_workplace text;
  workplace_allowed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Authentication required to start a random break';
    END IF;

    SELECT CASE
      WHEN upper(trim(p.workplace_type)) IN ('OFFICE','STORE','WAREHOUSE') THEN upper(trim(p.workplace_type))
      WHEN upper(trim(d.department_type)) IN ('OFFICE','STORE','WAREHOUSE') THEN upper(trim(d.department_type))
      ELSE NULL END
    INTO actual_workplace
    FROM public.profiles p
    LEFT JOIN public.departments d ON d.id=p.department_id
    WHERE p.id=auth.uid() AND p.is_active=true AND p.must_change_password=false
      AND p.role::text IN ('EMPLOYEE','DEPARTMENT_HEAD','HR');

    IF actual_workplace IS NULL THEN
      RAISE EXCEPTION 'WORKPLACE_NOT_CONFIGURED: Ask HR to set your workplace';
    END IF;

    SELECT is_enabled INTO workplace_allowed
      FROM public.workmate_break_workplace_settings
      WHERE workplace_type=actual_workplace FOR SHARE;
    IF workplace_allowed IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'RANDOM_BREAK_DISABLED: Random Break is disabled for %', actual_workplace;
    END IF;

    NEW.employee_id := auth.uid();
    NEW.started_at := statement_timestamp();
    NEW.ended_at := NULL;
    NEW.created_at := statement_timestamp();
    NEW.updated_at := statement_timestamp();

    IF NOT EXISTS (
      SELECT 1 FROM public.attendance a
      WHERE a.employee_id = auth.uid()
        AND a.clock_in_at IS NOT NULL AND a.clock_out_at IS NULL
        AND a.clock_in_at >= statement_timestamp() - interval '24 hours'
    ) THEN
      RAISE EXCEPTION 'CLOCK_IN_REQUIRED: Clock in first, then start Random Break';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Always allow an existing running break to END, even if its workplace
    -- was disabled after Break In. Existing history and reason are immutable.
    IF auth.uid() IS DISTINCT FROM OLD.employee_id THEN
      RAISE EXCEPTION 'Only the owner can end their random break';
    END IF;
    IF OLD.ended_at IS NOT NULL THEN
      RAISE EXCEPTION 'Completed random breaks are immutable';
    END IF;
    IF NEW.employee_id IS DISTINCT FROM OLD.employee_id
       OR NEW.started_at IS DISTINCT FROM OLD.started_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.reason IS DISTINCT FROM OLD.reason THEN
      RAISE EXCEPTION 'Break identity, reason and start time cannot be modified';
    END IF;
    IF NEW.ended_at IS NULL THEN
      RAISE EXCEPTION 'Use Break Out to end an active random break';
    END IF;
    NEW.ended_at := statement_timestamp();
    NEW.updated_at := statement_timestamp();
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Invalid break operation';
END;
$$;

-- PHASE 3 — service-role-only atomic Weekly Off approval RPC.
-- This function is accessible to service_role only; Edge Function authenticates
-- and authorizes every review before calling it. No attendance rows are touched.
CREATE OR REPLACE FUNCTION public.workmate_review_weekly_off_atomic(
 p_request_id uuid,p_reviewer_id uuid,p_decision text,p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_req record; v_reviewed_at timestamptz := now();
BEGIN
 IF p_decision NOT IN ('APPROVED','REJECTED') THEN
   RAISE EXCEPTION 'Invalid decision';
 END IF;
 SELECT id,employee_id,requested_day,status INTO v_req
 FROM public.weekly_off_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
 IF v_req.status <> 'PENDING' THEN RAISE EXCEPTION 'Request already reviewed'; END IF;
 IF p_decision='APPROVED' THEN
   UPDATE public.profiles SET weekly_off_day=v_req.requested_day
   WHERE id=v_req.employee_id AND is_active=true;
   IF NOT FOUND THEN RAISE EXCEPTION 'Employee inactive'; END IF;
 END IF;
 UPDATE public.weekly_off_requests
 SET status=p_decision,reviewed_by=p_reviewer_id,reviewed_at=v_reviewed_at,
     review_note=p_note,updated_at=v_reviewed_at
 WHERE id=p_request_id;
 RETURN jsonb_build_object('id',p_request_id,'status',p_decision,'reviewed_at',v_reviewed_at);
END;
$$;
REVOKE ALL ON FUNCTION public.workmate_review_weekly_off_atomic(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.workmate_review_weekly_off_atomic(uuid,uuid,text,text) TO service_role;

COMMIT;
