import { ReactNode } from "react";

// 과거에는 데스크톱에서 폰 프레임을 씌웠으나, PC 반응형 전환 이후에는
// 모든 화면 크기에서 실제 반응형 레이아웃을 그대로 렌더링한다.
const PhoneShell = ({ children }: { children: ReactNode }) => (
  <div className="w-full min-h-app bg-background">{children}</div>
);

export default PhoneShell;
