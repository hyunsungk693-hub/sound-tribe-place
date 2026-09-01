-- 배너를 이미지 한 장만으로도 올릴 수 있게 한다.
--
-- 20260901000027에서 title·description·link를 전부 NOT NULL로 잡았다. 코드에 박혀
-- 있던 배너 3장이 마침 셋 다 채워져 있었기 때문인데, 실제로 운영이 올리는 것은
-- 문구가 이미 그려져 있는 제휴·이벤트 이미지가 대부분이다. 그런 배너에 제목과
-- 설명을 억지로 짜 넣으면 같은 말이 이미지 위에 한 번 더 겹쳐 나온다. 이동할 곳이
-- 없는 단순 공지 배너도 link를 채울 이유가 없다.
--
-- 그래서 세 컬럼을 선택 입력으로 내린다. image_url만 계속 필수다 — 이미지가 없는
-- 배너는 아무것도 아니다.
--
-- 대신 관리 목록에서 슬라이드를 부를 이름이 사라진다. 제목이 비면 목록에 남는 건
-- 썸네일뿐이라 "두 번째 거 내려주세요"가 순서를 한 번 바꾸는 순간 다른 슬라이드를
-- 가리키게 된다. 그래서 행마다 변하지 않는 번호(slide_no)를 붙인다. 이 번호는
-- 사용자에게 노출되지 않고 관리 화면에서만 쓴다.

-- ── 1. 필수 입력 해제 ──
-- image_url은 건드리지 않는다. 계속 NOT NULL이다.
ALTER TABLE public.carousel_slides
  ALTER COLUMN title       DROP NOT NULL,
  ALTER COLUMN description DROP NOT NULL,
  ALTER COLUMN link        DROP NOT NULL;

-- ── 2. CHECK은 값이 있을 때만 ──
-- NULL은 통과시키되 빈 문자열은 계속 막는다. ''가 들어올 수 있으면 "제목 없음"이
-- NULL과 ''로 갈라져, 홈과 관리 화면이 두 경우를 각각 처리해야 한다.
-- 공백만 넣는 것도 눈에는 빈 값이므로 btrim으로 함께 막는다.
ALTER TABLE public.carousel_slides
  DROP CONSTRAINT IF EXISTS carousel_slides_title_len;
ALTER TABLE public.carousel_slides
  ADD CONSTRAINT carousel_slides_title_len
  CHECK (title IS NULL OR (btrim(title) <> '' AND char_length(title) <= 40));

ALTER TABLE public.carousel_slides
  DROP CONSTRAINT IF EXISTS carousel_slides_desc_len;
ALTER TABLE public.carousel_slides
  ADD CONSTRAINT carousel_slides_desc_len
  CHECK (description IS NULL OR (btrim(description) <> '' AND char_length(description) <= 120));

-- 링크 안전장치는 그대로다. NULL을 통과시키는 괄호 하나 말고는 20260901000027과
-- 조건이 글자 하나 다르지 않다 — '/'로 시작하고, '//'로 시작하지 않고, 역슬래시가
-- 없고, 200자 이하. 여기가 느슨해지면 관리자 계정이 뚫렸을 때 홈 최상단 배너가
-- 그대로 오픈 리다이렉트가 된다. ('//evil.com'과 '/\evil.com'은 브라우저가 외부
-- 절대 URL로 해석한다. chr(92) = '\'.)
ALTER TABLE public.carousel_slides
  DROP CONSTRAINT IF EXISTS carousel_slides_link_internal;
ALTER TABLE public.carousel_slides
  ADD CONSTRAINT carousel_slides_link_internal
  CHECK (
    link IS NULL OR (
      link ~ '^/'
      AND link !~ '^//'
      AND strpos(link, chr(92)) = 0
      AND char_length(link) <= 200
    )
  );

-- ── 3. 관리용 고유 번호 ──
-- sort_order와는 다른 값이다. sort_order는 "홈에서 몇 번째로 보일지"라 위/아래
-- 버튼 한 번에 전체가 0..n-1로 다시 매겨진다. slide_no는 행이 만들어질 때 한 번
-- 정해지면 끝까지 그대로다 — 순서를 바꿔도, 앞의 슬라이드를 지워도 #3은 계속 #3이다.
--
-- GENERATED ALWAYS AS IDENTITY로 두면 필요한 세 가지를 DB가 대신 지켜준다:
--   1. INSERT에 값을 주지 않아도 자동으로 매겨진다(관리 화면이 번호를 고를 일이 없다).
--   2. ALWAYS라서 UPDATE로 덮어쓸 수 없다. 번호의 불변성이 화면 규칙이 아니라
--      제약이 된다 — 관리자 UPDATE 정책으로도 못 바꾼다.
--   3. 이 ALTER가 이미 들어 있는 행에도 값을 채워 넣는다(테이블 재작성).
--      테이블이 비어 있으면 그냥 아무 일도 일어나지 않으므로 어느 쪽이든 안전하다.
ALTER TABLE public.carousel_slides
  ADD COLUMN IF NOT EXISTS slide_no bigint GENERATED ALWAYS AS IDENTITY;

-- 시퀀스가 같은 값을 두 번 줄 일은 없지만, 번호가 식별자로 쓰이는 이상 제약으로
-- 못 박아 둔다(덤으로 관리 목록이 쓰는 조회에 인덱스가 생긴다).
ALTER TABLE public.carousel_slides
  DROP CONSTRAINT IF EXISTS carousel_slides_slide_no_key;
ALTER TABLE public.carousel_slides
  ADD CONSTRAINT carousel_slides_slide_no_key UNIQUE (slide_no);

COMMENT ON COLUMN public.carousel_slides.slide_no IS
  '관리 화면에서 슬라이드를 가리키는 고유 번호(#3). 한 번 매겨지면 변하지 않으며 사용자에게는 보이지 않는다. 노출 순서인 sort_order와는 다른 값이다.';
COMMENT ON COLUMN public.carousel_slides.title IS
  '선택 입력. 배너 위 mono 라벨. 비면 홈에서 그 줄을 아예 그리지 않는다.';
COMMENT ON COLUMN public.carousel_slides.description IS
  '선택 입력. 배너 큰 문구. 비면 홈에서 그 줄을 아예 그리지 않는다.';
COMMENT ON COLUMN public.carousel_slides.link IS
  '선택 입력. 값이 있으면 앱 내부 경로만 — 외부 URL을 허용하면 홈 배너가 오픈 리다이렉트가 된다. 비면 배너를 눌러도 이동하지 않는다.';

-- ROLLBACK:
--   -- 되돌리기 전에 title/description/link가 NULL인 행을 채우거나 지워야 한다.
--   -- (NULL이 하나라도 남아 있으면 SET NOT NULL이 실패한다)
--   ALTER TABLE public.carousel_slides DROP CONSTRAINT IF EXISTS carousel_slides_slide_no_key;
--   ALTER TABLE public.carousel_slides DROP COLUMN IF EXISTS slide_no;
--   ALTER TABLE public.carousel_slides DROP CONSTRAINT IF EXISTS carousel_slides_link_internal;
--   ALTER TABLE public.carousel_slides ADD CONSTRAINT carousel_slides_link_internal
--     CHECK (link ~ '^/' AND link !~ '^//' AND strpos(link, chr(92)) = 0 AND char_length(link) <= 200);
--   ALTER TABLE public.carousel_slides DROP CONSTRAINT IF EXISTS carousel_slides_desc_len;
--   ALTER TABLE public.carousel_slides ADD CONSTRAINT carousel_slides_desc_len
--     CHECK (char_length(description) BETWEEN 1 AND 120);
--   ALTER TABLE public.carousel_slides DROP CONSTRAINT IF EXISTS carousel_slides_title_len;
--   ALTER TABLE public.carousel_slides ADD CONSTRAINT carousel_slides_title_len
--     CHECK (char_length(title) BETWEEN 1 AND 40);
--   ALTER TABLE public.carousel_slides
--     ALTER COLUMN title SET NOT NULL,
--     ALTER COLUMN description SET NOT NULL,
--     ALTER COLUMN link SET NOT NULL;
