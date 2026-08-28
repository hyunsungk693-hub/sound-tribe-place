import { useState, useEffect } from "react";
import { MapPin, Clock, Zap, ArrowLeft, CalendarClock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import BookingFlow from "@/components/BookingFlow";
import {
  Studio, Room, Slot, TIER_LABEL, fmtWon, slotDuration,
  listStudios, listRooms, listOpenSlots,
} from "@/lib/bookings";

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
      <div className="lg:max-w-4xl lg:mx-auto">
        {!selected ? (
          <>
            <p className="text-xs text-muted-foreground mb-4">
              제휴 연습실은 <span className="text-primary font-semibold">즉시예약·선결제</span>로 확정됩니다.
            </p>
            {loading ? (
              <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : studios.length === 0 ? (
              <div className="text-center py-16 text-sm text-muted-foreground">
                아직 제휴 연습실이 없습니다.<br />곧 홍대·합정 지역부터 오픈됩니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {studios.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => openStudio(s)}
                    className="glass-card p-4 text-left hover:bg-surface-hover transition-colors active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="text-sm font-semibold">{s.name}</h3>
                      {s.tier === "A" ? (
                        <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          <Zap className="w-3 h-3" /> 즉시예약
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{TIER_LABEL[s.tier]}</span>
                      )}
                    </div>
                    {s.address && <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="w-3 h-3" />{s.address}</p>}
                    {s.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{s.description}</p>}
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
            <div className="glass-card p-4 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-bold">{selected.name}</h2>
                {selected.tier === "A" && <Zap className="w-4 h-4 text-primary" />}
              </div>
              {selected.address && <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="w-3 h-3" />{selected.address}</p>}
              {selected.phone && <p className="text-xs text-muted-foreground mt-1">☎ {selected.phone}</p>}
              {selected.description && <p className="text-sm text-muted-foreground mt-2">{selected.description}</p>}
            </div>

            {rooms.length === 0 ? (
              <p className="text-center py-10 text-sm text-muted-foreground">등록된 합주실이 없습니다.</p>
            ) : rooms.map((r) => (
              <div key={r.id} className="glass-card p-4 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-semibold">{r.name}</h3>
                    <p className="text-xs text-muted-foreground">{fmtWon(r.hourly_price)}/시간{r.capacity ? ` · 최대 ${r.capacity}명` : ""}</p>
                  </div>
                </div>
                {r.description && <p className="text-xs text-muted-foreground mb-3">{r.description}</p>}
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground mb-2">
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
                        <span className="text-[10px] text-muted-foreground">{slotDuration(slot)}시간 · {fmtWon(Math.round(r.hourly_price * slotDuration(slot)))}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
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
