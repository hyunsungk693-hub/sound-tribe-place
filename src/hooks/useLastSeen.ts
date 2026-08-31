import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * 접속 중임을 주기적으로 남긴다(profiles.last_seen_at).
 *
 * "활동 중" 배지가 예전에는 profiles.updated_at이 7일 이내인지로 판정했다.
 * 그건 "최근에 프로필을 수정했다"는 뜻이지 접속 여부가 아니라, 한 달 전에
 * 닉네임 한 번 바꾼 사람이 일주일간 활동 중으로 보였다.
 *
 * 설계 선택
 *   · Realtime Presence를 쓰지 않는다. Presence는 같은 채널을 구독하는 동안만
 *     알 수 있어서, 목록에 스쳐 지나가는 수십 명의 상태를 알려면 그 수만큼
 *     구독해야 한다. 배지 하나에 치를 비용이 아니다.
 *   · 대신 열려 있는 동안 컬럼 하나를 갱신하고, 읽는 쪽은 profiles를 읽을 때
 *     같이 가져간다. 추가 조회가 없다.
 *
 * 쓰기를 아끼는 장치
 *   · 탭이 보일 때만 찍는다. 백그라운드에 방치된 탭은 접속 중이 아니다.
 *   · 마지막 쓰기로부터 HEARTBEAT_MS가 지나야 다시 찍는다. 화면 전환이나
 *     포커스 복귀가 잦아도 쓰기는 그 주기를 넘지 않는다.
 */

/** 갱신 주기. ONLINE_WINDOW_MS보다 넉넉히 짧아야 접속 중인데 배지가 꺼지지 않는다. */
const HEARTBEAT_MS = 2 * 60 * 1000;

export const useLastSeen = () => {
  const { user } = useAuth();
  const lastWriteRef = useRef(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;

    const beat = async () => {
      if (!alive || document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastWriteRef.current < HEARTBEAT_MS) return;
      lastWriteRef.current = now;
      // 실패해도 조용히 넘어간다 — 배지 하나 때문에 화면에 오류를 띄울 일이 아니다.
      await supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() } as never)
        .eq("user_id", user.id);
    };

    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);

    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [user]);
};
