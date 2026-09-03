import { useSheet } from "@/hooks/useSheet";
import { useState, useEffect } from "react";
import { X, CreditCard, KeyRound, MapPin, Clock, CheckCircle2, Hourglass, Info, AlarmClock } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFeature } from "@/hooks/useFeatureFlags";
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

type Phase = "review" | "paying" | "confirmed" | "requested";

// 요청예약(B)의 승인 마감. DB의 create_booking_hold·expire_stale_holds와 같은 규칙이라
// 여기서 계산한 시각이 실제 자동 취소 시각과 일치한다 (20260901000021).
const REQUEST_TTL_MS = 24 * 60 * 60 * 1000;

// 슬롯 선택 후 흐름. 등급에 따라 갈라진다.
//   A 즉시예약: hold → 모의결제 → 확정
//   B 요청예약: hold 없이 '예약 요청'으로 남기고 사장님 승인을 기다린다
//   C 정보:     예약 자체가 없다 (Studios에서 진입 자체를 막지만 방어적으로 안내만)
// 어느 경우든 실제 PG 연동 전이라 결제는 이뤄지지 않고, 따라서 도어락 PIN도 발급되지 않는다.
const BookingFlow = ({ studio, room, slot, originApplicationId, onClose, onBooked }: Props) => {
  const { user } = useAuth();
  // 결제 스위치. 마이그레이션(20260904000001)의 설명대로 "끄면 예약을 만들 수 없다" —
  // A는 hold 뒤 곧장 결제로 가고, B도 승인 뒤 결제로 이어지므로 둘 다 여기서 막는다.
  //
  // 막는 자리가 중요하다. 결제 버튼에서 막으면 이미 createHold로 5분 홀드를 잡은 뒤라
  // 아무도 쓰지 못하는 채로 슬롯만 잠긴다(B는 아예 'requested' 예약이 남는다).
  // 그래서 hold를 잡기 전, 시작 버튼 자체를 닫는다.
  //
  // 로딩 중 on은 true다. 돈이 오가는 자리에서 그 낙관을 그대로 쓰면 잠깐 열린 문으로
  // 예약이 들어올 수 있으므로, 판단이 끝날 때까지 버튼은 눌리지 않게 둔다.
  const payments = useFeature("payments");
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("review");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remain, setRemain] = useState(300); // hold 5분 TTL 카운트다운
  const [deadline, setDeadline] = useState<Date | null>(null); // 요청예약 자동 취소 시각

  const isRequest = studio.tier === "B"; // 승인이 필요한 요청예약
  const isInfoOnly = studio.tier === "C";
  // 합주 시작이 24시간보다 먼저 오면 마감이 그쪽으로 당겨진다. 안내 문구도 그때는 달라야 한다.
  const cutByStart = deadline != null && deadline.getTime() === new Date(slot.start_at).getTime();
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
    // 버튼을 숨겨도 이전 렌더의 클릭이 남아 들어올 수 있다. 홀드를 잡기 전 마지막 방벽.
    if (!payments.on || payments.loading) return;
    setBusy(true);
    try {
      const id = await createHold(slot.id, originApplicationId);
      setBookingId(id);
      // B는 이 시점에 이미 'requested'로 저장돼 있다. 결제 단계 없이 대기 화면으로 넘어간다.
      if (isRequest) {
        setDeadline(new Date(Math.min(Date.now() + REQUEST_TTL_MS, new Date(slot.start_at).getTime())));
        setPhase("requested");
        onBooked?.();
      } else {
        setPhase("paying");
      }
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
      setPaid(!!res.paid);
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
    // 결제 대기 중 이탈은 홀드를 바로 풀어준다. 승인 대기(requested)는 사장님이 볼 요청이라 남긴다.
    if (bookingId && phase === "paying") {
      try { await cancelBooking(bookingId); } catch { /* 만료됐으면 무시 */ }
    }
    onClose();
  };

  // 이 컴포넌트는 열려 있는 동안에만 마운트되므로 open은 항상 true다.
  // 닫기 경로를 onClose가 아니라 abandon으로 잡아야 뒤로가기로 나가도 잡아둔 5분 홀드가
  // 함께 풀린다. 그냥 닫으면 결제하지 않은 슬롯이 5분간 남에게 잠긴 채 남는다.
  const { overlayStyle } = useSheet(true, abandon);

  const mm = String(Math.floor(remain / 60)).padStart(1, "0");
  const ss = String(remain % 60).padStart(2, "0");
  const isSummaryPhase = phase === "review" || phase === "paying";
  const slotRange = `${fmt(slot.start_at)} ~ ${new Date(slot.end_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 flex items-end lg:items-center justify-center" style={overlayStyle} onClick={abandon}>
      <div
        className="w-full max-w-md bg-background rounded-t-2xl lg:rounded-2xl p-5 pb-8 max-h-sheet overflow-y-auto animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {isSummaryPhase && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold">
              {phase === "paying" ? "결제" : isRequest ? "예약 요청" : "예약 확인"}
            </h2>
            <button onClick={abandon} className="tap-44 p-1 rounded-full hover:bg-secondary"><X className="w-5 h-5" /></button>
          </div>
        )}

        {/* 예약 요약 */}
        {isSummaryPhase && (
          <div className="glass-card p-4 space-y-2 mb-4">
            <h3 className="font-semibold text-sm">{studio.name} · {room.name}</h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" /> {slotRange} ({hours}시간)
            </div>
            {studio.address && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" /> {studio.address}
              </div>
            )}
            <div className="pt-2 border-t border-border/40 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{isRequest ? "예상 금액" : "결제 금액"}</span>
              <span className="text-lg font-bold text-primary">{fmtWon(amount)}</span>
            </div>
          </div>
        )}

        {phase === "review" && (
          <>
            {isInfoOnly ? (
              // C등급은 예약을 받지 않는다. RPC도 거부하므로 여기선 안내만 한다.
              <div className="text-center py-6">
                <Info className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-semibold mb-1">정보만 제공하는 업소입니다</p>
                <p className="text-xs text-muted-foreground mb-4">예약은 업소로 직접 문의해주세요.{studio.phone ? ` (${studio.phone})` : ""}</p>
                <button onClick={onClose} className="w-full h-11 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium">닫기</button>
              </div>
            ) : !payments.on ? (
              // on은 읽는 중일 때 true이므로, 이 분기는 값을 확인한 뒤에만 들어온다.
              // 위 요약(시간·금액)은 그대로 둔다 — 얼마짜리 시간이었는지는 알고 닫는 편이 낫다.
              <div className="text-center py-6">
                <Info className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-semibold mb-1">지금은 예약을 받지 않습니다</p>
                <p className="text-xs text-muted-foreground mb-4">
                  결제 준비가 끝나면 다시 열립니다. 그때까지는 업소로 직접 문의해주세요.{studio.phone ? ` (${studio.phone})` : ""}
                </p>
                <button onClick={onClose} className="w-full h-11 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium">닫기</button>
              </div>
            ) : (
              <>
                <div className="text-[11px] text-muted-foreground bg-secondary/50 rounded-lg p-3 mb-4 leading-relaxed">
                  <p className="font-semibold mb-1">{isRequest ? "요청예약 안내" : "취소 정책"}</p>
                  {isRequest ? (
                    <>
                      요청을 보내면 사장님이 확인 후 승인합니다. 승인 전까지는 확정이 아니며,
                      해당 시간대는 검토 동안 다른 사람에게 열리지 않습니다.
                      <span className="block mt-1 font-semibold text-amber">
                        24시간 안에 승인되지 않으면 요청은 자동 취소됩니다.
                      </span>
                    </>
                  ) : (
                    <>
                      이용 24시간 전 취소 100% 환불 · 12시간 전 50% · 이후 환불 불가.
                      결제 후 5분 이내 완료하지 않으면 예약이 자동 취소됩니다.
                    </>
                  )}
                </div>
                <button
                  onClick={startHold}
                  disabled={busy || payments.loading}
                  className="w-full h-12 rounded-xl bg-action text-action-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-action-hover active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isRequest ? <Hourglass className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                  {busy ? "처리 중..." : isRequest ? "예약 요청 보내기" : "예약하고 결제하기"}
                </button>
              </>
            )}
          </>
        )}

        {phase === "paying" && (
          <>
            <div className="text-center mb-4">
              <p className="text-xs text-muted-foreground">남은 결제 시간</p>
              <p className="text-2xl font-bold tabular-nums text-primary">{mm}:{ss}</p>
            </div>
            <div className="rounded-lg border border-dashed border-border p-3 mb-4 text-center text-[11px] text-muted-foreground leading-relaxed">
              🧪 모의 결제 화면입니다 — 실제 결제(PG)는 제휴·심사 완료 후 연결됩니다.<br />
              돈이 빠져나가지 않으며, <span className="font-semibold text-foreground">출입 PIN도 발급되지 않습니다.</span>
            </div>
            <button
              onClick={pay}
              disabled={busy}
              className="w-full h-12 rounded-xl bg-action text-action-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-action-hover active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" /> {busy ? "처리 중..." : `${fmtWon(amount)} 결제하기 (모의)`}
            </button>
          </>
        )}

        {phase === "requested" && (
          <div className="text-center py-2">
            <Hourglass className="w-14 h-14 text-primary mx-auto mb-3" />
            <h2 className="text-lg font-bold mb-1">예약 요청을 보냈습니다</h2>
            <p className="text-xs text-muted-foreground mb-4">{studio.name} · {room.name}</p>

            <div className="glass-card p-4 space-y-3 text-left mb-4">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-primary" /> {slotRange}
              </div>
              {studio.address && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-primary" /> {studio.address}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/40 leading-relaxed">
                아직 <span className="font-semibold text-foreground">확정이 아닙니다.</span> 사장님이 승인하면 예약이 확정됩니다.
                결제와 출입 PIN 안내는 승인 이후 별도로 진행됩니다.
              </p>

              {/* 요청이 방치되면 무기한 기다리는 게 아니라 자동 취소된다. 언제인지까지 못박아 둔다. */}
              {deadline && (
                <div className="rounded-lg bg-negative text-negative-foreground p-3">
                  <p className="flex items-center gap-1.5 text-xs font-bold">
                    <AlarmClock className="w-3.5 h-3.5 shrink-0" />
                    {cutByStart ? "합주 시작 전까지 승인되지 않으면 자동 취소됩니다" : "24시간 안에 승인되지 않으면 자동 취소됩니다"}
                  </p>
                  <p className="text-[11px] mt-1 leading-relaxed">
                    마감 <span className="font-semibold tabular-nums">{fmt(deadline.toISOString())}</span>
                    {cutByStart
                      ? " — 합주 시작이 24시간보다 먼저라 그때까지만 기다립니다."
                      : " — 그때까지 답이 없으면 요청은 취소되고 시간대가 다시 열립니다."}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="w-full h-11 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-surface-hover active:scale-[0.98] transition-all"
            >
              확인
            </button>
          </div>
        )}

        {phase === "confirmed" && (
          <div className="text-center py-2">
            <CheckCircle2 className="w-14 h-14 text-primary mx-auto mb-3" />
            <h2 className="text-lg font-bold mb-1">예약이 확정되었습니다</h2>
            <p className="text-xs text-muted-foreground mb-4">{studio.name} · {room.name}</p>

            <div className="glass-card p-4 space-y-3 text-left mb-4">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-primary" /> {slotRange}
              </div>
              {studio.address && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-primary" /> {studio.address}
                </div>
              )}
              {/* PIN은 결제가 실제로 확인된 예약(paid)에만 배정된다. 지금은 PG 연동 전이라 항상 미결제다. */}
              {paid && pin ? (
                <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                  <KeyRound className="w-4 h-4 text-primary" />
                  <span className="text-sm">도어락 PIN</span>
                  <span className="ml-auto text-lg font-bold tracking-widest tabular-nums">{pin}</span>
                </div>
              ) : (
                <div className="pt-2 border-t border-border/40 space-y-1">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-amber">
                    <KeyRound className="w-3.5 h-3.5" /> 결제 미완료 · 출입 PIN 없음
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    실제 결제 연동 전이라 출입 PIN은 발급되지 않습니다. 이용 요금은 현장에서 정산하고,
                    출입 방법은 업소에 문의해주세요.{studio.phone ? ` (${studio.phone})` : ""}
                  </p>
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground mb-3">예약 내역은 프로필 → 예약현황에서 다시 볼 수 있습니다.</p>
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
