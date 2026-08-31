/**
 * 합주 가능 시간 — 요일 × 시간대 정형 슬롯.
 *
 * 예전에는 profiles.available_times가 자유 텍스트(쉼표 구분)였다. 그래서
 * FirstRehearsal의 "공통 가능 시간"이 문자열 완전일치로만 교집합을 구했고,
 * "주말 오후"와 "토요일 오후"처럼 표현이 조금만 달라도 매칭이 실패했다.
 * 사실상 늘 빈 결과가 나오는 기능이었다.
 *
 * 토큰은 `{요일}-{시간대}` 한 가지 형태만 쓴다(예: "sat-pm").
 * DB CHECK(20260901000020)가 같은 vocabulary를 강제하므로 임의 문자열은 저장되지 않는다.
 */

export const SLOT_DAYS = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
  { key: "sun", label: "일" },
] as const;

/** 구간 경계는 라벨에 함께 적는다 — "저녁"이 몇 시인지 사람마다 다르다 */
export const SLOT_PERIODS = [
  { key: "am", label: "오전", hint: "09–12시" },
  { key: "pm", label: "오후", hint: "12–18시" },
  { key: "eve", label: "저녁", hint: "18–22시" },
  { key: "night", label: "심야", hint: "22시–" },
] as const;

export type SlotDay = (typeof SLOT_DAYS)[number]["key"];
export type SlotPeriod = (typeof SLOT_PERIODS)[number]["key"];

export const slotToken = (day: SlotDay, period: SlotPeriod) => `${day}-${period}`;

const DAY_LABEL: Record<string, string> = Object.fromEntries(SLOT_DAYS.map((d) => [d.key, d.label]));
const PERIOD_LABEL: Record<string, string> = Object.fromEntries(SLOT_PERIODS.map((p) => [p.key, p.label]));

/** 저장 가능한 전체 토큰 — DB CHECK의 허용 목록과 같아야 한다 */
export const ALL_SLOTS: string[] = SLOT_DAYS.flatMap((d) => SLOT_PERIODS.map((p) => slotToken(d.key, p.key)));

const isValid = (t: string) => ALL_SLOTS.includes(t);

/**
 * 사람이 읽는 문자열로. 같은 요일끼리 묶어 "토 오후·저녁 · 일 오후" 형태가 된다.
 * 요일·시간대 순서는 화면 어디서나 같아야 하므로 입력 배열 순서를 따르지 않고
 * 정의 순서(월→일, 오전→심야)로 다시 세운다.
 */
export const formatSlots = (slots?: string[] | null): string => {
  if (!slots?.length) return "";
  const set = new Set(slots.filter(isValid));
  return SLOT_DAYS.map((d) => {
    const periods = SLOT_PERIODS.filter((p) => set.has(slotToken(d.key, p.key)));
    return periods.length ? `${d.label} ${periods.map((p) => p.label).join("·")}` : null;
  })
    .filter(Boolean)
    .join(" · ");
};

/** 요일별로 끊어 배지로 그릴 때 쓴다 */
export const groupSlots = (slots?: string[] | null): { day: string; periods: string }[] => {
  if (!slots?.length) return [];
  const set = new Set(slots.filter(isValid));
  return SLOT_DAYS.flatMap((d) => {
    const periods = SLOT_PERIODS.filter((p) => set.has(slotToken(d.key, p.key)));
    return periods.length ? [{ day: d.label, periods: periods.map((p) => p.label).join("·") }] : [];
  });
};

/** 교집합 — 토큰이 정형이므로 표현 차이로 어긋날 일이 없다 */
export const intersectSlots = (a?: string[] | null, b?: string[] | null): string[] => {
  if (!a?.length || !b?.length) return [];
  const set = new Set(b);
  return ALL_SLOTS.filter((t) => a.includes(t) && set.has(t));
};

export const slotLabel = (token: string) => {
  const [d, p] = token.split("-");
  return DAY_LABEL[d] && PERIOD_LABEL[p] ? `${DAY_LABEL[d]} ${PERIOD_LABEL[p]}` : token;
};
