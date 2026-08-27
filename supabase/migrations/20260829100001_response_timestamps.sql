-- A5 응답 시각 적재 (산출·표시는 W10)
-- 지원 상태 첫 변경 시각과 대화의 첫 상호 응답 시각을 기록한다.

-- ============================================================
-- 1. 지원 응답 시각: 공고 작성자가 status를 처음 바꾼 시점
-- ============================================================
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;

CREATE OR REPLACE FUNCTION public.record_application_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND OLD.responded_at IS NULL THEN
    NEW.responded_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_application_response ON public.job_applications;
CREATE TRIGGER trg_record_application_response
  BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.record_application_response();

-- ============================================================
-- 2. 대화 첫 응답 시각: 첫 발신자와 다른 참여자가 처음 메시지를 보낸 시점
--    (개설자가 보낸 메시지만 있는 동안에는 null 유지)
-- ============================================================
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz;

CREATE OR REPLACE FUNCTION public.record_conversation_first_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations c
     SET first_response_at = COALESCE(NEW.created_at, now())
   WHERE c.id = NEW.conversation_id
     AND c.first_response_at IS NULL
     AND EXISTS (
       SELECT 1
         FROM public.messages m
        WHERE m.conversation_id = NEW.conversation_id
          AND m.sender_id <> NEW.sender_id
          AND m.id <> NEW.id
     );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_first_response ON public.messages;
CREATE TRIGGER trg_record_first_response
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.record_conversation_first_response();
