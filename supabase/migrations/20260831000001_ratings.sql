-- A7: 3항목 합주 후 평가 (peer_ratings) + D3 2차 점등(재합주율·노쇼·합주횟수)
-- 평가는 실제 매칭(accepted job_application)이 있는 상대에게만 남길 수 있다.

CREATE TABLE IF NOT EXISTS public.peer_ratings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ratee_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_application_id  uuid REFERENCES public.job_applications(id) ON DELETE SET NULL,
  kept_promise        boolean NOT NULL,   -- 약속 지킴
  skill_matched       boolean NOT NULL,   -- 실력 일치
  would_again         boolean NOT NULL,   -- 또 하고 싶음
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT peer_ratings_no_self CHECK (rater_id <> ratee_id),
  CONSTRAINT peer_ratings_unique UNIQUE (rater_id, ratee_id, job_application_id)
);

CREATE INDEX IF NOT EXISTS idx_peer_ratings_ratee ON public.peer_ratings(ratee_id);
CREATE INDEX IF NOT EXISTS idx_peer_ratings_rater ON public.peer_ratings(rater_id);

ALTER TABLE public.peer_ratings ENABLE ROW LEVEL SECURITY;

-- 집계값(재합주율 등)이 카드에 공개되므로 SELECT는 공개.
-- 개별 평가 행에는 평가 내용(bool 3개)만 있고 PII가 없다.
CREATE POLICY "Public can read peer ratings"
  ON public.peer_ratings FOR SELECT USING (true);

-- 작성: 본인이 rater이고, 지정한 job_application이 accepted이며
-- (rater가 지원자·ratee가 공고주) 또는 (rater가 공고주·ratee가 지원자)여야 한다.
CREATE POLICY "Rate only matched peers"
  ON public.peer_ratings FOR INSERT TO authenticated
  WITH CHECK (
    rater_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.job_applications a
      JOIN public.posts p ON p.id = a.job_id
      WHERE a.id = peer_ratings.job_application_id
        AND a.status = 'accepted'
        AND (
          (a.user_id = auth.uid() AND p.user_id = peer_ratings.ratee_id)
          OR (p.user_id = auth.uid() AND a.user_id = peer_ratings.ratee_id)
        )
    )
  );

CREATE POLICY "Update own ratings"
  ON public.peer_ratings FOR UPDATE TO authenticated
  USING (rater_id = auth.uid())
  WITH CHECK (rater_id = auth.uid());

CREATE POLICY "Delete own ratings"
  ON public.peer_ratings FOR DELETE TO authenticated
  USING (rater_id = auth.uid());

-- ── refresh_user_stats 확장: 응답률(기존) + 평가 기반 지표(신규) ──
-- sessions_count = 받은 평가 수(합주 성사 근사치)
-- no_show_count  = kept_promise=false 수
-- rehire_rate    = would_again=true 비율 (모수 3건 미만이면 NULL)
-- partners_count = 나를 평가한 서로 다른 상대 수
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

  -- 평가 기반(신규): uid가 ratee인 평가들
  SELECT
    count(*),
    count(*) FILTER (WHERE would_again),
    count(*) FILTER (WHERE NOT kept_promise),
    count(DISTINCT rater_id)
  INTO rating_total, again_cnt, noshow_cnt, partners
  FROM public.peer_ratings
  WHERE ratee_id = uid;

  INSERT INTO public.user_stats (
    user_id, response_rate, median_response_h,
    sessions_count, no_show_count, rehire_rate, partners_count, updated_at
  )
  VALUES (
    uid,
    CASE WHEN total >= 3 THEN round(responded_24h::numeric / total, 3) ELSE NULL END,
    CASE WHEN total >= 3 THEN median_h ELSE NULL END,
    COALESCE(rating_total, 0),
    COALESCE(noshow_cnt, 0),
    CASE WHEN rating_total >= 3 THEN round(again_cnt::numeric / rating_total, 3) ELSE NULL END,
    COALESCE(partners, 0),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    response_rate = EXCLUDED.response_rate,
    median_response_h = EXCLUDED.median_response_h,
    sessions_count = EXCLUDED.sessions_count,
    no_show_count = EXCLUDED.no_show_count,
    rehire_rate = EXCLUDED.rehire_rate,
    partners_count = EXCLUDED.partners_count,
    updated_at = now();
END;
$$;

-- 평가 INSERT/UPDATE/DELETE 시 ratee의 통계 갱신
CREATE OR REPLACE FUNCTION public.refresh_stats_on_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_user_stats(COALESCE(NEW.ratee_id, OLD.ratee_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_stats_on_rating ON public.peer_ratings;
CREATE TRIGGER trg_refresh_stats_on_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.peer_ratings
  FOR EACH ROW EXECUTE FUNCTION public.refresh_stats_on_rating();

-- updated_at 자동 갱신
DROP TRIGGER IF EXISTS trg_peer_ratings_updated ON public.peer_ratings;
CREATE TRIGGER trg_peer_ratings_updated
  BEFORE UPDATE ON public.peer_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── W12 고급 지표(관리자 전용) ──
-- NSM은 예약(B) 도입 전이므로 accepted 지원 수를 첫 합주 근사치로 사용한다.
CREATE OR REPLACE FUNCTION public.get_advanced_metrics()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  community_authors int;
  community_to_job int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION '관리자만 조회할 수 있습니다';
  END IF;

  SELECT count(DISTINCT user_id) INTO community_authors
  FROM public.posts WHERE post_type = 'community';

  SELECT count(DISTINCT c.user_id) INTO community_to_job
  FROM public.posts c
  WHERE c.post_type = 'community'
    AND EXISTS (SELECT 1 FROM public.posts j WHERE j.user_id = c.user_id AND j.post_type = 'job');

  SELECT json_build_object(
    -- NSM: 수락된 지원 = 첫 합주 근사 (예약 도입 후 예약확정 수로 대체 예정)
    'nsm_accepted_matches', (SELECT count(*) FROM public.job_applications WHERE status = 'accepted'),
    'weekly_accepted_matches', (SELECT count(*) FROM public.job_applications WHERE status = 'accepted' AND created_at > now() - interval '7 days'),
    -- 커뮤니티 → 구인 전환율
    'community_authors', community_authors,
    'community_to_job_authors', community_to_job,
    'community_to_job_rate', CASE WHEN community_authors > 0 THEN round(community_to_job::numeric / community_authors, 3) ELSE NULL END,
    -- 평가
    'total_ratings', (SELECT count(*) FROM public.peer_ratings),
    'weekly_ratings', (SELECT count(*) FROM public.peer_ratings WHERE created_at > now() - interval '7 days'),
    'avg_would_again', (SELECT round(avg(CASE WHEN would_again THEN 1 ELSE 0 END), 3) FROM public.peer_ratings),
    -- 파생 예약 비율: 예약(B) 도입 후 산출 (현재는 대기)
    'derived_booking_ready', false
  ) INTO result;

  RETURN result;
END;
$$;
