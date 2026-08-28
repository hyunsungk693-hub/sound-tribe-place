// E4: 글 상세 봇 프리렌더 (Vercel Serverless Function)
// 크롤러 UA의 GET /post/:id → vercel.json has-rewrite → 이 함수
// 사람(일반 UA)은 기존 SPA로 가고, 봇에게만 완전한 HTML 문서를 준다.

// 클라이언트에 이미 노출되는 공개값이라 코드 fallback이 안전하다
// (src/integrations/supabase/client.ts와 동일한 값)
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://syxodrmnukybnnlgttuw.supabase.co";
const SUPABASE_ANON =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eG9kcm1udWt5Ym5ubGd0dHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2MjEwOTMsImV4cCI6MjEwMzE5NzA5M30.e96it7mNmSxnC4ygoeB33WGHBUEn4wwjDV5V_1T_rZg";
const SITE = "https://instrut.vercel.app";
const DEFAULT_OG_IMAGE = `${SITE}/og-image.png`;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TYPE_LABEL = {
  job: "구인구직",
  room: "연습실",
  shop: "악기사",
  community: "커뮤니티",
  promotion: "홍보",
};

// 모든 출력값은 반드시 이스케이프를 거친다 (XSS 방지)
export const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// 본문 → 메타 설명: 공백 정리 후 앞 160자
export function toDescription(content) {
  const flat = String(content ?? "").replace(/\s+/g, " ").trim();
  return flat.length > 160 ? `${flat.slice(0, 157)}…` : flat;
}

// 순수 함수: 글 → 봇용 HTML 문서 (node로 직접 검증 가능)
export function buildPostHtml(post) {
  const title = `${post.title} — instrut`;
  const desc = toDescription(post.content);
  const url = `${SITE}/post/${post.id}`;
  const image =
    post.image_url && /^https?:\/\//.test(post.image_url)
      ? post.image_url
      : DEFAULT_OG_IMAGE;
  const label = TYPE_LABEL[post.post_type] || "게시글";
  const dateIso = post.created_at
    ? new Date(post.created_at).toISOString()
    : "";
  const dateText = post.created_at
    ? new Date(post.created_at).toLocaleDateString("ko-KR")
    : "";
  const paragraphs = String(post.content ?? "")
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join("\n      ");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="canonical" href="${esc(url)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="instrut" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:image" content="${esc(image)}" />
  <meta property="og:url" content="${esc(url)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="${esc(image)}" />
  ${dateIso ? `<meta property="article:published_time" content="${esc(dateIso)}" />` : ""}
</head>
<body>
  <main>
    <article>
      <p><strong>${esc(label)}</strong></p>
      <h1>${esc(post.title)}</h1>
      <p>${esc(post.author_name || "익명")}${dateText ? ` · ${esc(dateText)}` : ""}</p>
      ${paragraphs}
    </article>
    <p><a href="${esc(url)}">instrut에서 보기</a></p>
  </main>
</body>
</html>
`;
}

export function buildNotFoundHtml() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>게시글을 찾을 수 없습니다 — instrut</title>
  <meta name="robots" content="noindex" />
</head>
<body>
  <main>
    <h1>게시글을 찾을 수 없습니다</h1>
    <p><a href="${SITE}">instrut 홈으로</a></p>
  </main>
</body>
</html>
`;
}

export async function fetchPost(id) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/posts?select=id,title,content,post_type,author_name,image_url,created_at&id=eq.${id}&limit=1`,
    {
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
    },
  );
  if (!res.ok) throw new Error(`posts fetch failed: ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

export default async function handler(req, res) {
  try {
    const id = String(req.query?.id ?? "");
    if (!UUID_RE.test(id)) {
      res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(buildNotFoundHtml());
      return;
    }

    const post = await fetchPost(id);
    if (!post) {
      res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "s-maxage=60");
      res.send(buildNotFoundHtml());
      return;
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=86400");
    res.status(200).send(buildPostHtml(post));
  } catch (e) {
    res.status(500).setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send("prerender error");
  }
}
