-- 요청예약(B등급)의 결과를 요청자에게 알린다.
--
-- 무엇이 문제인가
--   20260901000018에서 B등급 예약은 status='requested'로 접수되고 사장님이
--   decide_booking_request로 승인·거절한다. 20260901000021은 거기에 24시간 자동 만료를 더했다.
--   그런데 세 결말(승인·거절·자동만료) 중 어느 것도 요청자에게 통보되지 않는다.
--   요청자가 프로필의 예약현황을 스스로 다시 열어보기 전에는 자기 요청이 어떻게 됐는지 모른다.
--   확정된 줄 모르고 안 가거나, 취소된 줄 모르고 합주실 앞까지 가는 일이 그대로 생긴다.
--
-- 왜 함수가 아니라 트리거인가
--   결말을 만드는 주체가 이미 셋이다: decide_booking_request(사장님),
--   expire_stale_holds(pg_cron), cancel_booking(요청자 본인).
--   함수마다 알림 INSERT를 넣으면 지금 당장은 맞아도 네 번째 경로가 생길 때 또 빠진다 —
--   20260901000021이 만료 컬럼을 새로 만들지 않고 hold_expires_at을 재사용한 것과 같은 이유다.
--   'requested'에서 벗어나는 상태 전이 하나만 보면 세 경로가 한 번에 덮인다.
--
-- 승인 / 거절 / 자동만료를 어떻게 구분하는가
--   거절과 자동만료는 둘 다 status='cancelled'로 끝나서 상태값만으로는 갈리지 않는다.
--   구분 기준은 "그 UPDATE를 누가 실행했는가", 즉 auth.uid()다.
--     · auth.uid() = NEW.user_id → 요청자 본인이 물린 것(cancel_booking). 알림을 보내지 않는다.
--     · auth.uid() IS NOT NULL   → 사장님이 거절한 것(decide_booking_request, 또는 소유자 UPDATE).
--     · auth.uid() IS NULL       → JWT 없이 돈 것, 곧 pg_cron의 expire_stale_holds → 자동 만료.
--   hold_expires_at으로도 갈리기는 한다(승인·거절은 NULL로 비우고 크론은 값을 남긴다).
--   그건 두 함수의 지금 구현에 기댄 우연이라 한쪽이 바뀌면 조용히 오분류된다.
--   실행 주체는 경로가 늘어도 뜻이 변하지 않으므로 그쪽을 기준으로 삼았다.
--   다만 service_role로 도는 관리자 UPDATE도 auth.uid()가 NULL이라 '자동 만료'로 분류된다.
--   지금 그런 경로는 없고, 생기더라도 요청자에게 중요한 건 "왜"보다 "취소됐다"는 사실이라
--   오분류의 피해가 작다.
--
-- post_id를 어떻게 하는가
--   notifications.post_id는 posts(id)를 가리키는 외래키다(20260401124326). 예약에는 대응하는
--   게시물이 없고, booking id를 넣으면 FK 위반으로 INSERT 자체가 실패한다. 그래서 NULL로 둔다.
--   대신 NotificationsPanel이 post_id가 아니라 type을 보고 이동 경로를 정하도록 함께 고쳤다
--   (booking_* → /profile 의 예약현황). 목록에서 어느 예약인지 알아볼 단서가 사라지므로
--   post_title에 "A룸 · 09/02 19:00~21:00" 같은 라벨을 채워 그 자리를 메운다.

-- ============================================================
-- 1. 알림 유형 확장
--    20260828000001이 세운 목록에 예약 결과 3종을 더한다.
-- ============================================================
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'like', 'comment', 'apply_accepted', 'apply_rejected',
    'booking_approved', 'booking_rejected', 'booking_expired'
  ));

-- ============================================================
-- 2. 상태 전이 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_booking_result()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_uid   uuid;
  studio_name text;
  room_name   text;
  label       text;
  noti_type   text;
BEGIN
  -- 크론(expire_stale_holds)에는 JWT가 없다. auth.uid()는 그 경우 NULL을 돌려주지만,
  -- 알림 한 줄 때문에 예약 청소 배치가 통째로 실패하는 일만은 없어야 하므로 예외까지 삼킨다.
  BEGIN
    actor_uid := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    actor_uid := NULL;
  END;

  IF NEW.status = 'cancelled' THEN
    -- 본인이 물린 요청까지 알리면 자기가 한 일을 자기가 통보받는 꼴이 된다.
    IF actor_uid = NEW.user_id THEN
      RETURN NEW;
    END IF;
    noti_type := CASE WHEN actor_uid IS NULL THEN 'booking_expired' ELSE 'booking_rejected' END;
  ELSIF NEW.status IN ('held', 'confirmed') THEN
    -- 지금 decide_booking_request는 confirmed로만 보내지만, 승인 뒤 결제를 받는 흐름이
    -- 생기면 held를 거칠 수 있다. 요청자 입장에서는 둘 다 "승인됐다"이므로 같이 받는다.
    noti_type := 'booking_approved';
  ELSE
    -- completed·no_show 같은 사후 표기는 요청 결과가 아니다.
    RETURN NEW;
  END IF;

  SELECT st.name, rm.name INTO studio_name, room_name
  FROM public.rooms rm
  JOIN public.studios st ON st.id = rm.studio_id
  WHERE rm.id = NEW.room_id;

  -- 예약 상세로 가는 링크가 없으므로(맨 위 post_id 주석 참고) 이 라벨이 "어느 예약인지"를
  -- 알려주는 유일한 단서다. 알림이 여러 건 쌓였을 때 시간대로 구분된다.
  label := COALESCE(room_name, '합주실') || ' · '
        || to_char(lower(NEW.period) AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI')
        || '~'
        || to_char(upper(NEW.period) AT TIME ZONE 'Asia/Seoul', 'HH24:MI');

  INSERT INTO public.notifications (user_id, actor_name, type, post_id, post_title)
  VALUES (NEW.user_id, COALESCE(studio_name, '예약 업소'), noti_type, NULL, label);

  RETURN NEW;
END;
$$;

-- 전이 조건은 WHEN 절에 둔다. bookings는 paid 갱신·hold_expires_at 정리 등으로 자주
-- UPDATE되는데, 조건을 함수 본문에 넣으면 그 모든 UPDATE가 plpgsql 호출을 한 번씩 태운다.
DROP TRIGGER IF EXISTS trg_notify_on_booking_result ON public.bookings;
CREATE TRIGGER trg_notify_on_booking_result
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  WHEN (OLD.status = 'requested' AND NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.notify_on_booking_result();

COMMENT ON FUNCTION public.notify_on_booking_result() IS
  '요청예약(requested)이 승인·거절·자동만료로 끝날 때 요청자에게 알림을 남긴다. 승인/거절/만료는 UPDATE를 실행한 주체(auth.uid())로 구분한다.';

-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_notify_on_booking_result ON public.bookings;
--   DROP FUNCTION IF EXISTS public.notify_on_booking_result();
--   -- 남은 알림을 먼저 지워야 CHECK 축소가 통과한다
--   DELETE FROM public.notifications
--     WHERE type IN ('booking_approved', 'booking_rejected', 'booking_expired');
--   ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
--   ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
--     CHECK (type IN ('like', 'comment', 'apply_accepted', 'apply_rejected'));
