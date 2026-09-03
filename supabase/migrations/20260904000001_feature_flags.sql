-- 기능 토글: 어떤 기능을 지금 손님에게 보일지 관리자 화면에서 켜고 끈다.
--
-- 배포와 공개를 분리하기 위한 것이다. 코드는 올라가 있지만 아직 손님에게 보이면 안 되는
-- 기능(실결제처럼 밖의 계약이 끝나야 열 수 있는 것)을 코드를 되돌리지 않고 닫아둘 수 있다.
-- 반대로 문제가 터졌을 때도 배포를 기다리지 않고 그 기능만 즉시 닫을 수 있다.

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key         text PRIMARY KEY,
  enabled     boolean NOT NULL DEFAULT true,
  label       text NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- 읽기는 누구에게나 연다. 로그인하지 않은 사람에게도 목록 화면이 열려 있으므로
-- (E4 비로그인 개방) 그 화면이 어떤 기능을 보여줄지 판단하려면 익명도 읽을 수 있어야 한다.
-- 여기 담기는 것은 '이 기능이 켜져 있다'는 사실뿐이라 감출 것이 없다.
DROP POLICY IF EXISTS "feature flags are readable by everyone" ON public.feature_flags;
CREATE POLICY "feature flags are readable by everyone"
ON public.feature_flags FOR SELECT
USING (true);

-- 쓰기는 관리자만. INSERT·DELETE 정책을 두지 않아 키를 새로 만들거나 지우는 것은
-- 마이그레이션으로만 가능하다 — 화면에서 없앨 수 있으면 코드가 참조하는 키가 사라져
-- 그 기능이 통째로 꺼진 것처럼 보이는 사고가 난다.
DROP POLICY IF EXISTS "admins toggle feature flags" ON public.feature_flags;
CREATE POLICY "admins toggle feature flags"
ON public.feature_flags FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 관리자라도 바꿀 수 있는 것은 켜짐 여부뿐이다. label·description은 코드가 읽는 설명이라
-- 화면에서 고쳐 쓰면 코드와 어긋난다. (messages.is_read·job_applications.status와 같은 방식)
REVOKE ALL ON public.feature_flags FROM authenticated;
GRANT SELECT ON public.feature_flags TO authenticated, anon;
GRANT UPDATE (enabled, updated_at, updated_by) ON public.feature_flags TO authenticated;

-- 처음 값은 전부 켜짐이다. 지금 실제로 손님에게 보이고 있는 상태 그대로라,
-- 이 마이그레이션을 올리는 것만으로는 무엇도 달라지지 않는다. 무엇을 닫을지는
-- 배포 뒤 관리자 화면에서 사람이 정한다 — 배포가 조용히 화면을 바꾸는 일은 없어야 한다.
INSERT INTO public.feature_flags (key, label, description) VALUES
  ('jobs',            '구인구직',        '공고 목록·상세·지원. 끄면 홈과 탭에서 사라지고 주소로 들어와도 안내만 보인다.'),
  ('community',       '커뮤니티',        '자유 글·질문·거래 게시판.'),
  ('rooms',           '연습실 정보',     '연습실 목록·상세(정보 노출). 예약과는 별개다.'),
  ('shops',           '악기사 정보',     '악기사 목록·상세.'),
  ('bookings',        '제휴 연습실 예약', '슬롯을 골라 예약을 잡는 흐름 전체. 끄면 제휴 연습실은 정보만 보인다.'),
  ('payments',        '결제',           '예약의 결제 단계. 끄면 예약을 만들 수 없다. 실 PG 연동 전까지 닫아두는 스위치다.'),
  ('first_rehearsal', '첫 합주 잡기',    '합격한 지원에서 바로 합주 시간을 잡는 흐름.')
ON CONFLICT (key) DO NOTHING;

-- 누가 언제 바꿨는지는 남긴다. 기능이 갑자기 사라졌다는 문의가 왔을 때
-- 사고인지 사람이 끈 것인지 먼저 갈라야 한다.
CREATE OR REPLACE FUNCTION public.touch_feature_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  NEW.key := OLD.key;
  NEW.label := OLD.label;
  NEW.description := OLD.description;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feature_flags_touch ON public.feature_flags;
CREATE TRIGGER feature_flags_touch
BEFORE UPDATE ON public.feature_flags
FOR EACH ROW EXECUTE FUNCTION public.touch_feature_flag();
