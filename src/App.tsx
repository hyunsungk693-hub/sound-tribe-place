import { useState, useCallback, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import SplashScreen from "@/components/SplashScreen";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import PhoneShell from "@/components/PhoneShell";
import ErrorBoundary from "@/components/ErrorBoundary";

// 처음 그려질 두 화면만 함께 받는다. 나머지는 그 화면에 실제로 갈 때 받는다.
// 한 덩어리로 묶으면 로그인 화면만 보려는 사람도 관리자 지표 차트와 이모지 피커까지
// 전부 내려받는다(합쳐서 gzip 474KB였다). 홈과 로그인만 미리 받아 두는 것은,
// 그 둘은 거의 모든 방문의 첫 화면이라 쪼개면 스플래시 직후에 한 번 더 기다리게 되기 때문이다.
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import NotFound from "./pages/NotFound.tsx";

const Profile = lazy(() => import("./pages/Profile.tsx"));
const Jobs = lazy(() => import("./pages/Jobs.tsx"));
const Rooms = lazy(() => import("./pages/Rooms.tsx"));
const Community = lazy(() => import("./pages/Community.tsx"));
const Messages = lazy(() => import("./pages/Messages.tsx"));
const UserProfile = lazy(() => import("./pages/UserProfile.tsx"));
const PostDetail = lazy(() => import("./pages/PostDetail.tsx"));
const CardView = lazy(() => import("./pages/CardView.tsx"));
const PublicProfile = lazy(() => import("./pages/PublicProfile.tsx"));
const Studios = lazy(() => import("./pages/Studios.tsx"));
const Partner = lazy(() => import("./pages/Partner.tsx"));
const FirstRehearsal = lazy(() => import("./pages/FirstRehearsal.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const Privacy = lazy(() => import("./pages/Privacy.tsx"));

// 화면을 받아오는 동안의 자리. 기존 ProtectedRoute의 대기 표시와 같은 모양이라
// 로그인 확인에서 화면 로딩으로 넘어갈 때 표시가 바뀌지 않는다.
const RouteFallback = () => (
  <div className="min-h-app bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);
const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-app bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const handleSplashFinish = useCallback(() => setShowSplash(false), []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <PhoneShell>
                {/* 경계를 라우터 안에 두는 이유: 밖에 두면 되돌아갈 링크조차 없는 화면이 된다.
                    Suspense는 경계 안이어야 한다 — 화면을 받아오다 실패한 것도 예외로 온다. */}
                <ErrorBoundary>
                <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                  <Route path="/" element={<Index />} />
                  <Route path="/jobs" element={<Jobs />} />
                  <Route path="/rooms" element={<ProtectedRoute><Rooms /></ProtectedRoute>} />
                  <Route path="/shops" element={<ProtectedRoute><Rooms /></ProtectedRoute>} />
                  <Route path="/studios" element={<Studios />} />
                  <Route path="/partner" element={<ProtectedRoute><Partner /></ProtectedRoute>} />
                  <Route path="/first-rehearsal/:applicationId" element={<ProtectedRoute><FirstRehearsal /></ProtectedRoute>} />
                  <Route path="/community" element={<Community />} />
                  <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/post/:postId" element={<ProtectedRoute><PostDetail /></ProtectedRoute>} />
                  <Route path="/profile/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
                  {/* 가입 전에 읽을 수 있어야 하는 문서라 보호하지 않는다 */}
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/u/:handle" element={<PublicProfile />} />
                  <Route path="/u/:handle/card" element={<CardView />} />
                  <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
                </ErrorBoundary>
              </PhoneShell>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
