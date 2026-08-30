import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

/**
 * 읽지 않은 메시지 수 — 전역 단일 구독.
 *
 * TopNav(데스크톱)와 BottomNav(모바일)는 뷰포트와 무관하게 둘 다 마운트되므로
 * 훅에서 각자 채널을 열면 구독과 토스트가 2배로 발생한다. 모듈 스코프에 구독 하나를
 * 두고 리스너만 늘리는 방식으로 중복을 막는다.
 *
 * 수신은 이미 구현된 Supabase Realtime을 그대로 쓴다(폴링 없음).
 */

type Listener = (n: number) => void;

let channel: ReturnType<typeof supabase.channel> | null = null;
let refCount = 0;
let latest = 0;
let convIds: string[] = [];
const listeners = new Set<Listener>();

const emit = (n: number) => {
  latest = n;
  listeners.forEach((l) => l(n));
};

async function refetch(userId: string) {
  const { data: convs } = await supabase
    .from("conversations")
    .select("id")
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

  convIds = (convs || []).map((c: { id: string }) => c.id);
  if (convIds.length === 0) {
    emit(0);
    return;
  }

  const { count } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .in("conversation_id", convIds)
    .neq("sender_id", userId)
    .eq("is_read", false);

  emit(count || 0);
}

/**
 * @param onIncoming 새 메시지 수신 시 1회 호출. 구독이 전역 단일이므로 토스트도 1회만 뜬다.
 */
function open(userId: string, onIncoming: (m: { conversationId: string; preview: string }) => void) {
  if (channel) return;
  channel = supabase
    .channel("unread-messages-global")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      async (payload: { new?: Record<string, unknown> }) => {
        const m = payload.new;
        // 먼저 갱신해야 첫 대화(캐시에 없는 conversation_id)도 놓치지 않는다
        await refetch(userId);
        if (!m || m.sender_id === userId) return;
        // 내 대화방의 메시지가 아니면 무시 (messages 테이블은 필터 없이 구독된다)
        if (!convIds.includes(m.conversation_id as string)) return;
        onIncoming({
          conversationId: m.conversation_id as string,
          preview: (m.content as string)?.slice(0, 50) || "새 메시지",
        });
      }
    )
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, () => refetch(userId))
    .subscribe();
}

function close() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  convIds = [];
  emit(0);
}

export const useUnreadMessages = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [count, setCount] = useState(latest);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    const listener: Listener = (n) => setCount(n);
    listeners.add(listener);
    refCount += 1;

    open(user.id, ({ conversationId, preview }) => {
      // 메시지 화면에 있으면 토스트가 오히려 방해가 된다
      if (window.location.pathname.startsWith("/messages")) return;
      toast("💬 새 메시지가 도착했습니다", {
        description: preview,
        duration: 4000,
        action: {
          label: "보기",
          onClick: () => navigate(`/messages?c=${conversationId}`),
        },
      });
    });

    refetch(user.id);
    setCount(latest);

    return () => {
      listeners.delete(listener);
      refCount -= 1;
      if (refCount <= 0) {
        refCount = 0;
        close();
      }
    };
  }, [user, navigate]);

  return { count, refresh: () => (user ? refetch(user.id) : Promise.resolve()) };
};
