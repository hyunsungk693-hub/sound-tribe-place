-- 관리자 증빙 검토를 위한 profiles 열람 예외.
--
-- 문제
--   20260901000005의 "Eligible profiles are public" 정책은 증빙 미인증 프로의
--   profiles 행을 본인 외에는 아무에게도 안 보여준다. 관리자도 예외가 아니다.
--   그런데 증빙 검토 대상은 정확히 그 사람들이다. 관리자 화면에서
--   profile_credentials는 읽히는데 profiles는 안 읽혀서 신청자가 UUID로만 보였다.
--
-- 해결
--   정책에 관리자 절을 더한다. has_role은 SECURITY DEFINER로 user_roles만 읽으므로
--   profiles 정책 안에서 호출해도 재귀하지 않는다(20260901000007의 posts 사고와 다름).
--   공개 범위는 그대로다 — 관리자만 늘어난다.

DROP POLICY IF EXISTS "Eligible profiles are public" ON public.profiles;
CREATE POLICY "Eligible profiles are public"
  ON public.profiles FOR SELECT
  USING (
    user_id = auth.uid()
    OR purpose IS DISTINCT FROM 'pro'
    OR credential_verified
    OR public.has_role(auth.uid(), 'admin')
  );

-- ROLLBACK:
--   DROP POLICY IF EXISTS "Eligible profiles are public" ON public.profiles;
--   CREATE POLICY "Eligible profiles are public" ON public.profiles FOR SELECT
--     USING (user_id = auth.uid() OR purpose IS DISTINCT FROM 'pro' OR credential_verified);
