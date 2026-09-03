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

/**
 * 흰 화면으로 끝난 예외를 남긴다(ErrorBoundary에서 부른다).
 *
 * PostHog가 꺼져 있어도 콘솔에는 남긴다 — 개발 중에 조용히 사라지면 원인을 쫓을 수 없다.
 * 메시지와 스택만 보낸다. 화면에 무엇이 떠 있었는지는 componentStack으로 충분하고,
 * 사용자가 입력하던 값까지 딸려 보내지 않기 위해서다.
 */
export function captureError(error: Error, componentStack?: string) {
  console.error("[error-boundary]", error, componentStack);
  if (!enabled) return;
  posthog.capture("app_error", {
    message: error.message,
    stack: error.stack?.slice(0, 4000),
    component_stack: componentStack?.slice(0, 4000),
    path: window.location.pathname,
  });
}
