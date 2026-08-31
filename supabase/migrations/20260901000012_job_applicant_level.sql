-- 구인글 지원 자격: 누구나(any) / 인증된 프로만(pro)
--
-- 문제
--   20260901000005 이후 "프로"는 비용만 있고 이득이 없었다.
--   취미는 아무 제약 없이 지원하는데 프로는 증빙을 인증해야 지원할 수 있으니,
--   합리적인 사용자라면 전부 취미를 고른다. 인증 제도 자체가 죽는다.
--
-- 해결
--   공고 작성자가 지원 자격을 고르게 한다. 프로 인증이 "프로 전용 공고에
--   지원할 수 있는 권한"이 되면서 비용에 대응하는 이득이 생긴다.
--   기존 공고는 전부 'any' — 지금까지의 동작과 같다.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS applicant_level text NOT NULL DEFAULT 'any';

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_applicant_level_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_applicant_level_check CHECK (applicant_level IN ('any', 'pro'));

-- 프로 전용 공고 지원 자격 판정.
-- job_applications 정책 안에서 posts를 읽어야 하는데, posts의 SELECT 정책은
-- is_accepted_applicant를 통해 job_applications를 본다. 20260901000007과 같은
-- 순환을 피하려고 SECURITY DEFINER로 RLS를 벗어난다.
CREATE OR REPLACE FUNCTION public.can_apply_to(p_job_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT CASE
       WHEN p.applicant_level <> 'pro' THEN true
       ELSE EXISTS (
         SELECT 1 FROM public.profiles pr
         WHERE pr.user_id = p_user_id
           AND pr.purpose = 'pro'
           AND pr.credential_verified
       )
     END
     FROM public.posts p WHERE p.id = p_job_id),
    true  -- 공고가 없으면 이 정책이 막을 일이 아니다 (FK가 거른다)
  );
$$;

REVOKE ALL ON FUNCTION public.can_apply_to(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.can_apply_to(uuid, uuid) TO anon, authenticated;

-- 20260901000005의 정책에 자격 조건을 더한다.
DROP POLICY IF EXISTS "Eligible users can create own applications" ON public.job_applications;
CREATE POLICY "Eligible users can create own applications"
  ON public.job_applications FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.profile_is_eligible(auth.uid())
    AND public.can_apply_to(job_id, auth.uid())
  );

-- 프로 전용 공고만 따로 훑는 목록은 없으므로 인덱스는 두지 않는다.

-- ROLLBACK:
--   DROP POLICY IF EXISTS "Eligible users can create own applications" ON public.job_applications;
--   CREATE POLICY "Eligible users can create own applications" ON public.job_applications
--     FOR INSERT TO authenticated
--     WITH CHECK (auth.uid() = user_id AND public.profile_is_eligible(auth.uid()));
--   DROP FUNCTION IF EXISTS public.can_apply_to(uuid, uuid);
--   ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_applicant_level_check;
--   ALTER TABLE public.posts DROP COLUMN IF EXISTS applicant_level;
