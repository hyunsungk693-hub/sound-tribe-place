// E4 2단계: 동적 사이트맵 (Vercel Serverless Function)
// GET /sitemap.xml → vercel.json rewrite → 이 함수
// Supabase 공개 읽기(anon)로 게시글 목록을 받아 XML 사이트맵을 만든다.

// 클라이언트에 이미 노출되는 공개값이라 코드 fallback이 안전하다
// (src/integrations/supabase/client.ts와 동일한 값)
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://syxodrmnukybnnlgttuw.supabase.co";
const SUPABASE_ANON =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eG9kcm1udWt5Ym5ubGd0dHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2MjEwOTMsImV4cCI6MjEwMzE5NzA5M30.e96it7mNmSxnC4ygoeB33WGHBUEn4wwjDV5V_1T_rZg";
const SITE = "https://instrut.vercel.app";

const STATIC_PATHS = ["/", "/jobs", "/community"];

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 순수 함수: 게시글 목록 → 사이트맵 XML (node로 직접 검증 가능)
export function buildSitemapXml(posts, nowIso = new Date().toISOString()) {
  const urls = [
    ...STATIC_PATHS.map(
      (p) => `<url><loc>${SITE}${esc(p)}</loc><lastmod>${nowIso}</lastmod></url>`,
    ),
    ...posts
      .filter((p) => p && p.id)
      .map((p) => {
        const lastmod = p.created_at
          ? new Date(p.created_at).toISOString()
          : nowIso;
        return `<url><loc>${SITE}/post/${esc(p.id)}</loc><lastmod>${lastmod}</lastmod></url>`;
      }),
  ];
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.join("\n") +
    `\n</urlset>\n`
  );
}

export async function fetchPublicPosts() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/posts?select=id,created_at&order=created_at.desc&limit=1000`,
    {
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
    },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export default async function handler(req, res) {
  try {
    const posts = await fetchPublicPosts();
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "s-maxage=3600, stale-while-revalidate=86400",
    );
    res.status(200).send(buildSitemapXml(posts));
  } catch (e) {
    res.status(500).send("sitemap generation failed");
  }
}
