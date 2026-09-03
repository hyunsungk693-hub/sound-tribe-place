import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  level: "info" | "important";
  starts_at: string;
  ends_at: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * 지금 게시 중인 공지. 최신이 먼저 온다.
 *
 * 기간과 초안 여부는 RLS가 걸러준다(20260904000004) — 화면에서 다시 거르지 않는다.
 * 조건을 양쪽에 두면 한쪽만 고쳤을 때 "관리자에게는 보이는데 손님에게는 안 보이는"
 * 어긋남이 조용히 생긴다.
 *
 * 로그인하지 않은 사람도 읽을 수 있다. 오픈 안내처럼 가입을 고민하는 사람이 먼저
 * 읽어야 하는 내용이 여기 담기기 때문이다.
 */
export function useAnnouncements() {
  const [items, setItems] = useState<Announcement[] | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("announcements")
      .select("id, title, body, level, starts_at, ends_at, is_published, created_at, updated_at")
      .order("starts_at", { ascending: false });
    // 못 읽었으면 빈 목록으로 둔다. 공지를 못 불러온 것을 오류 화면으로 알리면
    // 정작 본문을 보러 온 사람의 길을 막는다.
    setItems(error || !data ? [] : (data as Announcement[]));
  }, []);

  useEffect(() => { load(); }, [load]);

  return { items, loading: items === null, reload: load };
}

const DISMISSED_KEY = "instrut_dismissed_notices";

/**
 * 홈 배너에서 닫은 공지를 기억한다.
 *
 * 서버에 남기지 않는 이유: 이건 "읽었다"는 기록이 아니라 이 기기에서 그만 보겠다는
 * 표시다. 사람마다·기기마다 다른 것이 자연스럽고, 서버에 두면 로그인하지 않은
 * 사람에게는 아예 동작하지 않는다.
 *
 * 저장소를 막아둔 브라우저에서는 매번 다시 보인다 — 공지가 사라지는 것보다 낫다.
 */
export function useDismissedNotices() {
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(DISMISSED_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      // 지나간 공지 id가 끝없이 쌓이지 않게 최근 30개만 들고 있는다.
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 30);
      try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* 저장 못 해도 그만 */ }
      return next;
    });
  }, []);

  return { dismissed, dismiss };
}
