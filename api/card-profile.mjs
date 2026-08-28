// 내 소개 카드: /api/card-profile?handle={handle} → 750x1050 세로형 카드 PNG
// dak.gg 카드처럼 단독 저장·공유용. satori+resvg 인프라는 og-profile과 공유한다.
import { fetchKoreanFont, loadRenderers } from "./og-profile.mjs";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://syxodrmnukybnnlgttuw.supabase.co";
const SUPABASE_ANON =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eG9kcm1udWt5Ym5ubGd0dHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2MjEwOTMsImV4cCI6MjEwMzE5NzA5M30.e96it7mNmSxnC4ygoeB33WGHBUEn4wwjDV5V_1T_rZg";

const BRAND = "#2083C5";
const BRAND_DEEP = "#14618f";
const MINT = "#7DE7DD";
const INK = "#14232e";
const SOFT = "#51677a";

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchCardData(handle) {
  const rows = await sb(
    `profiles?handle=eq.${encodeURIComponent(handle)}&select=user_id,display_name,instruments,genres,location,handle,purpose,available_times,avatar_url,video_url&limit=1`,
  );
  const profile = Array.isArray(rows) && rows[0] ? rows[0] : null;
  if (!profile) return null;
  const stats = await sb(
    `user_stats?user_id=eq.${profile.user_id}&select=response_rate,median_response_h,sessions_count,no_show_count&limit=1`,
  );
  return { profile, stats: Array.isArray(stats) && stats[0] ? stats[0] : null };
}

// 아바타를 data URI로 (satori에 원격 URL 대신 버퍼 전달 — 실패 시 null)
async function fetchAvatarDataUri(url) {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "image/png";
    if (!ct.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 3_000_000) return null;
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

const chip = (text, bg, color, size = 22) => ({
  type: "div",
  props: {
    style: {
      display: "flex", backgroundColor: bg, color,
      borderRadius: 999, padding: "8px 18px", fontSize: size, fontWeight: 700,
    },
    children: text,
  },
});

const row = (label, value) => ({
  type: "div",
  props: {
    style: { display: "flex", alignItems: "center", gap: 14 },
    children: [
      { type: "div", props: { style: { display: "flex", fontSize: 20, color: SOFT, width: 96, fontWeight: 700 }, children: label } },
      { type: "div", props: { style: { display: "flex", fontSize: 22, color: INK, fontWeight: 400, flex: 1 }, children: value } },
    ],
  },
});

export async function renderProfileCard({ profile, stats }) {
  const { satori, Resvg } = await loadRenderers();

  const name = profile.display_name || "instrut 음악인";
  const handle = profile.handle ? `@${profile.handle}` : "";
  const purpose = profile.purpose === "pro" ? "프로" : profile.purpose === "hobby" ? "취미" : null;
  const instruments = (profile.instruments || []).slice(0, 4);
  const genres = (profile.genres || []).slice(0, 4);
  const loc = profile.location || null;
  const times = (profile.available_times || []).slice(0, 3).join(" · ") || null;
  const hasVideo = !!profile.video_url;
  // 링크 표시용: 프로토콜 제거 + 40자 말줄임, 플랫폼 라벨 감지
  const rawUrl = (profile.video_url || "").replace(/^https?:\/\//, "").replace(/^www\./, "");
  const videoDisplay = rawUrl.length > 40 ? rawUrl.slice(0, 40) + "…" : rawUrl;
  const videoPlatform = /youtu\.?be/i.test(profile.video_url || "") ? "YouTube"
    : /instagram/i.test(profile.video_url || "") ? "Instagram" : "링크";
  const initial = name.trim().charAt(0).toUpperCase();
  const siteUrl = `instrut.vercel.app/u/${profile.handle || ""}`;

  const showRate = stats && stats.response_rate != null;
  const badges = [];
  if (showRate && Number(stats.response_rate) >= 0.8) badges.push("빠른 응답");
  if (stats && stats.no_show_count === 0 && (stats.sessions_count || 0) > 0) badges.push("노쇼 0");
  const isNew = !showRate;

  const allText =
    `${name}${handle}${purpose || ""}${instruments.join("")}${genres.join("")}` +
    `${loc || ""}${times || ""}${badges.join("")}악기장르지역가능 시간응답률응답 중앙값시간` +
    `새로 시작하는 음악인연주영상♪ instrut${siteUrl}${initial}${videoDisplay}${videoPlatform}링크` +
    (showRate ? `${Math.round(stats.response_rate * 100)}%${stats.median_response_h ?? ""}h` : "");

  const [bold, regular] = await Promise.all([
    fetchKoreanFont(allText, 700),
    fetchKoreanFont(allText, 400),
  ]);
  const avatar = await fetchAvatarDataUri(profile.avatar_url);

  const trustChildren = [];
  if (showRate) {
    trustChildren.push({
      type: "div",
      props: {
        style: { display: "flex", flexDirection: "column", alignItems: "center", flex: 1 },
        children: [
          { type: "div", props: { style: { display: "flex", fontSize: 40, fontWeight: 700, color: BRAND_DEEP }, children: `${Math.round(stats.response_rate * 100)}%` } },
          { type: "div", props: { style: { display: "flex", fontSize: 18, color: SOFT }, children: "응답률" } },
        ],
      },
    });
    if (stats.median_response_h != null) {
      trustChildren.push({
        type: "div",
        props: {
          style: { display: "flex", flexDirection: "column", alignItems: "center", flex: 1 },
          children: [
            { type: "div", props: { style: { display: "flex", fontSize: 40, fontWeight: 700, color: BRAND_DEEP }, children: `${stats.median_response_h}h` } },
            { type: "div", props: { style: { display: "flex", fontSize: 18, color: SOFT }, children: "응답 중앙값" } },
          ],
        },
      });
    }
  }

  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          width: 750, height: 1050, display: "flex", flexDirection: "column",
          backgroundColor: "#ffffff", fontFamily: "NotoSansKR",
        },
        children: [
          // 헤더 밴드
          {
            type: "div",
            props: {
              style: {
                display: "flex", flexDirection: "column", alignItems: "center",
                background: `linear-gradient(135deg, ${BRAND} 0%, ${MINT} 100%)`,
                paddingTop: 64, paddingBottom: 44,
              },
              children: [
                avatar
                  ? { type: "img", props: { src: avatar, width: 160, height: 160, style: { borderRadius: 999, border: "6px solid #ffffff", objectFit: "cover" } } }
                  : {
                      type: "div",
                      props: {
                        style: {
                          display: "flex", width: 160, height: 160, borderRadius: 999,
                          backgroundColor: "#ffffff", color: BRAND, fontSize: 72, fontWeight: 700,
                          alignItems: "center", justifyContent: "center", border: "6px solid rgba(255,255,255,0.7)",
                        },
                        children: initial,
                      },
                    },
                { type: "div", props: { style: { display: "flex", fontSize: 52, fontWeight: 700, color: "#ffffff", marginTop: 24 }, children: name } },
                {
                  type: "div",
                  props: {
                    style: { display: "flex", gap: 12, marginTop: 12, alignItems: "center" },
                    children: [
                      handle ? { type: "div", props: { style: { display: "flex", fontSize: 26, color: "rgba(255,255,255,0.92)", fontWeight: 400 }, children: handle } } : null,
                      purpose ? chip(purpose, "rgba(255,255,255,0.25)", "#ffffff") : null,
                      hasVideo ? chip(`♪ ${videoPlatform}`, "rgba(255,255,255,0.25)", "#ffffff") : null,
                    ].filter(Boolean),
                  },
                },
              ],
            },
          },
          // 본문
          {
            type: "div",
            props: {
              style: { display: "flex", flexDirection: "column", flex: 1, padding: "44px 52px", gap: 30 },
              children: [
                instruments.length
                  ? { type: "div", props: { style: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" },
                      children: [
                        { type: "div", props: { style: { display: "flex", fontSize: 20, color: SOFT, width: 96, fontWeight: 700 }, children: "악기" } },
                        ...instruments.map((t) => chip(t, "#dfeefa", BRAND_DEEP)),
                      ] } }
                  : null,
                genres.length
                  ? { type: "div", props: { style: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" },
                      children: [
                        { type: "div", props: { style: { display: "flex", fontSize: 20, color: SOFT, width: 96, fontWeight: 700 }, children: "장르" } },
                        ...genres.map((t) => chip(t, "#e7eff6", "#3a516a")),
                      ] } }
                  : null,
                loc ? row("지역", loc) : null,
                times ? row("가능 시간", times) : null,
                hasVideo ? row("연주영상", videoDisplay) : null,
                // 신뢰 영역 / 신규 뱃지
                showRate
                  ? {
                      type: "div",
                      props: {
                        style: {
                          display: "flex", flexDirection: "column", gap: 18,
                          backgroundColor: "#f2f8fd", borderRadius: 24, padding: "30px 24px", marginTop: 8,
                        },
                        children: [
                          { type: "div", props: { style: { display: "flex" }, children: trustChildren } },
                          badges.length
                            ? { type: "div", props: { style: { display: "flex", gap: 12, justifyContent: "center" },
                                children: badges.map((b) => chip(b, "#ffffff", BRAND_DEEP, 20)) } }
                            : null,
                        ].filter(Boolean),
                      },
                    }
                  : {
                      type: "div",
                      props: {
                        style: { display: "flex", justifyContent: "center", marginTop: 8 },
                        children: chip("새로 시작하는 음악인", "#f2f8fd", BRAND_DEEP, 24),
                      },
                    },
              ].filter(Boolean),
            },
          },
          // 푸터
          {
            type: "div",
            props: {
              style: {
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "26px 52px", borderTop: "2px solid #e7eff6",
              },
              children: [
                { type: "div", props: { style: { display: "flex", fontSize: 26, fontWeight: 700, color: BRAND }, children: "♪ instrut" } },
                { type: "div", props: { style: { display: "flex", fontSize: 20, color: SOFT }, children: siteUrl } },
              ],
            },
          },
        ],
      },
    },
    {
      width: 750,
      height: 1050,
      fonts: [
        { name: "NotoSansKR", data: bold, weight: 700, style: "normal" },
        { name: "NotoSansKR", data: regular, weight: 400, style: "normal" },
      ],
    },
  );

  const png = new Resvg(svg, { fitTo: { mode: "width", value: 750 } }).render().asPng();
  return Buffer.from(png);
}

export default async function handler(req, res) {
  try {
    const handle = String(req.query?.handle || "").toLowerCase();
    const data = handle ? await fetchCardData(handle) : null;
    if (!data) {
      res.setHeader("Cache-Control", "s-maxage=60");
      res.status(404).send("card not found");
      return;
    }
    const png = await renderProfileCard(data);
    res.setHeader("Content-Type", "image/png");
    // 카드는 프로필·지표가 바뀌면 갱신돼야 하므로 짧게 캐시
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    res.status(200).send(png);
  } catch (e) {
    if (String(req.query?.debug) === "1") {
      res.setHeader("Cache-Control", "no-store");
      res.status(500).send(String((e && e.stack) || e).slice(0, 2000));
      return;
    }
    res.setHeader("Cache-Control", "s-maxage=300");
    res.redirect(302, "/og-image.png");
  }
}
