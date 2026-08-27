// 최근 본 게시물 (기기 로컬 저장, 최대 20개)
export type RecentView = { id: string; title: string; type: string; at: number };

const KEY = "instrut_recent_posts";

export function addRecentView(v: Omit<RecentView, "at">) {
  try {
    const list = getRecentViews().filter((x) => x.id !== v.id);
    list.unshift({ ...v, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    // localStorage 미지원/차단 시 무시
  }
}

export function getRecentViews(): RecentView[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
