-- 카카오 로그인 스위치.
--
-- 다른 플래그와 달리 꺼진 채로 시작한다. 이 기능은 우리 코드만으로 완성되지 않기 때문이다 —
-- 카카오 개발자 콘솔에 앱을 만들고 그 키를 Supabase의 provider 설정에 넣어야 비로소 동작한다.
-- 키가 없는 상태에서 버튼만 보이면 누른 사람은 로그인 실패 화면을 만난다. 가입 첫 화면에서
-- 그런 일이 생기면 그대로 떠난다.
--
-- 바깥 준비가 끝나면 관리자 화면에서 켠다. 배포를 기다릴 일이 아니다.
INSERT INTO public.feature_flags (key, enabled, label, description) VALUES
  ('kakao_login', false, '카카오 로그인',
   '로그인·가입 화면의 카카오 버튼. 카카오 개발자 콘솔 앱 등록과 Supabase provider 설정이 끝난 뒤에 켠다. 그 전에 켜면 눌러도 로그인이 실패한다.')
ON CONFLICT (key) DO NOTHING;
