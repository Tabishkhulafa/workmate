-- Work Mate: role-scoped request notifications (additive; no historical replays).
-- Review before applying to production. No existing request rows are updated.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE TABLE IF NOT EXISTS public.workmate_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 category text NOT NULL CHECK (category IN ('PASSWORD_RESET','FACE_CHANGE','LEAVE','REGULARIZATION')),
 request_id uuid NOT NULL,
 event_type text NOT NULL CHECK (event_type IN ('SUBMITTED','APPROVED','REJECTED','COMPLETED','DISMISSED','CODE_READY')),
 title text NOT NULL,
 body text NOT NULL,
 href text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz,
 push_claimed_at timestamptz,
 push_sent_at timestamptz,
 push_attempts integer NOT NULL DEFAULT 0,
 UNIQUE (recipient_id,category,request_id,event_type)
);
CREATE INDEX IF NOT EXISTS wm_notifications_recipient_recent ON public.workmate_notifications(recipient_id,created_at DESC);
CREATE INDEX IF NOT EXISTS wm_notifications_push_pending ON public.workmate_notifications(created_at) WHERE push_sent_at IS NULL;
ALTER TABLE public.workmate_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workmate_notifications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.workmate_notifications TO authenticated;
GRANT UPDATE(read_at) ON public.workmate_notifications TO authenticated;
DROP POLICY IF EXISTS wm_notifications_select_own ON public.workmate_notifications;
CREATE POLICY wm_notifications_select_own ON public.workmate_notifications FOR SELECT TO authenticated USING (recipient_id=(select auth.uid()));
DROP POLICY IF EXISTS wm_notifications_mark_read_own ON public.workmate_notifications;
CREATE POLICY wm_notifications_mark_read_own ON public.workmate_notifications FOR UPDATE TO authenticated USING (recipient_id=(select auth.uid())) WITH CHECK (recipient_id=(select auth.uid()));

CREATE TABLE IF NOT EXISTS public.workmate_push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 endpoint text NOT NULL UNIQUE CHECK (length(endpoint) BETWEEN 20 AND 2500 AND endpoint LIKE 'https://%'),
 p256dh text NOT NULL CHECK (length(p256dh) BETWEEN 20 AND 300),
 auth_key text NOT NULL CHECK (length(auth_key) BETWEEN 10 AND 200),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wm_push_subscriptions_user ON public.workmate_push_subscriptions(user_id);
ALTER TABLE public.workmate_push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workmate_push_subscriptions FROM PUBLIC,anon,authenticated;
GRANT SELECT, INSERT, DELETE ON public.workmate_push_subscriptions TO authenticated;
GRANT UPDATE(p256dh,auth_key,updated_at) ON public.workmate_push_subscriptions TO authenticated;
DROP POLICY IF EXISTS wm_push_select_own ON public.workmate_push_subscriptions;
CREATE POLICY wm_push_select_own ON public.workmate_push_subscriptions FOR SELECT TO authenticated USING (user_id=(select auth.uid()));
DROP POLICY IF EXISTS wm_push_insert_own ON public.workmate_push_subscriptions;
CREATE POLICY wm_push_insert_own ON public.workmate_push_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id=(select auth.uid()));
DROP POLICY IF EXISTS wm_push_update_own ON public.workmate_push_subscriptions;
CREATE POLICY wm_push_update_own ON public.workmate_push_subscriptions FOR UPDATE TO authenticated USING (user_id=(select auth.uid())) WITH CHECK (user_id=(select auth.uid()));
DROP POLICY IF EXISTS wm_push_delete_own ON public.workmate_push_subscriptions;
CREATE POLICY wm_push_delete_own ON public.workmate_push_subscriptions FOR DELETE TO authenticated USING (user_id=(select auth.uid()));

CREATE SCHEMA IF NOT EXISTS workmate_private;
REVOKE ALL ON SCHEMA workmate_private FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION workmate_private.notify_request_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_employee_id uuid;
 v_role public.app_role;
 v_department_id uuid;
 v_category text;
 v_title text;
 v_href text;
 v_event text;
 v_recipient record;
BEGIN
 CASE TG_TABLE_NAME
  WHEN 'password_reset_requests' THEN v_employee_id:=NEW.user_id;v_category:='PASSWORD_RESET';v_title:='Password reset';v_href:='/password-reset-requests';
  WHEN 'face_reenrollment_requests' THEN v_employee_id:=NEW.employee_id;v_category:='FACE_CHANGE';v_title:='Face change';v_href:='/face-reviews';
  WHEN 'leave_requests' THEN v_employee_id:=NEW.employee_id;v_category:='LEAVE';v_title:='Leave';v_href:='/approvals/leaves';
  WHEN 'attendance_regularizations' THEN v_employee_id:=NEW.employee_id;v_category:='REGULARIZATION';v_title:='Attendance regularization';v_href:='/approvals/regularizations';
  ELSE RETURN NEW;
 END CASE;
 IF TG_OP='INSERT' THEN
  IF NEW.status::text <> 'PENDING' THEN RETURN NEW; END IF;
  v_event:='SUBMITTED';
 ELSIF OLD.status::text IS DISTINCT FROM NEW.status::text THEN
  IF NEW.status::text IN ('APPROVED','REJECTED') THEN v_event:=NEW.status::text;
  ELSIF v_category='PASSWORD_RESET' AND NEW.status::text IN ('COMPLETED','DISMISSED') THEN v_event:=NEW.status::text;
  ELSE RETURN NEW; END IF;
 ELSIF v_category='PASSWORD_RESET' AND NEW.reset_code_generated_at IS DISTINCT FROM OLD.reset_code_generated_at AND NEW.reset_code_generated_at IS NOT NULL THEN
  v_event:='CODE_READY';
 ELSE RETURN NEW; END IF;
 SELECT p.role,p.department_id INTO v_role,v_department_id FROM public.profiles p WHERE p.id=v_employee_id AND p.is_active;
 IF v_role IS NULL THEN RETURN NEW; END IF;
 IF v_event='SUBMITTED' THEN
  FOR v_recipient IN
   SELECT p.id FROM public.profiles p WHERE p.is_active AND p.id<>v_employee_id AND
    (p.role='SUPER_ADMIN'::public.app_role
     OR (v_role IN ('EMPLOYEE'::public.app_role,'DEPARTMENT_HEAD'::public.app_role) AND p.role='HR'::public.app_role)
     OR (v_role='EMPLOYEE'::public.app_role AND v_department_id IS NOT NULL
          AND p.role='DEPARTMENT_HEAD'::public.app_role AND p.department_id=v_department_id AND v_category<>'PASSWORD_RESET'))
  LOOP
   INSERT INTO public.workmate_notifications (recipient_id,requester_id,category,request_id,event_type,title,body,href)
   VALUES (v_recipient.id,v_employee_id,v_category,NEW.id,'SUBMITTED',v_title||' request',
     'New '||lower(v_title)||' request needs your review.',v_href)
   ON CONFLICT (recipient_id,category,request_id,event_type) DO NOTHING;
  END LOOP;
 ELSE
  IF v_event<>'CODE_READY' THEN
   UPDATE public.workmate_notifications
     SET read_at=COALESCE(read_at,now()), push_sent_at=COALESCE(push_sent_at,now())
   WHERE category=v_category AND request_id=NEW.id AND event_type='SUBMITTED';
  END IF;
  IF v_event='CODE_READY' THEN
    INSERT INTO public.workmate_notifications (recipient_id,requester_id,category,request_id,event_type,title,body,href)
    VALUES(v_employee_id,v_employee_id,v_category,NEW.id,v_event,'Password reset update',
      'A reset code has been prepared. Obtain it securely from your authorized reviewer.','/login')
    ON CONFLICT (recipient_id,category,request_id,event_type) DO NOTHING;
  ELSE
    INSERT INTO public.workmate_notifications (recipient_id,requester_id,category,request_id,event_type,title,body,href)
    VALUES(v_employee_id,v_employee_id,v_category,NEW.id,v_event,v_title||' request update',
      CASE v_event WHEN 'APPROVED' THEN 'Your '||lower(v_title)||' request has been approved.'
      WHEN 'REJECTED' THEN 'Your '||lower(v_title)||' request has been rejected.'
      WHEN 'COMPLETED' THEN 'Your password reset has been completed.'
      ELSE 'Your password reset request was dismissed.' END,
      CASE v_category WHEN 'PASSWORD_RESET' THEN '/login' WHEN 'FACE_CHANGE' THEN '/face-change'
        WHEN 'LEAVE' THEN '/leaves' ELSE '/regularizations' END)
    ON CONFLICT (recipient_id,category,request_id,event_type) DO NOTHING;
  END IF;
 END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN
 -- Notifications must never block a legitimate password/attendance/leave request.
 RAISE WARNING 'Work Mate notification fanout failed for %, SQLSTATE %', TG_TABLE_NAME, SQLSTATE;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION workmate_private.notify_request_change() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS wm_notification_password_reset ON public.password_reset_requests;
CREATE TRIGGER wm_notification_password_reset AFTER INSERT OR UPDATE ON public.password_reset_requests FOR EACH ROW EXECUTE FUNCTION workmate_private.notify_request_change();
DROP TRIGGER IF EXISTS wm_notification_face_change ON public.face_reenrollment_requests;
CREATE TRIGGER wm_notification_face_change AFTER INSERT OR UPDATE ON public.face_reenrollment_requests FOR EACH ROW EXECUTE FUNCTION workmate_private.notify_request_change();
DROP TRIGGER IF EXISTS wm_notification_leave ON public.leave_requests;
CREATE TRIGGER wm_notification_leave AFTER INSERT OR UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION workmate_private.notify_request_change();
DROP TRIGGER IF EXISTS wm_notification_regularization ON public.attendance_regularizations;
CREATE TRIGGER wm_notification_regularization AFTER INSERT OR UPDATE ON public.attendance_regularizations FOR EACH ROW EXECUTE FUNCTION workmate_private.notify_request_change();

-- Claim a bounded batch for the *separate*, secret-authenticated push dispatcher.
CREATE OR REPLACE FUNCTION public.workmate_claim_push_notifications(p_limit integer DEFAULT 25)
RETURNS TABLE (id uuid,recipient_id uuid,title text,body text,href text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 RETURN QUERY
 WITH pending AS (
  SELECT n.id FROM public.workmate_notifications n
  WHERE n.push_sent_at IS NULL AND n.push_attempts<8
   AND (n.event_type <> 'SUBMITTED' OR n.read_at IS NULL)
   AND (n.push_claimed_at IS NULL OR n.push_claimed_at<now()-interval '2 minutes')
  ORDER BY n.created_at FOR UPDATE SKIP LOCKED LIMIT LEAST(GREATEST(p_limit,1),50)
 ), claimed AS (
  UPDATE public.workmate_notifications n
  SET push_claimed_at=now(),push_attempts=n.push_attempts+1
  WHERE n.id IN (SELECT pending.id FROM pending)
  RETURNING n.id,n.recipient_id,n.title,n.body,n.href
 ) SELECT c.id,c.recipient_id,c.title,c.body,c.href FROM claimed c;
END;$$;
REVOKE ALL ON FUNCTION public.workmate_claim_push_notifications(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.workmate_claim_push_notifications(integer) TO service_role;
COMMIT;
