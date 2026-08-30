-- 급구는 "말 그대로 급하게 구하는 것"만: 마감까지 3일 이하인 공고만 급구로 등록한다.
--
-- CHECK 제약으로는 못 건다 — now()는 IMMUTABLE이 아니라 CHECK에 쓸 수 없다.
-- 그래서 BEFORE INSERT/UPDATE 트리거로 강제한다.
--
-- 이미 등록된 급구 글을 나중에 수정할 때(제목만 고치는 경우 등) 마감일이 지났다는
-- 이유로 저장이 막히면 안 되므로, is_urgent나 deadline_at이 실제로 바뀔 때만 검사한다.

CREATE OR REPLACE FUNCTION public.enforce_urgent_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.is_urgent IS DISTINCT FROM OLD.is_urgent
     OR NEW.deadline_at IS DISTINCT FROM OLD.deadline_at
  THEN
    IF NEW.is_urgent THEN
      IF NEW.deadline_at IS NULL THEN
        RAISE EXCEPTION '급구 공고는 마감일시를 입력해야 합니다';
      END IF;
      IF NEW.deadline_at <= now() THEN
        RAISE EXCEPTION '마감일시가 이미 지났습니다';
      END IF;
      IF NEW.deadline_at > now() + interval '3 days' THEN
        RAISE EXCEPTION '급구는 마감까지 3일 이하인 공고만 등록할 수 있습니다';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_urgent_deadline ON public.posts;
CREATE TRIGGER trg_enforce_urgent_deadline
  BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_urgent_deadline();

-- 기존 데이터 정리: 3일을 넘는 급구 글의 마감일을 3일 이내로 당긴다.
-- (시드 데이터라 급구 표식을 유지하는 쪽이 화면 확인에 유용하다.
--  실 데이터였다면 is_urgent=false로 내리는 편이 맞다.)
UPDATE public.posts
SET deadline_at = now() + interval '3 days'
WHERE is_urgent AND deadline_at > now() + interval '3 days';

UPDATE public.posts
SET is_urgent = false
WHERE is_urgent AND (deadline_at IS NULL OR deadline_at <= now());

-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_enforce_urgent_deadline ON public.posts;
--   DROP FUNCTION IF EXISTS public.enforce_urgent_deadline();
--   (당겨진 deadline_at 값은 되돌리지 않는다 — 원래 값은 시드 데이터였다)
