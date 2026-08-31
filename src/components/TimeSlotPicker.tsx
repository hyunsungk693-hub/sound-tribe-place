import { SLOT_DAYS, SLOT_PERIODS, slotToken } from "@/lib/timeSlots";

/**
 * 합주 가능 시간 선택 격자 — 요일(가로) × 시간대(세로).
 *
 * 자유 텍스트를 쓰지 않는 이유는 timeSlots.ts에 적어뒀다. 요약하면 표현이
 * 제각각이라 교집합이 성립하지 않았다.
 *
 * 격자를 고른 건 "언제 되는지"가 요일과 시간대의 곱이기 때문이다. 목록으로
 * 늘어놓으면 28줄이 되지만 격자는 한눈에 들어오고, 행·열 전체 선택으로
 * "평일 저녁 전부" 같은 흔한 패턴을 한 번에 찍을 수 있다.
 */
const TimeSlotPicker = ({
  value,
  onChange,
  className = "",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) => {
  const set = new Set(value);

  const toggle = (token: string) => {
    const next = new Set(set);
    if (next.has(token)) next.delete(token);
    else next.add(token);
    onChange([...next]);
  };

  /** 행·열 묶음 토글 — 전부 켜져 있으면 끄고, 아니면 전부 켠다 */
  const toggleMany = (tokens: string[]) => {
    const allOn = tokens.every((t) => set.has(t));
    const next = new Set(set);
    tokens.forEach((t) => (allOn ? next.delete(t) : next.add(t)));
    onChange([...next]);
  };

  return (
    <div className={className}>
      <div className="grid grid-cols-[3.1rem_repeat(7,1fr)] gap-1">
        <span />
        {SLOT_DAYS.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => toggleMany(SLOT_PERIODS.map((p) => slotToken(d.key, p.key)))}
            className="h-7 rounded-md text-[11px] font-semibold text-muted-foreground hover:bg-secondary transition-colors"
            title={`${d.label}요일 전체`}
          >
            {d.label}
          </button>
        ))}

        {SLOT_PERIODS.map((p) => (
          <div key={p.key} className="contents">
            <button
              type="button"
              onClick={() => toggleMany(SLOT_DAYS.map((d) => slotToken(d.key, p.key)))}
              className="h-9 rounded-md text-left px-1 hover:bg-secondary transition-colors"
              title={`${p.label} 전체 (${p.hint})`}
            >
              <span className="block text-[11px] font-semibold leading-tight">{p.label}</span>
              <span className="block text-[9px] text-muted-foreground leading-tight">{p.hint}</span>
            </button>
            {SLOT_DAYS.map((d) => {
              const token = slotToken(d.key, p.key);
              const on = set.has(token);
              return (
                <button
                  key={token}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${d.label} ${p.label}`}
                  onClick={() => toggle(token)}
                  className={`h-9 rounded-md border transition-colors active:scale-95 ${
                    on
                      ? "bg-action border-action text-action-foreground"
                      : "bg-background border-border hover:bg-secondary"
                  }`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-[11px] text-muted-foreground">
          요일·시간대 이름을 누르면 줄 전체가 선택됩니다.
        </p>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors"
          >
            전체 해제
          </button>
        )}
      </div>
    </div>
  );
};

export default TimeSlotPicker;
