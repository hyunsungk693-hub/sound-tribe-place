// D5: /api/og-profile?handle={handle} → 1200x630 동적 OG 이미지 (PNG)
// satori(레이아웃→SVG) + resvg(SVG→PNG). 한국어는 요청 텍스트만 담은
// Noto Sans KR 서브셋 TTF를 구글 폰트에서 받아 satori에 직접 전달한다.
// (@vercel/og 대신 satori+resvg를 쓴 이유: 순수 Node라 로컬 검증 가능, 폰트 제어 명시적)

// satori/resvg(네이티브 바이너리)는 런타임 환경에 따라 로드가 실패할 수 있어
// 지연 임포트한다 — 실패 시 핸들러의 302 폴백(정적 og-image.png)이 동작하도록.
async function loadRenderers() {
  const [{ default: satori }, { Resvg }] = await Promise.all([
    import("satori"),
    import("@resvg/resvg-js"),
  ]);
  return { satori, Resvg };
}

// 클라이언트에 이미 노출되는 공개값 (src/integrations/supabase/client.ts와 동일)
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://syxodrmnukybnnlgttuw.supabase.co";
const SUPABASE_ANON =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eG9kcm1udWt5Ym5ubGd0dHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2MjEwOTMsImV4cCI6MjEwMzE5NzA5M30.e96it7mNmSxnC4ygoeB33WGHBUEn4wwjDV5V_1T_rZg";

const BRAND = "#2083C5";
const BRAND_LIGHT = "#53B0ED";
const MINT = "#7DE7DD";

export async function fetchProfileByHandle(handle) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?handle=eq.${encodeURIComponent(handle)}&select=display_name,instruments,location,handle,purpose&limit=1`,
    { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } },
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

// 요청 텍스트만 담은 서브셋 TTF를 받는다 (구식 UA → TTF 포맷 응답)
export async function fetchKoreanFont(text, weight = 700) {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(text)}`,
    // 비브라우저 UA에는 TTF URL이 온다 (브라우저 UA는 woff2 — satori 미지원)
    { headers: { "User-Agent": "curl/7.64.1" } },
  ).then((r) => r.text());
  const m = css.match(/src:\s*url\(([^)]+)\)/);
  if (!m) throw new Error("font url not found in css");
  const buf = await fetch(m[1]).then((r) => r.arrayBuffer());
  return buf;
}

// 순수 함수: 프로필 → PNG Buffer (node로 직접 검증 가능)
export async function renderProfileOg(profile) {
  const { satori, Resvg } = await loadRenderers();
  const name = profile?.display_name || "instrut 음악인";
  const inst = profile?.instruments?.[0] || null;
  const loc = profile?.location || null;
  const handle = profile?.handle ? `@${profile.handle}` : "";
  const sub = [inst, loc].filter(Boolean).join(" · ") || "음악인 구인구직 · 연습실 · 커뮤니티";
  const tagline = "믿을 수 있는 밴드·세션 멤버 찾기";
  const logoMark = "♪";

  // 화면에 렌더되는 모든 문자열을 서브셋에 포함해야 한다 (누락 글자 = 두부 글리프)
  const allText = `${name}${sub}${handle}${tagline}${logoMark}instrut`;
  const [bold, regular] = await Promise.all([
    fetchKoreanFont(allText, 700),
    fetchKoreanFont(allText, 400),
  ]);

  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          width: 1200, height: 630, display: "flex", flexDirection: "column",
          justifyContent: "space-between", padding: 72,
          background: `linear-gradient(135deg, #EAF4FC 0%, #D8ECF8 100%)`,
          fontFamily: "NotoSansKR",
        },
        children: [
          {
            type: "div",
            props: {
              style: { display: "flex", alignItems: "center", gap: 16 },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      width: 56, height: 56, borderRadius: 16,
                      background: `linear-gradient(135deg, ${BRAND_LIGHT}, ${MINT})`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#ffffff", fontSize: 30, fontWeight: 700,
                    },
                    children: "♪",
                  },
                },
                { type: "div", props: { style: { fontSize: 40, fontWeight: 700, color: BRAND }, children: "instrut" } },
              ],
            },
          },
          {
            type: "div",
            props: {
              style: { display: "flex", flexDirection: "column", gap: 14 },
              children: [
                { type: "div", props: { style: { fontSize: 84, fontWeight: 700, color: "#14232E", lineHeight: 1.15 }, children: name } },
                { type: "div", props: { style: { fontSize: 40, fontWeight: 400, color: "#51677A" }, children: sub } },
              ],
            },
          },
          {
            type: "div",
            props: {
              style: { display: "flex", justifyContent: "space-between", alignItems: "center" },
              children: [
                { type: "div", props: { style: { fontSize: 32, fontWeight: 700, color: BRAND }, children: handle } },
                { type: "div", props: { style: { fontSize: 26, fontWeight: 400, color: "#51677A" }, children: "믿을 수 있는 밴드·세션 멤버 찾기" } },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "NotoSansKR", data: bold, weight: 700, style: "normal" },
        { name: "NotoSansKR", data: regular, weight: 400, style: "normal" },
      ],
    },
  );

  const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
  return Buffer.from(png);
}

export default async function handler(req, res) {
  try {
    const handle = String(req.query?.handle || "").toLowerCase();
    const profile = handle ? await fetchProfileByHandle(handle) : null;
    const png = await renderProfileOg(profile);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(png);
  } catch (e) {
    // 폰트·렌더 실패 시 정적 브랜드 이미지로 폴백
    res.setHeader("Cache-Control", "s-maxage=300");
    res.redirect(302, "/og-image.png");
  }
}
