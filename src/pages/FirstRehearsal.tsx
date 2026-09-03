import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarHeart, MapPin, Zap, Clock } from "lucide-react";
import PageShell from "@/components/PageShell";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAuth } from "@/contexts/AuthContext";
import { useFeature } from "@/hooks/useFeatureFlags";
import { supabase } from "@/integrations/supabase/client";
import BookingFlow from "@/components/BookingFlow";
import { Studio, Room, Slot, fmtWon, slotDuration, suggestSlots } from "@/lib/bookings";
import { intersectSlots, slotLabel, slotTokenForDate } from "@/lib/timeSlots";

const db = supabase as any;

// 후보를 모아 오는 개수. 공통 가능 시간 칩으로 다시 거르기 때문에 화면에 뿌릴 개수보다
// 넉넉해야 한다 — 시간대 구간이 4개(오전·오후·저녁·심야)이고 한 번에 최대 VISIBLE_LIMIT개를
// 보여주므로 4 × 6 = 24를 기준으로 잡았다. 더 늘려도 요청은 SUGGEST_MAX_STUDIOS로 묶여 있지만
// 스크롤도 안 하는 후보를 위해 스튜디오를 더 뒤질 이유가 없다.
const CANDIDATE_POOL = 24;
// 한 화면에 보여줄 후보 수. "추천"이라 다 나열하지 않고 앞에서부터 끊는다.
const VISIBLE_LIMIT = 6;

// C1 접합부: 지원 수락(accepted) 매칭에서 첫 합주를 잡는다.
// 양측 가능 시간 교집합 힌트(누르면 그 시간대만 필터) + 인근 A등급 열린 슬롯 후보 → 예약(origin_application_id 기록).
const FirstRehearsal = () => {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  useDocumentTitle("첫 합주 잡기");
  const firstRehearsalOn = useFeature("first_rehearsal").on;
  // 이 화면이 잡는 것은 결국 제휴 연습실 슬롯이다. 예약이 닫혀 있으면 첫 합주 잡기가
  // 켜져 있어도 잡을 수 있는 것이 없다 — 대신 아래 "공통 가능 시간"은 남겨둔다.
  // 언제 만날지 정하는 데는 그 정보만으로도 쓸모가 있고, 연습실은 각자 잡으면 된다.
  const bookingsOn = useFeature("bookings").on;

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [commonTimes, setCommonTimes] = useState<string[]>([]);
  const [areaHint, setAreaHint] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<{ studio: Studio; room: Room; slot: Slot }[]>([]);
  const [booking, setBooking] = useState<{ studio: Studio; room: Room; slot: Slot } | null>(null);
  // 공통 가능 시간 칩으로 고른 시간대. null이면 전체 보기.
  const [pickedTime, setPickedTime] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!applicationId || !user) { setLoading(false); return; }
      // 지원 로드 + 관련 공고(작성자)·지원자 검증
      const { data: app } = await db.from("job_applications").select("*").eq("id", applicationId).maybeSingle();
      if (!app || app.status !== "accepted") { setLoading(false); return; }
      const { data: job } = await db.from("posts").select("user_id, area, venue, title, rehearsal_slots").eq("id", app.job_id).maybeSingle();
      if (!job) { setLoading(false); return; }
      // 당사자(지원자 또는 공고작성자)만 접근
      const applicantId = app.user_id;
      const ownerId = job.user_id;
      if (user.id !== applicantId && user.id !== ownerId) { setLoading(false); return; }
      setValid(true);

      // 양측 가능 시간 교집합.
      // 예전에는 자유 텍스트 available_times를 문자열 완전일치로 비교해서
      // "주말 오후"와 "토요일 오후"처럼 표현만 달라도 늘 빈 결과가 나왔다.
      // 이제는 정형 슬롯(20260901000020)이라 실제로 교집합이 성립한다.
      //
      // 공고가 합주 가능 시간을 밝혔으면 그것을 공고주 쪽 기준으로 쓴다.
      // 개인 프로필보다 "이 공고에서 실제로 합주하려는 시간"이 더 정확하다.
      const { data: profs } = await db
        .from("profiles")
        .select("user_id, available_slots")
        .in("user_id", [applicantId, ownerId]);
      const slotsBy: Record<string, string[]> = {};
      (profs || []).forEach((p: any) => { slotsBy[p.user_id] = p.available_slots || []; });
      const ownerSide = job.rehearsal_slots?.length ? job.rehearsal_slots : slotsBy[ownerId];
      setCommonTimes(intersectSlots(ownerSide, slotsBy[applicantId]));
      const area = job.area || job.venue || null;
      setAreaHint(area);
      setCandidates(await suggestSlots(area, CANDIDATE_POOL));
      setLoading(false);
    })();
  }, [applicationId, user]);

  // 고른 시간대에 맞는 후보만. 09시 이전 슬롯은 slotTokenForDate가 null이라 어떤 칩에도 걸리지 않는다.
  const visible = useMemo(() => {
    const pool = pickedTime ? candidates.filter((c) => slotTokenForDate(c.slot.start_at) === pickedTime) : candidates;
    return pool.slice(0, VISIBLE_LIMIT);
  }, [candidates, pickedTime]);

  const fmtSlot = (s: Slot) => {
    const d = new Date(s.start_at);
    return `${d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" })} ${d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <PageShell title="첫 합주 잡기">
      <div className="lg:max-w-2xl lg:mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> 뒤로
        </button>

        {/* 주소로 직접 들어온 경우. 404로 보내지 않는다 — 합격 알림에 실린 링크라
            며칠 뒤에도 눌리고, 그때 "없는 페이지"가 뜨면 합격 자체를 의심하게 된다. */}
        {!firstRehearsalOn ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            첫 합주 잡기는 지금 준비 중입니다.<br />곧 다시 열립니다.
          </div>
        ) : loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : !valid ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            수락된 지원에서만 첫 합주를 잡을 수 있습니다.
          </div>
        ) : (
          <>
            <div className="glass-card p-5 mb-4 text-center">
              <CalendarHeart className="w-10 h-10 text-primary mx-auto mb-2" />
              <h2 className="text-base font-bold">첫 합주를 잡아보세요</h2>
              <p className="text-xs text-muted-foreground mt-1">수락된 매칭 · 인근 제휴 연습실에서 바로 예약</p>
            </div>

            {/* 가능 시간 교집합 힌트 */}
            <div className="glass-card p-4 mb-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold mb-2"><Clock className="w-3.5 h-3.5 text-primary" /> 두 분의 공통 가능 시간</div>
              {commonTimes.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {commonTimes.map((t) => {
                      const on = t === pickedTime;
                      return (
                        <button
                          key={t}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setPickedTime(on ? null : t)}
                          className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors active:scale-95 ${
                            on ? "bg-action text-action-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"
                          }`}
                        >
                          {slotLabel(t)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {pickedTime ? "다시 누르면 전체 시간대로 돌아갑니다." : "시간대를 누르면 그 시간에 예약 가능한 연습실만 보여줍니다."}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">겹치는 가능 시간 정보가 없습니다. 아래 시간대에서 협의해 선택하세요.</p>
              )}
              {areaHint && <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1"><MapPin className="w-3 h-3" /> 공고 지역: {areaHint}</p>}
            </div>

            {/* 후보 슬롯 */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Zap className="w-4 h-4 text-primary" />
                {pickedTime ? `${slotLabel(pickedTime)} 예약 가능한 슬롯` : "추천 연습실 슬롯"}
              </div>
              {pickedTime && (
                <button onClick={() => setPickedTime(null)} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                  전체 보기
                </button>
              )}
            </div>
            {!bookingsOn ? (
              <div className="glass-card p-6 text-center text-sm text-muted-foreground leading-relaxed">
                제휴 연습실 예약이 지금 준비 중이라<br />여기서 바로 시간을 잡을 수는 없습니다.
              </div>
            ) : candidates.length === 0 ? (
              <div className="glass-card p-6 text-center text-sm text-muted-foreground">
                지금 예약 가능한 제휴 연습실 슬롯이 없습니다.<br />
                <button onClick={() => navigate("/studios")} className="mt-2 text-primary font-medium">제휴 연습실 전체 보기</button>
              </div>
            ) : visible.length === 0 ? (
              // 특정 시간대를 골랐을 때 후보가 하나도 안 남는 건 흔한 일이라 되돌아갈 길을 같이 준다
              <div className="glass-card p-6 text-center text-sm text-muted-foreground">
                이 시간대에는 예약 가능한 연습실이 없습니다.<br />
                <button onClick={() => setPickedTime(null)} className="mt-2 text-primary font-medium">전체 시간대 보기</button>
              </div>
            ) : (
              <div className="space-y-2">
                {visible.map(({ studio, room, slot }) => (
                  <button
                    key={slot.id}
                    onClick={() => setBooking({ studio, room, slot })}
                    className="w-full glass-card p-4 text-left hover:bg-surface-hover transition-colors active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-semibold">{studio.name} · {room.name}</h3>
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary"><Zap className="w-3 h-3" />즉시예약</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{fmtSlot(slot)} · {slotDuration(slot)}시간</p>
                    {studio.address && <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{studio.address}</p>}
                    <p className="text-xs font-semibold text-primary mt-1">{fmtWon(Math.round(room.hourly_price * slotDuration(slot)))}</p>
                  </button>
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
          originApplicationId={applicationId}
          onClose={() => setBooking(null)}
          onBooked={() => navigate("/profile")}
        />
      )}
    </PageShell>
  );
};

export default FirstRehearsal;
