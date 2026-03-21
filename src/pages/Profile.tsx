import { Settings, ChevronRight, Music, Award, MapPin, Calendar, Edit3, Bell, Shield, HelpCircle, LogOut } from "lucide-react";
import PageShell from "@/components/PageShell";

const instruments = ["기타", "보컬"];
const genres = ["인디록", "팝", "어쿠스틱"];

const menuItems = [
  { icon: Edit3, label: "프로필 수정" },
  { icon: Bell, label: "알림 설정" },
  { icon: Shield, label: "개인정보 보호" },
  { icon: HelpCircle, label: "고객센터" },
];

const stats = [
  { label: "지원", value: "12" },
  { label: "게시글", value: "8" },
  { label: "스크랩", value: "24" },
];

const Profile = () => (
  <PageShell title="프로필">
    {/* Profile Card */}
    <div className="glass-card p-5 mb-4" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) both" }}>
      <div className="flex items-center gap-4 mb-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xl font-bold text-primary">
          김
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold">김재현</h2>
          <p className="text-xs text-muted-foreground mt-0.5">기타리스트 · 서울 마포구</p>
        </div>
        <button className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-surface-hover transition-colors active:scale-95">
          <Settings className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-around py-3 border-y border-border/50">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-lg font-bold tabular-nums">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Instruments & Genres */}
    <div className="glass-card p-4 mb-4" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.08s both" }}>
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Music className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold">악기</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {instruments.map((inst) => (
            <span key={inst} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">
              {inst}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Award className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold">장르</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {genres.map((genre) => (
            <span key={genre} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
              {genre}
            </span>
          ))}
        </div>
      </div>
    </div>

    {/* Activity */}
    <div className="glass-card p-4 mb-4" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.14s both" }}>
      <h3 className="text-xs font-semibold mb-3">최근 활동</h3>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <MapPin className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">사운드팩토리 예약</p>
            <p className="text-[10px] text-muted-foreground">홍대입구역</p>
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">어제</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">밴드 기타리스트 모집 지원</p>
            <p className="text-[10px] text-muted-foreground">홍대 라이브클럽</p>
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">3일 전</span>
        </div>
      </div>
    </div>

    {/* Menu */}
    <div className="glass-card overflow-hidden" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.2s both" }}>
      {menuItems.map(({ icon: Icon, label }, i) => (
        <button
          key={label}
          className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-hover transition-colors active:scale-[0.99] text-left ${
            i < menuItems.length - 1 ? "border-b border-border/40" : ""
          }`}
        >
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium flex-1">{label}</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      ))}
    </div>

    {/* Logout */}
    <button className="w-full mt-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/5 rounded-xl transition-colors active:scale-[0.98]">
      <span className="flex items-center justify-center gap-2">
        <LogOut className="w-4 h-4" />
        로그아웃
      </span>
    </button>
  </PageShell>
);

export default Profile;
