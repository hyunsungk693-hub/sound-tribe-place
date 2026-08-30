-- 커뮤니티 "인기"·"댓글" 정렬을 서버에서 처리하기 위한 카운트 비정규화.
--
-- 문제
--   좋아요·댓글 수는 post_likes / post_comments를 클라이언트에서 집계해 왔다.
--   목록에 페이지네이션이 들어가면서 이 정렬이 "불러온 페이지 안에서만" 동작하게 됐다.
--   20건만 받아 정렬하면 21번째 글이 가장 인기 있어도 최상단에 오지 못한다.
--   MOST LIKED 배너도 같은 이유로 불러온 범위의 1위만 보여줬다.
--
-- 해결
--   posts에 like_count / comment_count를 두고 트리거로 유지한다.
--   정렬·상위 1건 조회가 인덱스로 끝나므로 페이지 경계와 무관해진다.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS like_count    int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count int NOT NULL DEFAULT 0;

-- 기존 데이터 backfill
UPDATE public.posts p SET
  like_count    = COALESCE((SELECT count(*) FROM public.post_likes    l WHERE l.post_id = p.id), 0),
  comment_count = COALESCE((SELECT count(*) FROM public.post_comments c WHERE c.post_id = p.id), 0);

-- 좋아요 증감
CREATE OR REPLACE FUNCTION public.sync_post_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_post_like_count ON public.post_likes;
CREATE TRIGGER trg_sync_post_like_count
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_like_count();

-- 댓글 증감
CREATE OR REPLACE FUNCTION public.sync_post_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_post_comment_count ON public.post_comments;
CREATE TRIGGER trg_sync_post_comment_count
  AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_comment_count();

-- 정렬용 인덱스 (커뮤니티 목록 기준)
CREATE INDEX IF NOT EXISTS idx_posts_community_likes
  ON public.posts (post_type, like_count DESC, created_at DESC)
  WHERE post_type = 'community';

CREATE INDEX IF NOT EXISTS idx_posts_community_comments
  ON public.posts (post_type, comment_count DESC, created_at DESC)
  WHERE post_type = 'community';

-- ROLLBACK:
--   DROP INDEX IF EXISTS public.idx_posts_community_comments;
--   DROP INDEX IF EXISTS public.idx_posts_community_likes;
--   DROP TRIGGER IF EXISTS trg_sync_post_comment_count ON public.post_comments;
--   DROP TRIGGER IF EXISTS trg_sync_post_like_count ON public.post_likes;
--   DROP FUNCTION IF EXISTS public.sync_post_comment_count();
--   DROP FUNCTION IF EXISTS public.sync_post_like_count();
--   ALTER TABLE public.posts DROP COLUMN IF EXISTS comment_count, DROP COLUMN IF EXISTS like_count;
