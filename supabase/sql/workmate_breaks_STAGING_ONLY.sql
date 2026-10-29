-- WORK MATE BREAKS / STAGING ONLY
-- Run ONLY against a SEPARATE staging Supabase project, NEVER the existing
-- production project. This script creates NEW tables and policies; it does
-- not alter attendance, shifts, profiles, holidays, or payroll calculations.

BEGIN;

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

COMMIT;
