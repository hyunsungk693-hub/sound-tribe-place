import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Download, Link2, User, ArrowLeft, Play } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { safeVideoUrl } from "@/lib/safeUrl";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

// dak.gg 카드 페이지처럼: 카드 단독 출력 + 이미지 저장 + 링크 공유
const CardView = () => {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useDocumentTitle(name ? `${name}님의 카드` : null);

  // 버전 파라미터: 프로필·지표가 수정되면 URL이 바뀌어 CDN/브라우저 캐시를 우회한다
  const cardUrl = version
    ? `/api/card-profile?handle=${encodeURIComponent(handle || "")}&v=${encodeURIComponent(version)}`
    : null;

  useEffect(() => {
    if (!handle) { setNotFound(true); return; }
    (async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("user_id, display_name, updated_at, video_url")
        .eq("handle", handle.toLowerCase())
        .maybeSingle();
      if (!data) { setNotFound(true); return; }
      setName(data.display_name || "instrut 음악인");
      setVideoUrl(safeVideoUrl(data.video_url));
      const { data: st } = await (supabase as any)
        .from("user_stats")
        .select("updated_at")
        .eq("user_id", data.user_id)
        .maybeSingle();
      // 프로필/지표 중 더 최근 수정 시각 = 카드 버전
      const times = [data.updated_at, st?.updated_at].filter(Boolean).map((t: string) => new Date(t).getTime());
      setVersion(String(Math.max(...times, 0)));
    })();
  }, [handle]);

  const saveImage = async () => {
    setSaving(true);
    try {
      if (!cardUrl) return;
      const res = await fetch(cardUrl);
      if (!res.ok) throw new Error("card fetch failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `instrut-card-${handle}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("카드 이미지를 저장했습니다");
    } catch {
      toast.error("이미지 저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`https://instrut.vercel.app/u/${handle}/card`);
      toast.success("카드 링크를 복사했습니다");
    } catch {
      toast.error("링크 복사에 실패했습니다");
    }
  };

  if (notFound) {
    return (
      <div className="min-h-app bg-background flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-muted-foreground">존재하지 않는 카드입니다.</p>
        <button onClick={() => navigate("/")} className="px-4 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold active:scale-95 transition-transform">
          instrut 홈으로
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-app bg-secondary/60 flex flex-col items-center px-4 py-8 lg:py-14">
      <div className="w-full max-w-sm flex flex-col items-center gap-5" style={{ paddingTop: "var(--safe-top, 0px)" }}>
        <div className="w-full flex items-center justify-between">
          <button onClick={() => navigate(`/u/${handle}`)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> 프로필
          </button>
          <h1 className="text-sm font-semibold">{name ? `${name}님의 instrut 카드` : "instrut 카드"}</h1>
          <span className="w-14" />
        </div>

        {/* 카드 본체 (서버 렌더 PNG — 저장 파일과 동일한 모습) */}
        <div className="w-full rounded-3xl overflow-hidden shadow-2xl border border-border/40 bg-card" style={{ aspectRatio: "750 / 1050" }}>
          {!imgLoaded && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {cardUrl && <img
            src={cardUrl}
            alt={name ? `${name}님의 instrut 카드` : "instrut 카드"}
            className={`w-full h-full object-cover ${imgLoaded ? "" : "hidden"}`}
            onLoad={() => setImgLoaded(true)}
          />}
        </div>

        <div className="w-full grid grid-cols-2 gap-2.5">
          <button
            onClick={saveImage}
            disabled={saving || !imgLoaded}
            className="h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> {saving ? "저장 중..." : "이미지 저장"}
          </button>
          <button
            onClick={copyLink}
            className="h-12 rounded-xl bg-card border border-border text-sm font-semibold flex items-center justify-center gap-2 hover:bg-surface-hover active:scale-[0.98] transition-all"
          >
            <Link2 className="w-4 h-4" /> 링크 복사
          </button>
        </div>
        {videoUrl && (
          <a
            href={videoUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full h-12 rounded-xl bg-card border border-border text-sm font-semibold flex items-center justify-center gap-2 hover:bg-surface-hover active:scale-[0.98] transition-all"
          >
            <Play className="w-4 h-4 text-primary" /> 연주영상 보기
          </a>
        )}
        <button
          onClick={() => navigate(`/u/${handle}`)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <User className="w-3.5 h-3.5" /> 전체 프로필 보기
        </button>
      </div>
    </div>
  );
};

export default CardView;
