// 앱 아이콘 생성 스크립트: node scripts/generate-icons.mjs
// 원본 logo-icon.png(79px)의 디자인·색을 그대로 고해상도로 재현한다.
// 배경 #E5E9F3 (라이트 라벤더), 음표 #2554B1 (로열블루) — 원본에서 샘플링한 값.
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFileSync } from "node:fs";

const BG = "#E5E9F3";
const NOTE = "#2554B1";

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="${BG}"/>
  <!-- 원본 스타일: 뚫린 음표머리(링) + 오른쪽으로 올라가는 빔 -->
  <g stroke="${NOTE}" fill="none">
    <circle cx="190" cy="342" r="30" stroke-width="20"/>
    <circle cx="320" cy="314" r="30" stroke-width="20"/>
  </g>
  <g fill="${NOTE}">
    <!-- 왼쪽 기둥 (음표머리 오른쪽 가장자리에서 위로) -->
    <rect x="214" y="176" width="16" height="168"/>
    <!-- 오른쪽 기둥 -->
    <rect x="344" y="148" width="16" height="168"/>
    <!-- 빔: 왼쪽에서 오른쪽으로 상승 -->
    <path d="M 214 168 L 360 140 L 360 172 L 214 200 Z"/>
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
