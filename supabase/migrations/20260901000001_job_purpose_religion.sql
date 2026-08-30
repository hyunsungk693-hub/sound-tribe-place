-- 작업 4: 구인글 활동 목적에 "종교" 분류 추가 (+ 하위 유형)
--
-- 주의: 이것은 구인글(posts)의 목적 필드다. 사용자 개인의 종교 속성이 아니며
-- profiles에는 어떤 종교 정보도 저장하지 않는다.
--
-- 프론트의 tag = DB의 posts.category. enum이 아니라 자유 텍스트 컬럼이고
-- community('자유')·room·shop이 같은 컬럼을 공유하므로 전역 CHECK는 걸 수 없다.
-- post_type='job'일 때만 값 목록을 강제한다. 기존 job 3건이 category NULL이므로
-- NULL도 허용한다.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS subcategory text;

-- 구인글 카테고리 허용값 (기존 5종 + 종교)
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_job_category_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_job_category_check CHECK (
    post_type <> 'job'
    OR category IS NULL
    OR category IN ('공연', '녹음', '레슨', '행사', '종교', '기타')
  );

-- 하위 유형은 종교 목적에서만 쓰인다
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_subcategory_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_subcategory_check CHECK (
    subcategory IS NULL
    OR (category = '종교' AND subcategory IN ('교회 반주자', '찬양팀 세션'))
  );

-- 목록 필터(카테고리 제외 방식) 조회용
CREATE INDEX IF NOT EXISTS idx_posts_job_category
  ON public.posts (post_type, category)
  WHERE post_type = 'job';

-- ROLLBACK:
--   DROP INDEX IF EXISTS public.idx_posts_job_category;
--   ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_subcategory_check;
--   ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_job_category_check;
--   ALTER TABLE public.posts DROP COLUMN IF EXISTS subcategory;
