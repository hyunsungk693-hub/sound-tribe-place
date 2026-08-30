-- 작업 8: 프로필 필수화 및 목적별 증빙 인증
--
-- 개인정보를 다루는 마이그레이션이다. 설계 원칙:
--   1. 증빙 원본 이미지는 검증 후 파기한다. 원본을 영구 보관하지 않는다.
--   2. DB에는 검증 결과값만 남긴다 — 인증 종류 / 인증 일시 / 검증자 / 통과 여부.
--   3. 원본 파일 경로 컬럼을 두지 않는다. 경로는 id에서 파생되고(credentials/{user_id}/{id}),
--      파기 후에는 아무것도 남지 않는다.
--   4. 업로드는 비공개 버킷에만, 접근은 서명 URL로만.
--   5. 검증은 수동이다. 자동 OCR 검증은 만들지 않는다.
--
-- profiles.purpose(hobby|pro)와 profiles.video_url은 20260829000001에 이미 있으므로
-- 재사용한다. 새로 만들지 않는다.

-- ── 1. 비공개 버킷 ──
INSERT INTO storage.buckets (id, name, public)
VALUES ('credentials', 'credentials', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 업로드는 본인 폴더에만, 열람은 본인과 관리자만. 공개 열람 정책은 두지 않는다.
DROP POLICY IF EXISTS "Upload own credentials" ON storage.objects;
CREATE POLICY "Upload own credentials"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'credentials'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Read own or admin credentials" ON storage.objects;
CREATE POLICY "Read own or admin credentials"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'credentials'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS "Delete own or admin credentials" ON storage.objects;
CREATE POLICY "Delete own or admin credentials"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'credentials'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- ── 2. 검증 결과 테이블 ──
CREATE TABLE IF NOT EXISTS public.profile_credentials (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        text NOT NULL,   -- diploma | admission | award
  status      text NOT NULL DEFAULT 'pending',  -- pending | verified | rejected
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  purge_after timestamptz,     -- 원본 파기 예정 시각 (NULL = 파기 완료 또는 원본 없음)
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_credentials_kind_check   CHECK (kind IN ('diploma', 'admission', 'award')),
  CONSTRAINT profile_credentials_status_check CHECK (status IN ('pending', 'verified', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_profile_credentials_user
  ON public.profile_credentials (user_id, status);

ALTER TABLE public.profile_credentials ENABLE ROW LEVEL SECURITY;

-- 인증 "여부"는 배지로 공개되지만, 어떤 종류로 인증했는지는 본인·관리자만 본다.
CREATE POLICY "Read own credentials"
  ON public.profile_credentials FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Create own credentials"
  ON public.profile_credentials FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Delete own pending credentials"
  ON public.profile_credentials FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');

-- 검증(verified/rejected 전환)은 관리자만. 수동 처리다.
CREATE POLICY "Admins verify credentials"
  ON public.profile_credentials FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 검증되는 순간 파기 예정 시각을 박는다 (검증 후 30일).
CREATE OR REPLACE FUNCTION public.set_credential_purge_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('verified', 'rejected') AND OLD.status = 'pending' THEN
    NEW.verified_at := now();
    NEW.verified_by := auth.uid();
    NEW.purge_after := now() + interval '30 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credential_purge_schedule ON public.profile_credentials;
CREATE TRIGGER trg_credential_purge_schedule
  BEFORE UPDATE ON public.profile_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_credential_purge_schedule();

-- ── 3. 공개용 인증 플래그 ──
-- profile_credentials는 본인·관리자만 읽을 수 있다(인증 "종류"는 개인정보다).
-- 배지와 RLS 판정에는 종류가 필요 없으므로, 공개 가능한 불리언만 profiles에 둔다.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credential_verified boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.sync_credential_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := COALESCE(NEW.user_id, OLD.user_id);
BEGIN
  UPDATE public.profiles p
  SET credential_verified = EXISTS (
    SELECT 1 FROM public.profile_credentials c
    WHERE c.user_id = uid AND c.status = 'verified'
  )
  WHERE p.user_id = uid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_credential_verified ON public.profile_credentials;
CREATE TRIGGER trg_sync_credential_verified
  AFTER INSERT OR UPDATE OR DELETE ON public.profile_credentials
  FOR EACH ROW EXECUTE FUNCTION public.sync_credential_verified();

-- 자격 판정 단일 지점.
--   취미 / 미설정 → 통과
--   프로          → verified 증빙 1건 이상 필요
-- profiles를 읽지만 대상은 항상 본인 행(user_id = auth.uid())이라 정책상 항상 보인다.
-- SECURITY DEFINER를 쓰지 않으므로 profiles 정책과 재귀하지 않는다.
CREATE OR REPLACE FUNCTION public.profile_is_eligible(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT purpose IS DISTINCT FROM 'pro' OR credential_verified
     FROM public.profiles WHERE user_id = uid),
    true  -- 프로필 행이 아직 없으면 막지 않는다
  );
$$;

-- ── 4. 미충족 프로는 프로필 비공개 ──
-- 함수 호출 없이 컬럼만으로 판정한다 (profiles 정책 안에서 profiles를 다시 읽으면 재귀).
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Eligible profiles are public"
  ON public.profiles FOR SELECT
  USING (
    user_id = auth.uid()
    OR purpose IS DISTINCT FROM 'pro'
    OR credential_verified
  );

-- ── 5. 미충족 프로는 구인글 작성·지원 불가 ──
DROP POLICY IF EXISTS "Logged in users can create posts" ON public.posts;
CREATE POLICY "Eligible users can create posts"
  ON public.posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.profile_is_eligible(auth.uid()));

DROP POLICY IF EXISTS "Users can create own applications" ON public.job_applications;
CREATE POLICY "Eligible users can create own applications"
  ON public.job_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.profile_is_eligible(auth.uid()));

-- ── 6. 원본 파기 배치 ──
-- purge_after가 지난 증빙의 원본을 지우고, 결과값(kind/status/verified_at/verified_by)만 남긴다.
-- storage.objects 행을 지우면 Storage API에서 더 이상 조회·서명URL 발급이 불가능해진다.
-- (바이트 단위 삭제까지 보장하려면 pg_net + Edge Function으로 Storage API를 호출하도록
--  아래 DELETE를 교체하면 된다. 현재 프로젝트에는 pg_net이 설치돼 있지 않다.)
CREATE OR REPLACE FUNCTION public.purge_expired_credentials()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purged int := 0;
BEGIN
  WITH expired AS (
    SELECT id, user_id FROM public.profile_credentials
    WHERE purge_after IS NOT NULL AND purge_after < now()
  ),
  gone AS (
    DELETE FROM storage.objects o
    USING expired e
    WHERE o.bucket_id = 'credentials'
      AND o.name = e.user_id::text || '/' || e.id::text
    RETURNING 1
  )
  SELECT count(*) INTO purged FROM gone;

  -- 파기 완료 표시 (다음 배치에서 다시 잡히지 않도록)
  UPDATE public.profile_credentials
  SET purge_after = NULL
  WHERE purge_after IS NOT NULL AND purge_after < now();

  RETURN purged;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-expired-credentials') THEN
    -- 매일 04:00 UTC
    PERFORM cron.schedule('purge-expired-credentials', '0 4 * * *', 'SELECT public.purge_expired_credentials()');
  END IF;
END;
$$;

-- ROLLBACK:
--   SELECT cron.unschedule('purge-expired-credentials');
--   DROP FUNCTION IF EXISTS public.purge_expired_credentials();
--   DROP POLICY IF EXISTS "Eligible users can create own applications" ON public.job_applications;
--   CREATE POLICY "Users can create own applications" ON public.job_applications
--     FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
--   DROP POLICY IF EXISTS "Eligible users can create posts" ON public.posts;
--   CREATE POLICY "Logged in users can create posts" ON public.posts
--     FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
--   DROP POLICY IF EXISTS "Eligible profiles are public" ON public.profiles;
--   CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
--   DROP FUNCTION IF EXISTS public.profile_is_eligible(uuid);
--   DROP TRIGGER IF EXISTS trg_sync_credential_verified ON public.profile_credentials;
--   DROP FUNCTION IF EXISTS public.sync_credential_verified();
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS credential_verified;
--   DROP TRIGGER IF EXISTS trg_credential_purge_schedule ON public.profile_credentials;
--   DROP FUNCTION IF EXISTS public.set_credential_purge_schedule();
--   DROP TABLE IF EXISTS public.profile_credentials;
--   DROP POLICY IF EXISTS "Delete own or admin credentials" ON storage.objects;
--   DROP POLICY IF EXISTS "Read own or admin credentials" ON storage.objects;
--   DROP POLICY IF EXISTS "Upload own credentials" ON storage.objects;
--   DELETE FROM storage.buckets WHERE id = 'credentials';
