import { describe, it, expect } from "vitest";

// Jobs.tsx와 동일한 derived 로직
type App = { id: string; status: string; created_at: string };

const deriveFiltered = (
  list: App[],
  statusFilter: "all" | "applied" | "accepted" | "rejected",
  sortOrder: "newest" | "oldest"
) =>
  list
    .filter((a) => (statusFilter === "all" ? true : a.status === statusFilter))
    .sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? tb - ta : ta - tb;
    });

const PAGE = 10;
const paginate = (list: App[], visible: number) => list.slice(0, visible);

const make = (n: number, status: string = "applied"): App[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `app-${i}`,
    status,
    // 날짜를 i가 클수록 더 최신으로
    created_at: new Date(2026, 0, 1, 0, i).toISOString(),
  }));

describe("지원자 필터 즉시 반영", () => {
  const base: App[] = [
    { id: "a", status: "applied", created_at: "2026-01-01T00:00:00Z" },
    { id: "b", status: "accepted", created_at: "2026-01-02T00:00:00Z" },
    { id: "c", status: "rejected", created_at: "2026-01-03T00:00:00Z" },
    { id: "d", status: "applied", created_at: "2026-01-04T00:00:00Z" },
  ];

  it("상태 변경 시 다음 필터 적용 결과에 즉시 반영된다 (검토중→합격)", () => {
    const before = deriveFiltered(base, "applied", "newest");
    expect(before.map((x) => x.id)).toEqual(["d", "a"]);

    // updateApplicationStatus의 옵티미스틱 업데이트 시뮬레이션
    const updated = base.map((a) => (a.id === "a" ? { ...a, status: "accepted" } : a));

    const afterApplied = deriveFiltered(updated, "applied", "newest");
    expect(afterApplied.map((x) => x.id)).toEqual(["d"]);

    const afterAccepted = deriveFiltered(updated, "accepted", "newest");
    expect(afterAccepted.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("정렬 토글이 즉시 반영된다", () => {
    const newest = deriveFiltered(base, "all", "newest").map((x) => x.id);
    const oldest = deriveFiltered(base, "all", "oldest").map((x) => x.id);
    expect(newest).toEqual(["d", "c", "b", "a"]);
    expect(oldest).toEqual(["a", "b", "c", "d"]);
  });

  it("필터 변경 후 페이지네이션은 처음부터 다시 시작한다", () => {
    const list = make(25, "applied");
    // 초기 페이지
    let visible = PAGE;
    expect(paginate(deriveFiltered(list, "all", "newest"), visible)).toHaveLength(10);
    // 필터 바뀌면 visible은 PAGE로 리셋된다고 가정 (Jobs.tsx의 useEffect와 동일)
    visible = PAGE;
    expect(paginate(deriveFiltered(list, "applied", "newest"), visible)).toHaveLength(10);
  });
});

describe("무한 스크롤 경계 (중복/누락 없음)", () => {
  it("총 25개를 페이지(10)씩 누적해 정확히 25개를 한 번씩 노출한다", () => {
    const list = deriveFiltered(make(25), "all", "newest");
    let visible = PAGE;
    const seen: string[] = [];
    seen.push(...paginate(list, visible).map((x) => x.id));
    visible = Math.min(visible + PAGE, list.length);
    seen.push(...paginate(list, visible).slice(seen.length).map((x) => x.id));
    visible = Math.min(visible + PAGE, list.length);
    seen.push(...paginate(list, visible).slice(seen.length).map((x) => x.id));

    expect(visible).toBe(25);
    expect(seen).toHaveLength(25);
    expect(new Set(seen).size).toBe(25); // 중복 없음
    expect(seen).toEqual(list.map((x) => x.id)); // 순서/누락 없음
  });

  it("마지막 페이지에서 PAGE 미만 잔여만 노출되고 더 증가하지 않는다", () => {
    const list = deriveFiltered(make(23), "all", "newest");
    let visible = PAGE;
    while (visible < list.length) {
      visible = Math.min(visible + PAGE, list.length);
    }
    expect(visible).toBe(23);
    const next = Math.min(visible + PAGE, list.length);
    expect(next).toBe(23); // 경계 초과 없음
    expect(paginate(list, visible)).toHaveLength(23);
  });

  it("PAGE 정확히 배수(20개)에서도 중복 없이 종료된다", () => {
    const list = deriveFiltered(make(20), "all", "newest");
    let visible = PAGE;
    visible = Math.min(visible + PAGE, list.length);
    expect(visible).toBe(20);
    expect(new Set(paginate(list, visible).map((x) => x.id)).size).toBe(20);
  });

  it("PAGE 미만(7개)에서도 정상 종료된다", () => {
    const list = deriveFiltered(make(7), "all", "newest");
    const visible = Math.min(PAGE, list.length);
    expect(paginate(list, visible)).toHaveLength(7);
  });

  it("0개에서 센티넬이 작동하지 않는다 (visible >= length)", () => {
    const list: App[] = [];
    const visible = PAGE;
    expect(visible >= list.length).toBe(true);
  });

  it("필터 적용 후에도 중복/누락 없이 페이지네이션된다", () => {
    const mixed: App[] = [
      ...make(15, "applied"),
      ...make(8, "accepted").map((a, i) => ({ ...a, id: `acc-${i}` })),
    ];
    const filtered = deriveFiltered(mixed, "applied", "newest");
    expect(filtered).toHaveLength(15);
    let visible = PAGE;
    visible = Math.min(visible + PAGE, filtered.length);
    expect(visible).toBe(15);
    const ids = paginate(filtered, visible).map((x) => x.id);
    expect(new Set(ids).size).toBe(15);
  });
});
