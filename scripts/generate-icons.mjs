// 앱 아이콘 생성 스크립트: node scripts/generate-icons.mjs
// branding/logo.png (2048px 원본 로고)에서 핀 영역을 중심으로 잘라
// 모든 PWA/파비콘/스플래시 아이콘을 생성한다.
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFileSync } from "node:fs";

const SRC = "branding/logo.png";

// 핀 바운딩박스(사전 분석값): x 624–1424, y 504–1612, 중심 (1024, 1058)
// 여백 25%를 더한 정사각 크롭
const CROP = { left: 332, top: 366, width: 1385, height: 1385 };

const base = sharp(SRC).extract(CROP).flatten({ background: "#ffffff" });

const jobs = [
  { out: "public/pwa-icon-512.png", size: 512 },
  { out: "public/pwa-icon-192.png", size: 192 },
  { out: "src/assets/logo-icon.png", size: 512 },
  // .ico는 브라우저가 탭에 그릴 때 자체적으로 늘리고 줄인다. PNG를 크기별로 함께 주면
  // 그 계단 현상 없이 또렷하게 나온다. 180은 iOS 홈 화면 아이콘의 권장 크기다.
  { out: "public/apple-touch-icon.png", size: 180 },
  { out: "public/favicon-32.png", size: 32 },
  { out: "public/favicon-16.png", size: 16 },
];

for (const { out, size } of jobs) {
  await base.clone().resize(size, size).png().toFile(out);
  console.log("✓", out);
}

const png32 = await base.clone().resize(32, 32).png().toBuffer();
const png16 = await base.clone().resize(16, 16).png().toBuffer();
writeFileSync("public/favicon.ico", await pngToIco([png32, png16]));
console.log("✓ public/favicon.ico");
