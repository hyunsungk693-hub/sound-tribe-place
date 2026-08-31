-- 유료 예약(B 모듈)의 두 구멍을 막는다: 결제 없는 PIN 발급, 배지뿐인 스튜디오 등급.
-- 덤으로 무료 예약(room_reservations)에서 방 주인이 손을 못 대던 문제도 같이 고친다.
--
-- 1) 결제 검증 없이 진짜 도어락 PIN이 나간다
--    20260831100001의 confirm_booking은 결제 확인을 한 줄도 하지 않고
--    held → confirmed 전이와 door_pins 배정을 한다. 화면은 "🧪 모의 결제"라고 적어두지만
--    결과물(확정 예약·진짜 PIN·슬롯 점유)은 전부 실제다. 즉, 누구나 돈 한 푼 안 내고
--    남의 연습실 출입 PIN을 받아갈 수 있다.
--    → bookings.paid를 두고, 결제가 확인되지 않은 예약(paid=false)에는 PIN을 배정하지 않는다.
--      예약 자체(슬롯 점유)는 데모를 위해 남기되, 미결제 사실이 데이터에 남아 화면에도 드러난다.
--      실제 PG를 붙이면 결제 검증부에서 paid=true를 세우고 아래 PIN 배정 분기가 그대로 살아난다.
--
-- 2) tier가 배지뿐이라 C(정보) 업소도 예약이 확정된다
--    Studios 화면은 A=즉시예약 / B=요청예약 / C=정보 로 배지를 달지만, 실제 흐름은 등급과
--    무관하게 hold → 확정까지 간다. 프론트에서만 막으면 RPC 직접 호출로 우회되므로
--    SECURITY DEFINER 함수 안에서 studios.tier를 읽어 규칙을 강제한다.
--      A  지금처럼 즉시 확정
--      B  'requested'(사장님 승인 대기)로 남기고, 승인해야 confirmed
--      C  홀드 생성 자체를 거부
--
-- 3) 무료 예약을 방 주인이 취소할 수 없다
--    room_reservations의 DELETE 정책(20260509041010)이 auth.uid() = user_id뿐이라
--    방 주인에게는 남의 예약을 정리할 권한이 없다. 화면 쪽 조건식과 함께 고쳐야 실제로 동작한다.

-- ============================================================
-- 1. bookings.paid — 결제 확인 여부
-- ============================================================
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bookings.paid IS
  '결제가 실제로 확인된 예약인지. PG 연동 전에는 항상 false이며, false면 도어락 PIN을 배정하지 않는다.';

-- paid는 SECURITY DEFINER 함수(=결제 검증부)만 세울 수 있어야 한다.
-- bookings의 UPDATE 정책은 스튜디오 소유자에게 열려 있으므로, 그대로 두면 사장님이
-- paid=true를 직접 찍어 PIN을 뽑아낼 수 있다. 컬럼 단위로 조여 status만 남긴다.
-- (20260830200001에서 job_applications.status에 쓴 것과 같은 방식)
REVOKE UPDATE ON public.bookings FROM authenticated;
GRANT UPDATE (status) ON public.bookings TO authenticated;

-- ============================================================
-- 2. 'requested' 상태 추가 (B등급 승인 대기)
--    CHECK/EXCLUDE는 인라인 정의라 이름이 자동 생성됐다. 이름을 가정하지 말고 찾아서 교체한다.
-- ============================================================
DO $$
DECLARE cname text;
BEGIN
  FOR cname IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.bookings DROP CONSTRAINT %I', cname);
  END LOOP;
END;
$$;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('held','requested','confirmed','cancelled','completed','no_show'));

-- 승인 대기 예약도 슬롯을 붙잡고 있어야 한다. 그렇지 않으면 사장님이 검토하는 동안
-- 같은 시간대가 다른 사람에게 다시 팔린다.
DO $$
DECLARE cname text;
BEGIN
  FOR cname IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass AND contype = 'x'
  LOOP
    EXECUTE format('ALTER TABLE public.bookings DROP CONSTRAINT %I', cname);
  END LOOP;
END;
$$;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_active_period_excl
  EXCLUDE USING gist (room_id WITH =, period WITH &&)
  WHERE (status IN ('held','requested','confirmed'));

-- 예약 가능 슬롯 뷰도 승인 대기분을 빼야 한다 (뷰 정의는 20260831200002와 동일, 상태 목록만 확장).
CREATE OR REPLACE VIEW public.bookable_slots
WITH (security_invoker = false) AS
SELECT s.*
FROM public.room_slots s
WHERE s.is_open = true
  AND s.end_at >= now()
  AND NOT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.slot_id = s.id
      AND b.status IN ('held', 'requested', 'confirmed')
  );

GRANT SELECT ON public.bookable_slots TO anon, authenticated;

-- ============================================================
-- 3. RPC: hold 생성 — 등급별 분기 추가
--    나머지(슬롯 열림 확인·금액 계산·EXCLUDE로 이중부킹 차단)는 기존과 동일하다.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_booking_hold(
  _slot_id uuid,
  _origin_application_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s        public.room_slots;
  r        public.rooms;
  s_tier   text;
  price    int;
  new_id   uuid;
  hrs      numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;

  SELECT * INTO s FROM public.room_slots WHERE id = _slot_id;
  IF s.id IS NULL OR NOT s.is_open THEN
    RAISE EXCEPTION '예약할 수 없는 슬롯입니다';
  END IF;

  SELECT * INTO r FROM public.rooms WHERE id = s.room_id;
  SELECT st.tier INTO s_tier FROM public.studios st WHERE st.id = r.studio_id;

  -- 등급이 곧 예약 규칙이다. 프론트 배지가 아니라 여기가 진짜 관문.
  IF s_tier = 'C' THEN
    RAISE EXCEPTION '정보만 제공하는 업소입니다. 예약은 업소로 직접 문의해주세요';
  END IF;

  hrs := EXTRACT(EPOCH FROM (s.end_at - s.start_at)) / 3600.0;
  price := round(COALESCE(r.hourly_price, 0) * hrs);

  -- B는 결제 단계 없이 곧장 '승인 대기'로 들어간다. 승인 주체가 사장님이라 홀드 TTL이 없다.
  -- A는 기존대로 5분 TTL의 held.
  INSERT INTO public.bookings (room_id, slot_id, period, status, hold_expires_at, user_id, origin_application_id, amount)
  VALUES (
    s.room_id, s.id, tstzrange(s.start_at, s.end_at, '[)'),
    CASE WHEN s_tier = 'B' THEN 'requested' ELSE 'held' END,
    CASE WHEN s_tier = 'B' THEN NULL ELSE now() + interval '5 minutes' END,
    auth.uid(), _origin_application_id, price
  )
  RETURNING id INTO new_id;

  RETURN new_id;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION '이미 예약 중인 시간대입니다';
END;
$$;

-- ============================================================
-- 4. RPC: 확정 — 결제가 확인된 예약에만 PIN을 준다
--    소유자·held 상태·홀드 만료 검증은 기존 그대로 두고, PIN 배정에만 조건을 건다.
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_booking(_booking_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  b        public.bookings;
  sid      uuid;
  s_tier   text;
  pin_row  public.door_pins;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = _booking_id;
  IF b.id IS NULL OR b.user_id <> auth.uid() THEN
    RAISE EXCEPTION '예약을 찾을 수 없습니다';
  END IF;
  IF b.status = 'requested' THEN
    RAISE EXCEPTION '사장님 승인 대기 중인 예약입니다';
  END IF;
  IF b.status <> 'held' THEN
    RAISE EXCEPTION '이미 처리된 예약입니다 (상태: %)', b.status;
  END IF;
  IF b.hold_expires_at < now() THEN
    UPDATE public.bookings SET status = 'cancelled' WHERE id = _booking_id;
    RAISE EXCEPTION '결제 시간이 만료되었습니다. 다시 예약해주세요';
  END IF;

  SELECT st.id, st.tier INTO sid, s_tier
    FROM public.rooms rm JOIN public.studios st ON st.id = rm.studio_id
    WHERE rm.id = b.room_id;

  -- held는 A에서만 생기지만, 등급이 나중에 내려간 경우까지 막는다.
  IF s_tier <> 'A' THEN
    RAISE EXCEPTION '즉시예약(A등급) 업소가 아닙니다';
  END IF;

  UPDATE public.bookings SET status = 'confirmed', hold_expires_at = NULL WHERE id = _booking_id;

  -- 여기에 결제 검증이 없다. 그래서 paid는 false 그대로고, PIN도 나가지 않는다.
  -- PG를 붙이면 이 위에서 결제 결과를 확인해 paid=true로 갱신하면 아래 분기가 살아난다.
  IF b.paid THEN
    SELECT * INTO pin_row FROM public.door_pins
      WHERE studio_id = sid AND NOT used AND assigned_booking_id IS NULL
      ORDER BY created_at LIMIT 1;
    IF pin_row.id IS NOT NULL THEN
      UPDATE public.door_pins SET assigned_booking_id = _booking_id, used = true WHERE id = pin_row.id;
    END IF;
  END IF;

  RETURN json_build_object('booking_id', _booking_id, 'pin', pin_row.pin, 'paid', b.paid);
END;
$$;

-- ============================================================
-- 5. RPC: B등급 예약 요청 승인/거절 (사장님)
--    상태 전이를 클라이언트 UPDATE에 맡기면 'requested'가 아닌 예약까지 뒤집을 수 있어
--    RPC로 조건을 고정한다. 승인해도 paid=false라 PIN은 여전히 나가지 않는다.
-- ============================================================
CREATE OR REPLACE FUNCTION public.decide_booking_request(
  _booking_id uuid,
  _approve    boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE b public.bookings;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = _booking_id;
  IF b.id IS NULL OR NOT public.owns_room(b.room_id, auth.uid()) THEN
    RAISE EXCEPTION '예약을 찾을 수 없습니다';
  END IF;
  IF b.status <> 'requested' THEN
    RAISE EXCEPTION '승인 대기 중인 예약이 아닙니다 (상태: %)', b.status;
  END IF;

  UPDATE public.bookings
    SET status = CASE WHEN _approve THEN 'confirmed' ELSE 'cancelled' END
    WHERE id = _booking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.decide_booking_request(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.decide_booking_request(uuid, boolean) TO authenticated;

-- ============================================================
-- 6. RPC: 취소 — 승인 대기 중인 요청도 예약자가 물릴 수 있어야 한다
--    (기존 본문에 'requested'만 추가)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_booking(_booking_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE b public.bookings;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = _booking_id;
  IF b.id IS NULL OR b.user_id <> auth.uid() THEN
    RAISE EXCEPTION '예약을 찾을 수 없습니다';
  END IF;
  IF b.status NOT IN ('held','requested','confirmed') THEN
    RAISE EXCEPTION '취소할 수 없는 예약입니다';
  END IF;
  UPDATE public.bookings SET status = 'cancelled' WHERE id = _booking_id;
  -- 배정 PIN 회수
  UPDATE public.door_pins SET assigned_booking_id = NULL, used = false WHERE assigned_booking_id = _booking_id;
END;
$$;

-- ============================================================
-- 7. 무료 예약: 방 주인에게 삭제 권한
--    room_reservations.room_id는 posts(post_type='room')의 id다.
--    정책 안에서 posts를 직접 읽으면 posts의 SELECT 정책을 다시 타므로
--    (20260901000007에서 실제로 재귀가 터졌다) SECURITY DEFINER 헬퍼로 끊는다.
-- ============================================================
CREATE OR REPLACE FUNCTION public.owns_room_post(_post_id uuid, _uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.posts p WHERE p.id = _post_id AND p.user_id = _uid
  )
$$;

REVOKE ALL ON FUNCTION public.owns_room_post(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.owns_room_post(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can delete own reservations" ON public.room_reservations;
CREATE POLICY "Owner or room host can delete reservations"
  ON public.room_reservations FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.owns_room_post(room_id, auth.uid()));

-- ROLLBACK:
--   DROP POLICY IF EXISTS "Owner or room host can delete reservations" ON public.room_reservations;
--   CREATE POLICY "Users can delete own reservations" ON public.room_reservations FOR DELETE TO authenticated
--     USING (auth.uid() = user_id);
--   DROP FUNCTION IF EXISTS public.owns_room_post(uuid, uuid);
--   DROP FUNCTION IF EXISTS public.decide_booking_request(uuid, boolean);
--   -- create_booking_hold / confirm_booking / cancel_booking / bookable_slots 는
--   -- 20260831100001·20260831200002의 정의를 다시 실행해 되돌린다.
--   UPDATE public.bookings SET status = 'cancelled' WHERE status = 'requested';
--   ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_active_period_excl;
--   ALTER TABLE public.bookings ADD CONSTRAINT bookings_active_period_excl
--     EXCLUDE USING gist (room_id WITH =, period WITH &&) WHERE (status IN ('held','confirmed'));
--   ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
--   ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
--     CHECK (status IN ('held','confirmed','cancelled','completed','no_show'));
--   GRANT UPDATE ON public.bookings TO authenticated;
--   ALTER TABLE public.bookings DROP COLUMN IF EXISTS paid;
