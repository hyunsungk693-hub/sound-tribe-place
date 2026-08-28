-- bookable_slots 뷰 수정: security_invoker를 끈다(정의자 권한).
-- 이유: invoker 권한이면 anon이 bookings RLS로 남의 예약을 못 봐서
--       NOT EXISTS가 항상 참이 되어 예약된 슬롯이 걸러지지 않았다.
-- 정의자 권한이면 서브쿼리가 예약 전체를 보고 제외 판정을 정확히 한다.
-- 반환 컬럼은 room_slots(s.*)뿐이라 예약자 정보는 노출되지 않는다.

CREATE OR REPLACE VIEW public.bookable_slots
WITH (security_invoker = false) AS
SELECT s.*
FROM public.room_slots s
WHERE s.is_open = true
  AND s.end_at >= now()
  AND NOT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.slot_id = s.id
      AND b.status IN ('held', 'confirmed')
  );

GRANT SELECT ON public.bookable_slots TO anon, authenticated;
