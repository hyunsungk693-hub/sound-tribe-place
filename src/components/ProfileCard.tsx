import { useEffect, useState } from "react";
import { safeVideoUrl } from "@/lib/safeUrl";
import { useNavigate } from "react-router-dom";
import { MapPin, Music, Award, PlayCircle, Sparkles, Clock, Instagram, Zap, ShieldCheck, CircleDot, AlertTriangle, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// D1: 앱 전역에서 단일로 사용하는 프로필 카드.
// 정체성 영역(자기신고)과 신뢰 영역(자동 산출)을 분리하며,
// 신뢰 영역은 stats가 있을 때만 렌더한다 (D6: 0회 표시 금지).

export interface ProfileCardData {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  location: string | null;
  instruments: string[] | null;
  genres: string[] | null;
  bio?: string | null;
  video_url?: string | null;
  purpose?: string | null; // 'hobby' | 'pro'
  available_times?: string[] | null;
  handle?: string | null;
  credential_verified?: boolean | null;
  updated_at?: string | null;
}

// D3 자리: user_stats 집계가 생기면 채워진다. 모수 없는 항목은 null.
export interface ProfileStats {
  response_rate?: number | null;
  median_response_h?: number | null;
  sessions_count?: number | null;
  partners_count?: number | null;
  rehire_rate?: number | null;
  no_show_count?: number | null;
  // 작업 2: 집계 테이블에 미리 계산해 둔 등급 (렌더 시점 계산·조회 금지)
  grade?: "trust" | "stable" | "caution" | "unrated" | null;
  positive_rate?: number | null;
  review_count?: number | null;
}

/**
 * 등급 배지 — 신뢰·주의만 배지를 달고 안정은 아무것도 표시하지 않는다.
 * 산정 전(평가 5건 미만)은 "새로 시작하는 음악인"으로 표기한다.
 */
const GRADE_BADGE = {
  trust: { label: "신뢰", icon: ShieldCheck, cls: "bg-signal/15 text-signal" },
  caution: { label: "주의", icon: AlertTriangle, cls: "bg-amber/20 text-amber" },
} as const;

export const GradeBadge = ({ grade, size = "sm" }: { grade?: string | null; size?: "sm" | "md" }) => {
  const meta = grade === "trust" || grade === "caution" ? GRADE_BADGE[grade] : null;
  if (!meta) return null;
  const Icon = meta.icon;
  const box = size === "md" ? "text-[10px] px-2 py-0.5 gap-1" : "text-[9px] px-1.5 py-0.5 gap-0.5";
  return (
    <span className={`flex items-center ${box} font-semibold rounded-full shrink-0 ${meta.cls}`}>
      <Icon className="w-3 h-3" /> {meta.label}
    </span>
  );
};

/**
 * 응답 등급 — 공고주가 받은 지원에 24시간 안에 답한 비율(user_stats.response_rate)을
 * A/B/C로 끊는다. 지원을 넣을지 정하는 순간 "이 사람이 답을 주긴 하는가"가
 * 가장 궁금한 정보라 이름 옆에 붙인다.
 *
 * response_rate는 모수 3건 미만이면 refresh_user_stats가 NULL로 두므로,
 * 표본이 적은 사람에게 섣부른 등급이 붙지 않는다.
 */
const responseGrade = (rate?: number | null) => {
  if (rate == null) return null;
  if (rate >= 0.9) return { label: "응답 A", cls: "bg-signal/15 text-signal" };
  if (rate >= 0.7) return { label: "응답 B", cls: "bg-secondary text-secondary-foreground" };
  return { label: "응답 C", cls: "bg-amber/20 text-amber" };
};

export const ResponseBadge = ({ rate, size = "sm" }: { rate?: number | null; size?: "sm" | "md" }) => {
  const meta = responseGrade(rate);
  if (!meta) return null;
  const box = size === "md" ? "text-[10px] px-2 py-0.5" : "text-[9px] px-1.5 py-0.5";
  return (
    <span
      className={`font-mono font-bold rounded-full shrink-0 ${box} ${meta.cls}`}
      title={`지원에 24시간 내 응답한 비율 ${Math.round((rate as number) * 100)}%`}
    >
      {meta.label}
    </span>
  );
};

/**
 * D4 배지 묶음 — 주의 등급 회복 안내 + 획득한 배지만, 최대 3개.
 * 우선순위 = 인증 완료 > 빠른 응답 > 노쇼 0 > 활동 중 (§3.2 D4)
 *
 * 카드 안에 두면 본인 프로필 화면(/profile)에서는 쓸 수 없다. 그 화면은
 * 카드를 쓰지 않고 별도 마크업으로 아바타·이름만 그리기 때문에, 남이 보는 내
 * 카드에는 붙는 배지가 정작 나에게만 안 보이는 상태였다. 규칙을 두 벌로
 * 만들지 않도록 판정을 이쪽으로 빼서 양쪽이 같은 함수를 부르게 한다.
 */
export const TrustBadges = ({
  profile,
  stats,
}: {
  profile: Pick<ProfileCardData, "credential_verified" | "updated_at"> | null;
  stats?: ProfileStats | null;
}) => {
  const badges: { icon: typeof Zap; label: string }[] = [];
  // 증빙 인증 완료 (작업 8) — 종류는 공개하지 않고 "인증 완료" 여부만 노출
  if (profile?.credential_verified) {
    badges.push({ icon: BadgeCheck, label: "인증 완료" });
  }
  if (stats?.response_rate != null && stats.response_rate >= 0.8) {
    badges.push({ icon: Zap, label: "빠른 응답" });
  }
  if (stats && (stats.no_show_count ?? 0) === 0 && (stats.sessions_count ?? 0) > 0) {
    badges.push({ icon: ShieldCheck, label: "노쇼 0" });
  }
  // "활동 중"은 프로필 갱신 7일 이내를 근사치로 사용 (전 활동 스캔은 목록 비용 과다)
  if (profile?.updated_at && Date.now() - new Date(profile.updated_at).getTime() < 7 * 24 * 3600 * 1000) {
    badges.push({ icon: CircleDot, label: "활동 중" });
  }
  const shown = badges.slice(0, 3);
  const caution = stats?.grade === "caution";
  if (!caution && shown.length === 0) return null;

  return (
    <>
      {/* 주의 등급에는 회복 조건을 함께 알린다 */}
      {caution && (
        <p className="mt-2.5 text-[11px] text-muted-foreground">노쇼 없이 3건 완료 시 해제됩니다</p>
      )}
      {shown.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {shown.map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">
              <Icon className="w-3 h-3" /> {label}
            </span>
          ))}
        </div>
      )}
    </>
  );
};

/**
 * user_stats.median_response_h(지원에 답하기까지 걸린 시간의 중앙값)를 읽을 수 있는 문구로.
 * 숫자를 그대로 쓰면 "0.28시간"·"51시간"처럼 감이 안 오는 값이 나오므로 단위를 바꿔 끊는다.
 */
export function formatResponseHours(h?: number | null): string | null {
  const n = Number(h);
  if (h == null || !Number.isFinite(n) || n < 0) return null;
  if (n < 1) return `${Math.max(1, Math.round(n * 60))}분`;
  if (n < 24) return `${n < 10 ? String(Number(n.toFixed(1))) : Math.round(n)}시간`;
  return `${Math.round(n / 24)}일`;
}

interface Props {
  profile: ProfileCardData | null;
  variant?: "compact" | "full";
  stats?: ProfileStats | null;
  className?: string;
  // 카드 클릭으로 프로필 이동 전에 호출 (모달 닫기 등). false 반환 시 이동 안 함.
  onBeforeNavigate?: () => void;
  clickable?: boolean;
}

// YouTube URL → videoId (watch?v= / youtu.be/ / shorts/ 지원)
export function parseYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/
  );
  return m ? m[1] : null;
}

export function isInstagramUrl(url: string): boolean {
  return /instagram\.com\//.test(url);
}

const purposeLabel = (p?: string | null) =>
  p === "pro" ? "프로" : p === "hobby" ? "취미" : null;

const VideoEmbed = ({ url: rawUrl }: { url: string }) => {
  const [playing, setPlaying] = useState(false);
  // 저장형 XSS 방어: 허용 호스트(YouTube/Instagram)가 아니면 렌더하지 않음
  const url = safeVideoUrl(rawUrl);
  const ytId = url ? parseYouTubeId(url) : null;
  if (!url) return null;

  if (ytId) {
    return (
      <div className="rounded-xl overflow-hidden border border-border/40 aspect-video bg-black/80">
        {playing ? (
          <iframe
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
            title="연주영상"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full border-0"
          />
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setPlaying(true); }}
            className="relative w-full h-full group"
            aria-label="연주영상 재생"
          >
            <img
              src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
              alt="연주영상 썸네일"
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
              <PlayCircle className="w-12 h-12 text-white drop-shadow" />
            </span>
          </button>
        )}
      </div>
    );
  }

  if (isInstagramUrl(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-2.5 p-3 rounded-xl border border-border/60 bg-secondary/50 hover:bg-surface-hover transition-colors"
      >
        <Instagram className="w-5 h-5 text-primary shrink-0" />
        <span className="text-xs font-medium truncate">Instagram에서 연주영상 보기</span>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-2.5 p-3 rounded-xl border border-border/60 bg-secondary/50 hover:bg-surface-hover transition-colors"
    >
      <PlayCircle className="w-5 h-5 text-primary shrink-0" />
      <span className="text-xs font-medium truncate">연주영상 보기</span>
    </a>
  );
};

const ProfileCard = ({ profile, variant = "compact", stats, className = "", onBeforeNavigate, clickable = true }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // D3: full 카드에서 stats를 넘겨받지 못하면 user_stats를 단건 조회한다.
  // compact(목록)는 조회하지 않음 — §5.3 실시간 계산·N+1 금지.
  const [fetchedStats, setFetchedStats] = useState<ProfileStats | null | undefined>(undefined);
  const uid = profile?.user_id;
  useEffect(() => {
    if (variant !== "full" || stats !== undefined || !uid) return;
    let alive = true;
    supabase
      .from("user_stats" as any)
      .select("*")
      .eq("user_id", uid)
      .maybeSingle()
      .then(({ data }) => { if (alive) setFetchedStats((data as ProfileStats | null) ?? null); });
    return () => { alive = false; };
  }, [variant, stats, uid]);
  const effStats = stats !== undefined ? stats : fetchedStats;

  if (!profile) {
    // 삭제된 사용자 등: 자리 유지용 익명 표시
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">?</div>
        <span className="text-sm font-medium text-muted-foreground">알 수 없는 사용자</span>
      </div>
    );
  }

  const name = profile.display_name || "익명";
  const initials = name.charAt(0).toUpperCase();
  const mainInstrument = profile.instruments?.[0] || null;
  const purpose = purposeLabel(profile.purpose);

  const goProfile = () => {
    if (!clickable) return;
    if (onBeforeNavigate) onBeforeNavigate();
    navigate(user?.id === profile.user_id ? "/profile" : `/profile/${profile.user_id}`);
  };

  // 신뢰 영역: 값이 하나라도 있어야 렌더 (없으면 통째로 숨김 — D6)
  // sub는 그 숫자를 어떤 모수로 읽어야 하는지 (라벨만으로는 오해가 생기는 항목에만).
  const trustItems: { label: string; value: string; sub?: string }[] = [];
  if (effStats) {
    if (effStats.response_rate != null) trustItems.push({ label: "응답률", value: `${Math.round(effStats.response_rate * 100)}%` });
    // 응답률이 "답을 주긴 하는가"라면 중앙값은 "얼마나 기다려야 하는가"다. 짝으로 붙인다.
    const median = formatResponseHours(effStats.median_response_h);
    if (median) trustItems.push({ label: "응답까지", value: median, sub: "중앙값" });
    if (effStats.sessions_count != null && effStats.sessions_count > 0) trustItems.push({ label: "합주", value: `${effStats.sessions_count}회` });
    if (effStats.partners_count != null && effStats.partners_count > 0) trustItems.push({ label: "함께한 음악인", value: `${effStats.partners_count}명` });
    if (effStats.rehire_rate != null) trustItems.push({ label: "재합주율", value: `${Math.round(effStats.rehire_rate * 100)}%` });
    // positive_rate는 20260901000016에서 "답한 칸만 분모"로 바뀌었다.
    // "후기의 몇 %가 좋았나"가 아니라 "답한 항목 중 예가 몇 %인가"이므로
    // 모수(review_count = 산정에 쓰인 후기 수)를 함께 적어 뜻을 고정한다.
    if (effStats.positive_rate != null) {
      trustItems.push({
        label: "후기 긍정률",
        value: `${Math.round(effStats.positive_rate * 100)}%`,
        sub: `후기 ${effStats.review_count ?? 0}건 · 답한 항목만`,
      });
    }
  }
  const isNew = effStats?.grade ? effStats.grade === "unrated" : trustItems.length === 0;

  if (variant === "compact") {
    return (
      <div
        onClick={goProfile}
        className={`flex items-center gap-2.5 min-w-0 ${clickable ? "cursor-pointer group" : ""} ${className}`}
      >
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={name} className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`text-sm font-medium truncate ${clickable ? "group-hover:text-primary transition-colors" : ""}`}>{name}</span>
            {purpose && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">{purpose}</span>
            )}
            <ResponseBadge rate={effStats?.response_rate} />
            <GradeBadge grade={effStats?.grade} />
          </div>
          {(mainInstrument || profile.location) && (
            <p className="text-[11px] text-muted-foreground truncate">
              {[mainInstrument, profile.location].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        {profile.video_url && (
          <PlayCircle className="w-4 h-4 text-primary shrink-0" aria-label="연주영상 있음" />
        )}
      </div>
    );
  }

  // full variant
  return (
    <div className={`glass-card p-5 ${className}`}>
      <div
        onClick={goProfile}
        className={`flex items-center gap-4 ${clickable ? "cursor-pointer" : ""}`}
      >
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={name} className="w-16 h-16 rounded-2xl object-cover shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xl font-bold text-primary shrink-0">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold truncate">{name}</h2>
            {purpose && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{purpose}</span>
            )}
            <ResponseBadge rate={effStats?.response_rate} size="md" />
            <GradeBadge grade={effStats?.grade} size="md" />
            {isNew && (
              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                <Sparkles className="w-3 h-3" /> 새로 시작하는 음악인
              </span>
            )}
          </div>
          {profile.handle && (
            <p className="text-[11px] text-primary font-medium mt-0.5">@{profile.handle}</p>
          )}
          {profile.location && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {profile.location}
            </p>
          )}
        </div>
      </div>

      {/* 주의 등급 회복 안내 + D4 배지 (최대 3개) */}
      <TrustBadges profile={profile} stats={effStats} />

      {profile.bio && <p className="text-sm text-muted-foreground mt-3">{profile.bio}</p>}

      {(profile.instruments?.length || 0) > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Music className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold">악기</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {profile.instruments!.map((inst) => (
              <span key={inst} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">{inst}</span>
            ))}
          </div>
        </div>
      )}

      {(profile.genres?.length || 0) > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold">장르</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {profile.genres!.map((g) => (
              <span key={g} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">{g}</span>
            ))}
          </div>
        </div>
      )}

      {(profile.available_times?.length || 0) > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold">합주 가능 시간</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {profile.available_times!.map((t) => (
              <span key={t} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">{t}</span>
            ))}
          </div>
        </div>
      )}

      {profile.video_url && (
        <div className="mt-4">
          <span className="text-xs font-semibold mb-2 block">연주영상</span>
          <VideoEmbed url={profile.video_url} />
        </div>
      )}

      {/* 신뢰 영역(D3): 자동 산출값이 있을 때만 표시 */}
      {trustItems.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/40 grid grid-cols-2 gap-2">
          {trustItems.map((t) => (
            <div key={t.label} className="text-center py-1.5 rounded-lg bg-secondary/50">
              <p className="text-sm font-bold text-primary">{t.value}</p>
              <p className="text-[10px] text-muted-foreground">{t.label}</p>
              {t.sub && <p className="text-[9px] text-muted-foreground/70 leading-tight">{t.sub}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProfileCard;
