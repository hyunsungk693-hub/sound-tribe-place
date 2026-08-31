-- 합주 가능 시간 정형화 — 요일 × 시간대 슬롯.
--
-- 문제
--   profiles.available_times는 자유 텍스트 배열(쉼표 입력)이었다. FirstRehearsal의
--   "두 분의 공통 가능 시간"은 두 사람의 Set을 문자열 완전일치로 교집합했는데,
--   정해진 어휘가 아니라서 "주말 오후"와 "토요일 오후"처럼 표현이 조금만 달라도
--   매칭이 실패했다. 사실상 늘 "겹치는 시간 정보가 없습니다"만 나오는 기능이었다.
--
-- 해결
--   `{요일}-{시간대}` 한 가지 형태만 허용하는 정형 슬롯을 둔다.
--   프로필(개인 가능 시간)과 구인글(합주 가능 시간)이 같은 어휘를 쓰므로
--   교집합이 실제로 성립한다.
--
--   요일  mon tue wed thu fri sat sun
--   시간대 am(09-12) pm(12-18) eve(18-22) night(22-)
--
--   자유 텍스트 available_times는 지우지 않는다. 기존 사용자가 적어둔 내용이
--   남아 있고, 화면 한 곳이 아직 그 값을 읽는다. 정형 슬롯이 자리 잡은 뒤 정리한다.

-- 허용 어휘. 함수나 정규식 대신 목록을 그대로 적는다 —
-- CHECK에는 서브쿼리를 쓸 수 없고, 목록이 곧 문서가 된다.
-- src/lib/timeSlots.ts의 ALL_SLOTS와 같은 값이어야 한다.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS available_slots text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_available_slots_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_available_slots_check
  CHECK (available_slots <@ ARRAY[
    'mon-am', 'mon-pm', 'mon-eve', 'mon-night',
    'tue-am', 'tue-pm', 'tue-eve', 'tue-night',
    'wed-am', 'wed-pm', 'wed-eve', 'wed-night',
    'thu-am', 'thu-pm', 'thu-eve', 'thu-night',
    'fri-am', 'fri-pm', 'fri-eve', 'fri-night',
    'sat-am', 'sat-pm', 'sat-eve', 'sat-night',
    'sun-am', 'sun-pm', 'sun-eve', 'sun-night'
  ]::text[]);

-- 구인글에도 같은 어휘로 "합주 가능 시간"을 받는다.
-- NULL = 밝히지 않음. 빈 배열과 구분해야 "선택 안 함"과 "고르다 말았음"이 섞이지 않는다.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS rehearsal_slots text[];

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_rehearsal_slots_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_rehearsal_slots_check
  CHECK (rehearsal_slots IS NULL OR rehearsal_slots <@ ARRAY[
    'mon-am', 'mon-pm', 'mon-eve', 'mon-night',
    'tue-am', 'tue-pm', 'tue-eve', 'tue-night',
    'wed-am', 'wed-pm', 'wed-eve', 'wed-night',
    'thu-am', 'thu-pm', 'thu-eve', 'thu-night',
    'fri-am', 'fri-pm', 'fri-eve', 'fri-night',
    'sat-am', 'sat-pm', 'sat-eve', 'sat-night',
    'sun-am', 'sun-pm', 'sun-eve', 'sun-night'
  ]::text[]);

-- ROLLBACK:
--   ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_rehearsal_slots_check;
--   ALTER TABLE public.posts DROP COLUMN IF EXISTS rehearsal_slots;
--   ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_available_slots_check;
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS available_slots;
