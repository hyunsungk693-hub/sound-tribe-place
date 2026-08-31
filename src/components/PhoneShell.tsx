import { ReactNode } from "react";
import { useLastSeen } from "@/hooks/useLastSeen";

// 과거에는 데스크톱에서 폰 프레임을 씌웠으나, PC 반응형 전환 이후에는
// 모든 화면 크기에서 실제 반응형 레이아웃을 그대로 렌더링한다.
//
// 접속 하트비트를 여기서 돌린다 — AuthProvider 안이면서 라우트 전체를 감싸는
// 유일한 지점이라, 화면 크기(BottomNav는 lg:hidden, TopNav는 데스크톱 전용)에
// 상관없이 한 번만 돈다.
const PhoneShell = ({ children }: { children: ReactNode }) => {
  useLastSeen();
  return <div className="w-full min-h-app bg-background">{children}</div>;
};

export default PhoneShell;
