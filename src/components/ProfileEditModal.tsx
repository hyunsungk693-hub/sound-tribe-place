import { useState, useRef, useMemo } from "react";
import { X, Camera, Search, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProfileData {
  display_name: string | null;
  location: string | null;
  instruments: string[] | null;
  genres: string[] | null;
  bio: string | null;
  avatar_url: string | null;
  video_url?: string | null;
  purpose?: string | null;
  available_times?: string[] | null;
  handle?: string | null;
}

interface Props {
  userId: string;
  profile: ProfileData;
  onClose: () => void;
  onSaved: (updated: ProfileData) => void;
}

const INSTRUMENT_OPTIONS = [
  // 현악기
  "기타", "어쿠스틱 기타", "일렉트릭 기타", "클래식 기타", "베이스", "베이스 기타",
  "바이올린", "비올라", "첼로", "콘트라베이스", "하프", "우쿨렐레", "만돌린", "반조",
  "가야금", "거문고", "해금", "아쟁", "시타르", "에르후",
  // 건반
  "피아노", "키보드", "신디사이저", "오르간", "아코디언", "하모니카",
  // 관악기
  "플루트", "클라리넷", "오보에", "바순", "색소폰", "알토 색소폰", "테너 색소폰",
  "소프라노 색소폰", "바리톤 색소폰", "리코더", "피콜로", "대금", "소금", "단소",
  "트럼펫", "트롬본", "호른", "프렌치 호른", "튜바", "유포니움", "코넷",
  // 타악기
  "드럼", "드럼세트", "카혼", "콩가", "봉고", "젬베", "탬버린", "마림바",
  "실로폰", "비브라폰", "팀파니", "심벌즈", "트라이앵글", "장구", "꽹과리", "북",
  // 보컬/전자
  "보컬", "DJ", "턴테이블", "샘플러", "드럼머신", "MPC",
  // 기타
  "하모니카", "오카리나", "칼림바", "디저리두", "백파이프", "밴드네온",
];
const GENRE_OPTIONS = [
  "록", "팝", "재즈", "클래식", "인디", "R&B", "힙합", "일렉트로닉", "포크", "메탈", "블루스", "펑크",
  "소울", "레게", "컨트리", "얼터너티브", "그런지", "프로그레시브", "퓨전", "보사노바",
  "라틴", "월드뮤직", "앰비언트", "트랩", "디스코", "펑키", "가스펠", "뉴에이지",
  "포스트록", "슈게이징", "트로트", "발라드", "CCM", "국악", "EDM", "하우스", "테크노",
  "드럼앤베이스", "덥스텝", "K-POP", "J-POP", "시티팝",
];

const ProfileEditModal = ({ userId, profile, onClose, onSaved }: Props) => {
  const [displayName, setDisplayName] = useState(profile.display_name || "");
  const [location, setLocation] = useState(profile.location || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [instruments, setInstruments] = useState<string[]>(profile.instruments || []);
  const [genres, setGenres] = useState<string[]>(profile.genres || []);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || "");
  const [videoUrl, setVideoUrl] = useState(profile.video_url || "");
  const [purpose, setPurpose] = useState<string>(profile.purpose || "");
  const [availableTimes, setAvailableTimes] = useState((profile.available_times || []).join(", "));
  const [handle, setHandle] = useState(profile.handle || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [instrumentSearch, setInstrumentSearch] = useState("");
  const [genreSearch, setGenreSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uniqueInstrumentOptions = useMemo(() => [...new Set(INSTRUMENT_OPTIONS)], []);

  const filteredInstruments = useMemo(() => {
    if (!instrumentSearch.trim()) return uniqueInstrumentOptions.filter((i) => !instruments.includes(i)).slice(0, 12);
    const q = instrumentSearch.trim().toLowerCase();
    return uniqueInstrumentOptions.filter((i) => i.toLowerCase().includes(q) && !instruments.includes(i));
  }, [instrumentSearch, instruments, uniqueInstrumentOptions]);

  const addCustomInstrument = () => {
    const name = instrumentSearch.trim();
    if (!name || instruments.includes(name)) return;
    setInstruments([...instruments, name]);
    setInstrumentSearch("");
  };

  const uniqueGenreOptions = useMemo(() => [...new Set(GENRE_OPTIONS)], []);

  const filteredGenres = useMemo(() => {
    if (!genreSearch.trim()) return uniqueGenreOptions.filter((g) => !genres.includes(g)).slice(0, 12);
    const q = genreSearch.trim().toLowerCase();
    return uniqueGenreOptions.filter((g) => g.toLowerCase().includes(q) && !genres.includes(g));
  }, [genreSearch, genres, uniqueGenreOptions]);

  const addCustomGenre = () => {
    const name = genreSearch.trim();
    if (!name || genres.includes(name)) return;
    setGenres([...genres, name]);
    setGenreSearch("");
  };

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드 가능합니다");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("파일 크기는 5MB 이하여야 합니다");
      return;
    }

    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `${userId}/avatar.${fileExt}`;

    const { error } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (error) {
      toast.error("사진 업로드에 실패했습니다");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    setAvatarUrl(newUrl);
    toast.success("사진이 업로드되었습니다");
    setUploading(false);
  };

  const handleSave = async () => {
    if (!displayName.trim()) { toast.error("닉네임을 입력해주세요"); return; }
    if (displayName.length > 50) { toast.error("닉네임은 50자 이내로 입력해주세요"); return; }
    if (bio.length > 300) { toast.error("소개는 300자 이내로 입력해주세요"); return; }
    const trimmedVideo = videoUrl.trim();
    if (trimmedVideo && !/(youtube\.com|youtu\.be|instagram\.com)\//.test(trimmedVideo)) {
      toast.error("연주영상은 YouTube 또는 Instagram 링크만 등록할 수 있습니다");
      return;
    }
    const trimmedHandle = handle.trim().toLowerCase();
    if (trimmedHandle && !/^[a-z0-9-]{3,20}$/.test(trimmedHandle)) {
      toast.error("핸들은 소문자 영문·숫자·하이픈 3~20자로 입력해주세요");
      return;
    }

    setSaving(true);
    const updated: ProfileData = {
      display_name: displayName.trim(),
      location: location.trim() || null,
      bio: bio.trim() || null,
      instruments,
      genres,
      avatar_url: avatarUrl || null,
      video_url: trimmedVideo || null,
      purpose: purpose || null,
      available_times: availableTimes.split(",").map((t) => t.trim()).filter(Boolean),
      handle: trimmedHandle || null,
    };

    const { error } = await supabase
      .from("profiles")
      .update(updated as any)
      .eq("user_id", userId);

    if (error) {
      if (error.code === "23505") {
        toast.error("이미 사용 중인 핸들입니다. 다른 핸들을 입력해주세요");
      } else {
        toast.error("프로필 저장에 실패했습니다");
      }
    } else {
      toast.success("프로필이 저장되었습니다");
      onSaved(updated);
      onClose();
    }
    setSaving(false);
  };

  const initials = (displayName || "U").charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-background rounded-t-2xl lg:rounded-2xl max-h-sheet-lg flex flex-col animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-border/30">
          <h3 className="text-base font-bold">프로필 수정</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative w-20 h-20 rounded-2xl overflow-hidden cursor-pointer group"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-2xl font-bold text-primary">
                  {initials}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-5 h-5 text-white" />
              </div>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-xs text-primary font-medium"
            >
              {uploading ? "업로드 중..." : "사진 변경"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>

          {/* Display Name */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block">닉네임</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="닉네임을 입력하세요"
            />
          </div>

          {/* Location */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block">위치</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={100}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="예: 서울 홍대"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block">소개</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={300}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              placeholder="자신을 소개해주세요"
            />
            <p className="text-[10px] text-muted-foreground text-right mt-1">{bio.length}/300</p>
          </div>

          {/* 연주영상 (A1: 구인 지원에 필수) */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block">
              연주영상 <span className="text-primary">(구인 지원에 필요)</span>
            </label>
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="YouTube 또는 Instagram 영상 링크"
            />
            <p className="text-[10px] text-muted-foreground mt-1">내 연주를 보여줄 수 있는 영상 1개 — 지원할 때 프로필 카드에 함께 표시됩니다</p>
          </div>

          {/* 목적 */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block">활동 목적</label>
            <div className="flex gap-2">
              {[["hobby", "취미"], ["pro", "프로"]].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPurpose(purpose === value ? "" : value)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all active:scale-95 ${
                    purpose === value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-surface-hover"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 합주 가능 시간 */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block">합주 가능 요일/시간</label>
            <input
              value={availableTimes}
              onChange={(e) => setAvailableTimes(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="쉼표로 구분 — 예: 주말 오후, 평일 저녁"
            />
          </div>

          {/* 핸들 */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block">공개 핸들</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase())}
                maxLength={20}
                className="w-full h-10 pl-7 pr-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="소문자 영문·숫자·하이픈 3~20자"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">프로필 공유 주소에 사용됩니다 (추후 /u/핸들)</p>
          </div>

          {/* Instruments */}
          <div>
            <label className="text-xs font-semibold mb-2 block">악기</label>
            {/* Selected instruments */}
            {instruments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {instruments.map((inst) => (
                  <button
                    key={inst}
                    type="button"
                    onClick={() => setInstruments(instruments.filter((i) => i !== inst))}
                    className="text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-primary text-primary-foreground flex items-center gap-1 transition-colors"
                  >
                    {inst}
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}
            {/* Search input */}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={instrumentSearch}
                onChange={(e) => setInstrumentSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addCustomInstrument(); }
                }}
                className="w-full h-9 pl-8 pr-3 rounded-lg border border-input bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="악기 검색 또는 직접 입력 후 Enter"
              />
            </div>
            {/* Suggestions */}
            <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
              {filteredInstruments.map((inst) => (
                <button
                  key={inst}
                  type="button"
                  onClick={() => { setInstruments([...instruments, inst]); setInstrumentSearch(""); }}
                  className="text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-surface-hover transition-colors"
                >
                  {inst}
                </button>
              ))}
              {instrumentSearch.trim() && !uniqueInstrumentOptions.includes(instrumentSearch.trim()) && !instruments.includes(instrumentSearch.trim()) && (
                <button
                  type="button"
                  onClick={addCustomInstrument}
                  className="text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  "{instrumentSearch.trim()}" 추가
                </button>
              )}
              {filteredInstruments.length === 0 && !instrumentSearch.trim() && (
                <p className="text-[10px] text-muted-foreground">모든 악기가 선택되었습니다</p>
              )}
            </div>
          </div>

          {/* Genres */}
          <div>
            <label className="text-xs font-semibold mb-2 block">장르</label>
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {genres.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => setGenres(genres.filter((g) => g !== genre))}
                    className="text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-primary text-primary-foreground flex items-center gap-1 transition-colors"
                  >
                    {genre}
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={genreSearch}
                onChange={(e) => setGenreSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addCustomGenre(); }
                }}
                className="w-full h-9 pl-8 pr-3 rounded-lg border border-input bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="장르 검색 또는 직접 입력 후 Enter"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
              {filteredGenres.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => { setGenres([...genres, genre]); setGenreSearch(""); }}
                  className="text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-surface-hover transition-colors"
                >
                  {genre}
                </button>
              ))}
              {genreSearch.trim() && !uniqueGenreOptions.includes(genreSearch.trim()) && !genres.includes(genreSearch.trim()) && (
                <button
                  type="button"
                  onClick={addCustomGenre}
                  className="text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  "{genreSearch.trim()}" 추가
                </button>
              )}
              {filteredGenres.length === 0 && !genreSearch.trim() && (
                <p className="text-[10px] text-muted-foreground">모든 장르가 선택되었습니다</p>
              )}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="p-5 pt-3 border-t border-border/30">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditModal;
