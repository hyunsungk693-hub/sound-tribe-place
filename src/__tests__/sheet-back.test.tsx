import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, renderHook, act } from "@testing-library/react";

// 이 훅에서 위험한 곳은 두 군데다. ① 이력을 되돌리는 조건 — 잘못 잡으면 시트를 닫을
// 때마다 사용자를 엉뚱한 화면으로 되돌려 보낸다. ② 겹쳐 뜬 시트 — popstate는 창에
// 한 번 오고 열린 시트가 모두 듣기 때문에, 조정하지 않으면 뒤로가기 한 번에 아래
// 시트까지 함께 무너진다. 둘 다 못 박아 둔다.
//
// 훅이 모듈 수준으로 '열린 시트 목록'을 들고 있어서 테스트마다 새로 불러온다.
let useSheet: typeof import("@/hooks/useSheet").useSheet;
let backSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  vi.resetModules();
  ({ useSheet } = await import("@/hooks/useSheet"));
  window.history.pushState({}, "", "/jobs");
  backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
});

afterEach(() => {
  backSpy.mockRestore();
});

const pop = () => act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });

describe("useSheet — 뒤로가기로 닫기", () => {
  it("시트를 열면 이력을 하나 쌓는다", () => {
    renderHook(() => useSheet(true, () => {}));
    expect(window.history.state).toEqual({ sheet: true });
  });

  it("뒤로가기가 오면 onClose를 부른다", () => {
    const onClose = vi.fn();
    renderHook(() => useSheet(true, onClose));
    pop();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("닫기 버튼으로 닫으면 쌓아둔 이력을 되돌린다", () => {
    // 되돌리지 않으면 다음 뒤로가기가 그 항목만 먹고 아무 일도 안 한 것처럼 보인다.
    const { unmount } = renderHook(() => useSheet(true, () => {}));
    unmount();
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it("시트 안에서 다른 화면으로 이동한 뒤에는 이력을 되돌리지 않는다", () => {
    // 여기서 back()을 부르면 방금 옮겨온 화면을 도로 떠나게 만든다.
    const { unmount } = renderHook(() => useSheet(true, () => {}));
    act(() => { window.history.pushState({}, "", "/messages"); });
    unmount();
    expect(backSpy).not.toHaveBeenCalled();
  });

  it("닫혀 있는 동안에는 이력을 건드리지 않는다", () => {
    const before = window.history.state;
    renderHook(() => useSheet(false, () => {}));
    expect(window.history.state).toEqual(before);
    expect(backSpy).not.toHaveBeenCalled();
  });
});

describe("useSheet — 겹쳐 뜬 시트", () => {
  // 연습실 상세 위에 예약 시트가 뜨는 것과 같은 모양.
  const Sheet = ({ onClose }: { onClose: () => void }) => {
    useSheet(true, onClose);
    return null;
  };
  const Stack = ({ inner, outerClose, innerClose }: { inner: boolean; outerClose: () => void; innerClose: () => void }) => (
    <>
      <Sheet onClose={outerClose} />
      {inner && <Sheet onClose={innerClose} />}
    </>
  );

  it("뒤로가기 한 번은 맨 위 한 겹만 닫는다", () => {
    const outerClose = vi.fn();
    const innerClose = vi.fn();
    render(<Stack inner outerClose={outerClose} innerClose={innerClose} />);
    pop();
    expect(innerClose).toHaveBeenCalledTimes(1);
    expect(outerClose).not.toHaveBeenCalled();
  });

  it("맨 위를 닫아도 아래 시트 몫의 이력은 남는다", () => {
    render(<Stack inner outerClose={() => {}} innerClose={() => {}} />);
    act(() => { window.history.replaceState(null, "", "/jobs"); });
    pop();
    // 다시 쌓아두지 않으면 다음 뒤로가기가 시트가 아니라 페이지를 떠난다.
    expect(window.history.state).toEqual({ sheet: true });
  });

  it("한 번 더 누르면 아래 시트가 닫힌다", () => {
    const outerClose = vi.fn();
    const innerClose = vi.fn();
    const { rerender } = render(<Stack inner outerClose={outerClose} innerClose={innerClose} />);
    pop();
    // 안쪽이 닫혔다 — 실제 앱에서는 상태가 바뀌어 언마운트된다.
    rerender(<Stack inner={false} outerClose={outerClose} innerClose={innerClose} />);
    pop();
    expect(outerClose).toHaveBeenCalledTimes(1);
  });

  it("안쪽을 버튼으로 닫아도 바깥 시트의 이력을 걷어가지 않는다", () => {
    const { rerender } = render(<Stack inner outerClose={() => {}} innerClose={() => {}} />);
    rerender(<Stack inner={false} outerClose={() => {}} innerClose={() => {}} />);
    // 아직 바깥 시트가 열려 있으므로 그 항목은 그대로 있어야 한다.
    expect(backSpy).not.toHaveBeenCalled();
  });
});
