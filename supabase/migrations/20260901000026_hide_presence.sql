-- 접속 상태 숨기기.
--
-- 20260901000025로 "활동 중" 배지가 실제 접속 기준이 되면서, profiles가 공개
-- 테이블이라 누가 지금 앱에 들어와 있는지가 모두에게 드러나게 됐다. 구인·구직
-- 플랫폼에서 이건 원치 않을 수 있는 노출이다 — 이직을 알리고 싶지 않은 사람,
-- 특정 상대를 피하고 싶은 사람에게는 접속 여부 자체가 정보다.
--
-- 끄는 쪽을 확실하게 만든다: 켜져 있으면 last_seen_at을 갱신하지 않는다.
-- 화면에서 배지를 감추기만 하면 값은 계속 쌓여서, API를 직접 부르는 사람에게는
-- 그대로 보인다. 기록 자체를 남기지 않아야 숨긴 것이다.
--
-- 기본값은 false(공개). 이미 이 상태로 동작 중이고, 기본을 숨김으로 두면
-- 배지가 사실상 아무에게도 안 붙어 기능이 죽는다.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hide_presence boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.hide_presence IS
  '켜면 last_seen_at을 갱신하지 않는다. 화면에서 가리는 것이 아니라 기록을 남기지 않는다.';

-- 이미 접속 기록이 쌓인 사용자가 나중에 숨김을 켜면, 그 시점의 last_seen_at이
-- 남아 있어 최대 5분간 배지가 유지된다. 켜는 순간 값을 비우는 것은
-- 클라이언트가 함께 처리한다(같은 UPDATE에 last_seen_at = NULL).

-- ROLLBACK:
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS hide_presence;
