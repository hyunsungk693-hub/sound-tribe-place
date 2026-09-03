import { useEffect } from "react";

/**
 * 하단 고정 입력창에 포커스가 있는 동안 문서에 data-composing="true"를 건다.
 * 이 표시를 보고 탭바가 화면 아래로 비켜난다(index.css의 .app-bottom-nav 규칙).
 *
 * 키보드 유무를 뷰포트 크기로 재지 않고 '포커스'로 판단하는 이유:
 * 브라우저는 키보드에 두 가지로 반응한다. visual viewport만 줄이는 쪽(iOS 사파리)과
 * 레이아웃 뷰포트까지 줄이는 쪽(안드로이드 크롬)인데, 후자에서는 가려진 높이가 0으로
 * 측정되면서도 fixed로 바닥에 붙인 탭바가 키보드 위로 떠오른다. 크기로는 두 경우를
 * 하나의 규칙으로 다룰 수 없다. 반면 모바일에서 텍스트 입력에 포커스가 갔다는 것은
 * 곧 키보드가 올라왔다는 뜻이라 양쪽 모두에서 똑같이 맞는다.
 *
 * 물리 키보드를 붙인 태블릿에서는 키보드 없이도 탭바가 내려가지만, 입력하는 동안
 * 탭바가 필요 없는 것은 마찬가지라 해가 되지 않는다.
 */
export function useComposing(active: boolean) {
  useEffect(() => {
    if (!active) return;
    document.documentElement.setAttribute("data-composing", "true");
    return () => {
      document.documentElement.removeAttribute("data-composing");
    };
  }, [active]);
}
