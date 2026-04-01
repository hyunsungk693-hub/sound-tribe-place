import { useState, useRef } from "react";
import { X, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProfileData {
  display_name: string | null;
  location: string | null;
  instruments: string[] | null;
  genres: string[] | null;
  bio: string | null;
  avatar_url: string | null;
}

interface Props {
  userId: string;
  profile: ProfileData;
  onClose: () => void;
  onSaved: (updated: ProfileData) => void;
}

const INSTRUMENT_OPTIONS = ["기타", "베이스", "드럼", "키보드", "보컬", "바이올린", "첼로", "플루트", "색소폰", "트럼펫", "피아노", "우쿨렐레"];
const GENRE_OPTIONS = ["록", "팝", "재즈", "클래식", "인디", "R&B", "힙합", "일렉트로닉", "포크", "메탈", "블루스", "펑크"];

const ProfileEditModal = ({ userId, profile, onClose, onSaved }: Props) => {
  const [displayName, setDisplayName] = useState(profile.display_name || "");
  const [location, setLocation] = useState(profile.location || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [instruments, setInstruments] = useState<string[]>(profile.instruments || []);
  const [genres, setGenres] = useState<string[]>(profile.genres || []);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    setSaving(true);
    const updated: ProfileData = {
      display_name: displayName.trim(),
      location: location.trim() || null,
      bio: bio.trim() || null,
      instruments,
      genres,
      avatar_url: avatarUrl || null,
    };

    const { error } = await supabase
      .from("profiles")
      .update(updated)
      .eq("user_id", userId);

    if (error) {
      toast.error("프로필 저장에 실패했습니다");
    } else {
      toast.success("프로필이 저장되었습니다");
      onSaved(updated);
      onClose();
    }
    setSaving(false);
  };

  const initials = (displayName || "U").charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-background rounded-t-2xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-300"
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

          {/* Instruments */}
          <div>
            <label className="text-xs font-semibold mb-2 block">악기</label>
            <div className="flex flex-wrap gap-1.5">
              {INSTRUMENT_OPTIONS.map((inst) => (
                <button
                  key={inst}
                  type="button"
                  onClick={() => toggleItem(instruments, setInstruments, inst)}
                  className={`text-[11px] font-medium px-2.5 py-1.5 rounded-full transition-colors ${
                    instruments.includes(inst)
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-surface-hover"
                  }`}
                >
                  {inst}
                </button>
              ))}
            </div>
          </div>

          {/* Genres */}
          <div>
            <label className="text-xs font-semibold mb-2 block">장르</label>
            <div className="flex flex-wrap gap-1.5">
              {GENRE_OPTIONS.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => toggleItem(genres, setGenres, genre)}
                  className={`text-[11px] font-medium px-2.5 py-1.5 rounded-full transition-colors ${
                    genres.includes(genre)
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-surface-hover"
                  }`}
                >
                  {genre}
                </button>
              ))}
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
