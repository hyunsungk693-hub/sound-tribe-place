import { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { Plus, Trash2, KeyRound, CalendarPlus, Building2, Eye, EyeOff, Check, X, MapPin } from "lucide-react";
import { toast } from "sonner";
import PageShell from "@/components/PageShell";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { supabase } from "@/integrations/supabase/client";
import PlaceSearchInput from "@/components/PlaceSearchInput";
import { Studio, Room, Slot, Booking, fmtWon, decideBookingRequest } from "@/lib/bookings";

const db = supabase as any;

// 사장님 콘솔: 스튜디오·합주실 등록, 슬롯 열기/닫기, 예약 현황, 노쇼 표기, PIN 풀.
// 최소 기능 위주 (스코프: 미려함 불필요).
const Partner = () => {
  const { user, loading } = useAuth();
  useDocumentTitle("사장님 콘솔");
  const [studios, setStudios] = useState<Studio[]>([]);
  const [active, setActive] = useState<Studio | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [slots, setSlots] = useState<Record<string, Slot[]>>({});
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pins, setPins] = useState<any[]>([]);

  // 좌표는 장소 검색으로만 채운다. NULL이면 Studios 화면의 길찾기가 이름·주소 검색으로 떨어진다.
  const [sForm, setSForm] = useState<{
    name: string; address: string; phone: string; description: string; tier: string;
    lat: number | null; lng: number | null;
  }>({ name: "", address: "", phone: "", description: "", tier: "A", lat: null, lng: null });
  const [rForm, setRForm] = useState({ name: "", hourly_price: "", capacity: "" });
  const [slotForm, setSlotForm] = useState<{ roomId: string; date: string; start: string; duration: string }>({ roomId: "", date: "", start: "", duration: "2" });
  const [pinInput, setPinInput] = useState("");

  const loadStudios = useCallback(async () => {
    if (!user) return;
    const { data } = await db.from("studios").select("*").eq("owner_id", user.id).order("created_at");
    setStudios((data || []) as Studio[]);
    if (data && data[0] && !active) setActive(data[0]);
  }, [user, active]);

  useEffect(() => { loadStudios(); }, [loadStudios]);

  const loadStudioDetail = useCallback(async (s: Studio) => {
    const { data: rs } = await db.from("rooms").select("*").eq("studio_id", s.id).order("created_at");
    setRooms((rs || []) as Room[]);
    const map: Record<string, Slot[]> = {};
    const roomIds = (rs || []).map((r: Room) => r.id);
    for (const r of rs || []) {
      const { data: sl } = await db.from("room_slots").select("*").eq("room_id", r.id).order("start_at");
      map[r.id] = (sl || []) as Slot[];
    }
    setSlots(map);
    if (roomIds.length) {
      const { data: bk } = await db.from("bookings").select("*").in("room_id", roomIds).order("created_at", { ascending: false });
      setBookings((bk || []) as Booking[]);
    } else setBookings([]);
    const { data: pn } = await db.from("door_pins").select("*").eq("studio_id", s.id).order("created_at");
    setPins(pn || []);
  }, []);

  useEffect(() => { if (active) loadStudioDetail(active); }, [active, loadStudioDetail]);

  if (loading) return <div className="min-h-app flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const createStudio = async () => {
    if (!sForm.name.trim()) return toast.error("이름을 입력하세요");
    const { error } = await db.from("studios").insert({ ...sForm, owner_id: user.id });
    if (error) return toast.error("등록 실패: " + error.message);
    toast.success("스튜디오 등록됨");
    setSForm({ name: "", address: "", phone: "", description: "", tier: "A", lat: null, lng: null });
    loadStudios();
  };

  const createRoom = async () => {
    if (!active || !rForm.name.trim()) return toast.error("합주실 이름을 입력하세요");
    const { error } = await db.from("rooms").insert({
      studio_id: active.id, name: rForm.name,
      hourly_price: parseInt(rForm.hourly_price) || 0,
      capacity: rForm.capacity ? parseInt(rForm.capacity) : null,
    });
    if (error) return toast.error("등록 실패: " + error.message);
    toast.success("합주실 등록됨");
    setRForm({ name: "", hourly_price: "", capacity: "" });
    loadStudioDetail(active);
  };

  const addSlot = async () => {
    const { roomId, date, start, duration } = slotForm;
    if (!roomId || !date || !start) return toast.error("합주실·날짜·시작 시간을 선택하세요");
    const startAt = new Date(`${date}T${start}:00`);
    const endAt = new Date(startAt.getTime() + Number(duration) * 60 * 60 * 1000);
    const { error } = await db.from("room_slots").insert({ room_id: roomId, start_at: startAt.toISOString(), end_at: endAt.toISOString() });
    if (error) return toast.error(error.message.includes("overlap") || error.message.includes("exclu") ? "겹치는 슬롯이 있습니다" : "슬롯 추가 실패");
    toast.success("슬롯 추가됨");
    setSlotForm((f) => ({ ...f, start: "" }));
    if (active) loadStudioDetail(active);
  };

  // 06:00~23:30, 30분 간격 시작시각 옵션 (오전/오후 한국어 라벨)
  const timeOptions = (() => {
    const out: { value: string; label: string }[] = [];
    for (let h = 6; h <= 23; h++) {
      for (const m of [0, 30]) {
        const ampm = h < 12 ? "오전" : "오후";
        let hh = h % 12; if (hh === 0) hh = 12;
        out.push({ value: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, label: `${ampm} ${hh}:${String(m).padStart(2, "0")}` });
      }
    }
    return out;
  })();

  const delSlot = async (id: string) => {
    await db.from("room_slots").delete().eq("id", id);
    if (active) loadStudioDetail(active);
  };

  // 슬롯 닫기/열기. 삭제와 달리 슬롯 자체는 남으므로 다시 열 수 있고, 예약 이력도 끊기지 않는다.
  const toggleSlot = async (slot: Slot) => {
    const { error } = await db.from("room_slots").update({ is_open: !slot.is_open }).eq("id", slot.id);
    if (error) return toast.error("변경 실패: " + error.message);
    toast.success(slot.is_open ? "슬롯을 닫았습니다" : "슬롯을 열었습니다");
    if (active) loadStudioDetail(active);
  };

  const markBooking = async (b: Booking, status: "completed" | "no_show") => {
    const { error } = await db.from("bookings").update({ status }).eq("id", b.id);
    if (error) return toast.error("변경 실패: " + error.message);
    toast.success(status === "completed" ? "이용 완료 처리" : "노쇼 처리");
    if (active) loadStudioDetail(active);
  };

  // B(요청예약) 등급 예약 요청 처리. 승인하면 confirmed가 되지만 결제 연동 전이라 PIN은 나가지 않는다.
  const decideRequest = async (b: Booking, approve: boolean) => {
    if (!approve && !confirm("예약 요청을 거절하시겠습니까?")) return;
    try {
      await decideBookingRequest(b.id, approve);
      toast.success(approve ? "예약을 승인했습니다" : "예약 요청을 거절했습니다");
      if (active) loadStudioDetail(active);
    } catch (e: any) {
      toast.error(e.message || "처리에 실패했습니다");
    }
  };

  const addPin = async () => {
    if (!active || !pinInput.trim()) return;
    const list = pinInput.split(",").map((p) => p.trim()).filter(Boolean).map((pin) => ({ studio_id: active.id, pin }));
    const { error } = await db.from("door_pins").insert(list);
    if (error) return toast.error("PIN 추가 실패");
    toast.success(`PIN ${list.length}개 추가`);
    setPinInput("");
    loadStudioDetail(active);
  };

  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name || "삭제된 방";
  const statusLabel: Record<string, string> = { held: "결제대기", requested: "승인대기", confirmed: "확정", cancelled: "취소", completed: "완료", no_show: "노쇼" };

  return (
    <PageShell title="사장님 콘솔">
      <div className="lg:max-w-[1000px] lg:mx-auto space-y-5">
        {/* 스튜디오 선택/등록 — full width */}
        <div className="glass-card p-4 lg:p-5">
          <h2 className="font-bold text-base tracking-tight mb-3 flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> 내 스튜디오</h2>
          {studios.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {studios.map((s) => (
                <button key={s.id} onClick={() => setActive(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${active?.id === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary"}`}>
                  {s.name} <span className="font-mono opacity-70">({s.tier})</span>
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <input value={sForm.name} onChange={(e) => setSForm({ ...sForm, name: e.target.value })} placeholder="스튜디오 이름 *" className="h-10 rounded-lg border border-input bg-background px-3 text-sm sm:col-span-2 lg:col-span-4" />
            <div>
              <PlaceSearchInput
                value={sForm.address}
                placeholder="주소 · 장소 검색"
                selected={sForm.lat != null && sForm.lng != null}
                onChange={(v) => setSForm({ ...sForm, address: v, lat: null, lng: null })}
                onSelect={({ name, lat, lng }) => setSForm({ ...sForm, address: name, lat, lng })}
              />
              <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                <MapPin className="w-3 h-3 shrink-0" />
                {sForm.lat != null && sForm.lng != null
                  ? `${sForm.lat.toFixed(4)}, ${sForm.lng.toFixed(4)}`
                  : "검색 결과를 선택하면 좌표가 저장돼 길찾기가 켜집니다"}
              </p>
            </div>
            <input value={sForm.phone} onChange={(e) => setSForm({ ...sForm, phone: e.target.value })} placeholder="전화" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
            <select value={sForm.tier} onChange={(e) => setSForm({ ...sForm, tier: e.target.value })} className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
              <option value="A">A · 즉시예약</option>
              <option value="B">B · 요청예약</option>
              <option value="C">C · 정보</option>
            </select>
            <button onClick={createStudio} className="h-10 rounded-lg bg-action text-action-foreground text-sm font-semibold flex items-center justify-center gap-1 active:scale-95 transition-transform"><Plus className="w-4 h-4" />등록</button>
          </div>
        </div>

        {active && (
          <div className="lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start space-y-5 lg:space-y-0">
           {/* 좌측 컬럼: 합주실 + 슬롯 */}
           <div className="space-y-5">
            {/* 합주실 */}
            <div className="glass-card p-4 lg:p-5">
              <h2 className="font-bold text-base tracking-tight mb-3">합주실</h2>
              {rooms.map((r) => (
                <div key={r.id} className="text-sm py-2 border-b border-border last:border-0 flex items-center justify-between gap-2">
                  <span className="font-semibold tracking-tight truncate">{r.name}</span>
                  <span className="font-mono text-[12px] text-muted-foreground tabular-nums shrink-0">{fmtWon(r.hourly_price)}/시간{r.capacity ? ` · ${r.capacity}명` : ""}</span>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <input value={rForm.name} onChange={(e) => setRForm({ ...rForm, name: e.target.value })} placeholder="방 이름 *" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
                <input value={rForm.hourly_price} onChange={(e) => setRForm({ ...rForm, hourly_price: e.target.value })} placeholder="시간당 원" type="number" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
                <input value={rForm.capacity} onChange={(e) => setRForm({ ...rForm, capacity: e.target.value })} placeholder="정원" type="number" className="h-10 rounded-lg border border-input bg-background px-3 text-sm" />
              </div>
              <button onClick={createRoom} className="mt-2 w-full h-10 rounded-lg border border-border text-sm font-semibold flex items-center justify-center gap-1 hover:bg-surface-hover active:scale-95 transition-all"><Plus className="w-4 h-4" />합주실 추가</button>
            </div>

            {/* 슬롯 */}
            <div className="glass-card p-4 lg:p-5">
              <h2 className="font-bold text-base tracking-tight mb-3 flex items-center gap-2"><CalendarPlus className="w-4 h-4 text-primary" /> 예약 가능 슬롯</h2>
              {rooms.map((r) => (
                <div key={r.id} className="mb-3">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">{r.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(slots[r.id] || []).map((s) => (
                      <span key={s.id} className={`flex items-center gap-1.5 font-mono text-[11px] tabular-nums px-2 py-1 rounded ${s.is_open ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground line-through"}`}>
                        {new Date(s.start_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {/* 닫기는 삭제와 다르다 — 손님에게 안 보이게만 하고 언제든 다시 연다 */}
                        <button onClick={() => toggleSlot(s)} title={s.is_open ? "슬롯 닫기" : "슬롯 열기"} aria-label={s.is_open ? "슬롯 닫기" : "슬롯 열기"}>
                          {s.is_open ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </button>
                        <button onClick={() => delSlot(s.id)} title="슬롯 삭제" aria-label="슬롯 삭제"><Trash2 className="w-3 h-3" /></button>
                      </span>
                    ))}
                    {(slots[r.id] || []).length === 0 && <span className="text-[11px] text-muted-foreground">없음</span>}
                  </div>
                </div>
              ))}
              <div className="space-y-2 mt-3">
                <select value={slotForm.roomId} onChange={(e) => setSlotForm({ ...slotForm, roomId: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm">
                  <option value="">합주실 선택</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <div>
                  <label className="font-mono text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground mb-1 block">날짜</label>
                  <input type="date" value={slotForm.date} onChange={(e) => setSlotForm({ ...slotForm, date: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-mono text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground mb-1 block">시작 시간</label>
                    <select value={slotForm.start} onChange={(e) => setSlotForm({ ...slotForm, start: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm">
                      <option value="">선택</option>
                      {timeOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground mb-1 block">이용 시간</label>
                    <select value={slotForm.duration} onChange={(e) => setSlotForm({ ...slotForm, duration: e.target.value })} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm">
                      {["1", "2", "3", "4"].map((h) => <option key={h} value={h}>{h}시간</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <button onClick={addSlot} className="mt-2 w-full h-10 rounded-lg border border-border text-sm font-semibold flex items-center justify-center gap-1 hover:bg-surface-hover active:scale-95 transition-all"><Plus className="w-4 h-4" />슬롯 열기</button>
            </div>
           </div>

           {/* 우측 컬럼: PIN + 예약 현황 */}
           <div className="space-y-5">
            {/* PIN 풀 */}
            <div className="glass-card p-4 lg:p-5">
              <h2 className="font-bold text-base tracking-tight mb-3 flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary" /> 도어락 PIN 풀 <span className="font-mono text-xs font-semibold text-muted-foreground">({pins.filter((p) => !p.used).length}개 사용가능)</span></h2>
              <div className="flex gap-2">
                <input value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="PIN (쉼표로 여러 개)" className="flex-1 h-10 rounded-lg border border-input bg-background px-3 text-sm" />
                <button onClick={addPin} className="px-4 h-10 rounded-lg border border-border text-sm font-semibold hover:bg-surface-hover active:scale-95 transition-all">추가</button>
              </div>
            </div>

            {/* 예약 현황 */}
            <div className="glass-card p-4 lg:p-5">
              <h2 className="font-bold text-base tracking-tight mb-3">
                예약 현황 <span className="font-mono text-xs font-semibold text-muted-foreground tabular-nums">({bookings.length})</span>
                {bookings.some((b) => b.status === "requested") && (
                  <span className="ml-2 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber/15 text-amber tabular-nums">
                    승인대기 {bookings.filter((b) => b.status === "requested").length}
                  </span>
                )}
              </h2>
              {bookings.length === 0 && <p className="text-xs text-muted-foreground py-2">예약이 없습니다.</p>}
              {bookings.map((b) => (
                <div key={b.id} className="flex items-center justify-between py-3 border-b border-border last:border-0 gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold tracking-tight truncate">{roomName(b.room_id)} · <span className="font-mono tabular-nums">{fmtWon(b.amount)}</span></p>
                    <p className="text-[11px] text-muted-foreground font-mono tabular-nums mt-0.5 flex items-center gap-1.5">
                      {new Date(b.created_at).toLocaleDateString("ko-KR")} · {statusLabel[b.status] || b.status}
                      {/* 결제 연동 전이라 확정이어도 돈은 들어오지 않았다. 현장 정산 대상임을 여기서 알린다. */}
                      {!b.paid && b.status !== "cancelled" && (
                        <span className="px-1.5 py-0.5 rounded bg-amber/15 text-amber font-bold">미결제</span>
                      )}
                    </p>
                  </div>
                  {b.status === "requested" && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => decideRequest(b, true)} className="text-[11px] px-2 py-1 rounded bg-primary/10 text-primary font-semibold flex items-center gap-1"><Check className="w-3 h-3" />승인</button>
                      <button onClick={() => decideRequest(b, false)} className="text-[11px] px-2 py-1 rounded bg-destructive/10 text-destructive font-semibold flex items-center gap-1"><X className="w-3 h-3" />거절</button>
                    </div>
                  )}
                  {b.status === "confirmed" && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => markBooking(b, "completed")} className="text-[11px] px-2 py-1 rounded bg-primary/10 text-primary font-semibold">완료</button>
                      <button onClick={() => markBooking(b, "no_show")} className="text-[11px] px-2 py-1 rounded bg-destructive/10 text-destructive font-semibold">노쇼</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
           </div>
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default Partner;
