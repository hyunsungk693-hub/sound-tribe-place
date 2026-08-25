import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Music, Mail, Lock, User, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
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

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) both" }}>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Music className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">instrut</h1>
        </div>

        <p className="text-center text-muted-foreground text-sm mb-8" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.05s both" }}>
          {isLogin ? "다시 만나서 반가워요!" : "음악인을 위한 플랫폼에 합류하세요"}
        </p>

        {/* Email Form */}
        <form onSubmit={handleEmailAuth} className="space-y-3" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.2s both" }}>
          {!isLogin && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
      </div>
    </div>
  );
};

export default Auth;
