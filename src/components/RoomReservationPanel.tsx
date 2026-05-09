import { useEffect, useState, useCallback } from "react";
import { Calendar, Clock, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Reservation {
  id: string;
  user_id: string;
  start_at: string;
  end_at: string;
  note: string | null;
}

interface Props {
  roomId: string | null;
  ownerId: string | null;
}

const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const RoomReservationPanel = ({ roomId, ownerId }: Props) => {
  const { user } = useAuth();
  const [date, setDate] = useState<string>(todayStr());
  // Slots: 0..47 representing 00:00, 00:30, ... 23:30. End slot can be 1..48 (=24:00)
  const [startSlot, setStartSlot] = useState<number>(20); // 10:00
  const [endSlot, setEndSlot] = useState<number>(22);     // 11:00
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchReservations = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    const dayStart = new Date(`${date}T00:00:00`).toISOString();
    const dayEnd = new Date(`${date}T23:59:59`).toISOString();
    const { data } = await supabase
      .from("room_reservations" as any)
      .select("*")
      .eq("room_id", roomId)
      .gte("start_at", dayStart)
      .lte("start_at", dayEnd)
      .order("start_at");
    setReservations((data as any) || []);
    setLoading(false);
  }, [roomId, date]);

  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  if (!roomId) {
    return (
      <div className="mt-5 p-4 rounded-xl bg-secondary/40 text-center text-xs text-muted-foreground">
        샘플 연습실은 예약할 수 없습니다. 사용자가 등록한 연습실에서만 예약이 가능합니다.
      </div>
    );
  }

  // Build a Set of booked hours for visual disable
  const bookedHours = new Set<number>();
  reservations.forEach((r) => {
    const s = new Date(r.start_at);
    const e = new Date(r.end_at);
    for (let h = s.getHours(); h < e.getHours(); h++) bookedHours.add(h);
  });

  const handleReserve = async () => {
    if (!user) { toast.error("로그인이 필요합니다"); return; }
    if (endHour <= startHour) { toast.error("종료 시간은 시작 시간 이후여야 합니다"); return; }
    // Check overlap client-side first
    for (let h = startHour; h < endHour; h++) {
      if (bookedHours.has(h)) {
        toast.error(`${h}시는 이미 예약되어 있습니다`);
        return;
      }
    }
    setSubmitting(true);
    const start_at = new Date(`${date}T${String(startHour).padStart(2, "0")}:00:00`).toISOString();
    const end_at = new Date(`${date}T${String(endHour).padStart(2, "0")}:00:00`).toISOString();
    const { error } = await supabase.from("room_reservations" as any).insert({
      room_id: roomId,
      user_id: user.id,
      start_at,
      end_at,
    });
    setSubmitting(false);
    if (error) {
      if (error.code === "23P01") toast.error("선택한 시간이 다른 예약과 겹칩니다");
      else toast.error("예약에 실패했습니다: " + error.message);
      return;
    }
    toast.success("예약이 완료되었습니다!");
    fetchReservations();
  };

  const handleCancel = async (id: string) => {
    if (!confirm("예약을 취소하시겠습니까?")) return;
    const { error } = await supabase.from("room_reservations" as any).delete().eq("id", id);
    if (error) { toast.error("취소 실패"); return; }
    toast.success("예약이 취소되었습니다");
    fetchReservations();
  };

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="mt-5 pt-5 border-t border-border space-y-4">
      <h3 className="text-sm font-bold flex items-center gap-1.5">
        <Calendar className="w-4 h-4 text-primary" /> 예약하기
      </h3>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">날짜</label>
        <input
          type="date"
          value={date}
          min={todayStr()}
          onChange={(e) => setDate(e.target.value)}
          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">시작 시간</label>
          <select
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h} disabled={bookedHours.has(h)}>
                {String(h).padStart(2, "0")}:00 {bookedHours.has(h) ? "(예약됨)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">종료 시간</label>
          <select
            value={endHour}
            onChange={(e) => setEndHour(Number(e.target.value))}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h} disabled={h <= startHour}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleReserve}
        disabled={submitting || !user}
        className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 active:scale-[0.98] transition-all"
      >
        {submitting ? "예약 중..." : `${String(startHour).padStart(2, "0")}:00 - ${String(endHour).padStart(2, "0")}:00 예약하기`}
      </button>

      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
          <Clock className="w-3 h-3" /> {date} 예약 현황
        </h4>
        {loading ? (
          <p className="text-xs text-muted-foreground">불러오는 중...</p>
        ) : reservations.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">예약된 시간이 없습니다.</p>
        ) : (
          <ul className="space-y-1.5">
            {reservations.map((r) => {
              const mine = r.user_id === user?.id;
              return (
                <li key={r.id} className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg ${mine ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"}`}>
                  <span className="font-medium">{fmtTime(r.start_at)} - {fmtTime(r.end_at)} {mine && "(내 예약)"}</span>
                  {(mine || r.user_id === ownerId && user?.id === ownerId) && (
                    <button onClick={() => handleCancel(r.id)} className="p-1 rounded hover:bg-destructive/10 text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default RoomReservationPanel;
