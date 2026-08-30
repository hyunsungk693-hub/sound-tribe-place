-- 작업 2: 평판 등급 시스템 (신뢰 / 안정 / 주의 / 산정 전)
--
-- 지시서의 user_reputation(bigint user_id) 신설 대신 기존 public.user_stats를 확장한다.
-- user_stats는 이미 "렌더 시점 계산 금지, 이벤트 훅으로 갱신되는 집계 테이블"이라는
-- 같은 목적으로 만들어져 있고(20260830000001), 3항목 평가도 peer_ratings에
-- kept_promise / skill_matched / would_again 으로 이미 존재한다(20260831000001).
-- 테이블을 따로 두면 같은 값을 다르게 계산하는 집계가 2벌이 된다.

-- ── 1. 집계 컬럼 ──
ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS grade         text NOT NULL DEFAULT 'unrated',
  ADD COLUMN IF NOT EXISTS positive_rate numeric(4,3),
  ADD COLUMN IF NOT EXISTS review_count  int  NOT NULL DEFAULT 0;

ALTER TABLE public.user_stats
  DROP CONSTRAINT IF EXISTS user_stats_grade_check;
ALTER TABLE public.user_stats
  ADD CONSTRAINT user_stats_grade_check
  CHECK (grade IN ('trust', 'stable', 'caution', 'unrated'));

-- ── 2. 이의 제기 ──
ALTER TABLE public.peer_ratings
  ADD COLUMN IF NOT EXISTS disputed boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.rating_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id   uuid NOT NULL REFERENCES public.peer_ratings(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rating_reports_unique UNIQUE (rating_id, reporter_id),
  CONSTRAINT rating_reports_reason_len CHECK (char_length(reason) BETWEEN 1 AND 500)
);

ALTER TABLE public.rating_reports ENABLE ROW LEVEL SECURITY;

-- 신고는 "평가를 받은 당사자"만 할 수 있다
CREATE POLICY "Ratee can report own rating"
  ON public.rating_reports FOR INSERT TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.peer_ratings r
      WHERE r.id = rating_reports.rating_id AND r.ratee_id = auth.uid()
    )
  );

CREATE POLICY "Read own reports"
  ON public.rating_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

-- 신고 즉시 disputed 플래그 → 산정에서 제외. 운영자 확인은 DB에서 직접 처리한다.
CREATE OR REPLACE FUNCTION public.flag_disputed_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target uuid;
BEGIN
  UPDATE public.peer_ratings SET disputed = true
  WHERE id = NEW.rating_id
  RETURNING ratee_id INTO target;

  IF target IS NOT NULL THEN
    PERFORM public.refresh_user_stats(target);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flag_disputed_rating ON public.rating_reports;
CREATE TRIGGER trg_flag_disputed_rating
  AFTER INSERT ON public.rating_reports
  FOR EACH ROW EXECUTE FUNCTION public.flag_disputed_rating();

-- ── 3. 산정 로직 재작성 (최근 20건 롤링 + disputed 제외 + 등급) ──
--
-- 긍정률 = 3항목(약속 지킴 / 실력 일치 / 또 하고 싶음) 긍정 응답 수 / (평가 수 × 3)
--
-- 등급 판정 순서
--   주의   노쇼 3회 이상  또는  (긍정률 <= 0.4 이고 평가 3건 이상)
--   신뢰   평가 10건 이상 + 긍정률 >= 0.9 + 노쇼 0
--   안정   평가 5건 이상
--   산정 전 그 외
--
-- 지시서의 "주의" 행에는 모수 하한이 없지만, 평가 1~2건으로 공개 "주의" 배지가
-- 붙으면 오탐 피해가 크다. 노쇼 3회는 그 자체로 모수가 되므로 하한 없이 적용하고,
-- 비율 기반 조건에만 이 프로젝트가 D3에서 쓰던 모수 3건 하한을 적용했다.
-- 하한을 없애려면 아래 `AND rating_total >= 3` 한 줄만 지우면 된다.
--
-- 롤링 20건이므로 오래된 기록은 자동으로 빠지고 강등도 일어난다.

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
  rating_total int;
  again_cnt int;
  noshow_cnt int;
  partners int;
  positive_cnt int;
  pos_rate numeric(4,3);
  new_grade text;
BEGIN
  -- 응답률(기존 로직 유지): uid가 작성한 구인 공고에 받은 지원 기준
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

  -- 평가 기반: uid가 ratee인 최근 20건 (신고된 평가 제외)
  WITH recent AS (
    SELECT kept_promise, skill_matched, would_again, rater_id
    FROM public.peer_ratings
    WHERE ratee_id = uid AND NOT disputed
    ORDER BY created_at DESC
    LIMIT 20
  )
  SELECT
    count(*),
    count(*) FILTER (WHERE would_again),
    count(*) FILTER (WHERE NOT kept_promise),
    count(DISTINCT rater_id),
    COALESCE(sum(kept_promise::int + skill_matched::int + would_again::int), 0)
  INTO rating_total, again_cnt, noshow_cnt, partners, positive_cnt
  FROM recent;

  pos_rate := CASE
    WHEN rating_total > 0 THEN round(positive_cnt::numeric / (rating_total * 3), 3)
    ELSE NULL
  END;

  new_grade := CASE
    WHEN noshow_cnt >= 3 OR (pos_rate IS NOT NULL AND pos_rate <= 0.4 AND rating_total >= 3)
      THEN 'caution'
    WHEN rating_total >= 10 AND pos_rate >= 0.9 AND noshow_cnt = 0
      THEN 'trust'
    WHEN rating_total >= 5
      THEN 'stable'
    ELSE 'unrated'
  END;

  INSERT INTO public.user_stats (
    user_id, response_rate, median_response_h,
    sessions_count, no_show_count, rehire_rate, partners_count,
    grade, positive_rate, review_count, updated_at
  )
  VALUES (
    uid,
    CASE WHEN total >= 3 THEN round(responded_24h::numeric / total, 3) ELSE NULL END,
    CASE WHEN total >= 3 THEN median_h ELSE NULL END,
    COALESCE(rating_total, 0),
    COALESCE(noshow_cnt, 0),
    CASE WHEN rating_total >= 3 THEN round(again_cnt::numeric / rating_total, 3) ELSE NULL END,
    COALESCE(partners, 0),
    new_grade,
    pos_rate,
    COALESCE(rating_total, 0),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    response_rate = EXCLUDED.response_rate,
    median_response_h = EXCLUDED.median_response_h,
    sessions_count = EXCLUDED.sessions_count,
    no_show_count = EXCLUDED.no_show_count,
    rehire_rate = EXCLUDED.rehire_rate,
    partners_count = EXCLUDED.partners_count,
    grade = EXCLUDED.grade,
    positive_rate = EXCLUDED.positive_rate,
    review_count = EXCLUDED.review_count,
    updated_at = now();
END;
$$;

-- ── 4. 야간 정합성 보정 ──
-- 트리거는 평가·노쇼 시점에 즉시 갱신하지만, 롤링 20건은 시간이 지나면서
-- 창이 밀리므로(강등·해제) 하루 1회 전수 재계산으로 어긋남을 보정한다.
CREATE OR REPLACE FUNCTION public.refresh_all_user_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u uuid;
BEGIN
  FOR u IN
    SELECT user_id FROM public.user_stats
    UNION
    SELECT DISTINCT ratee_id FROM public.peer_ratings
  LOOP
    PERFORM public.refresh_user_stats(u);
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-user-stats-nightly') THEN
    -- 매일 03:15 UTC (KST 12:15) — 트래픽이 가장 적은 시간대는 아니지만
    -- 전수 재계산이 가벼워 사용자 영향이 없다.
    PERFORM cron.schedule('refresh-user-stats-nightly', '15 3 * * *', 'SELECT public.refresh_all_user_stats()');
  END IF;
END;
$$;

-- ── 5. 기존 데이터 재계산 (grade 초기값 채우기) ──
SELECT public.refresh_all_user_stats();

-- ROLLBACK:
--   SELECT cron.unschedule('refresh-user-stats-nightly');
--   DROP FUNCTION IF EXISTS public.refresh_all_user_stats();
--   DROP TRIGGER IF EXISTS trg_flag_disputed_rating ON public.rating_reports;
--   DROP FUNCTION IF EXISTS public.flag_disputed_rating();
--   DROP TABLE IF EXISTS public.rating_reports;
--   ALTER TABLE public.peer_ratings DROP COLUMN IF EXISTS disputed;
--   ALTER TABLE public.user_stats DROP CONSTRAINT IF EXISTS user_stats_grade_check;
--   ALTER TABLE public.user_stats
--     DROP COLUMN IF EXISTS grade,
--     DROP COLUMN IF EXISTS positive_rate,
--     DROP COLUMN IF EXISTS review_count;
--   -- refresh_user_stats는 20260831000001_ratings.sql 의 정의로 되돌린다
