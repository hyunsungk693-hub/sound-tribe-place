import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * 관리자 화면에서 켜고 끌 수 있는 기능들. 값은 feature_flags 테이블에 있고
 * 키 목록은 마이그레이션(20260904000001)이 정한다 — 화면에서 만들거나 지울 수 없다.
 */
export type FeatureKey =
  | "jobs"
  | "community"
  | "rooms"
  | "shops"
  | "bookings"
  | "payments"
  | "first_rehearsal"
  | "kakao_login";

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  label: string;
  description: string | null;
};

// 앱 전체가 같은 값을 봐야 하고, 화면마다 다시 물어볼 이유도 없다. 한 번 읽어 나눠 쓴다.
// 관리자가 껐다 켜는 일은 드물고, 바뀐 값은 다음 방문에 반영된다(관리자 화면은 스스로
// 다시 읽으므로 끈 사람은 즉시 확인할 수 있다).
let cache: FeatureFlag[] | null = null;
let inflight: Promise<FeatureFlag[]> | null = null;
const subscribers = new Set<() => void>();

const notify = () => subscribers.forEach((fn) => fn());

async function load(): Promise<FeatureFlag[]> {
  const { data, error } = await supabase
    .from("feature_flags")
    .select("key, enabled, label, description")
    .order("key");
  // 못 읽었으면 끄지 않는다. 네트워크가 흔들렸다고 기능이 사라지면, 켜져 있어야 할 것이
  // 사라지는 쪽이 꺼져야 할 것이 잠깐 보이는 쪽보다 훨씬 나쁘다.
  if (error || !data) return [];
  return data as FeatureFlag[];
}

function ensureLoaded() {
  if (cache || inflight) return;
  inflight = load().then((rows) => {
    cache = rows;
    inflight = null;
    notify();
    return rows;
  });
}

/** 관리자 화면이 값을 바꾼 뒤 부른다. 다음 읽기부터 새 값이 나온다. */
export function invalidateFeatureFlags() {
  cache = null;
  inflight = null;
  ensureLoaded();
}

export function useFeatureFlags() {
  const [, force] = useState(0);

  useEffect(() => {
    const rerender = () => force((n) => n + 1);
    subscribers.add(rerender);
    ensureLoaded();
    return () => { subscribers.delete(rerender); };
  }, []);

  const refresh = useCallback(() => invalidateFeatureFlags(), []);
  return { flags: cache, loading: cache === null, refresh };
}

/**
 * 기능 하나가 켜져 있는지.
 *
 * 아직 읽는 중이면 `on`은 true다 — 켜져 있는 기능이 느린 네트워크에서 잠깐 사라졌다
 * 나타나는 것보다는 낫다. 반대로 잘못 보이면 곤란한 자리(결제처럼 돈이 오가는 곳)에서는
 * `loading`이 끝날 때까지 기다렸다가 판단해라.
 */
export function useFeature(key: FeatureKey): { on: boolean; loading: boolean } {
  const { flags, loading } = useFeatureFlags();
  if (loading || !flags) return { on: true, loading: true };
  const found = flags.find((f) => f.key === key);
  // 목록에 없는 키는 켜진 것으로 본다. 마이그레이션이 아직 안 올라간 환경에서
  // 앱이 통째로 비어 보이지 않게 한다.
  return { on: found ? found.enabled : true, loading: false };
}
