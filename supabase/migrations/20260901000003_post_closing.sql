-- 구인 완료(마감) 글은 공고에서 숨기고 합격자만 볼 수 있게 한다.
--
-- posts.status('open' 기본)는 20260825000001에서 추가됐지만 UI에서 전혀 쓰이지 않았다.
-- 마감 처리 수단(closed_at)과 열람 제한(RLS)을 함께 도입한다.
--
-- 마감 트리거는 작성자의 수동 "모집 마감" 버튼이다. 합격 처리(job_applications.status
-- = 'accepted')와 분리한다 — 여러 명을 뽑는 공고가 첫 합격자에서 닫히면 안 되기 때문이다.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- status 허용값 고정 (기존 데이터는 전부 'open')
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_status_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_status_check CHECK (status IN ('open', 'closed'));

-- 마감 글 열람 제한.
-- 기존 "Public can read posts"(USING true)를 대체한다.
--   · open 글           → 비로그인 포함 전체 공개(E4 유지)
--   · closed 구인글     → 작성자 + 해당 공고의 accepted 지원자만
--   · job이 아닌 글     → status와 무관하게 공개(커뮤니티·연습실·악기사)
DROP POLICY IF EXISTS "Public can read posts" ON public.posts;
CREATE POLICY "Public can read open posts, closed jobs limited"
  ON public.posts FOR SELECT
  USING (
    status <> 'closed'
    OR post_type <> 'job'
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.job_applications a
      WHERE a.job_id = posts.id
        AND a.user_id = auth.uid()
        AND a.status = 'accepted'
    )
  );

-- 목록 조회는 항상 status='open'으로 좁혀 들어오므로 부분 인덱스를 둔다
CREATE INDEX IF NOT EXISTS idx_posts_job_open
  ON public.posts (post_type, status, created_at DESC)
  WHERE post_type = 'job' AND status = 'open';

-- ROLLBACK:
--   DROP INDEX IF EXISTS public.idx_posts_job_open;
--   DROP POLICY IF EXISTS "Public can read open posts, closed jobs limited" ON public.posts;
--   CREATE POLICY "Public can read posts" ON public.posts FOR SELECT USING (true);
--   ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_status_check;
--   ALTER TABLE public.posts DROP COLUMN IF EXISTS closed_at;
