import { useState, useEffect } from "react";
import { X, CreditCard, KeyRound, MapPin, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Slot, Room, Studio, fmtWon, slotDuration,
  createHold, confirmBooking, cancelBooking,
} from "@/lib/bookings";

type Props = {
  studio: Studio;
  room: Room;
  slot: Slot;
  originApplicationId?: string | null;
  onClose: () => void;
  onBooked?: () => void;
};

type Phase = "review" | "paying" | "confirmed";

// 슬롯 선택 후: hold 생성 → 모의결제 → 확정 + PIN. 취소정책 안내 포함.
const BookingFlow = ({ studio, room, slot, originApplicationId, onClose, onBooked }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("review");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remain, setRemain] = useState(300); // hold 5분 TTL 카운트다운

  const hours = slotDuration(slot);
  const amount = Math.round(room.hourly_price * hours);
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", { month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });

  // paying 단계에서 hold 만료 카운트다운
  useEffect(() => {
    if (phase !== "paying") return;
    setRemain(300);
    const t = setInterval(() => {
      setRemain((r) => {
        if (r <= 1) {
          clearInterval(t);
          toast.error("결제 시간이 만료되었습니다. 다시 시도해주세요.");
          setPhase("review");
          setBookingId(null);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  const startHold = async () => {
    if (!user) { navigate("/auth"); return; }
    setBusy(true);
    try {
      const id = await createHold(slot.id, originApplicationId);
      setBookingId(id);
      setPhase("paying");
    } catch (e: any) {
      toast.error(e.message || "예약을 시작할 수 없습니다");
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (!bookingId) return;
    setBusy(true);
    try {
      const res = await confirmBooking(bookingId);
      setPin(res.pin);
      setPhase("confirmed");
      onBooked?.();
    } catch (e: any) {
      toast.error(e.message || "결제에 실패했습니다");
      setPhase("review");
    } finally {
      setBusy(false);
    }
  };

  const abandon = async () => {
    if (bookingId && phase === "paying") {
      try { await cancelBooking(bookingId); } catch { /* 만료됐으면 무시 */ }
    }
    onClose();
  };

  const mm = String(Math.floor(remain / 60)).padStart(1, "0");
  const ss = String(remain % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 flex items-end lg:items-center justify-center" onClick={abandon}>
      <div
        className="w-full max-w-md bg-background rounded-t-2xl lg:rounded-2xl p-5 pb-8 max-h-sheet overflow-y-auto animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {phase !== "confirmed" && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold">{phase === "review" ? "예약 확인" : "결제"}</h2>
            <button onClick={abandon} className="p-1 rounded-full hover:bg-secondary"><X className="w-5 h-5" /></button>
          </div>
        )}

        {/* 예약 요약 */}
        {phase !== "confirmed" && (
          <div className="glass-card p-4 space-y-2 mb-4">
            <h3 className="font-semibold text-sm">{studio.name} · {room.name}</h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" /> {fmt(slot.start_at)} ~ {new Date(slot.end_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} ({hours}시간)
            </div>
            {studio.address && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" /> {studio.address}
              </div>
            )}
            <div className="pt-2 border-t border-border/40 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">결제 금액</span>
              <span className="text-lg font-bold text-primary">{fmtWon(amount)}</span>
            </div>
          </div>
        )}

        {phase === "review" && (
          <>
            <div className="text-[11px] text-muted-foreground bg-secondary/50 rounded-lg p-3 mb-4 leading-relaxed">
              <p className="font-semibold mb-1">취소 정책</p>
              이용 24시간 전 취소 100% 환불 · 12시간 전 50% · 이후 환불 불가.
              결제 후 5분 이내 완료하지 않으면 예약이 자동 취소됩니다.
            </div>
            <button
              onClick={startHold}
              disabled={busy}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" /> {busy ? "처리 중..." : "예약하고 결제하기"}
            </button>
          </>
        )}

        {phase === "paying" && (
          <>
            <div className="text-center mb-4">
              <p className="text-xs text-muted-foreground">남은 결제 시간</p>
              <p className="text-2xl font-bold tabular-nums text-primary">{mm}:{ss}</p>
            </div>
            <div className="rounded-lg border border-dashed border-border p-3 mb-4 text-center text-[11px] text-muted-foreground">
              🧪 모의 결제 화면입니다 — 실제 결제(PG)는 제휴·심사 완료 후 연결됩니다.
            </div>
            <button
              onClick={pay}
              disabled={busy}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" /> {busy ? "결제 중..." : `${fmtWon(amount)} 결제하기 (모의)`}
            </button>
          </>
        )}

        {phase === "confirmed" && (
          <div className="text-center py-2">
            <CheckCircle2 className="w-14 h-14 text-primary mx-auto mb-3" />
            <h2 className="text-lg font-bold mb-1">예약이 확정되었습니다</h2>
            <p className="text-xs text-muted-foreground mb-4">{studio.name} · {room.name}</p>

            <div className="glass-card p-4 space-y-3 text-left mb-4">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-primary" />
                {fmt(slot.start_at)} ~ {new Date(slot.end_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
              </div>
              {studio.address && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-primary" /> {studio.address}
                </div>
              )}
              {pin ? (
                <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                  <KeyRound className="w-4 h-4 text-primary" />
                  <span className="text-sm">도어락 PIN</span>
                  <span className="ml-auto text-lg font-bold tracking-widest tabular-nums">{pin}</span>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                  도어락 PIN은 이용 시간에 맞춰 안내됩니다.
                </p>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground mb-3">예약 내역과 PIN은 프로필 → 예약현황에서 다시 볼 수 있습니다.</p>
            <button
              onClick={() => { onClose(); navigate("/profile"); }}
              className="w-full h-11 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-surface-hover active:scale-[0.98] transition-all"
            >
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingFlow;
