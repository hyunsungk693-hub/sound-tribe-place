-- 악기사 전화 연결.
--
-- 악기사는 매장이라 문의 수단이 필요한데 지금은 길찾기밖에 없다.
-- posts에 phone을 두고 tel: 링크로 건다. 연습실도 같은 컬럼을 쓸 수 있지만
-- 지금 입력 필드를 노출하는 곳은 악기사뿐이다.
--
-- 형식 검증은 CHECK으로 최소한만 건다 — 전화번호 표기는 국가·매장마다 제각각이라
-- 정규식을 조이면 정상 번호를 막는다. tel: 링크를 만들 때 프론트에서 숫자만 남긴다.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_phone_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_phone_check
  CHECK (phone IS NULL OR (length(phone) BETWEEN 7 AND 30 AND phone ~ '^[0-9+][-0-9()+. ]*$'));

-- ROLLBACK:
--   ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_phone_check;
--   ALTER TABLE public.posts DROP COLUMN IF EXISTS phone;
