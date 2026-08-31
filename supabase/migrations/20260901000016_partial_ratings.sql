-- 후기 3항목을 예/아니오 + 미선택으로 바꾼다.
--
-- 문제
--   kept_promise / skill_matched / would_again이 전부 boolean NOT NULL이라
--   "이 항목은 답하지 않음"을 저장할 수 없다. UI가 셋 다 켠 상태로 시작하니
--   토글을 끄는 것이 "아니오"인지 "답 안 함"인지 구분되지 않고,
--   한 항목만 답하고 싶어도 나머지 둘에 대해 강제로 입장을 표명하게 된다.
--
-- 해결
--   세 컬럼을 NULL 허용으로 바꾸고(= 미선택), 최소 1개는 답하도록 강제한다.
--   전부 비운 후기는 의미가 없는데 review_count만 올려 등급을 흔든다.

ALTER TABLE public.peer_ratings ALTER COLUMN kept_promise  DROP NOT NULL;
ALTER TABLE public.peer_ratings ALTER COLUMN skill_matched DROP NOT NULL;
ALTER TABLE public.peer_ratings ALTER COLUMN would_again   DROP NOT NULL;

ALTER TABLE public.peer_ratings
  DROP CONSTRAINT IF EXISTS peer_ratings_at_least_one;
ALTER TABLE public.peer_ratings
  ADD CONSTRAINT peer_ratings_at_least_one
  CHECK (num_nonnulls(kept_promise, skill_matched, would_again) >= 1);

-- ── 집계 보정 ──
-- 미선택이 생기면 20260901000004의 집계가 전부 틀어진다.
--   · 재합주율: 분모가 전체 후기 수라 would_again을 답하지 않은 후기까지 세어 비율이 깎인다.
--   · 긍정률:  bool::int 셋을 더하는데 하나라도 NULL이면 행 전체가 NULL이 되어
--              sum에서 통째로 빠지고, 분모는 여전히 후기수 × 3이라 크게 낮아진다.
-- 답한 칸만 분모로 세도록 고친다. 나머지 로직(응답률·등급 기준)은 그대로다.
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
  again_answered int;
  noshow_cnt int;
  partners int;
  positive_cnt int;
  answered_cells int;
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
    count(*) FILTER (WHERE would_again IS NOT NULL),
    count(*) FILTER (WHERE NOT kept_promise),
    count(DISTINCT rater_id),
    COALESCE(sum(
      COALESCE(kept_promise::int, 0)
      + COALESCE(skill_matched::int, 0)
      + COALESCE(would_again::int, 0)
    ), 0),
    COALESCE(sum(
      (kept_promise IS NOT NULL)::int
      + (skill_matched IS NOT NULL)::int
      + (would_again IS NOT NULL)::int
    ), 0)
  INTO rating_total, again_cnt, again_answered, noshow_cnt, partners, positive_cnt, answered_cells
  FROM recent;

  pos_rate := CASE
    WHEN answered_cells > 0 THEN round(positive_cnt::numeric / answered_cells, 3)
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
    -- 재합주율은 "또 하고 싶은가"에 답한 후기만 분모로 센다
    CASE WHEN again_answered >= 3 THEN round(again_cnt::numeric / again_answered, 3) ELSE NULL END,
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

-- 기존 후기는 값이 그대로라 결과가 달라지지 않지만, 집계식이 바뀌었으므로 전수 재계산한다.
SELECT public.refresh_all_user_stats();

-- ROLLBACK:
--   (20260901000004의 refresh_user_stats 본문을 다시 실행)
--   ALTER TABLE public.peer_ratings DROP CONSTRAINT IF EXISTS peer_ratings_at_least_one;
--   UPDATE public.peer_ratings SET kept_promise = COALESCE(kept_promise, false),
--     skill_matched = COALESCE(skill_matched, false), would_again = COALESCE(would_again, false);
--   ALTER TABLE public.peer_ratings ALTER COLUMN kept_promise  SET NOT NULL;
--   ALTER TABLE public.peer_ratings ALTER COLUMN skill_matched SET NOT NULL;
--   ALTER TABLE public.peer_ratings ALTER COLUMN would_again   SET NOT NULL;
