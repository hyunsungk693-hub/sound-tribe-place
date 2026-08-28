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
  status: "held" | "confirmed" | "cancelled" | "completed" | "no_show";
  hold_expires_at: string | null;
  user_id: string;
  amount: number;
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
  const { data } = await db
    .from("room_slots")
    .select("*")
    .eq("room_id", roomId)
    .eq("is_open", true)
    .gte("end_at", new Date().toISOString())
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

export async function createHold(slotId: string, originApplicationId?: string | null) {
  const { data, error } = await db.rpc("create_booking_hold", {
    _slot_id: slotId,
    _origin_application_id: originApplicationId ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string; // booking id
}

export async function confirmBooking(bookingId: string) {
  const { data, error } = await db.rpc("confirm_booking", { _booking_id: bookingId });
  if (error) throw new Error(error.message);
  return data as { booking_id: string; pin: string | null };
}

export async function cancelBooking(bookingId: string) {
  const { error } = await db.rpc("cancel_booking", { _booking_id: bookingId });
  if (error) throw new Error(error.message);
}

export async function getBooking(id: string) {
  const { data } = await db.from("bookings").select("*").eq("id", id).maybeSingle();
  return data as Booking | null;
}

// 확정 예약의 배정 PIN 조회 (RLS로 본인 예약만)
export async function getAssignedPin(bookingId: string) {
  const { data } = await db.from("door_pins").select("pin").eq("assigned_booking_id", bookingId).maybeSingle();
  return (data?.pin as string) || null;
}

// 내 예약 목록
export async function myBookings() {
  const { data } = await db
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });
  return (data || []) as Booking[];
}
