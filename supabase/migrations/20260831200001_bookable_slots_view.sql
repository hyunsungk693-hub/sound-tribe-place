-- 예약 가능 슬롯 뷰: is_open이면서 활성 예약(held/confirmed)이 없는 슬롯만 노출
-- (에이전트 C 발견: is_open만으로 거르면 예약된 슬롯이 "예약 가능"으로 계속 표시됨)

CREATE OR REPLACE VIEW public.bookable_slots
WITH (security_invoker = true) AS
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
