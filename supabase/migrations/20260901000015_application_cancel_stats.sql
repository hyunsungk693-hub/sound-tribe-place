-- 지원 취소 시 공고주 지표 갱신.
--
-- 지원 취소는 job_applications 행을 지운다(DELETE 정책은 20260509052836부터 있다).
-- 그런데 trg_refresh_stats_on_application은 AFTER INSERT OR UPDATE라서,
-- 취소된 지원은 user_stats(응답률·응답 중앙값)에 미응답으로 계속 남아 있었다.
-- 답할 대상이 사라졌는데 공고주 응답률만 깎이는 건 틀린 계산이다.
--
-- refresh_stats_on_application은 NEW를 참조하므로 DELETE에 그대로 붙일 수 없다.
-- OLD 기준으로 공고주를 찾는 함수를 따로 둔다.

CREATE OR REPLACE FUNCTION public.refresh_stats_on_application_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner uuid;
BEGIN
  SELECT p.user_id INTO owner FROM public.posts p WHERE p.id = OLD.job_id;
  IF owner IS NOT NULL THEN
    PERFORM public.refresh_user_stats(owner);
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_stats_on_application_delete ON public.job_applications;
CREATE TRIGGER trg_refresh_stats_on_application_delete
  AFTER DELETE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.refresh_stats_on_application_delete();

-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_refresh_stats_on_application_delete ON public.job_applications;
--   DROP FUNCTION IF EXISTS public.refresh_stats_on_application_delete();
