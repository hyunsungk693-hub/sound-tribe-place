-- 유료 예약 B 모듈 + 접합부 C (스코프 §3.2 B/C, §5.1)
-- 기존 무료 room_reservations와 별개로 공존한다. 결제는 모의(mock) — PG 계약 전.

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- 1. studios (제휴 업소)
-- ============================================================
CREATE TABLE public.studios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  address     text,
  lat         double precision,
  lng         double precision,
  tier        text NOT NULL DEFAULT 'A' CHECK (tier IN ('A','B','C')),
  phone       text,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view studios"
  ON public.studios FOR SELECT USING (true);
CREATE POLICY "Owner can insert studio"
  ON public.studios FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner can update studio"
  ON public.studios FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owner can delete studio"
  ON public.studios FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE INDEX idx_studios_owner ON public.studios(owner_id);
CREATE INDEX idx_studios_tier ON public.studios(tier);

-- studio 소유 확인 헬퍼 (RLS 재귀 회피용, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.owns_studio(_studio_id uuid, _uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.studios s WHERE s.id = _studio_id AND s.owner_id = _uid)
$$;

-- ============================================================
-- 2. rooms (합주실)
-- ============================================================
CREATE TABLE public.rooms (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id    uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  name         text NOT NULL,
  hourly_price int NOT NULL DEFAULT 0,
  capacity     int,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- room으로부터 studio 소유 확인 (rooms 테이블 생성 후 정의 — 함수 본문 검증 통과)
CREATE OR REPLACE FUNCTION public.owns_room(_room_id uuid, _uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms r JOIN public.studios s ON s.id = r.studio_id
    WHERE r.id = _room_id AND s.owner_id = _uid
  )
$$;

CREATE POLICY "Anyone can view rooms"
  ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Studio owner manages rooms - insert"
  ON public.rooms FOR INSERT TO authenticated WITH CHECK (public.owns_studio(studio_id, auth.uid()));
CREATE POLICY "Studio owner manages rooms - update"
  ON public.rooms FOR UPDATE TO authenticated USING (public.owns_studio(studio_id, auth.uid()));
CREATE POLICY "Studio owner manages rooms - delete"
  ON public.rooms FOR DELETE TO authenticated USING (public.owns_studio(studio_id, auth.uid()));

CREATE INDEX idx_rooms_studio ON public.rooms(studio_id);

-- ============================================================
-- 3. room_slots (사장님이 연 유휴 슬롯 = allotment)
--    슬롯끼리 시간 겹침 방지 (같은 room 내)
-- ============================================================
CREATE TABLE public.room_slots (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id   uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  start_at  timestamptz NOT NULL,
  end_at    timestamptz NOT NULL,
  is_open   boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT room_slots_time_check CHECK (end_at > start_at),
  CONSTRAINT room_slots_no_overlap EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
);
ALTER TABLE public.room_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view slots"
  ON public.room_slots FOR SELECT USING (true);
CREATE POLICY "Room owner manages slots - insert"
  ON public.room_slots FOR INSERT TO authenticated WITH CHECK (public.owns_room(room_id, auth.uid()));
CREATE POLICY "Room owner manages slots - update"
  ON public.room_slots FOR UPDATE TO authenticated USING (public.owns_room(room_id, auth.uid()));
CREATE POLICY "Room owner manages slots - delete"
  ON public.room_slots FOR DELETE TO authenticated USING (public.owns_room(room_id, auth.uid()));

CREATE INDEX idx_room_slots_room ON public.room_slots(room_id, start_at);
CREATE INDEX idx_room_slots_open ON public.room_slots(room_id) WHERE is_open;

-- ============================================================
-- 4. bookings (§5.1) — hold/confirmed 상태에서 이중부킹 방지
-- ============================================================
CREATE TABLE public.bookings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id               uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  slot_id               uuid REFERENCES public.room_slots(id) ON DELETE SET NULL,
  period                tstzrange NOT NULL,
  status                text NOT NULL DEFAULT 'held'
                          CHECK (status IN ('held','confirmed','cancelled','completed','no_show')),
  hold_expires_at       timestamptz,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_application_id uuid REFERENCES public.job_applications(id) ON DELETE SET NULL,  -- C2 파생 추적
  amount                int NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  -- held/confirmed 상태끼리만 겹침 차단 (cancelled/completed는 재판매 가능)
  EXCLUDE USING gist (
    room_id WITH =,
    period  WITH &&
  ) WHERE (status IN ('held','confirmed'))
);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 조회: 본인 예약 + 해당 room의 studio 소유자
CREATE POLICY "View own or owned bookings"
  ON public.bookings FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.owns_room(room_id, auth.uid()));
-- 직접 INSERT/UPDATE는 막고 RPC(SECURITY DEFINER)로만 생성·전이한다.
-- 단, studio 소유자가 노쇼/완료 표기는 가능하도록 UPDATE 허용
CREATE POLICY "Studio owner marks booking status"
  ON public.bookings FOR UPDATE TO authenticated
  USING (public.owns_room(room_id, auth.uid()))
  WITH CHECK (public.owns_room(room_id, auth.uid()));

CREATE INDEX idx_bookings_hold_expiry ON public.bookings(hold_expires_at) WHERE status = 'held';
CREATE INDEX idx_bookings_origin ON public.bookings(origin_application_id);
CREATE INDEX idx_bookings_user ON public.bookings(user_id);
CREATE INDEX idx_bookings_room ON public.bookings(room_id);

-- ============================================================
-- 5. door_pins (도어락 PIN 풀)
-- ============================================================
CREATE TABLE public.door_pins (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id           uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  pin                 text NOT NULL,
  assigned_booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  used                boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.door_pins ENABLE ROW LEVEL SECURITY;

-- studio 소유자는 자기 PIN 풀 관리
CREATE POLICY "Studio owner manages pins - select"
  ON public.door_pins FOR SELECT TO authenticated USING (public.owns_studio(studio_id, auth.uid()));
CREATE POLICY "Studio owner manages pins - insert"
  ON public.door_pins FOR INSERT TO authenticated WITH CHECK (public.owns_studio(studio_id, auth.uid()));
CREATE POLICY "Studio owner manages pins - delete"
  ON public.door_pins FOR DELETE TO authenticated USING (public.owns_studio(studio_id, auth.uid()));
-- 배정된 예약의 예약자는 자기 PIN만 조회
CREATE POLICY "Booking user views assigned pin"
  ON public.door_pins FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = door_pins.assigned_booking_id AND b.user_id = auth.uid()
  ));

CREATE INDEX idx_door_pins_studio ON public.door_pins(studio_id) WHERE NOT used;

-- ============================================================
-- 6. RPC: hold 생성 (SECURITY DEFINER)
--    슬롯 열림 확인 → held 5분 TTL 생성 (EXCLUDE가 이중부킹 자동 차단)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_booking_hold(
  _slot_id uuid,
  _origin_application_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s       public.room_slots;
  r       public.rooms;
  price   int;
  new_id  uuid;
  hrs     numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;

  SELECT * INTO s FROM public.room_slots WHERE id = _slot_id;
  IF s.id IS NULL OR NOT s.is_open THEN
    RAISE EXCEPTION '예약할 수 없는 슬롯입니다';
  END IF;

  SELECT * INTO r FROM public.rooms WHERE id = s.room_id;
  hrs := EXTRACT(EPOCH FROM (s.end_at - s.start_at)) / 3600.0;
  price := round(COALESCE(r.hourly_price, 0) * hrs);

  -- EXCLUDE 제약이 동일 room·기간의 held/confirmed와 충돌 시 예외 발생 → 이중부킹 원천 차단
  INSERT INTO public.bookings (room_id, slot_id, period, status, hold_expires_at, user_id, origin_application_id, amount)
  VALUES (
    s.room_id, s.id, tstzrange(s.start_at, s.end_at, '[)'),
    'held', now() + interval '5 minutes', auth.uid(), _origin_application_id, price
  )
  RETURNING id INTO new_id;

  RETURN new_id;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION '이미 예약 중인 시간대입니다';
END;
$$;

-- ============================================================
-- 7. RPC: 결제 확정 (모의) — held → confirmed + PIN 배정
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_booking(_booking_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  b        public.bookings;
  sid      uuid;
  pin_row  public.door_pins;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id = _booking_id;
  IF b.id IS NULL OR b.user_id <> auth.uid() THEN
    RAISE EXCEPTION '예약을 찾을 수 없습니다';
  END IF;
  IF b.status <> 'held' THEN
    RAISE EXCEPTION '이미 처리된 예약입니다 (상태: %)', b.status;
  END IF;
  IF b.hold_expires_at < now() THEN
    UPDATE public.bookings SET status = 'cancelled' WHERE id = _booking_id;
    RAISE EXCEPTION '결제 시간이 만료되었습니다. 다시 예약해주세요';
  END IF;

  -- 확정
  UPDATE public.bookings SET status = 'confirmed', hold_expires_at = NULL WHERE id = _booking_id;

  -- PIN 배정 (해당 studio의 미사용 PIN 하나)
  SELECT s.id INTO sid FROM public.rooms rm JOIN public.studios s ON s.id = rm.studio_id WHERE rm.id = b.room_id;
  SELECT * INTO pin_row FROM public.door_pins
    WHERE studio_id = sid AND NOT used AND assigned_booking_id IS NULL
    ORDER BY created_at LIMIT 1;
  IF pin_row.id IS NOT NULL THEN
    UPDATE public.door_pins SET assigned_booking_id = _booking_id, used = true WHERE id = pin_row.id;
  END IF;

  RETURN json_build_object('booking_id', _booking_id, 'pin', COALESCE(pin_row.pin, null));
END;
$$;

-- ============================================================
-- 8. RPC: 예약 취소 (본인)
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
  IF b.status NOT IN ('held','confirmed') THEN
    RAISE EXCEPTION '취소할 수 없는 예약입니다';
  END IF;
  UPDATE public.bookings SET status = 'cancelled' WHERE id = _booking_id;
  -- 배정 PIN 회수
  UPDATE public.door_pins SET assigned_booking_id = NULL, used = false WHERE assigned_booking_id = _booking_id;
END;
$$;

-- ============================================================
-- 9. hold 만료 청소 + pg_cron 1분 주기
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_stale_holds()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.bookings
    SET status = 'cancelled'
    WHERE status = 'held' AND hold_expires_at < now();
END;
$$;

-- 1분마다 만료 hold 정리 (중복 스케줄 방지)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-stale-holds') THEN
    PERFORM cron.schedule('expire-stale-holds', '* * * * *', 'SELECT public.expire_stale_holds()');
  END IF;
END;
$$;

-- ============================================================
-- 10. 완료 예약 → user_stats.sessions_count 갱신 훅 (D3 2차 점등 근거)
--     status=completed 전이 시 예약자의 세션 카운트 증가
-- ============================================================
CREATE OR REPLACE FUNCTION public.on_booking_completed()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    INSERT INTO public.user_stats (user_id, sessions_count, updated_at)
    VALUES (NEW.user_id, 1, now())
    ON CONFLICT (user_id) DO UPDATE
      SET sessions_count = public.user_stats.sessions_count + 1, updated_at = now();
  END IF;
  IF NEW.status = 'no_show' AND OLD.status IS DISTINCT FROM 'no_show' THEN
    INSERT INTO public.user_stats (user_id, no_show_count, updated_at)
    VALUES (NEW.user_id, 1, now())
    ON CONFLICT (user_id) DO UPDATE
      SET no_show_count = public.user_stats.no_show_count + 1, updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_booking_completed
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.on_booking_completed();
