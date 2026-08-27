-- 비로그인 열람 개방 (E4 1단계)
-- 목록·글 내용은 비로그인 공개, 쓰기·지원·상세 상호작용은 로그인 필수(기존 정책 유지)

DROP POLICY IF EXISTS "Anyone can read posts" ON public.posts;
CREATE POLICY "Public can read posts"
  ON public.posts FOR SELECT USING (true);

-- 목록의 좋아요·댓글 수 표시를 위해 열람만 공개 (작성·삭제는 여전히 본인 한정)
DROP POLICY IF EXISTS "Anyone can read likes" ON public.post_likes;
CREATE POLICY "Public can read likes"
  ON public.post_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can read comments" ON public.post_comments;
CREATE POLICY "Public can read comments"
  ON public.post_comments FOR SELECT USING (true);
