-- WORK MATE / RANDOM BREAK WORKPLACE CONTROLS - STAGING ONLY
-- Apply on an ISOLATED TEST Supabase project after workmate_breaks_STAGING_ONLY.sql.
-- DO NOT execute against production (oshehhznsrbumiguvhbf).
-- No modifications to existing attendance/clock-in/clock-out, shifts, face/GPS or payroll.
-- All three workplaces initially ENABLED, preserving prior Random Break availability.

BEGIN;

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

COMMIT;
