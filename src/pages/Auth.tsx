import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Music, Mail, Lock, User, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({
          title: "가입 완료!",
          description: "이메일을 확인하여 계정을 인증해주세요.",
        });
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

  const handleSocialLogin = async (provider: "google" | "apple") => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      // If redirected, don't reset loading (page is navigating away)
      if (result.redirected) return;
      if (result.error) {
        console.error("Social login error:", result.error);
        throw result.error;
      }
      // Login successful, navigate
      navigate("/");
    } catch (error: any) {
      console.error("Social login catch:", error);
      toast({
        title: "로그인 오류",
        description: error?.message || "소셜 로그인 중 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
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

        {/* Social Login */}
        <div className="space-y-2.5 mb-6" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both" }}>
          <Button
            variant="outline"
            className="w-full h-12 text-sm font-medium gap-3"
            onClick={() => handleSocialLogin("google")}
            disabled={loading}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Google로 계속하기
          </Button>
          <Button
            variant="outline"
            className="w-full h-12 text-sm font-medium gap-3"
            onClick={() => handleSocialLogin("apple")}
            disabled={loading}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            Apple로 계속하기
          </Button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6" style={{ animation: "reveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.15s both" }}>
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">또는</span>
          <div className="flex-1 h-px bg-border" />
        </div>

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
