-- A2 구조화 구인글 (W3)
-- 구인글에 모집 포지션과 합주 요일/시간 필드를 추가한다.
-- 필수화는 폼 레벨(CreatePostDialog required)에서 처리 — 기존 글(NULL)과 다른 유형 글이 있으므로 DB NOT NULL은 걸지 않는다.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS schedule text;

-- A6 우선 노출 정렬을 대비한 인덱스 (post_type + position 조회)
CREATE INDEX IF NOT EXISTS idx_posts_type_position
  ON public.posts (post_type, position)
  WHERE position IS NOT NULL;
