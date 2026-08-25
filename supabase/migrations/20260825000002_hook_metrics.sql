-- 훅 검증 지표 함수 (관리자 전용)
-- Admin 페이지에서 supabase.rpc("get_hook_metrics", { days: 30 }) 로 호출

-- 일별 핵심 지표: 가입 / 글 등록(유형별) / 지원 / 대화·메시지 / 예약
CREATE OR REPLACE FUNCTION public.get_hook_metrics(days integer DEFAULT 30)
RETURNS TABLE (
  day date,
  signups bigint,
  job_posts bigint,
  room_posts bigint,
  community_posts bigint,
  promotion_posts bigint,
  applications bigint,
  new_conversations bigint,
  messages_sent bigint,
  reservations bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION '관리자만 조회할 수 있습니다';
  END IF;

  RETURN QUERY
  WITH d AS (
    SELECT generate_series(current_date - (days - 1), current_date, interval '1 day')::date AS day
  )
  SELECT
    d.day,
    (SELECT count(*) FROM public.profiles t WHERE t.created_at::date = d.day),
    (SELECT count(*) FROM public.posts t WHERE t.post_type = 'job' AND t.created_at::date = d.day),
    (SELECT count(*) FROM public.posts t WHERE t.post_type = 'room' AND t.created_at::date = d.day),
    (SELECT count(*) FROM public.posts t WHERE t.post_type = 'community' AND t.created_at::date = d.day),
    (SELECT count(*) FROM public.posts t WHERE t.post_type = 'promotion' AND t.created_at::date = d.day),
    (SELECT count(*) FROM public.job_applications t WHERE t.created_at::date = d.day),
    (SELECT count(*) FROM public.conversations t WHERE t.created_at::date = d.day),
    (SELECT count(*) FROM public.messages t WHERE t.created_at::date = d.day),
    (SELECT count(*) FROM public.room_reservations t WHERE t.created_at::date = d.day)
  FROM d
  ORDER BY d.day;
END;
$$;

-- 누적 지표 요약: 훅 검증 판단의 한눈 지표
CREATE OR REPLACE FUNCTION public.get_hook_totals()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION '관리자만 조회할 수 있습니다';
  END IF;

  SELECT json_build_object(
    'total_users',          (SELECT count(*) FROM public.profiles),
    'total_job_posts',      (SELECT count(*) FROM public.posts WHERE post_type = 'job'),
    'total_posts',          (SELECT count(*) FROM public.posts),
    'total_applications',   (SELECT count(*) FROM public.job_applications),
    'accepted_applications',(SELECT count(*) FROM public.job_applications WHERE status = 'accepted'),
    'total_conversations',  (SELECT count(*) FROM public.conversations),
    'total_messages',       (SELECT count(*) FROM public.messages),
    'total_reservations',   (SELECT count(*) FROM public.room_reservations),
    -- 최근 7일 활동 사용자 (글/지원/메시지 중 하나라도 한 사용자)
    'weekly_active_users', (
      SELECT count(DISTINCT u) FROM (
        SELECT user_id AS u FROM public.posts        WHERE created_at > now() - interval '7 days'
        UNION
        SELECT user_id      FROM public.job_applications WHERE created_at > now() - interval '7 days'
        UNION
        SELECT sender_id    FROM public.messages     WHERE created_at > now() - interval '7 days'
      ) s
    ),
    -- 최근 7일 가입자
    'weekly_signups', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days')
  ) INTO result;

  RETURN result;
END;
$$;
