import { Briefcase, MapPin, MessageCircle, Music, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";

const quickActions = [
  { icon: Briefcase, label: "구인구직", desc: "음악 관련 일자리 탐색", path: "/jobs", color: "from-amber-500/20 to-amber-600/5" },
  { icon: MapPin, label: "연습실", desc: "가까운 연습실 찾기", path: "/rooms", color: "from-emerald-500/20 to-emerald-600/5" },
  { icon: MessageCircle, label: "커뮤니티", desc: "음악인과 소통", path: "/community", color: "from-sky-500/20 to-sky-600/5" },
];

const recentJobs = [
  { title: "밴드 기타리스트 모집", venue: "홍대 라이브클럽", tag: "공연" },
  { title: "레코딩 세션 드러머", venue: "강남 스튜디오", tag: "녹음" },
  { title: "웨딩 싱어 구함", venue: "서울 전 지역", tag: "행사" },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <PageShell>
      {/* Hero */}
      <div className="pt-6 pb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center glow-amber">
            <Music className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">instrut</h1>
            <p className="text-xs text-muted-foreground">음악인을 위한 플랫폼</p>
          </div>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          구인구직부터 연습실 탐색, 커뮤니티까지<br />
          음악 활동에 필요한 모든 것을 한 곳에서.
        </p>
      </div>

      {/* Quick Actions */}
      <section className="space-y-3 mb-8" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both" }}>
        {quickActions.map(({ icon: Icon, label, desc, path, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="w-full glass-card p-4 flex items-center gap-4 hover:bg-surface-hover transition-colors duration-200 active:scale-[0.98] text-left"
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shrink-0`}>
              <Icon className="w-5 h-5 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-sm">{label}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </section>

      {/* Recent Jobs */}
      <section style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.25s both" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">최근 구인글</h2>
          <button onClick={() => navigate("/jobs")} className="text-xs text-primary font-medium active:scale-95 transition-transform">
            전체보기
          </button>
        </div>
        <div className="space-y-2">
          {recentJobs.map((job, i) => (
            <div key={i} className="glass-card p-3.5 flex items-center justify-between hover:bg-surface-hover transition-colors duration-200 cursor-pointer active:scale-[0.98]">
              <div>
                <p className="text-sm font-medium">{job.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{job.venue}</p>
              </div>
              <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary shrink-0">
                {job.tag}
              </span>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
};

export default Index;
