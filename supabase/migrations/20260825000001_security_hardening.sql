-- 보안 강화 마이그레이션
-- 적용 대상: 신규 Supabase 프로젝트 (기존 15개 마이그레이션 이후 실행)

-- ============================================================
-- 1. 알림 스팸 차단
--    기존: 로그인한 누구나 임의 사용자에게 임의 내용의 알림 INSERT 가능
--    변경: 클라이언트 직접 INSERT 금지, 좋아요/댓글 트리거가 알림을 생성
--    (프론트 Community.tsx의 notifications.insert 두 곳은 제거해도 되고,
--     남겨두면 정책 위반으로 조용히 실패하며 트리거가 대신 생성함)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;

CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner uuid;
  post_title_v text;
  actor text;
BEGIN
  SELECT p.user_id, p.title INTO post_owner, post_title_v
  FROM public.posts p WHERE p.id = NEW.post_id;

  -- 자기 글에 자기가 누른 좋아요는 알림 생략
  IF post_owner IS NULL OR post_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(pr.display_name, '익명') INTO actor
  FROM public.profiles pr WHERE pr.user_id = NEW.user_id;

  INSERT INTO public.notifications (user_id, actor_name, type, post_id, post_title)
  VALUES (post_owner, COALESCE(actor, '익명'), 'like', NEW.post_id, post_title_v);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_like ON public.post_likes;
CREATE TRIGGER trg_notify_on_like
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner uuid;
  post_title_v text;
BEGIN
  SELECT p.user_id, p.title INTO post_owner, post_title_v
  FROM public.posts p WHERE p.id = NEW.post_id;

  IF post_owner IS NULL OR post_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, actor_name, type, post_id, post_title)
  VALUES (post_owner, COALESCE(NEW.author_name, '익명'), 'comment', NEW.post_id, post_title_v);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_comment ON public.post_comments;
CREATE TRIGGER trg_notify_on_comment
  AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- ============================================================
-- 2. 지원 내역 비공개화
--    기존: 로그인한 누구나 모든 지원 내역(누가 어디에 지원했는지 + 메시지) 열람 가능
--    변경: 본인 지원 내역 + 자기 공고에 들어온 지원만 열람
--    (Jobs.tsx는 본인 지원 목록과 자기 공고의 지원자만 조회하므로 UI 영향 없음)
-- ============================================================
DROP POLICY IF EXISTS "Anyone authenticated can read applications" ON public.job_applications;

CREATE POLICY "Applicants and job owners can read applications"
ON public.job_applications FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = job_applications.job_id AND p.user_id = auth.uid()
  )
);

-- ============================================================
-- 3. 대화방 중복 방지
--    기존: UNIQUE(user1_id, user2_id)는 (A,B)와 (B,A) 중복을 못 막음
--    변경: 순서 무관 유니크 인덱스
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uniq_conversation_pair
ON public.conversations (LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id));

-- ============================================================
-- 4. 상대방 메시지 내용 수정 차단
--    기존: 대화 참여자면 상대 메시지의 content까지 UPDATE 가능
--    변경: UPDATE는 is_read 컬럼만 허용 (읽음 처리 용도)
-- ============================================================
REVOKE UPDATE ON public.messages FROM authenticated;
GRANT UPDATE (is_read) ON public.messages TO authenticated;

-- ============================================================
-- 5. 공고 모집 상태 (매칭 완료 지표의 근거)
-- ============================================================
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open'
  CHECK (status IN ('open', 'closed'));

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_posts_updated_at ON public.posts;
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
