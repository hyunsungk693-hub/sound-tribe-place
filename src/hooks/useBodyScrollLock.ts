import { useEffect } from "react";

/**
 * 시트가 열려 있는 동안 뒤 문서가 스크롤되지 않게 잠근다.
 *
 * 이 앱의 바텀 시트는 Radix가 아니라 손수 만든 `fixed inset-0` 오버레이라
 * 스크롤 잠금이 딸려오지 않는다. 그래서 시트 안 입력칸에 포커스가 가면
 * iOS가 키보드를 띄우면서 뒤 문서를 끌어올리고, 시트를 닫으면 엉뚱한 위치에
 * 남는다. 사용자에게는 "글 쓰는데 뒷 항목이 같이 스크롤된다"로 보인다.
 *
 * overflow:hidden만으로는 iOS에서 부족하다 — 그 브라우저는 body가 스크롤
 * 컨테이너가 아닐 때도 문서를 움직인다. position:fixed로 문서를 들어내고
 * 원래 스크롤 위치를 top으로 상쇄해 화면이 튀지 않게 한 뒤, 풀 때 되돌린다.
 *
 * 시트 위에 또 시트가 열릴 수 있으므로(예: 상세 시트 안에서 예약 시트)
 * 모듈 단위로 개수를 센다. 안쪽 시트가 닫힐 때 바깥 시트의 잠금까지 풀리면
 * 안 된다.
 */
let lockCount = 0;
let savedScrollY = 0;
let savedStyles: { position: string; top: string; left: string; right: string; width: string } | null = null;

const lock = () => {
  lockCount += 1;
  if (lockCount > 1) return;
  savedScrollY = window.scrollY;
  const s = document.body.style;
  savedStyles = { position: s.position, top: s.top, left: s.left, right: s.right, width: s.width };
  s.position = "fixed";
  s.top = `-${savedScrollY}px`;
  s.left = "0";
  s.right = "0";
  s.width = "100%";
};

const unlock = () => {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0 || !savedStyles) return;
  const s = document.body.style;
  s.position = savedStyles.position;
  s.top = savedStyles.top;
  s.left = savedStyles.left;
  s.right = savedStyles.right;
  s.width = savedStyles.width;
  savedStyles = null;
  // 스타일을 되돌린 직후에 복원해야 브라우저가 중간 상태에서 스크롤을 자르지 않는다.
  window.scrollTo(0, savedScrollY);
};

export const useBodyScrollLock = (active: boolean) => {
  useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active]);
};
