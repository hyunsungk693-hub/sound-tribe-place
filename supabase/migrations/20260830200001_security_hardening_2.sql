-- 보안 감사 2차 하드닝 (버그바운티 결과 반영)

-- ============================================================
-- HIGH-2: message-files 버킷 접근통제 붕괴 (IDOR)
--   기존: public 버킷 + 인증만 하면 전체 첨부 열람/다운로드
--   변경: 비공개 버킷 + 소유 폴더만 접근 (클라이언트는 서명 URL 사용)
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'message-files';

DROP POLICY IF EXISTS "Anyone can view message files" ON storage.objects;

-- 첨부 열람은 해당 대화 참여자만: 경로 첫 세그먼트(업로더 uid)가 본인이거나,
-- 그 업로더와 대화 관계가 있는 사용자만 허용
CREATE POLICY "Conversation members view message files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'message-files'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND (storage.foldername(name))[1] IN (c.user1_id::text, c.user2_id::text)
    )
  )
);

-- ============================================================
-- HIGH-1: 프로필 video_url 저장형 XSS
--   javascript:/data: 등 위험 스킴 저장 자체를 차단 (허용 호스트만)
-- ============================================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_video_url_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_video_url_check CHECK (
    video_url IS NULL
    OR video_url ~* '^https://([a-z0-9-]+\.)*(youtube\.com|youtu\.be|instagram\.com)/'
  );

-- ============================================================
-- LOW-2: 공고주가 지원서의 status 외 컬럼(자기소개 등)까지 변조
--   UPDATE 권한을 status 컬럼으로만 제한
-- ============================================================
REVOKE UPDATE ON public.job_applications FROM authenticated;
GRANT UPDATE (status) ON public.job_applications TO authenticated;

-- ============================================================
-- LOW-1: API 직접 가입 시 display_name = 이메일 노출 방지
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      split_part(NEW.email, '@', 1),  -- 이메일 로컬파트만 (도메인 비노출)
      '음악인'
    )
  );
  RETURN NEW;
END;
$$;
