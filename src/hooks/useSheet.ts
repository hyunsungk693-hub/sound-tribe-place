import { useEffect, useRef } from "react";
import { useBodyScrollLock } from "./useBodyScrollLock";
import { useKeyboardInset } from "./useKeyboardInset";

/**
 * 열려 있는 시트들. 마지막 것이 화면 맨 위에 있는 시트다.
 *
 * 시트가 시트 위에 겹쳐 뜨는 자리가 여럿이다(연습실 상세 → 예약, 공고 상세 → 영상 게이트).
 * popstate는 창 전체에 한 번 오고 열려 있는 시트가 모두 그것을 듣기 때문에, 각자 알아서
 * 닫으면 뒤로가기 한 번에 겹쳐 있던 시트가 통째로 무너진다. 그래서 누가 맨 위인지 여기서
 * 한 곳으로 관리하고, 뒤로가기는 맨 위 한 겹만 닫는다.
 */
const openSheets: Array<{ close: () => void }> = [];

/**
 * 시트가 하나라도 열려 있는 동안 이력에는 시트 몫의 항목이 '정확히 하나' 있게 유지한다.
 * 겹친 개수만큼 쌓지 않는 이유는, 그러면 몇 번을 눌러야 화면을 떠나는지가 시트를 어떻게
 * 열었는지에 따라 달라지기 때문이다. 맨 위 한 겹을 닫고 나서 아직 남은 시트가 있으면
 * 방금 소비된 항목을 즉시 다시 쌓는다.
 */
let pendingUndo = 0;

const onPopState = () => {
  // 아래 cleanup이 스스로 부른 back()이 되돌아온 것이라면 시트를 닫는 신호가 아니다.
  if (pendingUndo > 0) {
    pendingUndo -= 1;
    return;
  }
  const top = openSheets[openSheets.length - 1];
  if (!top) return;
  top.close();
  // 닫은 뒤에도 시트가 남아 있는지는 상태 갱신이 끝나야 알 수 있다. 남아 있다면 이 항목이
  // 계속 필요하고, 정말 마지막이었다면 그 시트의 cleanup이 아래에서 back()으로 걷어간다.
  window.history.pushState({ sheet: true }, "");
};

/**
 * 손수 만든 바텀 시트가 공통으로 필요로 하는 세 가지를 한 번에 건다.
 *   ① 뒤 문서 스크롤 잠금
 *   ② 안드로이드 뒤로가기 · iOS 스와이프백으로 시트 닫기
 *   ③ 키보드가 올라온 만큼 시트를 밀어 올리는 오버레이 여백
 *
 * ②가 없으면 시트가 열린 채 뒤로가기를 눌렀을 때 시트가 닫히는 대신 페이지를 떠난다.
 * 글을 쓰다 눌렀다면 쓰던 내용이 통째로 날아간다.
 *
 * ③은 오버레이(`fixed inset-0 flex items-end`) 아래에 키보드 높이만큼 여백을 두는
 * 방식이다. 시트의 높이 상한인 .max-h-sheet가 오버레이 높이의 100%도 함께 보므로,
 * 여백을 주면 상한이 같이 줄어 시트가 키보드 위 남은 공간에 정확히 들어간다.
 * 시트 바닥에 붙는 제출 버튼이 키보드 뒤로 숨지 않는 것이 핵심이다.
 *
 * @param open  시트가 열려 있는지. 조건부 렌더 안에서 부를 수 없으므로 컴포넌트
 *              최상단에서 이 값으로 켜고 끈다.
 * @param onClose 뒤로가기로 닫을 때 부를 함수. 겹쳐 뜬 시트를 한 컴포넌트가 함께
 *              관리한다면 여기서 맨 위 한 겹만 닫으면 된다(이력은 훅이 알아서 맞춘다).
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
    const entry = { close: () => onCloseRef.current() };

    // 첫 시트일 때만 이력을 쌓고 리스너를 건다 — 항목도 리스너도 하나면 충분하다.
    if (openSheets.length === 0) {
      window.history.pushState({ sheet: true }, "");
      window.addEventListener("popstate", onPopState);
    }
    openSheets.push(entry);

    return () => {
      const i = openSheets.indexOf(entry);
      if (i >= 0) openSheets.splice(i, 1);
      if (openSheets.length > 0) return;

      window.removeEventListener("popstate", onPopState);
      // 마지막 시트가 닫혔으니 쌓아둔 항목을 걷어간다. 지우지 않으면 다음 뒤로가기가
      // 그 항목만 먹고 아무 일도 안 한 것처럼 보인다.
      // 단, 시트 안에서 다른 화면으로 이동해 언마운트된 경우에는 되돌리면 안 된다 —
      // 그 back()은 방금 옮겨온 화면을 도로 떠나게 만든다.
      if (window.history.state?.sheet && window.location.pathname === pathAtOpen) {
        pendingUndo += 1;
        window.history.back();
      }
    };
  }, [open]);

  const keyboardInset = useKeyboardInset();
  return {
    overlayStyle: keyboardInset ? { paddingBottom: keyboardInset } : undefined,
  };
}
