-- Work Mate: ensure at most ONE DEPARTMENT_HEAD per department.
-- Review before executing: live conflict as checked 2026-10-26: Other / Review: Test4 = official head_user_id; test18 = duplicate.
-- This migration is additive except the explicitly guarded duplicate correction below.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Refuse to silently decide winners for any unexpected or newly-created duplicate departments.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.departments d ON d.id=p.department_id
    WHERE p.role='DEPARTMENT_HEAD'
    GROUP BY p.department_id
    HAVING count(*) > 1 AND
      (p.department_id <> '5c328f6a-952e-4e8e-aa12-1d166c4eb6be'::uuid OR count(*) <> 2)
  ) THEN
    RAISE EXCEPTION 'Unexpected department-head duplicates found. Stop and review.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.departments d
    JOIN public.profiles p ON p.id=d.head_user_id
    WHERE d.id='5c328f6a-952e-4e8e-aa12-1d166c4eb6be'::uuid
    AND d.head_user_id='3133f090-b871-4457-9773-4f5f178f8166'::uuid
    AND p.role='DEPARTMENT_HEAD' AND p.department_id=d.id
  ) THEN
    RAISE EXCEPTION 'Official Other / Review head changed: do not modify roles.';
  END IF;
END $$;

-- Correct only the confirmed duplicate; preserve Test4 (official assigned head).
UPDATE public.profiles
SET role='EMPLOYEE'::public.app_role,updated_at=now()
WHERE id='13beab95-28ed-4fa3-8108-eb941015c098'::uuid
  AND department_id='5c328f6a-952e-4e8e-aa12-1d166c4eb6be'::uuid
  AND role='DEPARTMENT_HEAD'::public.app_role;

-- Guaranteed at most one Head per department even if another API directly modifies roles.
CREATE UNIQUE INDEX IF NOT EXISTS workmate_one_head_per_department
ON public.profiles(department_id)
WHERE role='DEPARTMENT_HEAD'::public.app_role AND department_id IS NOT NULL;

-- Atomic assignment; called ONLY from authorized Edge Function with service_role.
CREATE OR REPLACE FUNCTION public.workmate_assign_department_head_atomic(
  p_department_id uuid,p_employee_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_department public.departments%ROWTYPE;
  v_employee public.profiles%ROWTYPE;
  v_previous_id uuid;
  v_demoted integer := 0;
BEGIN
  SELECT * INTO v_department FROM public.departments
    WHERE id=p_department_id AND is_active=true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active department not found.';
  END IF;
  SELECT * INTO v_employee FROM public.profiles
    WHERE id=p_employee_id FOR UPDATE;
  IF NOT FOUND OR v_employee.department_id IS DISTINCT FROM p_department_id
    OR v_employee.is_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Select an active employee from this department.';
  END IF;
  IF v_employee.role <> 'EMPLOYEE'::public.app_role AND
    NOT (v_employee.role='DEPARTMENT_HEAD'::public.app_role AND
         v_department.head_user_id=p_employee_id) THEN
    RAISE EXCEPTION 'Only an Employee from this department can become Head.';
  END IF;

  v_previous_id:=v_department.head_user_id;
  -- Demote ALL duplicates, not just head_user_id; unique index protects against races.
  UPDATE public.profiles SET role='EMPLOYEE'::public.app_role,updated_at=now()
    WHERE department_id=p_department_id AND role='DEPARTMENT_HEAD'::public.app_role
      AND id <> p_employee_id;
  GET DIAGNOSTICS v_demoted=ROW_COUNT;
  UPDATE public.profiles SET role='DEPARTMENT_HEAD'::public.app_role,updated_at=now()
    WHERE id=p_employee_id;
  UPDATE public.departments SET head_user_id=p_employee_id,updated_at=now()
    WHERE id=p_department_id;
  RETURN jsonb_build_object('success',true,'department_id',p_department_id,
       'head_user_id',p_employee_id,'previous_head_user_id',v_previous_id,
       'demoted_count',v_demoted);
END;
$$;
REVOKE ALL ON FUNCTION public.workmate_assign_department_head_atomic(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.workmate_assign_department_head_atomic(uuid,uuid) TO service_role;

-- Guard that no duplicates survive; fails and rolls back entire migration otherwise.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE role='DEPARTMENT_HEAD'::public.app_role
    AND department_id IS NOT NULL GROUP BY department_id HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Duplicate department heads remain; rolling back.';
  END IF;
END $$;
COMMIT;
