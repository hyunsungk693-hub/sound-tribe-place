// 사용자 제공 URL을 href로 렌더하기 전 프로토콜을 검증한다.
// javascript:/data: 등 위험 스킴을 차단해 저장형 XSS를 막는다.
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, "https://instrut.vercel.app");
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

// 연주영상은 허용 호스트(YouTube/Instagram)만 신뢰한다.
export function safeVideoUrl(url: string | null | undefined): string | null {
  const safe = safeExternalUrl(url);
  if (!safe) return null;
  try {
    const host = new URL(safe).hostname.replace(/^www\./, "");
    const ok = ["youtube.com", "youtu.be", "instagram.com"].some(
      (h) => host === h || host.endsWith("." + h),
    );
    return ok ? safe : null;
  } catch {
    return null;
  }
}
