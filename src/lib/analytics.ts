import posthog from "posthog-js";

// PostHog 키가 없으면(로컬 개발 등) 조용히 비활성화된다.
const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
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
