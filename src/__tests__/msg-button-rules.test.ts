import { describe, it, expect } from "vitest";

// 두 화면이 공유하는 표시 규칙
const shouldShowMessageButton = (
  postUserId: string | null | undefined,
  currentUserId: string | null | undefined
): boolean => !!postUserId && postUserId !== currentUserId;

describe("메시지 버튼 표시 규칙", () => {
  const cases: Array<{ name: string; post: string | null; me: string | null; expected: boolean }> = [
    { name: "타인 게시물 + 로그인",       post: "user-A", me: "user-B", expected: true  },
    { name: "타인 게시물 + 비로그인",     post: "user-A", me: null,     expected: true  },
    { name: "본인 게시물 + 로그인",       post: "user-A", me: "user-A", expected: false },
    { name: "샘플(작성자 없음) + 로그인", post: null,     me: "user-B", expected: false },
    { name: "샘플 + 비로그인",            post: null,     me: null,     expected: false },
    { name: "빈 문자열 user_id",          post: "",       me: "user-B", expected: false },
  ];
  for (const c of cases) {
    it(c.name, () => expect(shouldShowMessageButton(c.post, c.me)).toBe(c.expected));
  }
});
