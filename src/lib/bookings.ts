import { supabase } from "@/integrations/supabase/client";

// 유료 예약(B 모듈) 클라이언트 헬퍼. 새 테이블은 자동생성 types에 없어 as any 사용.
const db = supabase as any;

export type Studio = {
  id: string;
  owner_id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  tier: "A" | "B" | "C";
  phone: string | null;
  description: string | null;
};

export type Room = {
  id: string;
  studio_id: string;
  name: string;
  hourly_price: number;
  capacity: number | null;
  description: string | null;
};

export type Slot = {
  id: string;
  room_id: string;
  start_at: string;
  end_at: string;
  is_open: boolean;
};

export type Booking = {
  id: string;
  room_id: string;
  slot_id: string | null;
  period: string;
  status: "held" | "requested" | "confirmed" | "cancelled" | "completed" | "no_show";
  hold_expires_at: string | null;
  user_id: string;
  amount: number;
  // 결제가 실제로 확인된 예약인지. PG 연동 전이라 항상 false이며, false면 도어락 PIN이 배정되지 않는다.
  paid: boolean;
  created_at: string;
};

export const TIER_LABEL: Record<string, string> = { A: "즉시예약", B: "요청예약", C: "정보" };

export function fmtWon(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}

export function slotDuration(s: Slot) {
  const h = (new Date(s.end_at).getTime() - new Date(s.start_at).getTime()) / 3600000;
  return h;
}

export async function listStudios() {
  const { data } = await db.from("studios").select("*").order("tier").order("created_at", { ascending: false });
  return (data || []) as Studio[];
}

export async function getStudio(id: string) {
  const { data } = await db.from("studios").select("*").eq("id", id).maybeSingle();
  return data as Studio | null;
}

export async function listRooms(studioId: string) {
  const { data } = await db.from("rooms").select("*").eq("studio_id", studioId).order("created_at");
  return (data || []) as Room[];
}

export async function listOpenSlots(roomId: string) {
  // bookable_slots 뷰: 이미 held/confirmed된 슬롯은 자동 제외 (실제 예약 가능분만)
  const { data } = await db
    .from("bookable_slots" as any)
    .select("*")
    .eq("room_id", roomId)
    .order("start_at");
  return (data || []) as Slot[];
}

// A등급 스튜디오의 열린 슬롯 후보 (C1 첫 합주 잡기). areaHint로 지역 우선 정렬.
export async function suggestSlots(areaHint?: string | null, limit = 3) {
  const { data: studios } = await db.from("studios").select("*").eq("tier", "A");
  const list = (studios || []) as Studio[];
  if (list.length === 0) return [];
  const sorted = areaHint
    ? [...list].sort((a, b) => {
        const am = (a.address || "").includes(areaHint) ? 0 : 1;
        const bm = (b.address || "").includes(areaHint) ? 0 : 1;
        return am - bm;
      })
    : list;

  const out: { studio: Studio; room: Room; slot: Slot }[] = [];
  for (const studio of sorted) {
    const rooms = await listRooms(studio.id);
    for (const room of rooms) {
      const slots = await listOpenSlots(room.id);
      for (const slot of slots) {
        out.push({ studio, room, slot });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

// 홀드 생성. A등급은 5분 TTL의 held, B등급은 사장님 승인을 기다리는 requested로 들어간다.
// C등급은 RPC가 거부한다 (프론트에서도 예약 UI를 감추지만 관문은 DB다).
export async function createHold(slotId: string, originApplicationId?: string | null) {
  const { data, error } = await db.rpc("create_booking_hold", {
    _slot_id: slotId,
    _origin_application_id: originApplicationId ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string; // booking id
}

// 확정 RPC. 결제 검증이 아직 없어 paid=false로 돌아오며, 그때는 pin도 null이다.
export async function confirmBooking(bookingId: string) {
  const { data, error } = await db.rpc("confirm_booking", { _booking_id: bookingId });
  if (error) throw new Error(error.message);
  return data as { booking_id: string; pin: string | null; paid: boolean };
}

export async function cancelBooking(bookingId: string) {
  const { error } = await db.rpc("cancel_booking", { _booking_id: bookingId });
  if (error) throw new Error(error.message);
}

// B등급(요청예약) 예약 요청에 대한 사장님 판단. 승인해도 결제 전이라 PIN은 나가지 않는다.
export async function decideBookingRequest(bookingId: string, approve: boolean) {
  const { error } = await db.rpc("decide_booking_request", { _booking_id: bookingId, _approve: approve });
  if (error) throw new Error(error.message);
}
