-- 공지. 관리자가 쓰고 모든 사람이 읽는 한 방향 글이다.
--
-- posts로 대신하지 않는 이유: posts는 사용자가 쓰는 것이고 목록·검색·지원 같은 흐름이
-- 전부 걸려 있다. 공지를 거기 섞으면 커뮤니티 글 사이에 운영자 글이 끼어 정렬을 흔들고,
-- 반대로 공지에 필요한 것(게시 기간, 예약 공개, 초안)은 posts에 없다.
--
-- 알림(notifications)과도 다르다. 그쪽은 "너에게 일어난 일"이라 사람마다 다르고,
-- 공지는 모두에게 같은 하나라 사람 수만큼 복사할 이유가 없다.

CREATE TABLE IF NOT EXISTS public.announcements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  body         text NOT NULL,
  -- 'important'는 홈 배너에서 눈에 띄게 그린다. 색으로만 급함을 말하지 않도록
  -- 화면에서는 라벨도 함께 붙인다.
  level        text NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'important')),
  -- 게시 기간. starts_at을 미래로 두면 그때가 되어야 보인다(예약 공개).
  -- ends_at이 비어 있으면 내릴 때까지 계속 보인다.
  starts_at    timestamptz NOT NULL DEFAULT now(),
  ends_at      timestamptz,
  -- 초안. 쓰다 만 글이 손님에게 보이면 안 된다.
  is_published boolean NOT NULL DEFAULT false,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT announcements_period_valid CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS announcements_live_idx
  ON public.announcements (starts_at DESC)
  WHERE is_published;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 읽기는 익명까지 연다. 목록 화면이 로그인 없이 열려 있고(E4), 오픈 안내처럼
-- 가입을 고민하는 사람이 먼저 읽어야 하는 내용이 여기 담긴다.
-- 게시 중인 것만 보인다 — 초안과 기간이 지난 것은 관리자에게만.
DROP POLICY IF EXISTS "published announcements are readable by everyone" ON public.announcements;
CREATE POLICY "published announcements are readable by everyone"
ON public.announcements FOR SELECT
USING (
  is_published
  AND starts_at <= now()
  AND (ends_at IS NULL OR ends_at > now())
);

DROP POLICY IF EXISTS "admins read every announcement" ON public.announcements;
CREATE POLICY "admins read every announcement"
ON public.announcements FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins write announcements" ON public.announcements;
CREATE POLICY "admins write announcements"
ON public.announcements FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON public.announcements FROM anon, authenticated;
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.announcements TO authenticated;

-- 누가 언제 고쳤는지 남긴다. created_by는 처음 쓴 사람으로 고정한다 —
-- 다른 관리자가 문구를 다듬었다고 글쓴이가 바뀌면 책임 소재가 흐려진다.
CREATE OR REPLACE FUNCTION public.touch_announcement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS announcements_touch ON public.announcements;
CREATE TRIGGER announcements_touch
BEFORE INSERT OR UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.touch_announcement();
