import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Music, Award, PlayCircle, Sparkles, Clock, Instagram } from "lucide-react";
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
}

// D3 자리: user_stats 집계가 생기면 채워진다. 모수 없는 항목은 null.
export interface ProfileStats {
  response_rate?: number | null;
  sessions_count?: number | null;
  partners_count?: number | null;
  rehire_rate?: number | null;
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

const VideoEmbed = ({ url }: { url: string }) => {
  const [playing, setPlaying] = useState(false);
  const ytId = parseYouTubeId(url);

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
  const trustItems: { label: string; value: string }[] = [];
  if (stats) {
    if (stats.response_rate != null) trustItems.push({ label: "응답률", value: `${Math.round(stats.response_rate * 100)}%` });
    if (stats.sessions_count != null && stats.sessions_count > 0) trustItems.push({ label: "합주", value: `${stats.sessions_count}회` });
    if (stats.partners_count != null && stats.partners_count > 0) trustItems.push({ label: "함께한 음악인", value: `${stats.partners_count}명` });
    if (stats.rehire_rate != null) trustItems.push({ label: "재합주율", value: `${Math.round(stats.rehire_rate * 100)}%` });
  }
  const isNew = trustItems.length === 0;

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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProfileCard;
