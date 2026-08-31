-- 고객센터 문의 창구: 문의를 받을 관리자 한 명의 user_id만 돌려준다.
--
-- 무엇이 문제인가
--   프로필 > 고객센터에는 자가처리 안내만 있고 "그 밖의 문의"를 보낼 곳이 없었다.
--   앱에는 이미 사람 대 사람 메시지(/messages?to=<user_id>)가 있는데,
--   일반 사용자는 관리자의 user_id를 알아낼 방법이 없다 —
--   user_roles의 SELECT 정책(20260506040704)은 본인 행과 관리자에게만 열려 있고,
--   has_role은 boolean만 돌려주지 id를 주지 않는다.
--
-- 어떻게 고치는가
--   user_roles에 공개 SELECT를 여는 대신(그러면 관리자 명단 전체와 각자의 부여 시각까지
--   드러난다) 필요한 값 하나 — 문의를 받을 관리자 한 명의 user_id — 만 내주는
--   SECURITY DEFINER 함수를 둔다. 노출되는 정보는 "이 uuid에게 문의를 보내면 된다"가 전부다.
--
-- 왜 '가장 먼저 등록된 관리자'인가
--   반환값이 호출할 때마다 달라지면 문의가 여러 관리자에게 흩어져 아무도 전체 맥락을
--   보지 못한다. user_roles.created_at 오름차순으로 첫 행을 잡으면 관리자를 새로 추가해도
--   창구는 그대로다(먼저 등록된 사람이 계속 받는다). 같은 시각에 두 명이 들어간 경우까지
--   결정적이어야 하므로 user_id로 한 번 더 정렬한다 — ORDER BY가 유일해야 LIMIT 1이 안정적이다.
--   창구를 옮기려면 그 관리자 행을 지웠다 다시 넣으면 된다(운영 판단이라 앱에는 열지 않는다).
--
-- 관리자가 없으면
--   예외 대신 NULL을 돌려준다. 문의 창구가 아직 없다는 것은 오류 상황이 아니라
--   그냥 사실이고, 화면은 NULL을 받으면 버튼을 감추고 기존 안내 문구를 그대로 보인다.
--   (동작하지 않는 버튼을 남기지 않는다.)

CREATE OR REPLACE FUNCTION public.get_support_admin_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
  ORDER BY ur.created_at, ur.user_id
  LIMIT 1
$$;

COMMENT ON FUNCTION public.get_support_admin_id() IS
  '고객센터 문의를 받을 관리자 한 명의 user_id. 가장 먼저 등록된 관리자(user_roles.created_at, user_id 순)를 돌려주고, 관리자가 없으면 NULL. 관리자 명단 전체를 열지 않으려고 둔 창구다.';

-- 메시지는 로그인해야 보낼 수 있으므로 익명에게는 줄 이유가 없다.
REVOKE ALL ON FUNCTION public.get_support_admin_id() FROM public;
GRANT EXECUTE ON FUNCTION public.get_support_admin_id() TO authenticated;

-- 관리자 조회용 인덱스는 두지 않는다. user_roles는 행이 몇 개뿐이고
-- (user_id, role) UNIQUE 인덱스가 이미 있어 이 정도 스캔은 비용이 아니다.

-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.get_support_admin_id();
