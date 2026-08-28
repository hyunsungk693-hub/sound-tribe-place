// 팀 A 로컬 검증: OG 이미지 렌더 + 봇 프리렌더 HTML (일회용 검증 스크립트)
import { writeFileSync } from "node:fs";
import { renderProfileOg } from "../api/og-profile.mjs";
import { buildProfileHtml } from "../api/profile-prerender.mjs";

const sample = {
  display_name: "김드러머",
  instruments: ["드럼", "퍼커션"],
  location: "서울 마포구",
  handle: "drummer-kim",
  purpose: "pro",
};

const png = await renderProfileOg(sample);
const sig = png.subarray(0, 4).toString("hex");
console.log("PNG bytes:", png.length, "/ signature:", sig, sig === "89504e47" ? "(유효한 PNG)" : "(!! 손상)");
writeFileSync("scripts/og-sample.png", png);

const html = buildProfileHtml(sample, "drummer-kim");
const checks = [
  ['og:title', html.includes('og:title" content="김드러머 — 드럼 · 서울 마포구 | instrut"')],
  ['og:image → 동적 OG', html.includes("/api/og-profile?handle=drummer-kim")],
  ['canonical /u/', html.includes("/u/drummer-kim")],
  ['XSS 이스케이프', buildProfileHtml({ display_name: '<script>x</script>' }, "h").includes("&lt;script&gt;")],
];
for (const [name, ok] of checks) console.log(`${ok ? "✓" : "✗"} ${name}`);

const notFound = buildProfileHtml(null, "ghost");
console.log(notFound.includes("og-image.png") ? "✓ 미존재 핸들 → 정적 이미지 폴백" : "✗ 폴백 실패");
