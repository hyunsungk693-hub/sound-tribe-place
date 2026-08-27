// 앱 아이콘 생성 스크립트: node scripts/generate-icons.mjs
// 로열블루 그라데이션 배경 + 흰색 겹8분음표. 모든 PWA/파비콘 사이즈를 재생성한다.
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFileSync } from "node:fs";

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5474E8"/>
      <stop offset="1" stop-color="#2B49AE"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.3" cy="0.25" r="0.9">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <rect width="512" height="512" fill="url(#glow)"/>
  <g fill="#ffffff">
    <!-- 왼쪽 음표머리 -->
    <ellipse cx="182" cy="352" rx="44" ry="33" transform="rotate(-16 182 352)"/>
    <!-- 오른쪽 음표머리 -->
    <ellipse cx="326" cy="332" rx="44" ry="33" transform="rotate(-16 326 332)"/>
    <!-- 왼쪽 기둥 -->
    <rect x="206" y="176" width="18" height="176"/>
    <!-- 오른쪽 기둥 -->
    <rect x="350" y="156" width="18" height="176"/>
    <!-- 빔 (위쪽 연결대, 살짝 기울임) -->
    <path d="M 206 150 L 368 128 L 368 178 L 206 200 Z"/>
  </g>
</svg>`;

const buf = Buffer.from(svg);

const jobs = [
  { out: "public/pwa-icon-512.png", size: 512 },
  { out: "public/pwa-icon-192.png", size: 192 },
  { out: "src/assets/logo-icon.png", size: 512 },
];

for (const { out, size } of jobs) {
  await sharp(buf).resize(size, size).png().toFile(out);
  console.log("✓", out);
}

const png32 = await sharp(buf).resize(32, 32).png().toBuffer();
const png16 = await sharp(buf).resize(16, 16).png().toBuffer();
writeFileSync("public/favicon.ico", await pngToIco([png32, png16]));
console.log("✓ public/favicon.ico");
