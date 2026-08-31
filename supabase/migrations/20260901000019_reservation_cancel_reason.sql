-- 예약 취소 사유를 실제로 보존하고, 연습실 주인이 읽을 수 있게 한다.
--
-- 무엇이 문제인가
--   Profile.tsx의 예약 취소는 사유를 빈 값이면 막을 만큼 필수로 받아놓고,
--   room_reservations 행을 delete()만 한다. 입력한 사유는 성공 토스트 문구에
--   한 번 스치고 사라진다. 연습실 주인은 자기 방 예약이 왜 취소됐는지 알 길이
--   없고, 사유를 강제로 입력시킨 이용자 입장에서도 헛수고다.
--
-- 왜 소프트 삭제가 아니라 별도 로그 테이블인가
--   room_reservations에 cancelled_at / cancel_reason을 붙이는 쪽이 단순해 보이지만,
--   이 테이블을 읽는 곳들이 전부 "여기 있는 행 = 살아 있는 예약"을 전제로 짜여 있다.
--     · RoomReservationPanel.tsx는 room_id·날짜로만 걸러 가용 슬롯을 계산한다.
--       취소된 행이 남으면 이미 비어 있는 시간대가 계속 예약된 것으로 보인다.
--     · 겹침 방지 EXCLUDE 제약(room_reservations_no_overlap, 20260509041010)은
--       행이 존재하는 한 유효하므로, 취소된 시간대에 새 예약을 넣을 수 없게 된다.
--     · hook_metrics(20260825000002)의 예약 수 집계가 취소분까지 세어 지표가 부푼다.
--   세 가지 모두 이 마이그레이션 밖의 파일·이미 적용된 마이그레이션을 고쳐야 하는
--   일이다. 그래서 예약 행은 지금처럼 지우고, 취소 사실만 append-only 로그로 남긴다.

-- ── 1. 취소 로그 ──
CREATE TABLE IF NOT EXISTS public.room_reservation_cancellations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 원본 예약 행은 이 로그를 쓰는 순간 삭제되므로 FK를 걸지 않는다.
  -- 같은 예약이 두 번 기록되지 않았는지 확인하는 추적용 식별자로만 쓴다.
  reservation_id uuid NOT NULL,
  room_id        uuid NOT NULL,          -- public.posts(post_type='room')의 id
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 누가 취소했는지. 예약자 본인일 수도, 방 주인일 수도 있다
  cancelled_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- 어느 시간대가 다시 비었는지가 주인에게 가장 중요한 정보라 함께 복사해 둔다.
  start_at       timestamptz NOT NULL,
  end_at         timestamptz NOT NULL,
  reason         text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT room_reservation_cancellations_reason_len
    CHECK (char_length(reason) BETWEEN 1 AND 500)
);

-- 주인 화면은 "내 방들의 최근 취소", 본인 화면은 "내가 낸 취소" 순으로 읽는다.
CREATE INDEX IF NOT EXISTS idx_room_resv_cancel_room
  ON public.room_reservation_cancellations (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_resv_cancel_user
  ON public.room_reservation_cancellations (user_id, created_at DESC);

ALTER TABLE public.room_reservation_cancellations ENABLE ROW LEVEL SECURITY;

-- ── 2. 열람 ──
-- 취소 사유는 자유 서술이라 개인 사정이 적힐 수 있다. 예약을 읽는 정책이
-- "Anyone can read reservations"(전체 공개)인 것과 달리, 여기는 당사자만 연다.
--   · 취소한 본인
--   · 그 방(posts) 게시자 — 이 로그를 만든 이유 자체
--   · 관리자 — 분쟁 확인용. rating_reports(20260901000017)와 같은 기준.
-- posts를 EXISTS로 참조하는 방식은 job_applications 정책(20260825000001)과 동일하다.
CREATE POLICY "Canceller room owner or admin reads cancellations"
  ON public.room_reservation_cancellations FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = room_reservation_cancellations.room_id
        AND p.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- INSERT/UPDATE/DELETE 정책은 두지 않는다.
-- 클라이언트가 직접 쓸 수 있으면 하지도 않은 취소를 남의 방에 기록하거나,
-- 예약만 지우고 로그를 빼먹는 절반짜리 취소가 가능해진다. 아래 RPC만 쓴다.

-- ── 3. 취소 = 로그 기록 + 예약 삭제, 한 번에 ──
-- 두 동작이 갈라지면 "사유는 남았는데 예약이 살아 있다" 또는 그 반대가 된다.
-- resolve_rating_report(20260901000017)와 같은 이유로 한 함수로 묶는다.
CREATE OR REPLACE FUNCTION public.cancel_room_reservation(
  p_reservation_id uuid,
  p_reason         text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r            public.room_reservations%ROWTYPE;
  clean_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  IF clean_reason = '' THEN
    RAISE EXCEPTION '취소 사유를 입력해주세요';
  END IF;
  IF char_length(clean_reason) > 500 THEN
    RAISE EXCEPTION '취소 사유는 500자 이하로 입력해주세요';
  END IF;

  SELECT * INTO r FROM public.room_reservations WHERE id = p_reservation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '예약을 찾을 수 없습니다';
  END IF;

  -- SECURITY DEFINER라 RLS를 그냥 통과한다. 권한 확인을 여기서 직접 한다.
  -- 비로그인(auth.uid() IS NULL)이면 <> 비교가 NULL이 되어 통과해버리므로
  -- IS DISTINCT FROM 을 쓴다.
  --
  -- 예약자 본인 외에 방 주인도 취소할 수 있다 — 20260901000018에서 화면 조건과
  -- DELETE 정책을 함께 열었으므로, 그 경로도 사유를 남기게 하려면 여기서 받아야 한다.
  IF r.user_id IS DISTINCT FROM auth.uid()
     AND NOT public.owns_room_post(r.room_id, auth.uid()) THEN
    RAISE EXCEPTION '본인 예약이거나 내 연습실의 예약만 취소할 수 있습니다';
  END IF;

  INSERT INTO public.room_reservation_cancellations
    (reservation_id, room_id, user_id, cancelled_by, start_at, end_at, reason)
  VALUES (r.id, r.room_id, r.user_id, auth.uid(), r.start_at, r.end_at, clean_reason);

  DELETE FROM public.room_reservations WHERE id = r.id;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_room_reservation(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.cancel_room_reservation(uuid, text) TO authenticated;

-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.cancel_room_reservation(uuid, text);
--   DROP POLICY IF EXISTS "Canceller room owner or admin reads cancellations"
--     ON public.room_reservation_cancellations;
--   DROP TABLE IF EXISTS public.room_reservation_cancellations;
