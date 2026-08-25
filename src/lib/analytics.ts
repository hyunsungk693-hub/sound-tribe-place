import posthog from "posthog-js";

// PostHog Project API Key는 클라이언트 공개용 값이라 기본값 내장이 안전하다.
const KEY =
  (import.meta.env.VITE_POSTHOG_KEY as string | undefined) ||
  "phc_D7XoeS2xqz8Gu7vLVVYqkHQT7uMcj2P6zKS9iC4cYnTf";
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://us.i.posthog.com";

let enabled = false;

export function initAnalytics() {
  if (!KEY) return;
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: true,
    capture_pageleave: true,
  });
  enabled = true;
}

// 훅 검증 핵심 이벤트: signup / post_create / job_apply / dm_start
export function track(event: string, props?: Record<string, unknown>) {
  if (!enabled) return;
  posthog.capture(event, props);
}

export function identifyUser(userId: string, email?: string | null) {
  if (!enabled) return;
  posthog.identify(userId, email ? { email } : undefined);
}

export function resetAnalytics() {
  if (!enabled) return;
  posthog.reset();
}
