-- 프로필 카드(D 모듈) 정체성 필드 + A1 확장 (W1~2)
-- profiles SELECT는 공개 정책(USING true)이므로 새 컬럼도 카드 렌더링에 바로 사용 가능

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS purpose text,
  ADD COLUMN IF NOT EXISTS available_times text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS handle text;

-- 목적: 취미(hobby) / 프로(pro)
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_purpose_check CHECK (purpose IS NULL OR purpose IN ('hobby', 'pro'));

-- 공개 핸들(/u/{handle} 예정): 소문자 영숫자·하이픈 3~20자, 전역 유일
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_handle_format CHECK (handle IS NULL OR handle ~ '^[a-z0-9-]{3,20}$');

CREATE UNIQUE INDEX IF NOT EXISTS uniq_profiles_handle
  ON public.profiles (handle) WHERE handle IS NOT NULL;
