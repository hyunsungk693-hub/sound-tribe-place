-- 평가 신고를 관리자가 검토·처리할 수 있게 한다.
--
-- 20260901000004는 신고가 들어오면 즉시 disputed=true로 산정에서 빼고,
-- "운영자 확인은 DB에서 직접 처리한다"고 적어둔 채 화면을 만들지 않았다.
-- 그 결과
--   · 관리자는 rating_reports를 읽을 수조차 없다(SELECT 정책이 reporter 본인 한정).
--   · 신고만 하면 어떤 평가든 영구히 산정에서 빠진다. 검토가 없으니 되돌릴 길이 없고,
--     불리한 평가를 받은 사람이 전부 신고하면 나쁜 평판을 지울 수 있다.
-- 처리 상태와 관리자용 정책, 그리고 판정을 한 번에 적용하는 RPC를 둔다.

-- ── 1. 처리 상태 ──
ALTER TABLE public.rating_reports
  ADD COLUMN IF NOT EXISTS status      text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_note  text;

ALTER TABLE public.rating_reports
  DROP CONSTRAINT IF EXISTS rating_reports_status_check;
ALTER TABLE public.rating_reports
  ADD CONSTRAINT rating_reports_status_check
  CHECK (status IN ('pending', 'upheld', 'dismissed'));

ALTER TABLE public.rating_reports
  DROP CONSTRAINT IF EXISTS rating_reports_note_len;
ALTER TABLE public.rating_reports
  ADD CONSTRAINT rating_reports_note_len
  CHECK (admin_note IS NULL OR char_length(admin_note) <= 500);

CREATE INDEX IF NOT EXISTS idx_rating_reports_status
  ON public.rating_reports (status, created_at DESC);

-- ── 2. 관리자 열람 ──
-- 기존 "Read own reports"(reporter 본인)는 그대로 두고 관리자 절만 더한다.
DROP POLICY IF EXISTS "Read own reports" ON public.rating_reports;
CREATE POLICY "Read own reports or admin"
  ON public.rating_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ── 3. 판정 적용 ──
-- 처리 = 신고 상태 갱신 + peer_ratings.disputed 조정 + 산정 재계산.
-- 세 가지가 따로 놀면 "기각했는데 여전히 제외 중"이 생기므로 한 함수로 묶는다.
-- 클라이언트에 UPDATE 정책을 여는 대신 RPC만 연다 — 그래야 세 동작이 갈라지지 않는다.
--
--   upheld    신고 인정 → 평가는 계속 산정에서 제외
--   dismissed 신고 기각 → 평가를 다시 산정에 포함
CREATE OR REPLACE FUNCTION public.resolve_rating_report(
  p_report_id uuid,
  p_decision  text,
  p_note      text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_rating uuid;
  target_ratee  uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION '관리자만 신고를 처리할 수 있습니다';
  END IF;
  IF p_decision NOT IN ('upheld', 'dismissed') THEN
    RAISE EXCEPTION '처리 결과는 upheld 또는 dismissed여야 합니다';
  END IF;

  UPDATE public.rating_reports
  SET status      = p_decision,
      resolved_at = now(),
      resolved_by = auth.uid(),
      admin_note  = NULLIF(btrim(COALESCE(p_note, '')), '')
  WHERE id = p_report_id
  RETURNING rating_id INTO target_rating;

  IF target_rating IS NULL THEN
    RAISE EXCEPTION '신고를 찾을 수 없습니다';
  END IF;

  -- 같은 평가에 대기 중인 다른 신고가 남아 있으면 계속 제외한다.
  UPDATE public.peer_ratings
  SET disputed = (
    p_decision = 'upheld'
    OR EXISTS (
      SELECT 1 FROM public.rating_reports r
      WHERE r.rating_id = target_rating AND r.status = 'pending'
    )
  )
  WHERE id = target_rating
  RETURNING ratee_id INTO target_ratee;

  IF target_ratee IS NOT NULL THEN
    PERFORM public.refresh_user_stats(target_ratee);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_rating_report(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_rating_report(uuid, text, text) TO authenticated;

-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.resolve_rating_report(uuid, text, text);
--   DROP POLICY IF EXISTS "Read own reports or admin" ON public.rating_reports;
--   CREATE POLICY "Read own reports" ON public.rating_reports FOR SELECT TO authenticated
--     USING (reporter_id = auth.uid());
--   DROP INDEX IF EXISTS public.idx_rating_reports_status;
--   ALTER TABLE public.rating_reports
--     DROP CONSTRAINT IF EXISTS rating_reports_status_check,
--     DROP CONSTRAINT IF EXISTS rating_reports_note_len,
--     DROP COLUMN IF EXISTS status, DROP COLUMN IF EXISTS resolved_at,
--     DROP COLUMN IF EXISTS resolved_by, DROP COLUMN IF EXISTS admin_note;
