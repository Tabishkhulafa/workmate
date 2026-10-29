-- STAGING ONLY: install in a SEPARATE TEST project after its Work Mate schema exists.
-- This function is accessible to service_role only; Edge Function authenticates
-- and authorizes every review before calling it. No attendance rows are touched.
BEGIN;
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
