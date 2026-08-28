import { useState, useEffect } from "react";
import { MapPin, ArrowLeft, CalendarClock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import BookingFlow from "@/components/BookingFlow";
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
    const rs = await listRooms(s.id);
    setRooms(rs);
    const map: Record<string, Slot[]> = {};
    for (const r of rs) map[r.id] = await listOpenSlots(r.id);
    setSlotsByRoom(map);
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
            <p className="text-[13px] text-muted-foreground mb-5">
              제휴 연습실은 <span className="text-primary font-semibold">즉시예약·선결제</span>로 확정됩니다.
            </p>
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
                      {s.tier === "A" ? (
                        <span className="shrink-0 font-mono text-[10px] font-bold tracking-wide text-signal bg-signal/10 rounded px-2 py-1">즉시예약</span>
                      ) : (
                        <span className="shrink-0 font-mono text-[10px] font-bold tracking-wide text-secondary-foreground bg-secondary rounded px-2 py-1">{TIER_LABEL[s.tier]}</span>
                      )}
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
                {selected.tier === "A" && <span className="font-mono text-[10px] font-bold tracking-wide text-signal bg-signal/10 rounded px-2 py-0.5">즉시예약</span>}
              </div>
              {selected.address && <p className="flex items-center gap-1 text-[12.5px] text-muted-foreground"><MapPin className="w-3 h-3 shrink-0" />{selected.address}</p>}
              {selected.phone && <p className="text-[12.5px] text-muted-foreground mt-1 font-mono">☎ {selected.phone}</p>}
              {selected.description && <p className="text-sm text-muted-foreground mt-2">{selected.description}</p>}
              <div className="flex items-center gap-2 mt-3">
                <VuMeter level={tierLevel(selected.tier)} />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">신뢰 {selected.tier}등급</span>
              </div>
            </div>

            <div className="flex items-baseline justify-between pb-3 border-b-2 border-foreground mb-4">
              <h3 className="text-lg lg:text-[19px] font-extrabold tracking-tight">합주실 · 예약</h3>
            </div>

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
                            <span className="text-[10px] text-muted-foreground font-mono tabular-nums">{slotDuration(slot)}시간 · {fmtWon(Math.round(r.hourly_price * slotDuration(slot)))}</span>
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
