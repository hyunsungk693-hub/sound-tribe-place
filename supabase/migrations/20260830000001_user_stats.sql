-- D3 신뢰 영역 집계 (§5.3): user_stats + 응답률 1차 점등
-- 카드가 앱 전역에 노출되므로 실시간 계산 금지 — 이벤트 훅으로 갱신되는 집계 테이블을 둔다.
-- sessions/partners/rehire/no_show는 예약·평가(W5~, W11) 도입 후 점등 — 지금은 기본값 유지.

CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  response_rate      numeric(4,3),   -- A5: 24시간 내 응답 비율 (모수 3건 미만이면 NULL)
  median_response_h  numeric(5,2),   -- 응답된 건의 중앙값(시간)
  sessions_count     int NOT NULL DEFAULT 0,  -- bookings completed (W5~)
  partners_count     int NOT NULL DEFAULT 0,
  rehire_rate        numeric(4,3),   -- A7 "또 하고 싶음" 비율 (W11)
  no_show_count      int NOT NULL DEFAULT 0,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- 카드 렌더링을 위해 열람 공개, 쓰기는 정책 없음(트리거·함수만 갱신)
CREATE POLICY "Public can read user stats"
  ON public.user_stats FOR SELECT USING (true);

-- 응답률 재계산: uid가 작성한 구인 공고에 받은 지원 기준
-- response_rate = (responded_at IS NOT NULL AND 24h 이내) / 전체 지원
-- 모수(전체 지원) 3건 미만이면 표시 하한(§5.3)에 따라 NULL
CREATE OR REPLACE FUNCTION public.refresh_user_stats(uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total int;
  responded_24h int;
  median_h numeric(5,2);
BEGIN
  SELECT
    count(*),
    count(*) FILTER (
      WHERE a.responded_at IS NOT NULL
        AND a.responded_at - a.created_at <= interval '24 hours'
    )
  INTO total, responded_24h
  FROM public.job_applications a
  JOIN public.posts p ON p.id = a.job_id
  WHERE p.user_id = uid AND p.post_type = 'job';

  SELECT percentile_cont(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (a.responded_at - a.created_at)) / 3600.0
  )::numeric(5,2)
  INTO median_h
  FROM public.job_applications a
  JOIN public.posts p ON p.id = a.job_id
  WHERE p.user_id = uid AND p.post_type = 'job' AND a.responded_at IS NOT NULL;

  INSERT INTO public.user_stats (user_id, response_rate, median_response_h, updated_at)
  VALUES (
    uid,
    CASE WHEN total >= 3 THEN round(responded_24h::numeric / total, 3) ELSE NULL END,
    CASE WHEN total >= 3 THEN median_h ELSE NULL END,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    response_rate = EXCLUDED.response_rate,
    median_response_h = EXCLUDED.median_response_h,
    updated_at = now();
END;
$$;

-- 지원 생성/상태 변경 시 공고 작성자의 통계 갱신
CREATE OR REPLACE FUNCTION public.refresh_stats_on_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner uuid;
BEGIN
  SELECT p.user_id INTO owner FROM public.posts p WHERE p.id = NEW.job_id;
  IF owner IS NOT NULL THEN
    PERFORM public.refresh_user_stats(owner);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_stats_on_application ON public.job_applications;
CREATE TRIGGER trg_refresh_stats_on_application
  AFTER INSERT OR UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.refresh_stats_on_application();
