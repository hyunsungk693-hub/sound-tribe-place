import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";

// 소프트 키보드는 jsdom에 없다. 대신 브라우저가 실제로 하는 일 —
// 레이아웃 뷰포트(window.innerHeight)는 그대로 두고 visual viewport만 줄이는 것 —
// 을 흉내내어, 가려진 높이를 제대로 계산하는지 본다.
class FakeViewport extends EventTarget {
  height = 800;
  offsetTop = 0;
}

let vv: FakeViewport;

const setViewport = (height: number, offsetTop = 0) => {
  vv.height = height;
  vv.offsetTop = offsetTop;
  act(() => {
    vv.dispatchEvent(new Event("resize"));
  });
};

beforeEach(() => {
  vv = new FakeViewport();
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
  Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
});

afterEach(() => {
  Object.defineProperty(window, "visualViewport", { value: undefined, configurable: true });
});

describe("useKeyboardInset", () => {
  it("키보드가 닫혀 있으면 0", () => {
    const { result } = renderHook(() => useKeyboardInset());
    expect(result.current).toBe(0);
  });

  it("키보드가 올라오면 가려진 높이를 돌려준다", () => {
    const { result } = renderHook(() => useKeyboardInset());
    setViewport(500); // 키보드 300px
    expect(result.current).toBe(300);
  });

  it("화면이 위로 밀린 만큼(offsetTop)을 두 번 세지 않는다", () => {
    const { result } = renderHook(() => useKeyboardInset());
    // iOS가 화면을 100px 밀어 올린 채 키보드를 연 상태.
    // height만 보면 500이 가려진 것처럼 보이지만 실제로 가려진 것은 300이다.
    setViewport(400, 100);
    expect(result.current).toBe(300);
  });

  it("주소창이 접히고 펴지는 정도(≤120px)는 키보드로 보지 않는다", () => {
    const { result } = renderHook(() => useKeyboardInset());
    setViewport(720); // 80px — 주소창 높이만큼
    expect(result.current).toBe(0);
  });

  it("키보드가 닫히면 0으로 돌아온다", () => {
    const { result } = renderHook(() => useKeyboardInset());
    setViewport(500);
    expect(result.current).toBe(300);
    setViewport(800);
    expect(result.current).toBe(0);
  });

  it("visualViewport가 없는 브라우저에서는 0을 유지한다", () => {
    Object.defineProperty(window, "visualViewport", { value: undefined, configurable: true });
    const { result } = renderHook(() => useKeyboardInset());
    expect(result.current).toBe(0);
  });
});
