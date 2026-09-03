import { supabase } from "@/integrations/supabase/client";

/**
 * 카카오로 로그인한다.
 *
 * 돌아올 주소를 현재 오리진으로 잡는 이유: 로컬(:8080)과 배포(instrut.vercel.app) 양쪽에서
 * 같은 코드가 돌아야 한다. 이 주소는 Supabase의 additional_redirect_urls에 등록된 것만
 * 허용된다 — 등록되지 않은 곳으로 돌아오려 하면 로그인은 성공했는데 세션 없이 떨어진다.
 *
 * 토큰을 받아 세션으로 바꾸는 일은 supabase-js가 알아서 한다(detectSessionInUrl 기본값).
 * AuthContext의 onAuthStateChange가 그 순간을 잡아 화면을 갱신하므로 여기서 할 일은 없다.
 */
export async function signInWithKakao(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "kakao",
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });
  if (!error) return { error: null };

  // provider가 아직 Supabase에 켜져 있지 않으면 여기로 온다. 사용자에게는 "카카오가
  // 문제"가 아니라 "아직 준비되지 않았다"가 맞는 설명이다 — 다시 눌러도 소용없다.
  const notEnabled = /provider .*not enabled|Unsupported provider/i.test(error.message);
  return {
    error: notEnabled
      ? "카카오 로그인은 아직 준비 중입니다. 이메일로 로그인해주세요."
      : "카카오 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.",
  };
}
