// D5: 크롤러(봇 UA)가 /u/{handle}에 접근하면 OG 메타가 채워진 HTML을 반환.
// vercel.json의 has(user-agent) rewrite로만 도달하며, 사람은 SPA를 그대로 받는다.

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://syxodrmnukybnnlgttuw.supabase.co";
const SUPABASE_ANON =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eG9kcm1udWt5Ym5ubGd0dHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2MjEwOTMsImV4cCI6MjEwMzE5NzA5M30.e96it7mNmSxnC4ygoeB33WGHBUEn4wwjDV5V_1T_rZg";
const SITE = "https://instrut.vercel.app";

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// 순수 함수: 프로필 → 봇용 HTML (node로 직접 검증 가능)
export function buildProfileHtml(profile, handle) {
  const found = !!profile;
  const name = profile?.display_name || "instrut 음악인";
  const inst = profile?.instruments?.[0] || null;
  const loc = profile?.location || null;
  const sub = [inst, loc].filter(Boolean).join(" · ");
  const title = found ? `${name}${sub ? ` — ${sub}` : ""} | instrut` : "instrut — 음악인 구인구직·연습실·커뮤니티";
  const desc = found
    ? `${name}님의 음악인 프로필 — 믿을 수 있는 밴드·세션 멤버를 찾고, 첫 합주까지 바로 잡는 곳, instrut에서 확인하세요.`
    : "믿을 수 있는 밴드·세션 멤버를 찾고, 첫 합주까지 바로 잡는 곳 — 음악인 구인구직·연습실 예약·커뮤니티";
  const image = found ? `${SITE}/api/og-profile?handle=${encodeURIComponent(handle)}` : `${SITE}/og-image.png`;
  const url = `${SITE}/u/${encodeURIComponent(handle)}`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${esc(url)}" />
<meta property="og:type" content="profile" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:url" content="${esc(url)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<meta name="twitter:image" content="${esc(image)}" />
</head>
<body>
<h1>${esc(name)}</h1>
${sub ? `<p>${esc(sub)}</p>` : ""}
<p>${esc(desc)}</p>
<a href="${esc(url)}">instrut에서 프로필 보기</a>
</body>
</html>`;
}

export async function fetchProfileByHandle(handle) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?handle=eq.${encodeURIComponent(handle)}&select=display_name,instruments,location,handle&limit=1`,
    { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } },
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export default async function handler(req, res) {
  try {
    const handle = String(req.query?.handle || "").toLowerCase();
    const profile = handle ? await fetchProfileByHandle(handle) : null;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=3600");
    res.status(profile ? 200 : 404).send(buildProfileHtml(profile, handle));
  } catch (e) {
    res.status(500).send("prerender failed");
  }
}
