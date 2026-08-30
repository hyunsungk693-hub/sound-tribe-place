-- 홈 "커뮤니티 인기글" 섹션을 전체 기준으로 정렬하기 위한 생성 컬럼.
--
-- 문제
--   홈은 최근 12건만 가져와 그 안에서 (좋아요+댓글) 순으로 정렬하고 있었다.
--   13번째 이후의 글은 아무리 인기가 많아도 후보에 들어가지 못한다.
--   글이 쌓일수록 "인기글"이 사실상 "최근 글 중 인기글"이 된다.
--
-- 해결
--   순위 기준인 like_count + comment_count를 생성 컬럼으로 두면
--   PostgREST의 .order()로 전체 정렬이 가능해진다.
--   두 컬럼은 20260901000009의 트리거가 유지하므로 popularity도 자동으로 따라간다.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS popularity int
  GENERATED ALWAYS AS (like_count + comment_count) STORED;

CREATE INDEX IF NOT EXISTS idx_posts_community_popularity
  ON public.posts (post_type, popularity DESC, created_at DESC)
  WHERE post_type = 'community';

-- ROLLBACK:
--   DROP INDEX IF EXISTS public.idx_posts_community_popularity;
--   ALTER TABLE public.posts DROP COLUMN IF EXISTS popularity;
