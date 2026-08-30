-- 긴급 수정: posts SELECT 정책의 무한 재귀
--
-- 증상
--   로그인(authenticated) 상태에서 posts를 읽으면 500:
--     ERROR 42P17: infinite recursion detected in policy for relation "posts"
--   비로그인(anon)은 통과해서 배포 검증에서 놓쳤다. 로그인 사용자에게는
--   구인·연습실·악기사·커뮤니티·홈이 전부 빈 목록으로 보였다.
--
-- 원인
--   20260901000003의 정책이 EXISTS로 job_applications를 읽는데,
--   job_applications의 SELECT 정책은 다시 posts를 읽는다(공고 주인 확인).
--     posts 정책 → job_applications 정책 → posts 정책 → ...
--   anon은 planner가 post_type <> 'job' 등에서 먼저 걸러 재귀에 도달하지 않았을 뿐,
--   정책 자체가 잘못돼 있었다.
--
-- 수정
--   합격자 판정을 SECURITY DEFINER 함수로 분리한다. 함수는 소유자 권한으로 실행되어
--   job_applications의 RLS를 타지 않으므로 순환이 끊긴다.
--   (profile_is_eligible에서 profiles 재귀를 컬럼으로 피한 것과 같은 이유다)

CREATE OR REPLACE FUNCTION public.is_accepted_applicant(p_job_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.job_applications a
    WHERE a.job_id = p_job_id
      AND a.user_id = p_user_id
      AND a.status = 'accepted'
  );
$$;

REVOKE ALL ON FUNCTION public.is_accepted_applicant(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_accepted_applicant(uuid, uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Public can read open posts, closed jobs limited" ON public.posts;
CREATE POLICY "Public can read open posts, closed jobs limited"
  ON public.posts FOR SELECT
  USING (
    status <> 'closed'
    OR post_type <> 'job'
    OR user_id = auth.uid()
    OR public.is_accepted_applicant(id, auth.uid())
  );

-- ROLLBACK:
--   DROP POLICY IF EXISTS "Public can read open posts, closed jobs limited" ON public.posts;
--   CREATE POLICY "Public can read posts" ON public.posts FOR SELECT USING (true);
--   DROP FUNCTION IF EXISTS public.is_accepted_applicant(uuid, uuid);
--   (20260901000003 의 EXISTS 버전으로 되돌리면 재귀가 다시 발생하므로 쓰지 말 것)
