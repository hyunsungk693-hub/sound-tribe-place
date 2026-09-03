import { useState, useEffect } from "react";
import { MapPin, ArrowLeft, CalendarClock, Navigation, Info, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useFeature } from "@/hooks/useFeatureFlags";
import BookingFlow from "@/components/BookingFlow";
import { naverDirectionsUrl, googleDirectionsUrl, hasDirections } from "@/lib/directions";
import {
  Studio, Room, Slot, TIER_LABEL, fmtWon, slotDuration,
  listStudios, listRooms, listOpenSlots,
} from "@/lib/bookings";

// VU 미터 — 세그먼트 게이지 (0~1) · 신뢰 등급 시각화
const VuMeter = ({ level, segs = 7 }: { level: number; segs?: number }) => {
  const on = Math.max(0, Math.min(segs, Math.round(level * segs)));
  return (
    <div className="flex items-center gap-[3px]" aria-hidden>
      {Array.from({ length: segs }).map((_, i) => (
        <span key={i} className={`w-[3px] h-3.5 rounded-[1px] ${i < on ? (i >= segs - 2 ? "bg-amber" : "bg-primary") : "bg-border"}`} />
      ))}
    </div>
  );
};
const tierLevel = (tier?: string) => (tier === "A" ? 1 : tier === "B" ? 0.7 : tier === "C" ? 0.45 : 0.55);

// 제휴 연습실(유료 예약). 기존 무료 /rooms 와 별개.
const Studios = () => {
  const navigate = useNavigate();
  useDocumentTitle("제휴 연습실 예약");
  // 예약을 닫아도 이 화면 자체는 닫지 않는다. 마이그레이션(20260904000001)의 bookings 설명대로
  // "정보만 보인다" — 어디에 어떤 업소가 있고 전화번호가 무엇인지는 예약과 무관하게 쓸모가 있고,
  // 화면을 통째로 막으면 길찾기·전화 걸기까지 같이 사라진다. 잠그는 것은 슬롯 선택 이후뿐이다.
  const bookingsOn = useFeature("bookings").on;
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Studio | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [slotsByRoom, setSlotsByRoom] = useState<Record<string, Slot[]>>({});
  const [booking, setBooking] = useState<{ studio: Studio; room: Room; slot: Slot } | null>(null);

  const loadStudios = async () => {
    setLoading(true);
    setStudios(await listStudios());
    setLoading(false);
  };
  useEffect(() => { loadStudios(); }, []);

  const openStudio = async (s: Studio) => {
    setSelected(s);
    // C(정보) 업소는 예약을 받지 않는다 — 슬롯을 불러올 이유도, 보여줄 이유도 없다.
    // 예약 자체가 닫혀 있을 때도 마찬가지다(합주실 수만큼 요청이 나가는 조회라 더 아깝다).
    if (s.tier === "C" || !bookingsOn) {
      setRooms([]);
      setSlotsByRoom({});
      return;
    }
    const rs = await listRooms(s.id);
    setRooms(rs);
    const map: Record<string, Slot[]> = {};
    for (const r of rs) map[r.id] = await listOpenSlots(r.id);
    setSlotsByRoom(map);
  };

  // 좌표가 있으면 좌표로, 없으면 이름+주소 검색으로 (Rooms 화면과 같은 방식)
  const openDirections = (s: Studio) => {
    window.open(
      s.lat != null && s.lng != null
        ? naverDirectionsUrl(s.name, s.lat, s.lng)
        : naverDirectionsUrl(`${s.name} ${s.address || ""}`.trim()),
      "_blank",
      "noopener",
    );
  };

  const fmtSlot = (s: Slot) => {
    const d = new Date(s.start_at);
    return `${d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" })} ${d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <PageShell title="제휴 연습실">
      <div>
        {!selected ? (
          <>
            {bookingsOn ? (
              <>
                <p className="text-[13px] text-muted-foreground mb-2 leading-relaxed">
                  <span className="text-primary font-semibold">A 즉시예약</span>은 바로 확정,
                  <span className="text-foreground font-semibold"> B 요청예약</span>은 사장님 승인 후 확정,
                  <span className="text-foreground font-semibold"> C</span>는 정보만 제공합니다.
                </p>
                <p className="text-[11.5px] text-muted-foreground mb-5 leading-relaxed">
                  실제 결제(PG) 연동 전이라 결제는 이뤄지지 않으며, 출입 PIN도 발급되지 않습니다.
                </p>
              </>
            ) : (
              // 등급 설명을 그대로 두면 "A는 바로 확정"이라고 읽고 들어가 슬롯이 없는 걸 보게 된다.
              <p className="text-[13px] text-muted-foreground mb-5 leading-relaxed">
                앱에서의 예약은 지금 준비 중입니다.<br />
                지금은 업소 정보만 보여드립니다 — 이용 문의는 업소로 직접 연락해주세요.
              </p>
            )}
            {loading ? (
              <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : studios.length === 0 ? (
              <div className="text-center py-16 text-sm text-muted-foreground">
                아직 제휴 연습실이 없습니다.<br />곧 홍대·합정 지역부터 오픈됩니다.
              </div>
            ) : (
              <div className="grid gap-2.5 lg:grid-cols-2 xl:grid-cols-3 lg:gap-3.5 items-start">
                {studios.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => openStudio(s)}
                    className="glass-card p-4 text-left flex flex-col hover:border-primary transition-colors active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="text-[15px] font-bold tracking-tight">{s.name}</h3>
                      {/* 등급 표식은 곧 예약 방식(즉시/요청)이라, 예약이 닫혀 있으면 지킬 수 없는 말이 된다 */}
                      {bookingsOn && (s.tier === "A" ? (
                        <span className="shrink-0 font-mono text-[10px] font-bold tracking-wide text-signal bg-signal/10 rounded px-2 py-1">즉시예약</span>
                      ) : (
                        <span className="shrink-0 font-mono text-[10px] font-bold tracking-wide text-secondary-foreground bg-secondary rounded px-2 py-1">{TIER_LABEL[s.tier]}</span>
                      ))}
                    </div>
                    {s.address && <p className="flex items-center gap-1 text-[12.5px] text-muted-foreground"><MapPin className="w-3 h-3 shrink-0" />{s.address}</p>}
                    {s.description && <p className="text-[12.5px] text-muted-foreground mt-1.5 line-clamp-2">{s.description}</p>}
                    <div className="flex items-center gap-2 mt-3">
                      <VuMeter level={tierLevel(s.tier)} />
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">신뢰 {s.tier}등급</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft className="w-4 h-4" /> 목록
            </button>
            <div className="glass-card p-4 mb-5">
              <div className="flex items-center gap-2 mb-1.5">
                <h2 className="text-lg font-extrabold tracking-tight">{selected.name}</h2>
                {bookingsOn && selected.tier === "A" && <span className="font-mono text-[10px] font-bold tracking-wide text-signal bg-signal/10 rounded px-2 py-0.5">즉시예약</span>}
              </div>
              {selected.address && <p className="flex items-center gap-1 text-[12.5px] text-muted-foreground"><MapPin className="w-3 h-3 shrink-0" />{selected.address}</p>}
              {selected.phone && <p className="text-[12.5px] text-muted-foreground mt-1 font-mono">☎ {selected.phone}</p>}
              {selected.description && <p className="text-sm text-muted-foreground mt-2">{selected.description}</p>}
              <div className="flex items-center gap-2 mt-3">
                <VuMeter level={tierLevel(selected.tier)} />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">신뢰 {selected.tier}등급</span>
              </div>
              {/* 좌표(lat/lng)는 사장님 콘솔의 장소 검색으로 들어온다. 없으면 이름·주소 검색 링크로 대체된다. */}
              {hasDirections(selected.lat, selected.lng, selected.address || selected.name) && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => openDirections(selected)}
                    className="flex-1 h-10 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors active:scale-[0.98] flex items-center justify-center gap-1.5"
                  >
                    <Navigation className="w-3.5 h-3.5" /> 네이버 지도 길찾기
                  </button>
                  {selected.lat != null && selected.lng != null && (
                    <a
                      href={googleDirectionsUrl(selected.lat, selected.lng)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 h-10 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-surface-hover transition-colors active:scale-[0.98] flex items-center justify-center gap-1.5"
                    >
                      Google 지도
                    </a>
                  )}
                </div>
              )}
              {selected.phone && (
                <a
                  href={`tel:${selected.phone.replace(/[^0-9+]/g, "")}`}
                  className="mt-2 w-full h-10 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-surface-hover transition-colors active:scale-[0.98] flex items-center justify-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" /> 전화 걸기
                </a>
              )}
            </div>

            {/* 예약이 닫혀 있으면 등급과 무관하게 슬롯을 내주지 않는다. 위 정보 카드(주소·전화·길찾기)는
                그대로 남아 있어, 손님이 헛걸음하지 않고 업소로 바로 연락할 수 있다. */}
            {!bookingsOn ? (
              <div className="glass-card p-5 text-center">
                <Info className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-semibold mb-1">예약은 지금 준비 중입니다</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  앱에서 예약을 받는 기능은 곧 다시 열립니다. 그때까지는 업소로 직접 문의해주세요.
                  {selected.phone ? ` (${selected.phone})` : ""}
                </p>
              </div>
            ) : selected.tier === "C" ? (
              <div className="glass-card p-5 text-center">
                <Info className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-semibold mb-1">정보만 제공하는 업소입니다</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  이 업소는 앱에서 예약을 받지 않습니다. 이용 문의는 업소로 직접 연락해주세요.
                </p>
              </div>
            ) : (
            <>
            <div className="flex items-baseline justify-between pb-3 border-b-2 border-foreground mb-4">
              <h3 className="text-lg lg:text-[19px] font-extrabold tracking-tight">
                합주실 · {selected.tier === "B" ? "예약 요청" : "예약"}
              </h3>
              {selected.tier === "B" && (
                <span className="font-mono text-[10px] font-bold tracking-wide text-muted-foreground">사장님 승인 후 확정</span>
              )}
            </div>

            {/* 시간대를 누르면 곧장 확정되는 게 아니라 요청이 들어간다. 그 요청이 언제 사라지는지까지 같이 알린다. */}
            {selected.tier === "B" && (
              <p className="text-[11.5px] text-muted-foreground leading-relaxed -mt-2 mb-4">
                시간대를 고르면 예약 <span className="font-semibold text-foreground">요청</span>이 접수됩니다 ·
                <span className="font-semibold text-amber"> 24시간 안에 승인되지 않으면 자동 취소</span>
                {" "}(합주 시작이 더 빠르면 그때)
              </p>
            )}

            {rooms.length === 0 ? (
              <p className="text-center py-10 text-sm text-muted-foreground">등록된 합주실이 없습니다.</p>
            ) : (
              <div className="grid gap-2.5 lg:grid-cols-2 lg:gap-3.5 items-start">
                {rooms.map((r) => (
                  <div key={r.id} className="glass-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-[15px] font-bold tracking-tight">{r.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5"><span className="font-mono tabular-nums">{fmtWon(r.hourly_price)}</span>/시간{r.capacity ? ` · 최대 ${r.capacity}명` : ""}</p>
                      </div>
                    </div>
                    {r.description && <p className="text-xs text-muted-foreground mb-3">{r.description}</p>}
                    <div className="flex items-center gap-1.5 mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                      <CalendarClock className="w-3.5 h-3.5" /> 예약 가능 시간
                    </div>
                    {(slotsByRoom[r.id] || []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">열린 시간대가 없습니다.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {(slotsByRoom[r.id] || []).map((slot) => (
                          <button
                            key={slot.id}
                            onClick={() => setBooking({ studio: selected, room: r, slot })}
                            className="flex flex-col items-start px-3 py-2 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors active:scale-95"
                          >
                            <span className="text-xs font-semibold">{fmtSlot(slot)}</span>
                            <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                              {slotDuration(slot)}시간 · {fmtWon(Math.round(r.hourly_price * slotDuration(slot)))}{selected.tier === "B" ? " · 요청" : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            </>
            )}
          </>
        )}
      </div>

      {booking && (
        <BookingFlow
          studio={booking.studio}
          room={booking.room}
          slot={booking.slot}
          onClose={() => setBooking(null)}
          onBooked={() => selected && openStudio(selected)}
        />
      )}
    </PageShell>
  );
};

export default Studios;
