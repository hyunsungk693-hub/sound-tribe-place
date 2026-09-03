import { useEffect, useState } from "react";

/**
 * 소프트 키보드가 화면 아래를 가린 높이(px). 키보드가 닫혀 있으면 0.
 *
 * 모바일 브라우저는 키보드를 열 때 '레이아웃 뷰포트'를 줄이지 않는다. 줄어드는 쪽은
 * visual viewport고, position: fixed는 레이아웃 뷰포트에 붙으므로 화면 바닥에 고정한
 * 입력 바가 그대로 키보드 뒤로 들어간다. 스크롤로도 꺼낼 수 없다 — fixed라 문서와
 * 함께 움직이지 않기 때문이다.
 *
 * 그래서 가려진 높이를 직접 재서 그만큼 띄운다.
 *   가려진 높이 = 레이아웃 뷰포트 높이 − (보이는 높이 + 위로 밀려난 양)
 * offsetTop을 함께 빼는 이유: iOS는 키보드를 열 때 화면 자체를 위로 밀어 올리기도 하는데,
 * height만 보면 이미 밀려난 만큼을 두 번 세어 입력 바가 필요 이상으로 떠오른다.
 *
 * viewport meta에 interactive-widget=resizes-content를 쓰는 브라우저에서는 레이아웃
 * 뷰포트가 같이 줄어 이 값이 0이 되고, fixed가 알아서 제자리에 놓인다 — 어느 쪽이든 맞는다.
 * visualViewport가 없는 구형 브라우저에서는 0을 유지하므로 기존 동작 그대로다.
 */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const measure = () => {
      const hidden = window.innerHeight - (vv.height + vv.offsetTop);
      // 주소창이 접히고 펴지는 것만으로도 값이 수십 px씩 흔들린다. 키보드라고 부를 만한
      // 크기가 아니면 0으로 본다 — 아니면 스크롤할 때마다 입력 바가 들썩인다.
      setInset(hidden > 120 ? Math.round(hidden) : 0);
    };

    measure();
    vv.addEventListener("resize", measure);
    vv.addEventListener("scroll", measure);
    return () => {
      vv.removeEventListener("resize", measure);
      vv.removeEventListener("scroll", measure);
    };
  }, []);

  return inset;
}
