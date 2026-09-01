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

/**
 * 시간대 구간의 유일한 정의. 경계를 숫자로 들고 있어야 "이 슬롯이 몇 시니까 오후"라는
 * 판정(slotTokenForDate)을 같은 값에서 파생시킬 수 있다. 예전에는 경계가 hint 문구에만
 * 적혀 있어서 코드가 9/12/18/22를 다시 하드코딩할 수밖에 없었다.
 * endHour는 열린 구간(미만)이고, 심야의 24는 자정 = 그날의 끝을 뜻한다.
 */
const PERIOD_DEFS = [
  { key: "am", label: "오전", startHour: 9, endHour: 12 },
  { key: "pm", label: "오후", startHour: 12, endHour: 18 },
  { key: "eve", label: "저녁", startHour: 18, endHour: 22 },
  { key: "night", label: "심야", startHour: 22, endHour: 24 },
] as const;

const hh = (h: number) => String(h).padStart(2, "0");

/** 구간 경계는 라벨에 함께 적는다 — "저녁"이 몇 시인지 사람마다 다르다 */
export const SLOT_PERIODS = PERIOD_DEFS.map((p) => ({
  ...p,
  // 자정에서 끝나는 심야만 상한을 적지 않는다 ("22시–")
  hint: p.endHour >= 24 ? `${hh(p.startHour)}시–` : `${hh(p.startHour)}–${hh(p.endHour)}시`,
}));

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

/**
 * 어떤 시각이 어느 토큰에 속하는가. 슬롯의 start_at(timestamptz)을 넣으면 "sat-pm"이 나온다.
 * 연습실 슬롯을 "토 오후" 같은 합주 가능 시간으로 되짚을 때 쓴다.
 *
 * 기준은 사용자의 로컬 시각이다. 프로필에 "토요일 오후"라고 적은 사람은 자기 시계로 말한 것이므로
 * UTC가 아니라 Date의 getDay()/getHours()(둘 다 로컬)를 그대로 본다.
 *
 * 09시 이전(00–09시 새벽)은 어느 구간에도 속하지 않는다 — vocabulary에 새벽이 없기 때문이다.
 * 그때는 null을 돌려주고, 호출부는 "어떤 시간대 칩으로도 걸러지지 않는 슬롯"으로 취급한다.
 * 새벽 슬롯을 전날 심야로 당겨 붙이지는 않는다. 사람이 "금 심야"라고 하면 보통 금요일 밤을
 * 뜻하지만 날짜 경계를 넘겨 짐작하는 순간 반대 방향으로 틀릴 수도 있어, 여기서는 판정을 포기한다.
 */
export const slotTokenForDate = (at: Date | string): string | null => {
  const d = typeof at === "string" ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) return null;
  const period = PERIOD_DEFS.find((p) => d.getHours() >= p.startHour && d.getHours() < p.endHour);
  if (!period) return null;
  // getDay()는 일요일이 0이지만 SLOT_DAYS는 월요일부터라 한 칸 밀어 맞춘다
  const day = SLOT_DAYS[(d.getDay() + 6) % 7];
  return slotToken(day.key, period.key);
};
