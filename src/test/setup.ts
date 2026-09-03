import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom에는 스크롤이 없어서 window.scrollTo가 "Not implemented" 에러를 뱉는다.
// useBodyScrollLock이 잠금을 풀 때 원래 위치로 되돌리며 부르는 것이라 테스트에서는
// 아무 일도 하지 않아도 된다. 에러 출력이 실제 실패를 가리는 것만 막는다.
Object.defineProperty(window, "scrollTo", { writable: true, value: () => {} });
