import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { signInWithKakao } from "@/lib/oauth";
import { useFeature } from "@/hooks/useFeatureFlags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const kakao = useFeature("kakao_login");
  const navigate = useNavigate();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        track("signup");
        if (data.session) {
          // 이메일 인증 비활성 상태: 즉시 로그인됨
          toast({ title: "가입 완료!", description: "환영합니다 🎵" });
          navigate("/");
        } else {
          toast({
            title: "가입 완료!",
            description: "이메일을 확인하여 계정을 인증해주세요.",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "오류",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 성공하면 이 페이지를 떠나므로 kakaoLoading을 되돌릴 일이 없다. 실패했을 때만 되돌린다 —
  // 카카오로 넘어가는 사이에 버튼이 다시 눌리는 것을 막아야 인증 창이 두 번 뜨지 않는다.
  const handleKakao = async () => {
    setKakaoLoading(true);
    const { error } = await signInWithKakao();
    if (error) {
      toast({ title: "카카오 로그인", description: error, variant: "destructive" });
      setKakaoLoading(false);
    }
  };

  return (
    <div className="min-h-app bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) both" }}>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">instrut<span className="text-primary">.</span></h1>
        </div>

        <p className="text-center text-muted-foreground text-sm mb-8" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.05s both" }}>
          {isLogin ? "다시 만나서 반가워요!" : "음악인을 위한 플랫폼에 합류하세요"}
        </p>

        {/* 카카오 로그인.
            켜져 있을 때만 그린다. 꺼진 채로 두는 것은 카카오 개발자 콘솔 앱 등록과
            Supabase provider 설정이 끝나기 전이기 때문이다 — 그때 버튼을 보여주면
            누르는 사람은 가입 첫 화면에서 실패만 만난다. 비활성 버튼으로 남기지도
            않는다: 눌리지 않는 소셜 버튼은 "이 서비스는 카카오를 지원하는데 지금
            고장났다"로 읽힌다. 준비되기 전에는 없는 편이 정직하다.
            읽는 동안(loading)에도 그리지 않는다. 이 값이 기본 true라 잠깐 나타났다
            사라지면 그 깜빡임이 곧 오작동으로 보인다. */}
        {kakao.on && !kakao.loading && (
          <div className="mb-6" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both" }}>
            <button
              type="button"
              onClick={handleKakao}
              disabled={kakaoLoading || loading}
              // 카카오 지정 색이다. 앱의 파스텔 팔레트와 어긋나 보이지만, 소셜 버튼은
              // 브랜드 색으로 알아보게 하는 것이 규정이자 사용자에게도 빠르다.
              className="w-full h-12 rounded-xl bg-[#FEE500] text-[rgba(0,0,0,0.85)] text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.96] transition-transform"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="w-[18px] h-[18px] fill-current">
                <path d="M12 3C6.477 3 2 6.463 2 10.735c0 2.746 1.82 5.155 4.56 6.518-.15.54-.966 3.48-.996 3.71 0 0-.02.17.09.235.11.065.24.015.24.015.31-.043 3.6-2.353 4.17-2.753.63.09 1.28.135 1.936.135 5.523 0 10-3.463 10-7.735S17.523 3 12 3z" />
              </svg>
              {kakaoLoading ? "카카오로 이동 중..." : "카카오로 시작하기"}
            </button>
            <div className="flex items-center gap-3 mt-6">
              <div className="h-px flex-1 bg-border" />
              <span className="mono-label text-[10px] text-muted-foreground">또는 이메일로</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </div>
        )}

        {/* Email Form */}
        <form onSubmit={handleEmailAuth} className="space-y-3" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.2s both" }}>
          {!isLogin && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                enterKeyHint="next"
                className="pl-10 h-12"
                required={!isLogin}
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              enterKeyHint="next"
              className="pl-10 h-12"
              required
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              // 로그인과 가입을 한 화면에서 오가므로 모드에 따라 값을 바꾼다. 가입인데
              // current-password면 비밀번호 관리자가 "저장할까요"를 띄우지 않고, 로그인인데
              // new-password면 이미 저장된 비밀번호를 채워주지 않는다.
              autoComplete={isLogin ? "current-password" : "new-password"}
              // 비밀번호는 폼의 마지막 칸이라 다음 칸이 아니라 제출로 이어진다.
              enterKeyHint="go"
              className="pl-10 h-12"
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full h-12 text-sm font-semibold gap-2" disabled={loading}>
            {isLogin ? "로그인" : "가입하기"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>

        {/* Toggle */}
        <p className="text-center text-sm text-muted-foreground mt-6" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.25s both" }}>
          {isLogin ? "아직 계정이 없나요?" : "이미 계정이 있나요?"}{" "}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary font-semibold hover:underline"
          >
            {isLogin ? "가입하기" : "로그인"}
          </button>
        </p>

        {/* 가입 전에 읽을 수 있어야 해서 여기 둔다. /privacy는 App.tsx에서 ProtectedRoute 밖에
            있으므로 계정 없이도 열린다 — 무엇을 내주게 되는지 확인한 뒤에 결정할 수 있어야 한다.
            동의 체크박스로 만들지 않는다: 동의 여부를 기록하는 코드가 없는데 체크박스를 두면
            "동의를 받았다"는 형식만 남고 근거는 남지 않는다. 있지도 않은 절차를 흉내내느니
            읽을 길만 확실히 열어 둔다. 로그인 모드에서도 감추지 않는다 — 이미 가입한 사람이
            방침을 다시 찾을 곳이 프로필 안쪽 메뉴뿐이면 사실상 못 찾는 것과 같다. */}
        <p
          className="text-center text-xs text-muted-foreground mt-8"
          style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.3s both" }}
        >
          <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground transition-colors">
            개인정보처리방침
          </Link>
          <span className="mx-1.5 text-border">·</span>
          무엇을 저장하는지 먼저 확인할 수 있습니다
        </p>
      </div>
    </div>
  );
};

export default Auth;
