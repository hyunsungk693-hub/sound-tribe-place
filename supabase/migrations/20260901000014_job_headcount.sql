-- 구인글 모집 인원.
--
-- 지원자는 "몇 명 뽑는 자리인지"를 알 수 없었고, 공고주는 몇 명을 더 뽑아야 하는지
-- 지원자 목록을 세어가며 가늠해야 했다. 둘 다 공고에 숫자 하나만 있으면 끝난다.
--
-- NULL 허용: 기존 공고는 인원을 밝힌 적이 없다. 1로 채우면 "1명 모집"이라고
-- 하지 않은 말을 만들어내는 셈이라, 미지정은 미지정으로 둔다.
-- 새 공고는 폼에서 필수로 받는다.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS headcount int;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_headcount_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_headcount_check
  CHECK (headcount IS NULL OR headcount BETWEEN 1 AND 99);

-- ROLLBACK:
--   ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_headcount_check;
--   ALTER TABLE public.posts DROP COLUMN IF EXISTS headcount;
