import { useEffect } from "react";

export const DEFAULT_TITLE = "instrut — 음악인 구인구직·연습실·커뮤니티";

// 페이지별 문서 타이틀. title이 비어 있으면 기본 타이틀 유지,
// 언마운트 시 기본 타이틀로 복원한다.
export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} — instrut` : DEFAULT_TITLE;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);
}
