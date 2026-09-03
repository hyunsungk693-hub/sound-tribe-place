import { useEffect, useRef } from "react";
import { useBodyScrollLock } from "./useBodyScrollLock";
import { useKeyboardInset } from "./useKeyboardInset";

/**
 * 손수 만든 바텀 시트가 공통으로 필요로 하는 세 가지를 한 번에 건다.
 *   ① 뒤 문서 스크롤 잠금
 *   ② 안드로이드 뒤로가기 · iOS 스와이프백으로 시트 닫기
 *   ③ 키보드가 올라온 만큼 시트를 밀어 올리는 오버레이 여백
 *
 * ②가 없으면 시트가 열린 채 뒤로가기를 눌렀을 때 시트가 닫히는 대신 페이지를 떠난다.
 * 글을 쓰다 눌렀다면 쓰던 내용이 통째로 날아간다. 그래서 시트를 열 때 이력을 하나
 * 쌓아두고, 그 이력이 사라지는 것(popstate)으로 닫는다. 뒤로가기는 이력만 지우고
 * 페이지는 그대로 남는다.
 *
 * ③은 오버레이(`fixed inset-0 flex items-end`) 아래에 키보드 높이만큼 여백을 두는
 * 방식이다. 시트의 높이 상한인 .max-h-sheet가 오버레이 높이의 100%도 함께 보므로,
 * 여백을 주면 상한이 같이 줄어 시트가 키보드 위 남은 공간에 정확히 들어간다.
 * 시트 바닥에 붙는 제출 버튼이 키보드 뒤로 숨지 않는 것이 핵심이다.
 *
 * @param open  시트가 열려 있는지. 조건부 렌더 안에서 부를 수 없으므로 컴포넌트
 *              최상단에서 이 값으로 켜고 끈다.
 * @param onClose 뒤로가기로 닫을 때 부를 함수.
 * @returns overlayStyle — 오버레이 div의 style에 그대로 펴 넣는다.
 */
export function useSheet(open: boolean, onClose: () => void) {
  useBodyScrollLock(open);

  // onClose는 렌더마다 새로 만들어지는 경우가 많다. 그대로 의존성에 넣으면 렌더마다
  // 이력을 다시 쌓게 되므로 ref로 최신 것만 들고 있는다.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const pathAtOpen = window.location.pathname;
    window.history.pushState({ sheet: true }, "");
    const onPop = () => onCloseRef.current();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // 닫기 버튼이나 저장 완료로 닫혔다면 쌓아둔 이력이 그대로 남는다. 지우지 않으면
      // 다음 뒤로가기가 그 이력만 먹고 아무 일도 안 한 것처럼 보인다.
      // 단, 시트 안에서 다른 화면으로 이동해 언마운트된 경우에는 되돌리면 안 된다 —
      // 그 back()은 방금 옮겨온 화면을 도로 떠나게 만든다. 경로가 그대로일 때만 되돌린다.
      if (window.history.state?.sheet && window.location.pathname === pathAtOpen) {
        window.history.back();
      }
    };
  }, [open]);

  const keyboardInset = useKeyboardInset();
  return {
    overlayStyle: keyboardInset ? { paddingBottom: keyboardInset } : undefined,
  };
}
