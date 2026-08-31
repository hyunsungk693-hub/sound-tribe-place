-- 승인 대기(requested) 예약이 슬롯을 무기한 잠그는 구멍을 막는다.
--
-- 무엇이 문제인가
--   20260901000018에서 B(요청예약) 등급 예약은 status='requested'로 저장되고 홀드 TTL이 없다.
--   그런데 requested는 이중부킹 EXCLUDE 제약(bookings_active_period_excl)과 bookable_slots 뷰
--   양쪽에서 슬롯을 점유한다. 사장님이 승인도 거절도 하지 않고 방치하면 그 시간대는 영영 잠긴다.
--     · 다른 사람은 그 슬롯을 예약할 수 없다 — 목록에서 사라진 채로 돌아오지 않는다.
--     · 요청자는 확정도 취소도 아닌 상태로 계속 기다린다.
--     · 합주 시작 시각이 지나도 행이 그대로라, 아무도 쓸 수 없는 시간대를 계속 붙들고 있다.
--   A(즉시예약)의 held는 5분 TTL + expire_stale_holds(pg_cron 1분 주기)로 걷히는데,
--   requested에는 그 장치가 통째로 없다.
--
-- 어떻게 고치는가
--   요청에도 만료 시각을 주고, 이미 1분마다 도는 청소 함수가 같이 걷어가게 한다.
--     만료 시각 = LEAST(요청 시각 + 24시간, 합주 시작 시각)
--   24시간은 "사장님이 하루 안에는 답한다"는 약속이고, 합주 시작 시각으로 한 번 더 자르는 이유는
--   시작 시각이 지난 요청은 승인해봐야 아무도 못 쓰는 시간대를 잠그기만 하기 때문이다.
--   (이미 시작한 슬롯에 요청이 들어오면 만료 시각이 과거가 되어 다음 청소에서 곧바로 취소된다.
--    그게 맞다 — 붙들고 있어야 할 이유가 없다.)
--
-- 왜 새 컬럼이 아니라 hold_expires_at 재사용인가
--   이 컬럼은 이미 "잠정 점유가 스스로 풀리는 시각"이다. held는 5분, requested는 24시간으로
--   기간만 다를 뿐 뜻이 같고, 컬럼을 하나 더 두면 앞으로 만료를 다루는 코드가 매번 두 컬럼을
--   함께 봐야 한다(한쪽만 보는 코드가 곧 이번 같은 구멍이 된다).
--   confirm_booking(20260901000018)과 충돌하지 않는지도 확인했다. 그 함수는
--   status='requested'를 hold_expires_at 검사보다 먼저 걸러내고("사장님 승인 대기 중입니다"),
--   그 뒤 만료 검사는 status='held'만 통과한 예약에서 돈다. 즉 요청의 마감 시각이
--   결제 만료 경로에 닿을 일이 없다. 승인·거절 시점에는 아래 decide_booking_request가 값을
--   비우므로(확정 때 NULL로 비우는 confirm_booking과 같은 이유) 확정 예약에 지난 마감이 남지도 않는다.

COMMENT ON COLUMN public.bookings.hold_expires_at IS
  '잠정 점유가 스스로 풀리는 시각. held(A 즉시예약)는 결제 마감 5분, requested(B 요청예약)는 승인 마감 24시간(합주 시작 시각이 더 빠르면 그때). 확정·취소 이후에는 NULL.';

-- ============================================================
-- 1. 새 요청에 만료 시각 부여
--    20260901000018의 정의에서 B등급 hold_expires_at만 NULL → 마감 시각으로 바꾼다.
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

  -- B는 결제 단계 없이 곧장 '승인 대기'로 들어간다. 대신 무기한은 아니다 —
  -- 24시간 안에 사장님이 답하지 않으면 자동 취소되고, 합주 시작 시각이 더 빠르면 그때 취소된다.
  -- A는 기존대로 5분 TTL의 held.
  INSERT INTO public.bookings (room_id, slot_id, period, status, hold_expires_at, user_id, origin_application_id, amount)
  VALUES (
    s.room_id, s.id, tstzrange(s.start_at, s.end_at, '[)'),
    CASE WHEN s_tier = 'B' THEN 'requested' ELSE 'held' END,
    CASE WHEN s_tier = 'B'
         THEN LEAST(now() + interval '24 hours', s.start_at)
         ELSE now() + interval '5 minutes' END,
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
-- 2. 이미 쌓인 요청 백필
--    이 마이그레이션 전에 들어온 requested는 hold_expires_at이 NULL이다.
--    같은 규칙(요청 시각 + 24시간, 합주 시작 시각으로 절단)을 소급 적용한다.
--    이미 그 기준을 넘긴 요청은 과거 시각이 들어가고, 첫 청소에서 취소된다.
-- ============================================================
UPDATE public.bookings
  SET hold_expires_at = LEAST(created_at + interval '24 hours', lower(period))
  WHERE status = 'requested' AND hold_expires_at IS NULL;

-- 청소 UPDATE가 훑는 대상. 기존 idx_bookings_hold_expiry는 status='held' 부분 인덱스라
-- requested 쪽에는 쓰이지 않는다.
CREATE INDEX IF NOT EXISTS idx_bookings_request_expiry
  ON public.bookings (hold_expires_at) WHERE status = 'requested';

-- ============================================================
-- 3. 청소 함수 확장
--    별도 함수 + 별도 스케줄을 두는 대신 이미 도는 함수를 넓힌다.
--    스케줄이 하나면 두 번 등록될 일이 없고, "만료된 잠정 예약을 걷는다"는 일 자체가 하나다.
--    함수 이름은 그대로 둔다 — pg_cron 잡('expire-stale-holds')이 이 이름을 부르고 있어서,
--    이름을 바꾸면 잡 재등록이 필요해지고 그게 곧 중복 스케줄의 씨앗이다.
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_stale_holds()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- A: 결제 홀드 5분
  UPDATE public.bookings
    SET status = 'cancelled'
    WHERE status = 'held' AND hold_expires_at < now();

  -- B: 승인 대기 24시간(또는 합주 시작 시각)
  -- COALESCE는 마감이 비어 있는 행에 대한 방어다. 위 백필로 채우긴 하지만,
  -- 값이 없다는 이유로 슬롯이 영원히 잠기는 일 — 이 마이그레이션이 없애려는 바로 그 상태 —
  -- 만큼은 어떤 경로로도 다시 생기지 않게 한다.
  UPDATE public.bookings
    SET status = 'cancelled'
    WHERE status = 'requested'
      AND COALESCE(hold_expires_at, LEAST(created_at + interval '24 hours', lower(period))) < now();
END;
$$;

COMMENT ON FUNCTION public.expire_stale_holds() IS
  '만료된 잠정 예약 청소. held(결제 5분)와 requested(승인 24시간)를 모두 cancelled로 돌린다. pg_cron 잡 expire-stale-holds가 1분마다 호출한다.';

-- 스케줄은 20260831100001이 이미 등록했다. 같은 이름이 있으면 아무 것도 하지 않는다 —
-- 여기서 무조건 cron.schedule을 부르면 같은 청소가 두 번 도는 잡이 생긴다.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-stale-holds') THEN
    PERFORM cron.schedule('expire-stale-holds', '* * * * *', 'SELECT public.expire_stale_holds()');
  END IF;
END;
$$;

-- ============================================================
-- 4. 승인/거절 — 만료된 요청 처리와 크론 경합
--    20260901000018의 정의에 두 가지를 더한다.
-- ============================================================
CREATE OR REPLACE FUNCTION public.decide_booking_request(
  _booking_id uuid,
  _approve    boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  b        public.bookings;
  deadline timestamptz;
  touched  int;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = _booking_id;
  IF b.id IS NULL OR NOT public.owns_room(b.room_id, auth.uid()) THEN
    RAISE EXCEPTION '예약을 찾을 수 없습니다';
  END IF;
  IF b.status <> 'requested' THEN
    RAISE EXCEPTION '승인 대기 중인 예약이 아닙니다 (상태: %)', b.status;
  END IF;

  deadline := COALESCE(b.hold_expires_at, LEAST(b.created_at + interval '24 hours', lower(b.period)));

  -- 만료된 요청은 승인할 수 없다. 청소가 1분 주기라 "만료됐는데 아직 안 걷힌" 창이 생기는데,
  -- 그 창에서 승인이 통과하면 결과가 크론 타이밍에 좌우된다. 요청자에게 24시간이라고 안내한 이상
  -- 그 뒤의 승인은 막는다. 거절은 어차피 같은 결말(cancelled)이라 그대로 받아준다.
  IF _approve AND deadline < now() THEN
    RAISE EXCEPTION '요청 유효시간이 지났습니다. 자동 취소된 요청은 승인할 수 없습니다';
  END IF;

  -- WHERE에 status를 다시 넣는다. 위 SELECT와 이 UPDATE 사이에 청소가 먼저 취소했다면
  -- 읽어둔 값으로 덮어써서 취소된 예약이 승인으로 되살아난다.
  UPDATE public.bookings
    SET status = CASE WHEN _approve THEN 'confirmed' ELSE 'cancelled' END,
        -- 판단이 끝나면 마감 시각은 의미가 없다. 지난 마감이 남아 있으면 다른 화면에서
        -- 확정된 예약이 "곧 만료"처럼 읽힌다. confirm_booking이 확정 때 비우는 것과 같은 처리다.
        hold_expires_at = NULL
    WHERE id = _booking_id AND status = 'requested';

  GET DIAGNOSTICS touched = ROW_COUNT;
  IF touched = 0 THEN
    RAISE EXCEPTION '이미 처리된 예약입니다';
  END IF;
END;
$$;

-- ROLLBACK:
--   -- 함수 3개를 20260901000018의 정의로 다시 실행한다
--   --   (create_booking_hold: B등급 hold_expires_at을 NULL로,
--   --    decide_booking_request: 만료 검사·ROW_COUNT 확인·hold_expires_at 정리 없이,
--   --    expire_stale_holds: 20260831100001의 held 전용 본문으로)
--   DROP INDEX IF EXISTS public.idx_bookings_request_expiry;
--   -- 되돌려도 백필된 마감 시각은 남는다. requested에 남은 값을 지워야 완전히 원복된다:
--   UPDATE public.bookings SET hold_expires_at = NULL WHERE status = 'requested';
--   COMMENT ON COLUMN public.bookings.hold_expires_at IS NULL;
--   COMMENT ON FUNCTION public.expire_stale_holds() IS NULL;
--   -- cron 잡('expire-stale-holds')은 20260831100001이 만든 것이라 그대로 둔다.
