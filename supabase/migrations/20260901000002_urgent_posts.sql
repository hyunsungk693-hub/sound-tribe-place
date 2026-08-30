-- 작업 7: 홈 상단 섹션을 "최근 구인글" → "급구 구인글"로 전환하기 위한 선행 스키마
--
-- 지시서의 예시는 job_posts(deadline_at, is_urgent)였으나 실제 테이블은
-- public.posts(post_type='job')이므로 그에 맞춘다.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false;

-- 급구 정렬 전용 부분 인덱스 (급구 글만 색인 → 인덱스가 작게 유지된다)
CREATE INDEX IF NOT EXISTS idx_posts_urgent_deadline
  ON public.posts (is_urgent, deadline_at)
  WHERE is_urgent;

-- 급구가 부족할 때 최근순으로 채우는 폴백 정렬용
CREATE INDEX IF NOT EXISTS idx_posts_job_created
  ON public.posts (post_type, created_at DESC)
  WHERE post_type = 'job';

-- ROLLBACK:
--   DROP INDEX IF EXISTS public.idx_posts_job_created;
--   DROP INDEX IF EXISTS public.idx_posts_urgent_deadline;
--   ALTER TABLE public.posts DROP COLUMN IF EXISTS is_urgent;
--   ALTER TABLE public.posts DROP COLUMN IF EXISTS deadline_at;
