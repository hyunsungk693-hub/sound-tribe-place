-- 홈 배너 캐러셀을 관리자가 직접 관리한다.
--
-- 지금 홈(src/pages/Index.tsx)의 배너 3장은 코드에 박혀 있다
-- (`import banner1 from "@/assets/banner-1.png"`). 문구 한 줄, 이미지 한 장을
-- 바꾸려면 개발자가 커밋하고 재배포해야 한다. 운영이 배포 주기에 묶여 있는 셈이라
-- 제휴 배너나 시즌 공지 같은 걸 제때 올릴 수가 없다.
--
-- 슬라이드를 테이블로 빼고 이미지는 공개 버킷에 올린다. 설계에서 신경 쓴 것:
--   1. 홈은 비로그인에게도 열려 있다. 활성 슬라이드는 anon도 읽어야 한다.
--   2. 쓰기는 관리자만. 첫 화면 최상단이라 아무나 못 바꾸게 한다.
--   3. link는 앱 내부 경로만 받는다. 외부 URL을 넣을 수 있으면 관리자 계정이
--      뚫렸을 때 홈 배너가 그대로 오픈 리다이렉트가 된다.
--   4. 시드 데이터를 넣지 않는다. 슬라이드가 0건이면 홈은 하드코딩 3장으로
--      되돌아가도록 만들어 두었고(클라이언트 폴백), 여기서 미리 채워버리면
--      그 폴백이 영영 검증되지 않는다.

-- ── 1. 공개 이미지 버킷 ──
-- 배너는 비로그인에게도 보여야 하니 서명 URL을 쓸 수 없다. public 버킷으로 둔다.
INSERT INTO storage.buckets (id, name, public)
VALUES ('carousel-images', 'carousel-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 읽기는 누구나(post-images와 동일). 쓰기·삭제는 관리자만 — post-images처럼
-- "로그인한 사람 전부"로 열어두면 아무 사용자나 배너 버킷에 파일을 쌓을 수 있다.
DROP POLICY IF EXISTS "Anyone can view carousel images" ON storage.objects;
CREATE POLICY "Anyone can view carousel images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'carousel-images');

DROP POLICY IF EXISTS "Admins upload carousel images" ON storage.objects;
CREATE POLICY "Admins upload carousel images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'carousel-images'
    AND public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Admins delete carousel images" ON storage.objects;
CREATE POLICY "Admins delete carousel images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'carousel-images'
    AND public.has_role(auth.uid(), 'admin')
  );

-- ── 2. 슬라이드 테이블 ──
-- 컬럼은 하드코딩돼 있던 배열({ title, desc, image, path })을 그대로 옮긴 것에
-- 정렬 순서와 노출 여부를 더한 형태다.
CREATE TABLE IF NOT EXISTS public.carousel_slides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,     -- 배너 위 mono 라벨 (예: "Find")
  description text NOT NULL,     -- 큰 문구 (예: "믿을 수 있는 밴드·세션 멤버 찾기")
  image_url   text NOT NULL,     -- 공개 버킷 public URL
  image_path  text,              -- 버킷 내 경로. 슬라이드를 지울 때 원본도 같이 지우려고 남긴다
  link        text NOT NULL,     -- 눌렀을 때 이동할 앱 내부 경로 (예: "/jobs")
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT carousel_slides_title_len CHECK (char_length(title) BETWEEN 1 AND 40),
  CONSTRAINT carousel_slides_desc_len  CHECK (char_length(description) BETWEEN 1 AND 120),
  -- 앱 내부 경로만 허용한다. '/'로 시작한다는 조건만으로는 부족하다 —
  -- "//evil.com"과 "/\evil.com"은 브라우저가 외부 절대 URL로 해석한다.
  -- 역슬래시는 내부 경로에 쓸 일이 없으니 위치를 가리지 않고 전부 막는다
  -- (chr(92) = '\'. 정규식에 직접 쓰면 이스케이프 규칙에 따라 해석이 갈린다).
  CONSTRAINT carousel_slides_link_internal CHECK (
    link ~ '^/'
    AND link !~ '^//'
    AND strpos(link, chr(92)) = 0
    AND char_length(link) <= 200
  )
);

-- 홈 조회는 항상 "활성 + 순서대로"다.
CREATE INDEX IF NOT EXISTS idx_carousel_slides_order
  ON public.carousel_slides (is_active, sort_order, created_at);

ALTER TABLE public.carousel_slides ENABLE ROW LEVEL SECURITY;

-- 홈은 비로그인에게도 열려 있으므로 TO 절 없이(= anon 포함) 연다.
-- 비활성 슬라이드는 관리 화면에서만 보여야 하니 관리자에게만 보인다.
-- (anon이면 auth.uid()가 NULL이고 has_role은 false를 반환한다)
CREATE POLICY "Public can read active slides"
  ON public.carousel_slides FOR SELECT
  USING (is_active OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins create slides"
  ON public.carousel_slides FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update slides"
  ON public.carousel_slides FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete slides"
  ON public.carousel_slides FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_carousel_slides_updated_at ON public.carousel_slides;
CREATE TRIGGER trg_carousel_slides_updated_at
  BEFORE UPDATE ON public.carousel_slides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON COLUMN public.carousel_slides.link IS
  '앱 내부 경로만. 외부 URL을 허용하면 홈 배너가 오픈 리다이렉트가 된다.';
COMMENT ON COLUMN public.carousel_slides.image_path IS
  'carousel-images 버킷 내 경로. 슬라이드 삭제 시 고아 파일이 남지 않도록 함께 지운다.';

-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_carousel_slides_updated_at ON public.carousel_slides;
--   DROP POLICY IF EXISTS "Admins delete slides" ON public.carousel_slides;
--   DROP POLICY IF EXISTS "Admins update slides" ON public.carousel_slides;
--   DROP POLICY IF EXISTS "Admins create slides" ON public.carousel_slides;
--   DROP POLICY IF EXISTS "Public can read active slides" ON public.carousel_slides;
--   DROP TABLE IF EXISTS public.carousel_slides;
--   DROP POLICY IF EXISTS "Admins delete carousel images" ON storage.objects;
--   DROP POLICY IF EXISTS "Admins upload carousel images" ON storage.objects;
--   DROP POLICY IF EXISTS "Anyone can view carousel images" ON storage.objects;
--   DELETE FROM storage.objects WHERE bucket_id = 'carousel-images';
--   DELETE FROM storage.buckets WHERE id = 'carousel-images';
