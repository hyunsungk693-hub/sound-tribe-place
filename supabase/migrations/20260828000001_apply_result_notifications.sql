-- 지원 결과(합격/불합격) 알림
-- 공고 작성자가 지원 상태를 accepted/rejected로 바꾸면 지원자에게 알림 생성

-- 1. 알림 유형 확장
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('like', 'comment', 'apply_accepted', 'apply_rejected'));

-- 2. 상태 변경 트리거
CREATE OR REPLACE FUNCTION public.notify_on_application_result()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_title_v text;
  owner_name text;
BEGIN
  IF NEW.status IN ('accepted', 'rejected') AND NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT p.title INTO job_title_v FROM public.posts p WHERE p.id = NEW.job_id;
    SELECT COALESCE(pr.display_name, '공고 작성자') INTO owner_name
    FROM public.posts p
    JOIN public.profiles pr ON pr.user_id = p.user_id
    WHERE p.id = NEW.job_id;

    INSERT INTO public.notifications (user_id, actor_name, type, post_id, post_title)
    VALUES (
      NEW.user_id,
      COALESCE(owner_name, '공고 작성자'),
      CASE WHEN NEW.status = 'accepted' THEN 'apply_accepted' ELSE 'apply_rejected' END,
      NEW.job_id,
      job_title_v
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_application_result ON public.job_applications;
CREATE TRIGGER trg_notify_on_application_result
  AFTER UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_application_result();
